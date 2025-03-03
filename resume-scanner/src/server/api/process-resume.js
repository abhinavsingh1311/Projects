// src/pages/api/process-resume.js
import { supabase, supabaseAdmin, hasAdminAccess } from '@/server/config/database_connection';
import { processResume } from '@/server/services/resumeParser';
import { handleExtractionError, recordExtractionError, hasRecentErrors } from '@/server/services/extractionErrorHandler';

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

        // Authenticate user
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required',
                details: authError?.message || 'User not authenticated'
            });
        }

        // Get resume data
        const { data: resume, error: resumeError } = await supabaseAdmin
            .from('resumes')
            .select('*, user_id')
            .eq('id', resumeId)
            .single();

        if (resumeError) {
            return res.status(404).json({
                success: false,
                error: 'Resume not found',
                details: resumeError.message
            });
        }

        // Verify ownership (make sure the user owns this resume)
        if (resume.user_id !== user.id) {
            return res.status(403).json({
                success: false,
                error: 'Permission denied',
                details: 'You do not have permission to process this resume'
            });
        }

        // Check for too many recent errors to prevent repetitive failures
        if (!force && await hasRecentErrors(resumeId, 'processing', 10)) {
            return res.status(429).json({
                success: false,
                error: 'Too many recent failures',
                details: 'This resume has failed processing multiple times recently. Wait a few minutes or try with a different file.',
                waitTime: '10 minutes'
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
                last_processed_at: new Date().toISOString(),
                processing_error: null // Clear any previous errors
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
            background: true,
            statusEndpoint: `/api/resumes/${resumeId}/status` // Let the client know where to check status
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

/**
 * Background processing function with improved error handling and retries
 */
async function processResumeInBackground(resumeId, filePath, fileType) {
    let retryCount = 0;
    const maxRetries = 2;

    // Function to try processing with exponential backoff
    async function attemptProcessing() {
        try {
            // Download the file
            const { data: fileData, error: fileError } = await supabaseAdmin.storage
                .from('resumes')
                .download(filePath);

            if (fileError) {
                const errorInfo = handleExtractionError(fileError, 'file-download');
                await updateResumeStatus(resumeId, 'failed', errorInfo.userMessage);
                await recordExtractionError(resumeId, errorInfo);
                return { success: false, error: errorInfo };
            }

            // Process the file
            const processingResult = await processResume(fileData, filePath, fileType);

            if (!processingResult.success) {
                const errorInfo = handleExtractionError(
                    new Error(processingResult.errorDetails),
                    'processing'
                );

                // Determine if we should retry
                if (retryCount < maxRetries && isRetryableError(processingResult.errorType)) {
                    retryCount++;
                    const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff
                    console.log(`Retrying process for resume ${resumeId} (attempt ${retryCount}) in ${delay}ms...`);

                    await new Promise(resolve => setTimeout(resolve, delay));
                    return attemptProcessing();
                }

                await updateResumeStatus(resumeId, 'failed', errorInfo.userMessage);
                await recordExtractionError(resumeId, errorInfo);
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
                    confidence: processingResult.confidence || {},
                    warnings: processingResult.validation?.warnings || [],
                    processed_at: new Date().toISOString()
                }]);

            if (insertError) {
                console.error('Error storing parsed data:', insertError);
                const errorInfo = handleExtractionError(insertError, 'database-storage');
                await updateResumeStatus(resumeId, 'failed', 'Failed to store parsed data');
                await recordExtractionError(resumeId, errorInfo);
                return { success: false, error: errorInfo };
            }

            // Update resume status
            await updateResumeStatus(resumeId, 'parsed');

            return {
                success: true,
                resumeId,
                message: 'Resume processed successfully',
                confidence: processingResult.confidence
            };
        } catch (error) {
            console.error('Background processing error:', error);
            const errorInfo = handleExtractionError(error, 'processing');
            await updateResumeStatus(resumeId, 'failed', errorInfo.userMessage);
            await recordExtractionError(resumeId, errorInfo);
            return { success: false, error: errorInfo };
        }
    }

    // Start the processing attempt
    return attemptProcessing();
}

/**
 * Determine if an error type is suitable for retry
 */
function isRetryableError(errorType) {
    const retryableErrors = [
        'NETWORK_ERROR',
        'TIMEOUT_ERROR',
        'DATABASE_ERROR',
        'API_ERROR'
    ];

    return retryableErrors.includes(errorType);
}

/**
 * Update resume status with improved tracking
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
            updateData.processing_error = null;
        }

        // Also track processing history for better debugging
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