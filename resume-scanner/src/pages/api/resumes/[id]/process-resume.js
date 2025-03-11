// src/pages/api/process-resume.js
import { supabase, supabaseAdmin, hasAdminAccess } from '@/server/config/database_connection';
import { processResume } from '@/server/services/resumeParser';
import { extractText } from '@/server/services/textExtractor';
import { handleExtractionError, recordExtractionError, hasRecentErrors } from '@/server/services/extractionErrorHandler';

// CORS configuration for development
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': process.env.NODE_ENV === 'development' ? '*' : process.env.CLIENT_URL,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

export default async function handler(req, res) {
    // Set CORS headers
    Object.entries(CORS_HEADERS).forEach(([key, value]) => {
        res.setHeader(key, value);
    });

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({
            success: false,
            error: 'Method not allowed',
            allowedMethods: ['POST']
        });
    }

    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ error: 'Missing authorization header' });

        const token = authHeader.split(' ')[1];
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (!user || authError) {
            return res.status(401).json({
                error: 'Invalid authentication',
                details: authError?.message
            });
        }

        // Validate request body
        const { resumeId } = req.body;
        if (!resumeId) return res.status(400).json({ error: 'Resume ID required' });

        // Verify resume ownership
        const { data: resume, error: resumeError } = await supabase
            .from('resumes')
            .select('id, user_id, file_path')
            .eq('id', resumeId)
            .single();

        if (resumeError || !resume) {
            return res.status(404).json({
                error: 'Resume not found',
                details: resumeError?.message
            });
        }

        if (resume.user_id !== user.id) {
            return res.status(403).json({
                error: 'Unauthorized access to resume'
            });
        }

        // Update status to processing
        await supabase
            .from('resumes')
            .update({ status: 'processing' })
            .eq('id', resumeId);

        console.log(`Starting processing for resume ${resumeId}`);
        await supabaseAdmin
            .from('resumes')
            .update({
                status: 'parsing',
                last_processed_at: new Date().toISOString(),
                processing_error: null
            })
            .eq('id', resumeId);

        // Start background processing
        processResumeInBackground(resumeId, resume.file_path, resume.file_type)
            .then(result => {
                console.log(`Processing completed for ${resumeId}:`, result.success);
            })
            .catch(error => {
                console.error(`Background error for ${resumeId}:`, error);
            });

        return res.status(200).json({
            success: true,
            message: 'Resume processing started',
            resumeId,
            background: true,
            statusEndpoint: `/api/resumes/${resumeId}/status`
        });

    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message || 'Unknown error occurred'
        });
    }
}

// Enhanced background processor with hybrid approach
async function processResumeInBackground(resumeId, filePath, fileType) {
    const MAX_RETRIES = 3;
    let retryCount = 0;

    async function attemptProcessing() {
        try {
            console.log(`[${resumeId}] Attempt ${retryCount + 1}/${MAX_RETRIES}`);

            // Download file with error handling
            console.log(`[${resumeId}] Downloading file from ${filePath}`);
            const { data: fileData, error: fileError } = await supabaseAdmin.storage
                .from('resumes')
                .download(filePath);

            if (fileError) {
                const errorInfo = handleExtractionError(fileError, 'file-download');
                await recordExtractionError(resumeId, errorInfo);
                throw errorInfo;
            }

            // Hybrid processing flow
            console.log(`[${resumeId}] Starting text extraction`);
            const arrayBuffer = await fileData.arrayBuffer();
            const textResult = await extractText(Buffer.from(arrayBuffer), fileType);

            console.log(`[${resumeId}] Text extracted (${textResult.text.length} chars)`);
            console.log(`[${resumeId}] Starting structured parsing`);

            const parseResult = await processResume(textResult.text, filePath, fileType);

            if (!parseResult.success) {
                const errorInfo = handleExtractionError(
                    new Error(parseResult.errorDetails),
                    'processing'
                );
                throw errorInfo;
            }

            // Unified data storage
            console.log(`[${resumeId}] Storing parsed data`);
            const { error: insertError } = await supabaseAdmin
                .from('resume_parsed_data')
                .insert([{
                    resume_id: resumeId,
                    raw_text: textResult.text,
                    parsed_data: parseResult.parsedData,
                    metadata: { ...textResult.metadata, ...parseResult.metadata },
                    confidence: parseResult.confidence,
                    warnings: parseResult.validation?.warnings,
                    processed_at: new Date().toISOString()
                }]);

            if (insertError) {
                const errorInfo = handleExtractionError(insertError, 'database-storage');
                throw errorInfo;
            }

            await updateResumeStatus(resumeId, 'parsed');
            return { success: true };

        } catch (error) {
            console.error(`[${resumeId}] Processing error:`, error);

            if (retryCount < MAX_RETRIES && isRetryableError(error.errorType)) {
                const delay = Math.pow(2, retryCount) * 1000;
                console.log(`[${resumeId}] Retrying in ${delay}ms`);
                await new Promise(resolve => setTimeout(resolve, delay));
                retryCount++;
                return attemptProcessing();
            }

            await updateResumeStatus(resumeId, 'failed', error.userMessage);
            await recordExtractionError(resumeId, error);
            return { success: false, error };
        }
    }

    return attemptProcessing();
}

// Improved status updater with logging
async function updateResumeStatus(resumeId, status, errorMessage = null) {
    try {
        console.log(`[${resumeId}] Updating status to ${status}`);

        const updateData = {
            status,
            last_processed_at: new Date().toISOString(),
            processing_error: errorMessage || null
        };

        const { error } = await supabaseAdmin
            .from('resumes')
            .update(updateData)
            .eq('id', resumeId);

        if (error) throw error;

        console.log(`[${resumeId}] Status updated to ${status}`);
        return true;
    } catch (error) {
        console.error(`[${resumeId}] Status update failed:`, error);
        return false;
    }
}

// Retry classifier
function isRetryableError(errorType) {
    return [
        'NETWORK_ERROR',
        'TIMEOUT_ERROR',
        'API_ERROR',
        'DATABASE_ERROR'
    ].includes(errorType);
}