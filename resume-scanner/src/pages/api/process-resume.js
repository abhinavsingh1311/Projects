// src/pages/api/process-resume.js

import { supabase, supabaseAdmin } from '@/server/config/database_connection';
import { extractText } from '@/server/services/textExtractor';

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
        const { resumeId, force = false } = req.body;

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
        console.log(`1. Starting to process resume: ${resumeId}`);
        console.log(`2. Downloading file from path: ${filePath}`);

        const { data: fileBlob, error: fileError } = await supabaseAdmin.storage
            .from('resumes')
            .download(filePath);

        if (fileError) {
            console.error('File download error:', fileError);
            await updateResumeStatus(resumeId, 'failed', `Failed to download file: ${fileError.message}`);
            return { success: false, error: fileError.message };
        }

        console.log(`3. File downloaded successfully, size: ${fileBlob.size} bytes`);

        // Extract text from the file
        try {
            // Convert Blob to ArrayBuffer and then to Buffer
            const arrayBuffer = await fileBlob.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            console.log(`4. Starting text extraction for file type: ${fileType}`);

            // Extract text using the text extractor
            const extractionResult = await extractText(buffer, fileType);

            if (!extractionResult || !extractionResult.text) {
                throw new Error('Text extraction failed - no text returned');
            }

            console.log(`5. Text extracted successfully, length: ${extractionResult.text.length} characters`);

            // Store the extracted text directly without complex logic
            try {
                console.log('6. Storing extracted text in database');

                const { error: insertError } = await supabaseAdmin
                    .from('resume_parsed_data')
                    .insert([{
                        resume_id: resumeId,
                        raw_text: extractionResult.text,
                        parsed_data: {}, // Empty object for now
                        processed_at: new Date().toISOString()
                    }]);

                if (insertError) {
                    console.error('Error storing extracted text:', insertError);
                    console.error('Error details:', JSON.stringify(insertError));

                    await updateResumeStatus(resumeId, 'failed', `Failed to store text: ${insertError.message}`);
                    return { success: false, error: insertError.message };
                }

                console.log('7. Text stored successfully in database');

                // Update resume status to parsed
                await updateResumeStatus(resumeId, 'parsed');

                return {
                    success: true,
                    resumeId,
                    message: 'Resume processed successfully'
                };
            } catch (dbError) {
                console.error('Exception storing text:', dbError);
                await updateResumeStatus(resumeId, 'failed', `Database error: ${dbError.message}`);
                return { success: false, error: dbError.message };
            }
        } catch (extractionError) {
            console.error('Text extraction error:', extractionError);
            await updateResumeStatus(resumeId, 'failed', `Text extraction failed: ${extractionError.message}`);
            return { success: false, error: extractionError.message };
        }
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
        console.log(`Updating resume ${resumeId} status to: ${status}`);

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

        console.log(`Successfully updated resume ${resumeId} status to: ${status}`);
        return true;
    } catch (error) {
        console.error(`Error updating resume status to ${status}:`, error);
        return false;
    }
}