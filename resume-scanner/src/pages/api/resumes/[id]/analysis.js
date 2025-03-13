// src/pages/api/resumes/[id]/analysis.js
import { supabase } from '@/server/config/database_connection';

export default async function handler(req, res) {
    console.log("Analysis API hit:", req.method, req.url);

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { id } = req.query;

        if (!id) {
            return res.status(400).json({ error: 'Resume ID is required' });
        }

        // Authenticate user
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const token = authHeader.split(' ')[1];
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            return res.status(401).json({ error: 'Authentication failed' });
        }

        // First check if the resume exists and belongs to the user
        const { data: resume, error: resumeError } = await supabase
            .from('resumes')
            .select('id, user_id, title, status')
            .eq('id', id)
            .eq('user_id', user.id)
            .single();

        if (resumeError) {
            return res.status(404).json({ error: 'Resume not found' });
        }

        // Get the analysis data
        const { data: analysis, error: analysisError } = await supabase
            .from('resume_analysis')
            .select('*')
            .eq('resume_id', id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (analysisError) {
            if (analysisError.code === 'PGRST116') {
                return res.status(404).json({
                    error: 'Analysis not found',
                    resumeTitle: resume.title,
                    resumeStatus: resume.status,
                    resumeId: id
                });
            }
            return res.status(500).json({ error: 'Error retrieving analysis data' });
        }

        return res.status(200).json({
            success: true,
            resumeId: id,
            resumeTitle: resume.title,
            resumeStatus: resume.status,
            analysis: analysis.analysis_json,
            createdAt: analysis.created_at
        });
    } catch (error) {
        console.error('API error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}