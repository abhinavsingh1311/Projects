// src/pages/api/job-matches.js
import { supabase } from '@/server/utils/supabase-client';
const { getUserJobMatches, getJobRecommendations } = require('@/server/services/jobMatchingService');

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

        const { type } = req.query;
        let result;

        if (type === 'recommendations') {
            // Get job recommendations
            const limit = parseInt(req.query.limit) || 3;
            result = await getJobRecommendations(user.id, limit);
        } else {
            // Get job matches
            const limit = parseInt(req.query.limit) || 5;
            result = await getUserJobMatches(user.id, limit);
        }

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error || 'Failed to retrieve job matches'
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