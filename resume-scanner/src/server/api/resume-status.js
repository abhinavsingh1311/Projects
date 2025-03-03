// src/pages/api/resume-status.js
import { supabase } from '@/server/utils/supabase-client';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { resumeId } = req.query;

        if (!resumeId) {
            return res.status(400).json({ error: 'Resume ID is required' });
        }

        // Get user to ensure they only access their own resumes
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        // Get resume status
        const { data, error } = await supabase
            .from('resumes')
            .select('id, status, processing_error, created_at, last_processed_at')
            .eq('id', resumeId)
            .eq('user_id', user.id)
            .single();

        if (error) {
            return res.status(404).json({ error: 'Resume not found' });
        }

        return res.status(200).json({
            success: true,
            status: data.status,
            error: data.processing_error || null,
            createdAt: data.created_at,
            processedAt: data.last_processed_at
        });
    } catch (error) {
        console.error('Status API error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}