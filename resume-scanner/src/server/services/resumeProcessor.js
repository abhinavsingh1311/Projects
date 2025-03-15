// src/server/services/resumeProcessor.js
const { extractText,extractTextWithValidation, identifyFileType } = require('./textExtractor');
const { supabase, supabaseAdmin } = require('../config/database_connection');
const {handleExtractionError,recordExtractionError} = require('@/server/services/extractionErrorHandler');
/**
 * Process a resume: extract text and update status
 * @param {string} resumeId - The ID of the resume to process
 * @returns {Promise<Object>} - Result of the processing
 */

async function processResume(resumeId) {
    console.log(`Starting processing for resume ID: ${resumeId}`);

    try {
        // Update status to processing
        await updateResumeStatus(resumeId, 'parsing');

        // Get the resume data
        const { data: resume, error: resumeError } = await supabaseAdmin
            .from('resumes')
            .select('*')
            .eq('id', resumeId)
            .single();

        if (resumeError) {
            const errorInfo = handleExtractionError(resumeError, 'database-fetch');
            await updateResumeStatus(resumeId, 'failed', errorInfo.userMessage);
            await recordExtractionError(resumeId, errorInfo);
            return { success: false, error: errorInfo };
        }

        // Download the file
        const { data: fileData, error: fileError } = await supabaseAdmin.storage
            .from('resumes')
            .download(resume.file_path);

        if (fileError) {
            const errorInfo = handleExtractionError(fileError, 'file-download');
            await updateResumeStatus(resumeId, 'failed', errorInfo.userMessage);
            await recordExtractionError(resumeId, errorInfo);
            return { success: false, error: errorInfo };
        }

        // Extract and validate text
        const extractionResult = await extractTextWithValidation(
            fileData,
            resume.file_type,
            resume.file_path
        );

        if (!extractionResult.success) {
            const errorInfo = handleExtractionError(
                new Error(extractionResult.errorDetails),
                'text-extraction'
            );
            await updateResumeStatus(resumeId, 'failed', errorInfo.userMessage);
            await recordExtractionError(resumeId, errorInfo);
            return { success: false, error: errorInfo };
        }

        // Check for warnings that might indicate poor extraction
        const hasWarnings = extractionResult.validation &&
            extractionResult.validation.warnings &&
            extractionResult.validation.warnings.length > 0;

        // Store the extracted text
        await storeExtractedText(
            resumeId,
            extractionResult.text,
            extractionResult.metadata,
            hasWarnings ? extractionResult.validation.warnings : []
        );

        // Update resume status
        const finalStatus = hasWarnings ? 'parsed_with_warnings' : 'parsed';
        await updateResumeStatus(resumeId, finalStatus);

        return {
            success: true,
            resumeId,
            textLength: extractionResult.text.length,
            hasWarnings,
            warnings: hasWarnings ? extractionResult.validation.warnings : [],
            status: finalStatus
        };

    } catch (error) {
        // Handle any uncaught errors
        const errorInfo = handleExtractionError(error, 'unknown');
        await updateResumeStatus(resumeId, 'failed', errorInfo.userMessage);
        await recordExtractionError(resumeId, errorInfo);

        return {
            success: false,
            error: errorInfo
        };
    }
}

/**
 * Check if a resume needs processing
 * @param {string} resumeId - The ID of the resume to check
 * @returns {Promise<boolean>} - Whether the resume needs processing
 */
async function doesResumeNeedProcessing(resumeId) {
    try {
        // Check if resume exists and has appropriate status
        const { data: resume, error: resumeError } = await supabaseAdmin
            .from('resumes')
            .select('status')
            .eq('id', resumeId)
            .single();

        if (resumeError) throw resumeError;

        // Check if already processed
        if (['parsed', 'analyzed', 'failed'].includes(resume.status)) {
            return false;
        }

        // Check if already has parsed data
        const { data: existingData, error: dataError } = await supabaseAdmin
            .from('resume_parsed_data')
            .select('id')
            .eq('resume_id', resumeId)
            .maybeSingle();

        if (dataError && dataError.code !== 'PGRST116') throw dataError;

        // If already has parsed data, don't process again
        return !existingData;

    } catch (error) {
        console.error('Error checking resume processing status:', error);
        // If error occurs, assume we need to process to be safe
        return true;
    }
}


async function reprocessResume(resumeId) {
    try {
        console.log(`Starting reprocessing for resume ID: ${resumeId}`);

        // Delete existing parsed data if any
        await supabaseAdmin
            .from('resume_parsed_data')
            .delete()
            .eq('resume_id', resumeId);

        // Get the resume data to access the file path
        const { data: resume, error: resumeError } = await supabaseAdmin
            .from('resumes')
            .select('*')
            .eq('id', resumeId)
            .single();

        if (resumeError) {
            throw new Error(`Failed to fetch resume data: ${resumeError.message}`);
        }

        // Ensure we're getting a fresh copy of the file
        console.log(`Downloading file from ${resume.file_path}`);
        const { data: fileData, error: fileError } = await supabaseAdmin.storage
            .from('resumes')
            .download(resume.file_path);

        if (fileError) {
            throw new Error(`Failed to download file: ${fileError.message}`);
        }

        // Convert to proper Buffer before continuing
        const arrayBuffer = await fileData.arrayBuffer();
        const fileBuffer = Buffer.from(arrayBuffer);

        // Update status to processing
        await updateResumeStatus(resumeId, 'parsing');

        // Extract and validate text with the properly formatted buffer
        const extractionResult = await extractTextWithValidation(
            fileBuffer,
            resume.file_type,
            resume.file_path
        );

        if (!extractionResult.success) {
            const errorInfo = handleExtractionError(
                new Error(extractionResult.errorDetails),
                'text-extraction'
            );
            await updateResumeStatus(resumeId, 'failed', errorInfo.userMessage);
            return { success: false, error: errorInfo };
        }

        // Store the extracted text
        await storeExtractedText(
            resumeId,
            extractionResult.text,
            extractionResult.metadata,
            extractionResult.validation?.warnings || []
        );

        // Update resume status
        const finalStatus = extractionResult.validation?.warnings?.length > 0 ?
            'parsed_with_warnings' : 'parsed';
        await updateResumeStatus(resumeId, finalStatus);

        return {
            success: true,
            resumeId,
            status: finalStatus
        };
    } catch (error) {
        console.error('Error reprocessing resume:', error);

        // Update status to failed
        await updateResumeStatus(resumeId, 'failed', error.message || 'Unknown error during reprocessing');

        return {
            success: false,
            resumeId,
            error: error.message || 'Unknown error during resume reprocessing'
        };
    }
}

/**
 * Process all unprocessed resumes in the database
 * @returns {Promise<Object>} - Processing results
 */
async function processAllPendingResumes() {
    try {
        // Find all resumes with status 'uploaded'
        const { data: pendingResumes, error: fetchError } = await supabaseAdmin
            .from('resumes')
            .select('id')
            .eq('status', 'uploaded');

        if (fetchError) throw fetchError;

        console.log(`Found ${pendingResumes.length} pending resumes to process`);

        const results = {
            total: pendingResumes.length,
            successful: 0,
            failed: 0,
            details: []
        };

        // Process each resume
        for (const resume of pendingResumes) {
            try {
                const result = await processResume(resume.id);

                if (result.success) {
                    results.successful++;
                } else {
                    results.failed++;
                }

                results.details.push(result);

            } catch (error) {
                results.failed++;
                results.details.push({
                    success: false,
                    resumeId: resume.id,
                    error: error.message || 'Unknown error'
                });
            }
        }

        return results;

    } catch (error) {
        console.error('Error processing pending resumes:', error);
        return {
            success: false,
            error: error.message || 'Unknown error processing pending resumes'
        };
    }
}

/**
 * Updates resume status with error handling
 */
async function updateResumeStatus(resumeId, status, errorMessage = null) {
    try {
        const updateData = {
            status,
            last_processed_at: new Date().toISOString()
        };

        if (errorMessage) {
            updateData.processing_error = errorMessage;
        } else {
            // Clear any previous errors if successful
            updateData.processing_error = null;
        }

        const { error } = await supabaseAdmin
            .from('resumes')
            .update(updateData)
            .eq('id', resumeId);

        if (error) {
            console.error(`Failed to update resume status to ${status}:`, error);
            return false;
        }

        return true;
    } catch (error) {
        console.error(`Exception updating resume status to ${status}:`, error);
        return false;
    }
}

/**
 * Stores extracted text in database with error handling
 */
async function storeExtractedText(resumeId, text, metadata, warnings = []) {
    try {
        // Import the parser
        const { parseResumeText } = require('./resumeParser');

        // Parse the extracted text to get structured data
        let parsedData = {};
        try {
            parsedData = parseResumeText(text);
            console.log('Resume text parsed successfully');
        } catch (parseError) {
            console.error('Error parsing resume text:', parseError);
            // Create a minimal valid object if parsing fails
            parsedData = {
                contactInfo: {},
                skills: [],
                sections: {
                    header: text.substring(0, 200) // Just include the first portion as header
                },
                rawText: text
            };
        }

        // First delete any existing record
        const { error: deleteError } = await supabaseAdmin
            .from('resume_parsed_data')
            .delete()
            .eq('resume_id', resumeId);

        if (deleteError) {
            console.warn('Warning when deleting existing parsed data:', deleteError);
            // Continue anyway - it might not exist
        }

        // Then insert the new record
        const { error } = await supabaseAdmin
            .from('resume_parsed_data')
            .insert([{
                resume_id: resumeId,
                raw_text: text,
                parsed_data: parsedData,
                metadata: metadata || {},
                warnings: warnings || [],
                processed_at: new Date().toISOString()
            }]);

        if (error) {
            console.error('Failed to store extracted text:', error);
            throw error;
        }

        return true;
    } catch (error) {
        console.error('Exception storing extracted text:', error);
        throw error;
    }
}

module.exports = {
    processResume,
    reprocessResume,
    doesResumeNeedProcessing,
    processAllPendingResumes,
    updateResumeStatus,
    storeExtractedText
};