// src/pages/api/resumes/[id]/status.js
import { supabase } from '@/server/utils/supabase-client';
import { getRecoverySuggestion } from '@/server/services/extractionErrorHandler';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { id } = req.query;

        if (!id) {
            return res.status(400).json({ error: 'Resume ID is required' });
        }

        // Get user to ensure they only access their own resumes
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return res.status(401).json({
                error: 'Authentication required',
                message: authError?.message || 'Please sign in to access your resume'
            });
        }

        // Get resume status with additional details
        const { data, error } = await supabase
            .from('resumes')
            .select(`
                id, 
                status, 
                processing_error, 
                created_at, 
                last_processed_at,
                title
            `)
            .eq('id', id)
            .eq('user_id', user.id)
            .single();

        if (error) {
            return res.status(404).json({
                error: 'Resume not found',
                message: 'The requested resume could not be found or you do not have permission to access it',
                details: error.message
            });
        }

        // Check if there is a parsing process in progress and calculate progress
        let progressPercentage = null;
        let estimatedTimeRemaining = null;

        if (data.status === 'parsing' || data.status === 'analyzing') {
            // Calculate progress based on time elapsed since last update
            // Assuming average processing time is 1 minute
            const startTime = new Date(data.last_processed_at || data.created_at);
            const currentTime = new Date();
            const elapsedMs = currentTime - startTime;
            const estimatedTotalMs = 60000; // 1 minute in ms

            progressPercentage = Math.min(Math.round((elapsedMs / estimatedTotalMs) * 100), 95);

            // Don't show 100% unless we're actually done
            if (progressPercentage > 95) progressPercentage = 95;

            // Calculate estimated time remaining
            const remainingMs = Math.max(estimatedTotalMs - elapsedMs, 0);
            estimatedTimeRemaining = Math.ceil(remainingMs / 1000); // In seconds
        }

        // If there's an error, add a recovery suggestion
        let recoverySuggestion = null;
        if (data.status === 'failed' && data.processing_error) {
            // Determine error type from the message
            const errorType = determineErrorType(data.processing_error);
            recoverySuggestion = getRecoverySuggestion(errorType);
        }

        return res.status(200).json({
            success: true,
            resumeId: data.id,
            title: data.title,
            status: data.status,
            error: data.processing_error || null,
            createdAt: data.created_at,
            processedAt: data.last_processed_at,
            // Additional fields for better UX
            progressPercentage,
            estimatedTimeRemaining,
            recoverySuggestion,
            statusDescription: getStatusDescription(data.status)
        });
    } catch (error) {
        console.error('Status API error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: 'An unexpected error occurred while fetching resume status'
        });
    }
}

/**
 * Get a user-friendly description of each status
 */
function getStatusDescription(status) {
    const descriptions = {
        'uploaded': 'Your resume has been uploaded and is waiting to be processed.',
        'parsing': 'We are currently extracting information from your resume.',
        'parsed': 'Your resume has been processed successfully.',
        'analyzing': 'We are analyzing your resume to provide insights and suggestions.',
        'analyzed': 'Your resume has been analyzed successfully.',
        'completed': 'All processing has been completed successfully.',
        'failed': 'There was an issue processing your resume.',
        'reprocessing': 'Your resume is being processed again.'
    };

    return descriptions[status] || 'Status unknown';
}

/**
 * Determine error type from error message
 */
function determineErrorType(errorMessage) {
    if (!errorMessage) return 'UNKNOWN';

    if (errorMessage.includes('password') || errorMessage.includes('encrypted')) {
        return 'PROTECTED_DOCUMENT';
    } else if (errorMessage.includes('corrupted') || errorMessage.includes('damaged')) {
        return 'CORRUPTED_FILE';
    } else if (errorMessage.includes('no text') || errorMessage.includes('empty')) {
        return 'EMPTY_DOCUMENT';
    } else if (errorMessage.includes('unsupported') || errorMessage.includes('invalid type')) {
        return 'UNSUPPORTED_FILE';
    } else if (errorMessage.includes('OCR') || errorMessage.includes('image-based')) {
        return 'OCR_FAILED';
    }

    return 'EXTRACTION_FAILED';
}