// src/pages/api/process-resume.js
import { supabase, supabaseAdmin } from '@/server/config/database_connection';
import { processResume } from '@/server/services/resumeParser';
import { handleExtractionError } from '@/server/services/extractionErrorHandler';

export default async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({
            success: false,
            error: 'Method not allowed',
            allowedMethods: ['POST']
        });
    }

    try {
        const { resumeId, force = false } = req.body;

        // Validate input
        if (!resumeId) {
            return res.status(400).json({
                success: false,
                error: 'Resume ID is required'
            });
        }

        // Get resume data
        const { data: resume, error: resumeError } = await supabaseAdmin
            .from('resumes')
            .select('*')
            .eq('id', resumeId)
            .single();

        if (resumeError) {
            return res.status(404).json({
                success: false,
                error: 'Resume not found',
                details: resumeError.message
            });
        }

        // If not forcing reprocess, check if already processed
        if (!force) {
            const { data: existingData } = await supabaseAdmin
                .from('resume_parsed_data')
                .select('id')
                .eq('resume_id', resumeId)
                .maybeSingle();

            if (existingData) {
                return res.status(200).json({
                    success: true,
                    message: 'Resume already processed',
                    resumeId,
                    alreadyProcessed: true
                });
            }
        }

        // Update status to processing
        await supabaseAdmin
            .from('resumes')
            .update({
                status: 'parsing',
                last_processed_at: new Date().toISOString()
            })
            .eq('id', resumeId);

        // Start the processing in the background
        processResumeInBackground(resumeId, resume.file_path, resume.file_type)
            .then(result => {
                console.log(`Background processing completed for resume ${resumeId}:`, result.success);
            })
            .catch(error => {
                console.error(`Error in background processing for resume ${resumeId}:`, error);
            });

        return res.status(200).json({
            success: true,
            message: 'Resume processing started',
            resumeId,
            background: true
        });
    } catch (error) {
        console.error('API Error in process-resume:', error);

        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message || 'Unknown error occurred'
        });
    }
}

async function processResumeInBackground(resumeId, filePath, fileType) {
    try {
        // Download the file
        const { data: fileData, error: fileError } = await supabaseAdmin.storage
            .from('resumes')
            .download(filePath);

        if (fileError) {
            const errorInfo = handleExtractionError(fileError, 'file-download');
            await updateResumeStatus(resumeId, 'failed', errorInfo.userMessage);
            return { success: false, error: errorInfo };
        }

        // Process the file
        const processingResult = await processResume(fileData, filePath, fileType);

        if (!processingResult.success) {
            const errorInfo = handleExtractionError(
                new Error(processingResult.errorDetails),
                'processing'
            );
            await updateResumeStatus(resumeId, 'failed', errorInfo.userMessage);
            return { success: false, error: errorInfo };
        }

        // Store the parsed data
        const { error: insertError } = await supabaseAdmin
            .from('resume_parsed_data')
            .insert([{
                resume_id: resumeId,
                raw_text: processingResult.rawText,
                parsed_data: processingResult.parsedData,
                metadata: processingResult.metadata || {},
                warnings: processingResult.validation?.warnings || [],
                processed_at: new Date().toISOString()
            }]);

        if (insertError) {
            console.error('Error storing parsed data:', insertError);
            await updateResumeStatus(resumeId, 'failed', 'Failed to store parsed data');
            return { success: false, error: insertError.message };
        }

        // Update resume status
        await updateResumeStatus(resumeId, 'parsed');

        return {
            success: true,
            resumeId,
            message: 'Resume processed successfully'
        };
    } catch (error) {
        console.error('Background processing error:', error);
        await updateResumeStatus(resumeId, 'failed', error.message);
        return { success: false, error: error.message };
    }
}

async function updateResumeStatus(resumeId, status, errorMessage = null) {
    const updateData = {
        status,
        last_processed_at: new Date().toISOString()
    };

    if (errorMessage) {
        updateData.processing_error = errorMessage;
    } else {
        updateData.processing_error = null;
    }

    return await supabaseAdmin
        .from('resumes')
        .update(updateData)
        .eq('id', resumeId);
}