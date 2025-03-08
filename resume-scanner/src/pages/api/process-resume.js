// src/pages/api/process-resume.js

import { supabase, supabaseAdmin } from '@/server/config/database_connection';
import { processResumeText } from '@/server/services/resumeParser';
import { getSession } from '@supabase/auth-helpers-nextjs';


export default async function handler(req, res) {
    // Allow CORS for development
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

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
        const { resumeId } = req.body;

        if (!resumeId) {
            console.error('Missing resumeId in request');
            return res.status(400).json({ error: 'Resume ID required' });
        }

        // Add detailed logging
        console.log(`Fetching resume ${resumeId}`);
        const { data: resume, error: resumeError } = await supabaseAdmin
            .from('resumes')
            .select('*')
            .eq('id', resumeId)
            .single();

        if (resumeError || !resume) {
            console.error('Resume fetch error:', resumeError);
            return res.status(404).json({ error: 'Resume not found' });
        }
        console.log(`Found resume: ${resume.id}`);

        // Add file validation
        if (!resume.file_path) {
            console.error('Missing file path in resume record');
            return res.status(400).json({ error: 'Invalid resume file path' });
        }

        const session = await getSession({ req });
        if (!session) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        //
        // // Get resume data without authentication for now
        // const { data: resume, error: resumeError } = await supabaseAdmin
        //     .from('resumes')
        //     .select('*')
        //     .eq('id', resumeId)
        //     .eq('user_id', session.user.id)
        //     .single();

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
 * Process a resume file in the background
 * @param {string} resumeId - Resume ID to process
 * @param {string} filePath - Path to the file in storage
 * @param {string} fileType - Type of the resume file
 * @returns {Promise<Object>} - Processing result
 */
async function processResumeInBackground(resumeId, filePath, fileType) {
    try {
        console.log(`Downloading file from path: ${filePath}`);
        const { data: fileBlob, error: fileError } = await supabaseAdmin.storage
            .from('resumes')
            .download(filePath);

        if (fileError) throw fileError;

        // Convert Blob to ArrayBuffer first
        const arrayBuffer = await fileBlob.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Now process with the proper Buffer
        const processingResult = await processResumeText(buffer, fileType);

        if (!processingResult.success) {
            await updateResumeStatus(resumeId, 'failed', processingResult.error || 'Text extraction failed');
            return { success: false, error: processingResult.error };
        }

        // Store the parsed data
        const { error: insertError } = await supabaseAdmin
            .from('resume_parsed_data')
            .insert([{
                resume_id: resumeId,
                raw_text: processingResult.text,
                parsed_data: processingResult.parsedData,
                metadata: processingResult.metadata || {},
                processed_at: new Date().toISOString()
            }]);

        if (insertError) {
            await updateResumeStatus(resumeId, 'failed', `Failed to store parsed data: ${insertError.message}`);
            return { success: false, error: insertError.message };
        }

        // Update resume status to parsed
        await updateResumeStatus(resumeId, 'parsed');

        return {
            success: true,
            resumeId,
            message: 'Resume processed successfully'
        };

    } catch (error) {
        console.error(`Error processing resume ${resumeId}:`, error);
        await updateResumeStatus(resumeId, 'failed', error.message || 'Unknown error during processing');
        return { success: false, error: error.message || 'Unknown error' };
    }
}

/**
 * Update resume status
 * @param {string} resumeId - Resume ID
 * @param {string} status - New status
 * @param {string} errorMessage - Optional error message
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

        await supabaseAdmin
            .from('resumes')
            .update(updateData)
            .eq('id', resumeId);

    } catch (error) {
        console.error(`Error updating resume status to ${status}:`, error);
    }
}