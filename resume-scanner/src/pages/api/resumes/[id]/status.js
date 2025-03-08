// src/pages/api/resumes/[id]/status.js

import { supabaseAdmin } from '@/server/config/database_connection';

export default async function handler(req, res) {
    // Allow CORS for development
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { id } = req.query;

        if (!id) {
            return res.status(400).json({ error: 'Resume ID is required' });
        }

        // Get resume status - skip authentication for debugging
        const { data, error } = await supabaseAdmin
            .from('resumes')
            .select('id, status, processing_error, created_at, last_processed_at')
            .eq('id', id)
            .single();

        if (error) {
            return res.status(404).json({ error: 'Resume not found' });
        }

        // Simple progress calculation (useful for UX)
        let progressPercentage = null;
        let estimatedTimeRemaining = null;

        if (data.status === 'parsing' || data.status === 'analyzing') {
            // Calculate progress based on time elapsed since last update
            // Assuming average processing time is 30 seconds
            const startTime = new Date(data.last_processed_at || data.created_at);
            const currentTime = new Date();
            const elapsedMs = currentTime - startTime;
            const estimatedTotalMs = 30000; // 30 seconds in ms

            progressPercentage = Math.min(Math.round((elapsedMs / estimatedTotalMs) * 100), 95);

            // Don't show 100% unless we're actually done
            if (progressPercentage > 95) progressPercentage = 95;

            // Calculate estimated time remaining
            const remainingMs = Math.max(estimatedTotalMs - elapsedMs, 0);
            estimatedTimeRemaining = Math.ceil(remainingMs / 1000); // In seconds
        }

        return res.status(200).json({
            success: true,
            status: data.status,
            error: data.processing_error || null,
            createdAt: data.created_at,
            processedAt: data.last_processed_at,
            progressPercentage,
            estimatedTimeRemaining
        });
    } catch (error) {
        console.error('Status API error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}