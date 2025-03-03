// src/server/services/resumeProcessingPipeline.js
const { processResume } = require('./resumeProcessor');
const { analyzeResume } = require('./resumeAnalyzer');
const { supabaseAdmin } = require('../config/database_connection');

/**
 * Process a resume from upload to analysis
 * @param {string} resumeId - The ID of the resume to process
 * @returns {Promise<Object>} - Result of the processing
 */
async function processAndAnalyzeResume(resumeId) {
    try {
        console.log(`Starting end-to-end processing for resume ID: ${resumeId}`);

        // Step 1: Extract text
        console.log(`Step 1: Extracting text for resume ID: ${resumeId}`);
        const extractionResult = await processResume(resumeId);

        if (!extractionResult.success) {
            console.error(`Text extraction failed for resume ID: ${resumeId}`);
            return {
                success: false,
                phase: 'extraction',
                error: extractionResult.error,
                resumeId
            };
        }

        console.log(`Text extraction succeeded for resume ID: ${resumeId}`);

        // Step 2: Analyze with AI
        console.log(`Step 2: Analyzing text with AI for resume ID: ${resumeId}`);
        const analysisResult = await analyzeResume(resumeId);

        if (!analysisResult.success) {
            console.error(`AI analysis failed for resume ID: ${resumeId}`);
            return {
                success: false,
                phase: 'analysis',
                error: analysisResult.error,
                resumeId
            };
        }

        console.log(`AI analysis succeeded for resume ID: ${resumeId}`);

        // Step 3: Final status update
        console.log(`Step 3: Updating final status for resume ID: ${resumeId}`);
        await supabaseAdmin
            .from('resumes')
            .update({
                status: 'completed',
                processing_completed_at: new Date().toISOString()
            })
            .eq('id', resumeId);

        return {
            success: true,
            resumeId,
            message: 'Resume processing and analysis completed successfully'
        };
    } catch (error) {
        console.error(`Error in end-to-end processing for resume ID: ${resumeId}:`, error);

        // Update resume status to failed
        try {
            await supabaseAdmin
                .from('resumes')
                .update({
                    status: 'processing_failed',
                    processing_error: error.message || 'Unknown error during processing'
                })
                .eq('id', resumeId);
        } catch (updateError) {
            console.error('Failed to update status after processing error:', updateError);
        }

        return {
            success: false,
            resumeId,
            error: error.message || 'Unknown error during end-to-end processing'
        };
    }
}

/**
 * Reprocess and analyze a resume
 * @param {string} resumeId - The ID of the resume to reprocess
 * @returns {Promise<Object>} - Result of the processing
 */
async function reprocessAndAnalyzeResume(resumeId) {
    try {
        // Update status to reprocessing
        await supabaseAdmin
            .from('resumes')
            .update({ status: 'reprocessing' })
            .eq('id', resumeId);

        // Delete existing parsed data and analysis
        await supabaseAdmin
            .from('resume_parsed_data')
            .delete()
            .eq('resume_id', resumeId);

        await supabaseAdmin
            .from('resume_analysis')
            .delete()
            .eq('resume_id', resumeId);

        // Run the full pipeline
        return await processAndAnalyzeResume(resumeId);
    } catch (error) {
        console.error(`Error reprocessing resume ID: ${resumeId}:`, error);
        return {
            success: false,
            resumeId,
            error: error.message || 'Unknown error during resume reprocessing'
        };
    }
}

/**
 * Process all pending resumes from upload to analysis
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
                const result = await processAndAnalyzeResume(resume.id);

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
    processAndAnalyzeResume,
    reprocessAndAnalyzeResume,
    processAllPendingResumes
};