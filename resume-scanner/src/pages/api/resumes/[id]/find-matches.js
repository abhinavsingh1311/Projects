// src/pages/api/resumes/[id]/find-matches.js
import { supabase } from '@/server/utils/supabase-client';
import { supabaseAdmin } from '@/server/config/database_connection';
const { findJobMatches } = require('@/server/services/jobMatcher');

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({
            success: false,
            error: 'Method not allowed'
        });
    }

    try {
        const { id } = req.query;
        const { force = false } = req.body;

        if (!id) {
            return res.status(400).json({
                success: false,
                error: 'Resume ID is required'
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

        // Verify resume ownership
        const { data: resume, error: resumeError } = await supabaseAdmin
            .from('resumes')
            .select('*')
            .eq('id', id)
            .eq('user_id', user.id)
            .single();

        if (resumeError) {
            return res.status(404).json({
                success: false,
                error: 'Resume not found or you do not have permission to access it'
            });
        }

        console.log(`Job matching initiated for resume ${id} using OpenAI`);

        // Check if the resume is processed
        if (!['parsed', 'analyzed', 'completed'].includes(resume.status)) {
            return res.status(400).json({
                success: false,
                error: `Resume is in ${resume.status} state and must be processed before finding job matches`,
                resumeStatus: resume.status
            });
        }

        // Delete existing matches if force=true
        if (force) {
            const { error: deleteError } = await supabaseAdmin
                .from('job_matches')
                .delete()
                .eq('resume_id', id);

            if (deleteError) {
                console.warn('Warning: Failed to delete existing matches:', deleteError);
            }
        }

        // Run job matching using OpenAI
        console.log(`Calling findJobMatches for resume ${id}`);
        const matchResult = await findJobMatches(id);
        console.log(`Job matching result:`, matchResult);

        if (!matchResult.success) {
            return res.status(500).json({
                success: false,
                error: matchResult.error || 'Failed to find job matches'
            });
        }

        // Get a sample of the matches to return
        const { data: sampleMatches, error: sampleError } = await supabaseAdmin
            .from('job_matches')
            .select(`
        id, job_id, match_score,
        jobs(id, title, company_name)
      `)
            .eq('resume_id', id)
            .order('match_score', { ascending: false })
            .limit(5);

        return res.status(200).json({
            success: true,
            message: 'Job matching completed successfully',
            resumeId: id,
            resumeTitle: resume.title,
            matchCount: matchResult.matchCount || 0,
            sampleMatches: sampleMatches || []
        });
    } catch (error) {
        console.error('API error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
}