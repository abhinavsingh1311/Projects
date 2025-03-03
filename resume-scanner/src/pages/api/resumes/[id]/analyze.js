// src/pages/api/resumes/[id]/analyze.js
import { supabase, supabaseAdmin } from '@/server/config/database_connection';
import { analyzeResume } from '@/server/services/resumeAnalyzer';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
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
            .select('id, user_id, status')
            .eq('id', id)
            .eq('user_id', user.id)
            .single();

        if (resumeError) {
            return res.status(404).json({ error: 'Resume not found' });
        }

        // Check if the resume has been parsed
        if (resume.status !== 'parsed' && resume.status !== 'analyzed' && resume.status !== 'completed') {
            return res.status(400).json({
                error: 'Resume must be parsed before analysis',
                status: resume.status
            });
        }

        // Get the parsed text
        const { data: parsedData, error: parseError } = await supabase
            .from('resume_parsed_data')
            .select('raw_text')
            .eq('resume_id', id)
            .single();

        if (parseError) {
            return res.status(404).json({ error: 'Parsed data not found' });
        }

        // Update resume status to analyzing
        await supabaseAdmin
            .from('resumes')
            .update({ status: 'analyzing' })
            .eq('id', id);

        // Call AI service to analyze resume (in background)
        const analyzePromise = analyzeResumeBackground(id, parsedData.raw_text);

        // Respond immediately
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

// Function to analyze resume in background
async function analyzeResumeBackground(resumeId, rawText) {
    try {
        // Call the analyze function
        const result = await analyzeResume(resumeId, rawText);

        if (result.success) {
            // Store analysis results
            await supabaseAdmin
                .from('resume_analysis')
                .insert([{
                    resume_id: resumeId,
                    analysis_json: result.analysis,
                    model_version: result.analysis.model || 'unknown',
                    created_at: new Date().toISOString()
                }]);

            // Update resume status
            await supabaseAdmin
                .from('resumes')
                .update({
                    status: 'analyzed',
                    last_analyzed_at: new Date().toISOString()
                })
                .eq('id', resumeId);

            console.log(`Analysis completed for resume ${resumeId}`);
        } else {
            console.error(`Analysis failed for resume ${resumeId}:`, result.error);

            // Update resume status
            await supabaseAdmin
                .from('resumes')
                .update({
                    status: 'analysis_failed',
                    processing_error: result.error
                })
                .eq('id', resumeId);
        }

        return result;
    } catch (error) {
        console.error(`Background analysis error for resume ${resumeId}:`, error);

        // Update resume status
        await supabaseAdmin
            .from('resumes')
            .update({
                status: 'analysis_failed',
                processing_error: error.message
            })
            .eq('id', resumeId);

        throw error;
    }
}