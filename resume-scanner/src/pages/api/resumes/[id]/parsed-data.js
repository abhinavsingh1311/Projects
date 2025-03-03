// src/pages/api/resumes/[id]/parsed-data.js
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

        // First, check if the resume belongs to the user
        const { data: resume, error: resumeError } = await supabase
            .from('resumes')
            .select('id, user_id, title, status')
            .eq('id', id)
            .eq('user_id', user.id)
            .single();

        if (resumeError) {
            return res.status(404).json({ error: 'Resume not found' });
        }

        // Get the parsed data
        const { data: parsedData, error: dataError } = await supabase
            .from('resume_parsed_data')
            .select('*')
            .eq('resume_id', id)
            .single();

        if (dataError) {
            if (dataError.code === 'PGRST116') { // Resource not found
                return res.status(404).json({
                    error: 'Parsed data not found',
                    resumeStatus: resume.status
                });
            }
            return res.status(500).json({ error: 'Error retrieving parsed data' });
        }

        return res.status(200).json({
            success: true,
            resumeId: id,
            resumeTitle: resume.title,
            resumeStatus: resume.status,
            parsedData: parsedData.parsed_data,
            rawText: parsedData.raw_text,
            processedAt: parsedData.processed_at
        });
    } catch (error) {
        console.error('API error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}