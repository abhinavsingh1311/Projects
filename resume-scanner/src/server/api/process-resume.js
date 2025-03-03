// src/pages/api/process-resume.js
import { processResume, reprocessResume, doesResumeNeedProcessing } from '@/server/services/resumeProcessor';

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

        // Check if this resume needs processing (unless force=true)
        if (!force) {
            const needsProcessing = await doesResumeNeedProcessing(resumeId);

            if (!needsProcessing) {
                return res.status(200).json({
                    success: true,
                    message: 'Resume already processed',
                    resumeId,
                    alreadyProcessed: true
                });
            }
        }

        // Process immediately or start background processing
        if (force) {
            // If force=true, reprocess even if already processed
            console.log(`Force reprocessing resume ${resumeId}`);

            // Start processing in the background
            reprocessResume(resumeId)
                .then(result => {
                    console.log(`Reprocessing completed for resume ${resumeId}:`, result.success);
                })
                .catch(error => {
                    console.error(`Error in background reprocessing for resume ${resumeId}:`, error);
                });

            return res.status(200).json({
                success: true,
                message: 'Resume reprocessing started',
                resumeId,
                background: true
            });
        } else {
            // Normal processing
            console.log(`Processing resume ${resumeId}`);

            // Start processing in the background
            processResume(resumeId)
                .then(result => {
                    console.log(`Processing completed for resume ${resumeId}:`, result.success);
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
        }
    } catch (error) {
        console.error('API Error in process-resume:', error);

        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message || 'Unknown error occurred'
        });
    }
}