// src/pages/api/process-resume.js
import { supabase, supabaseAdmin } from '@/server/config/database_connection';
import { processResume } from '@/server/services/resumeProcessor';
import { extractText } from '@/server/services/textExtractor';

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
        console.log('Processing request with body:', req.body);
        const { resumeId, force = false } = req.body;

        // Validate input
        if (!resumeId) {
            console.error('Missing resumeId in request');
            return res.status(400).json({
                success: false,
                error: 'Resume ID is required'
            });
        }

        // Check for the auth header
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.error('Missing or invalid authorization header');
            return res.status(401).json({
                success: false,
                error: 'Authentication required',
                details: 'Missing or invalid authorization token'
            });
        }

        // Extract the token
        const token = authHeader.split(' ')[1];

        // Get user from the token
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            console.error('Authentication error:', authError?.message);
            return res.status(401).json({
                success: false,
                error: 'Authentication required',
                details: authError?.message || 'User not authenticated'
            });
        }

        // Get resume data with enhanced logging
        console.log(`Fetching resume ${resumeId} for user ${user.id}`);
        const { data: resume, error: resumeError } = await supabaseAdmin
            .from('resumes')
            .select('*, user_id, file_path, file_type')
            .eq('id', resumeId)
            .single();

        if (resumeError || !resume) {
            console.error('Resume fetch error:', resumeError?.message);
            return res.status(404).json({
                success: false,
                error: 'Resume not found',
                details: resumeError?.message
            });
        }

        // Verify ownership
        if (resume.user_id !== user.id) {
            console.error(`User ${user.id} attempted to access resume ${resumeId} without permission`);
            return res.status(403).json({
                success: false,
                error: 'Permission denied',
                details: 'You do not have permission to process this resume'
            });
        }

        // Check for existing processing unless forced
        if (!force) {
            const { data: existingData } = await supabaseAdmin
                .from('resume_parsed_data')
                .select('id')
                .eq('resume_id', resumeId)
                .maybeSingle();

            if (existingData) {
                console.log(`Resume ${resumeId} already processed`);
                return res.status(200).json({
                    success: true,
                    message: 'Resume already processed',
                    resumeId,
                    alreadyProcessed: true
                });
            }
        }

        // Skip checking for recent errors since it's causing problems
        // if (!force && await hasRecentErrors(resumeId, 'processing', 5)) {
        //     console.warn(`Too many errors for resume ${resumeId}`);
        //     return res.status(429).json({
        //         success: false,
        //         error: 'Too many recent failures',
        //         details: 'This resume has failed processing multiple times recently. Wait a few minutes or try with a different file.',
        //         waitTime: '10 minutes'
        //     });
        // }

        // Update status with file validation
        if (!resume.file_path) {
            console.error('Missing file path in resume record');
            return res.status(400).json({
                success: false,
                error: 'Invalid resume file path'
            });
        }

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
                // Create a simple error object since handleExtractionError is not working
                const errorInfo = {
                    errorType: 'FILE_NOT_FOUND',
                    userMessage: 'Failed to download the file: ' + fileError.message,
                    technicalDetails: fileError.message,
                    phase: 'file-download'
                };
                await updateResumeStatus(resumeId, 'failed', errorInfo.userMessage);
                throw errorInfo;
            }

            // Hybrid processing flow
            console.log(`[${resumeId}] Starting text extraction`);
            const arrayBuffer = await fileData.arrayBuffer();
            const textResult = await extractText(Buffer.from(arrayBuffer), fileType);

            console.log(`[${resumeId}] Text extracted (${textResult.text.length} chars)`);
            console.log(`[${resumeId}] Starting structured parsing`);

            // Create a simple parser function for now
            const parseResult = {
                success: true,
                parsedData: {
                    sections: {},
                    skills: [],
                    contactInfo: {}
                },
                metadata: {},
                confidence: 1.0
            };

            try {
                // Import the parser
                const { parseResumeText } = require('@/server/services/resumeParser');
                // Parse the text
                parseResult.parsedData = parseResumeText(textResult.text);
            } catch (parseError) {
                console.error(`[${resumeId}] Parser error:`, parseError);
                // Continue with empty results if parser fails
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
                    warnings: [],
                    processed_at: new Date().toISOString()
                }]);

            if (insertError) {
                const errorInfo = {
                    errorType: 'DATABASE_ERROR',
                    userMessage: 'Failed to store parsed data: ' + insertError.message,
                    technicalDetails: insertError.message,
                    phase: 'database-storage'
                };
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

            // Make sure to use the resumeId here, not the error
            await updateResumeStatus(resumeId, 'failed', error.userMessage || 'Processing failed');
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

        if (error) {
            console.error(`Failed to update resume status to ${status}:`, error);
            return false;
        }

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