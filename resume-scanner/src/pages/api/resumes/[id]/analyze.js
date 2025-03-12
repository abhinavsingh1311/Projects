// src/pages/api/resumes/[id]/analyze.js
import { supabase, supabaseAdmin } from '@/server/config/database_connection';
import { analyzeResume } from '@/server/services/resumeAnalyzer';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { id } = req.query;
        const { force = false } = req.body;

        if (!id) {
            return res.status(400).json({ error: 'Resume ID is required' });
        }

        // Authenticate user
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        // Check if resume belongs to user
        const { data: resume, error: resumeError } = await supabase
            .from('resumes')
            .select('id, user_id, status')
            .eq('id', id)
            .eq('user_id', user.id)
            .single();

        if (resumeError) {
            return res.status(404).json({ error: 'Resume not found' });
        }

        // Make sure resume has been parsed
        if (!['parsed', 'analyzed', 'completed'].includes(resume.status) && !force) {
            return res.status(400).json({
                error: 'Resume must be processed before analysis',
                status: resume.status
            });
        }

        // Update status to analyzing
        await supabaseAdmin
            .from('resumes')
            .update({ status: 'analyzing' })
            .eq('id', id);

        // Start analysis in background
        analyzeResume(id)
            .then(result => console.log(`Analysis completed for resume ${id}`))
            .catch(error => console.error(`Error analyzing resume ${id}:`, error));

        return res.status(200).json({
            success: true,
            message: 'Resume analysis started',
            resumeId: id,
            background: true
        });
    } catch (error) {
        console.error('API error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}