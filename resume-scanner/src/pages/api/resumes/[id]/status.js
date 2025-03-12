// pages/api/resumes/[id]/status.js

import {supabase,supabaseAdmin} from "@/server/config/database_connection";

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { id } = req.query;

        // Check for the auth header
        const authHeader = req.headers.authorization;
        let token;

        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.split(' ')[1];
        } else {
            return res.status(401).json({ error: 'Authentication required' });
        }

        // Validate user with the token
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

        if (!user || authError) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Get resume status
        const { data: resume, error: dbError } = await supabaseAdmin
            .from('resumes')
            .select('status, processing_error')
            .eq('id', id)
            .single();

        if (dbError) {
            return res.status(404).json({
                error: 'Resume not found',
                code: 'RESUME_NOT_FOUND'
            });
        }
        // Get resume status
        const { data, error } = await supabase
            .from('resumes')
            .select('id, status, processing_error, created_at, last_processed_at')
            .eq('id', id)
            .eq('user_id', user.id)
            .single();

        return res.status(200).json({
            status: resume.status,
            error: resume.processing_error,
            progressPercentage: calculateProgress(resume.status)
        });

    } catch (error) {
        console.error('Status check error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

// Simple progress calculation function
function calculateProgress(status) {
    switch(status) {
        case 'uploaded': return 10;
        case 'parsing': return 40;
        case 'parsed': return 70;
        case 'analyzing': return 85;
        case 'analyzed':
        case 'completed': return 100;
        case 'failed': return 0;
        default: return 25;
    }
}