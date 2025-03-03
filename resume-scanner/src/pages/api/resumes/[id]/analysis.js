// src/pages/api/resumes/[id]/analysis.js
import { supabase } from '@/server/utils/supabase-client';

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
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        // Check if the resume belongs to the user
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
        const { data: analysisData, error: analysisError } = await supabase
            .from('resume_analysis')
            .select('*')
            .eq('resume_id', id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (analysisError) {
            if (analysisError.code === 'PGRST116') { // Resource not found
                return res.status(404).json({
                    error: 'Analysis not found',
                    resumeStatus: resume.status
                });
            }
            return res.status(500).json({ error: 'Error retrieving analysis data' });
        }

        return res.status(200).json({
            success: true,
            resumeId: id,
            resumeTitle: resume.title,
            resumeStatus: resume.status,
            analysis: analysisData.analysis_json,
            analyzedAt: analysisData.created_at
        });
    } catch (error) {
        console.error('API error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}