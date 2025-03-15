// src/pages/api/resumes/[id]/analysis.js
import {supabase, supabaseAdmin} from '@/server/config/database_connection';

export default async function handler(req, res) {
    console.log("Analysis API hit:", req.method, req.url);

    // Allow CORS for development
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Handle GET requests (fetch analysis)
    if (req.method === 'GET') {
        try {
            const { id } = req.query;

            if (!id) {
                return res.status(400).json({ error: 'Resume ID is required' });
            }

            console.log("Fetching analysis for resume:", id);

            // Authenticate user
            const authHeader = req.headers.authorization;
            if (!authHeader?.startsWith('Bearer ')) {
                console.log("Missing auth header for GET");
                return res.status(401).json({ error: 'Authentication required' });
            }

            const token = authHeader.split(' ')[1];
            const { data: { user }, error: authError } = await supabase.auth.getUser(token);

            if (authError || !user) {
                console.log("Auth error for GET:", authError);
                return res.status(401).json({ error: 'Authentication failed' });
            }

            // First check if the resume exists using admin client
            const { data: resume, error: resumeError } = await supabaseAdmin
                .from('resumes')
                .select('id, title, status')
                .eq('id', id)
                // Remove user ownership check
                //.eq('user_id', user.id)
                .single();

            if (resumeError) {
                console.log("Resume fetch error:", resumeError);
                return res.status(404).json({
                    error: 'Resume not found',
                    details: resumeError.message
                });
            }

            console.log("Resume found:", resume);

            // Get the analysis data
            const { data: analysis, error: analysisError } = await supabaseAdmin
                .from('resume_analysis')
                .select('*')
                .eq('resume_id', id)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (analysisError) {
                console.log("Analysis fetch error:", analysisError);
                if (analysisError.code === 'PGRST116') {
                    return res.status(404).json({
                        error: 'Analysis not found',
                        resumeTitle: resume.title,
                        resumeStatus: resume.status,
                        resumeId: id
                    });
                }
                return res.status(500).json({
                    error: 'Error retrieving analysis data',
                    details: analysisError.message
                });
            }

            console.log("Analysis found, returning data");
            return res.status(200).json({
                success: true,
                resumeId: id,
                resumeTitle: resume.title,
                resumeStatus: resume.status,
                analysis: analysis.analysis_json,
                createdAt: analysis.created_at
            });
        } catch (error) {
            console.error('API error in GET:', error);
            return res.status(500).json({
                error: 'Internal server error',
                details: error.message
            });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}