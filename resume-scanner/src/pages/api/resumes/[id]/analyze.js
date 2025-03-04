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

        // Check if there is existing analysis (if not forcing reanalysis)
        if (!force) {
            const { data: existingAnalysis, error: analysisError } = await supabase
                .from('resume_analysis')
                .select('id')
                .eq('resume_id', id)
                .maybeSingle();

            // If analysis exists and we're not forcing, return existing
            if (!analysisError && existingAnalysis) {
                return res.status(200).json({
                    success: true,
                    message: 'Resume already analyzed',
                    resumeId: id,
                    alreadyAnalyzed: true
                });
            }
        }

        // Check if we have parsed data
        const { data: parsedData, error: parsedError } = await supabase
            .from('resume_parsed_data')
            .select('id')
            .eq('resume_id', id)
            .maybeSingle();

        if (parsedError || !parsedData) {
            // If no parsed data, we need to process the resume first
            return res.status(400).json({
                error: 'Resume must be processed before analysis',
                status: resume.status,
                message: 'The resume text needs to be extracted before it can be analyzed'
            });
        }

        // Update status to analyzing
        await supabaseAdmin
            .from('resumes')
            .update({
                status: 'analyzing',
                processing_error: null // clear any previous errors
            })
            .eq('id', id);

        // Start analysis in the background
        analyzeInBackground(id, force)
            .then(result => {
                console.log(`Analysis completed for resume ${id}`);
            })
            .catch(error => {
                console.error(`Error analyzing resume ${id}:`, error);
            });

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

/**
 * Run analysis in the background
 * @param {string} resumeId - Resume ID to analyze
 * @param {boolean} force - Force reanalysis
 */
async function analyzeInBackground(resumeId, force = false) {
    try {
        // If forcing, clear existing analysis
        if (force) {
            await supabaseAdmin
                .from('resume_analysis')
                .delete()
                .eq('resume_id', resumeId);

            // Also clear job matches since we'll recalculate them
            await supabaseAdmin
                .from('job_matches')
                .delete()
                .eq('resume_id', resumeId);

            // Clear resume skills to recreate them
            await supabaseAdmin
                .from('resume_skills')
                .delete()
                .eq('resume_id', resumeId);
        }

        // Run the analysis
        const result = await analyzeResume(resumeId);

        // Handle failure
        if (!result.success) {
            await supabaseAdmin
                .from('resumes')
                .update({
                    status: 'analysis_failed',
                    processing_error: result.error
                })
                .eq('id', resumeId);

            throw new Error(result.error || 'Analysis failed');
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

// API endpoint to get improvement suggestions
export async function generateImprovementSuggestions(resumeId) {
    try {
        // Get analysis data
        const { data: analysis, error: analysisError } = await supabaseAdmin
            .from('resume_analysis')
            .select('analysis_json')
            .eq('resume_id', resumeId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (analysisError) throw new Error('Analysis not found');

        // Get job matches
        const { data: jobMatches, error: jobError } = await supabaseAdmin
            .from('job_matches')
            .select(`
                job_id,
                match_score,
                match_details,
                jobs(title, company_name)
            `)
            .eq('resume_id', resumeId)
            .order('match_score', { ascending: false })
            .limit(5);

        // Extract data for suggestions
        const suggestions = {
            content: [],
            formatting: [],
            ats: [],
            skills: []
        };

        // Add content suggestions from analysis
        if (analysis.analysis_json.improvement_areas) {
            analysis.analysis_json.improvement_areas.forEach(area => {
                if (area.toLowerCase().includes('format') || area.toLowerCase().includes('layout')) {
                    suggestions.formatting.push(area);
                } else if (area.toLowerCase().includes('ats') || area.toLowerCase().includes('tracking')) {
                    suggestions.ats.push(area);
                } else {
                    suggestions.content.push(area);
                }
            });
        }

        // Add ATS suggestions
        if (analysis.analysis_json.ats_compatibility && analysis.analysis_json.ats_compatibility.recommendations) {
            suggestions.ats = [
                ...suggestions.ats,
                ...analysis.analysis_json.ats_compatibility.recommendations
            ];
        }

        // Gather missing skills from job matches
        if (jobMatches && jobMatches.length > 0) {
            // Extract job details
            const jobInfo = jobMatches.map(match => ({
                title: match.jobs.title,
                company: match.jobs.company_name,
                score: match.match_score,
                missingSkills: (match.match_details?.missing_skills || []).slice(0, 5)
            }));

            // Find common missing skills
            const allMissingSkills = jobMatches
                .filter(match => match.match_details && match.match_details.missing_skills)
                .flatMap(match => match.match_details.missing_skills);

            // Count skill occurrences
            const skillCounts = {};
            allMissingSkills.forEach(skill => {
                skillCounts[skill] = (skillCounts[skill] || 0) + 1;
            });

            // Get top missing skills
            const topMissingSkills = Object.entries(skillCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([skill]) => skill);

            if (topMissingSkills.length > 0) {
                suggestions.skills.push(
                    `Consider adding these skills to your resume to improve job matches: ${topMissingSkills.join(', ')}`
                );
            }

            // Add job-specific suggestions
            jobMatches.forEach(match => {
                if (match.match_score < 70 &&
                    match.match_details &&
                    match.match_details.missing_skills &&
                    match.match_details.missing_skills.length > 0) {
                    suggestions.skills.push(
                        `To improve your match for ${match.jobs.title} at ${match.jobs.company_name}, add these skills: ${match.match_details.missing_skills.slice(0, 3).join(', ')}`
                    );
                }
            });

            // Store suggestions in database
            const { error: saveError } = await supabaseAdmin
                .from('resume_improvement_suggestions')
                .upsert([{
                    resume_id: resumeId,
                    suggestions,
                    target_jobs: jobInfo,
                    created_at: new Date().toISOString()
                }], {
                    onConflict: 'resume_id'
                });

            if (saveError) throw saveError;

            return {
                success: true,
                suggestions,
                targetJobs: jobInfo
            };
        }

        return {
            success: true,
            suggestions
        };

    } catch (error) {
        console.error('Error generating improvement suggestions:', error);
        return {
            success: false,
            error: error.message
        };
    }
}