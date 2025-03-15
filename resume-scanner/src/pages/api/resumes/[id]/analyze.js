// src/pages/api/resumes/[id]/analyze.js
import {analyzeResume} from "@/server/api/analyze-resume";
import {supabaseAdmin} from "@/server/config/database_connection";
import {supabase} from "@/server/utils/supabase-client";

export default async function handler(req, res) {
    console.log("Analyze API hit:", req.method, req.url);

    // Allow CORS for development
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            console.log("Missing auth header");
            return res.status(401).json({ error: 'Authentication required' });
        }

        const token = authHeader.split(' ')[1];
        console.log("Token received:", token.substring(0, 10) + "...");

        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            console.log("Auth error:", authError);
            return res.status(401).json({ error: 'Authentication failed' });
        }

        console.log("Authenticated user:", { id: user.id, email: user.email });

        const { id } = req.query;
        const { force = false } = req.body;

        console.log("Resume ID to analyze:", id);

        if (!id) {
            return res.status(400).json({ error: 'Resume ID is required' });
        }

        // IMPORTANT CHANGE: Use supabaseAdmin instead of supabase
        // This ensures we're using admin privileges to query
        const { data: resumeExists, error: existsError } = await supabaseAdmin
            .from('resumes')
            .select('id')
            .eq('id', id)
            .maybeSingle();

        console.log("Resume exists check:", { exists: !!resumeExists, error: existsError?.message });

        if (!resumeExists) {
            return res.status(404).json({
                error: 'Resume not found in database',
                details: existsError?.message || 'Resume ID does not exist'
            });
        }

        // Get the resume without user ownership check
        const { data: resume, error: resumeError } = await supabaseAdmin
            .from('resumes')
            .select('id, status')
            .eq('id', id)
            .single();

        if (resumeError) {
            console.log("Error fetching resume:", resumeError);
            return res.status(404).json({ error: 'Resume not found' });
        }

        console.log("Using resume:", resume);

        // Make sure resume has been parsed
        if (!['parsed', 'analyzed', 'completed'].includes(resume.status) && !force) {
            return res.status(400).json({
                error: 'Resume must be processed before analysis',
                status: resume.status
            });
        }

        // Update status to analyzing
        const { error: updateError } = await supabaseAdmin
            .from('resumes')
            .update({ status: 'analyzing' })
            .eq('id', id);

        if (updateError) {
            console.log("Error updating resume status:", updateError);
            return res.status(500).json({ error: 'Failed to update resume status' });
        }

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
        return res.status(500).json({ error: 'Internal server error', details: error.message });
    }
}