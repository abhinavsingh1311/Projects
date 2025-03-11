// pages/api/resumes/[id]/status.js
import { supabaseAdmin } from '@/server/config/database_connection';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { id } = req.query;
        const token = req.headers.authorization?.split(' ')[1];

        // Validate user
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
        if (!user || authError) return res.status(401).json({ error: 'Unauthorized' });

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

        return res.status(200).json({
            status: resume.status,
            error: resume.processing_error,
            progressPercentage: calculateProgress(resume.status) // Implement your progress logic
        });

    } catch (error) {
        console.error('Status check error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}