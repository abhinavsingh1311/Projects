// src/pages/api/resumes/[resumeId]/job-matches/[jobId].js
import { supabase } from '@/server/utils/supabase-client';
const { getDetailedJobMatch } = require('@/server/services/jobMatchingService');

export default async function handler(req, res) {
    // Set CORS headers for development
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow GET requests
    if (req.method !== 'GET') {
        return res.status(405).json({
            success: false,
            error: 'Method not allowed'
        });
    }

    try {
        const { resumeId, jobId } = req.query;

        if (!resumeId || !jobId) {
            return res.status(400).json({
                success: false,
                error: 'Resume ID and Job ID are required'
            });
        }

        // Authenticate user
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }

        const token = authHeader.split(' ')[1];
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            return res.status(401).json({
                success: false,
                error: 'Authentication failed'
            });
        }

        // Check if the resume belongs to the user
        const { data: resume, error: resumeError } = await supabase
            .from('resumes')
            .select('id')
            .eq('id', resumeId)
            .eq('user_id', user.id)
            .single();

        if (resumeError) {
            return res.status(404).json({
                success: false,
                error: 'Resume not found or access denied'
            });
        }

        // Get detailed job match
        const result = await getDetailedJobMatch(resumeId, jobId);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error || 'Failed to retrieve job match details'
            });
        }

        return res.status(200).json(result);
    } catch (error) {
        console.error('API error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
}