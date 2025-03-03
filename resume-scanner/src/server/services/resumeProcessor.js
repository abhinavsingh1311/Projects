// src/server/services/resumeProcessor.js
const { extractText, identifyFileType } = require('./textExtractor');
const { supabase, supabaseAdmin } = require('../config/database_connection');

/**
 * Process a resume: extract text and update status
 * @param {string} resumeId - The ID of the resume to process
 * @returns {Promise<Object>} - Result of the processing
 */
async function processResume(resumeId) {
    console.log(`Starting processing for resume ID: ${resumeId}`);

    try {
        // 1. Get the resume data
        const { data: resume, error: resumeError } = await supabaseAdmin
            .from('resumes')
            .select('*')
            .eq('id', resumeId)
            .single();

        if (resumeError) {
            console.error('Error fetching resume:', resumeError);
            throw new Error(`Failed to fetch resume: ${resumeError.message}`);
        }

        if (!resume) {
            throw new Error(`Resume with ID ${resumeId} not found`);
        }

        // 2. Update status to parsing
        const { error: updateError } = await supabaseAdmin
            .from('resumes')
            .update({ status: 'parsing' })
            .eq('id', resumeId);

        if (updateError) {
            console.error('Error updating resume status:', updateError);
            throw new Error(`Failed to update resume status: ${updateError.message}`);
        }

        console.log(`Updated resume ${resumeId} status to parsing`);

        // 3. Download the file from storage
        const { data: fileData, error: fileError } = await supabaseAdmin.storage
            .from('resumes')
            .download(resume.file_path);

        if (fileError) {
            console.error('Error downloading file:', fileError);
            throw new Error(`Failed to download resume file: ${fileError.message}`);
        }

        console.log(`Downloaded resume file from path: ${resume.file_path}`);

        // 4. Extract text from the file
        const fileType = resume.file_type || identifyFileType(resume.file_path);

        if (!fileType) {
            throw new Error('Could not determine file type for text extraction');
        }

        console.log(`Extracting text from ${fileType} file...`);

        const { text, metadata } = await extractText(fileData, fileType, resume.file_path);

        console.log(`Text extraction complete. Extracted ${text.length} characters`);

        // 5. Store the extracted text in the database
        const { error: insertError } = await supabaseAdmin
            .from('resume_parsed_data')
            .insert([{
                resume_id: resumeId,
                raw_text: text,
                metadata: metadata || {},
                processed_at: new Date().toISOString()
            }]);

        if (insertError) {
            console.error('Error storing parsed data:', insertError);
            throw new Error(`Failed to store parsed resume data: ${insertError.message}`);
        }

        console.log(`Stored parsed data for resume ${resumeId}`);

        // 6. Update resume status to indicate successful parsing
        const { error: finalUpdateError } = await supabaseAdmin
            .from('resumes')
            .update({
                status: 'parsed',
                last_processed_at: new Date().toISOString()
            })
            .eq('id', resumeId);

        if (finalUpdateError) {
            console.error('Error updating final status:', finalUpdateError);
            throw new Error(`Failed to update final resume status: ${finalUpdateError.message}`);
        }

        console.log(`Processing completed successfully for resume ${resumeId}`);

        return {
            success: true,
            resumeId,
            textLength: text.length,
            message: 'Resume processed successfully'
        };

    } catch (error) {
        console.error(`Error processing resume ${resumeId}:`, error);

        // Update resume status to failed
        try {
            await supabaseAdmin
                .from('resumes')
                .update({
                    status: 'failed',
                    last_processed_at: new Date().toISOString(),
                    processing_error: error.message
                })
                .eq('id', resumeId);
        } catch (updateError) {
            console.error('Failed to update status to failed:', updateError);
        }

        return {
            success: false,
            resumeId,
            error: error.message || 'Unknown error during resume processing'
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

/**
 * Reprocess a resume even if it was processed before
 * @param {string} resumeId - The ID of the resume to reprocess
 * @returns {Promise<Object>} - Result of the processing
 */
async function reprocessResume(resumeId) {
    try {
        // Delete existing parsed data if any
        await supabaseAdmin
            .from('resume_parsed_data')
            .delete()
            .eq('resume_id', resumeId);

        // Process the resume
        return await processResume(resumeId);
    } catch (error) {
        console.error('Error reprocessing resume:', error);
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

module.exports = {
    processResume,
    reprocessResume,
    doesResumeNeedProcessing,
    processAllPendingResumes
};