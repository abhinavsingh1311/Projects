// src/server/services/jobMatchingService.js
const { findJobMatches, analyzeJobMatchWithAI, getPotentialJobs } = require('./jobMatcher');
const { extractSkillsFromResume } = require('./skillsExtractor');
const { supabaseAdmin } = require('../config/database_connection');

/**
 * Get job matches for the user's resumes
 * @param {string} userId - The user ID
 * @param {number} limit - Maximum number of job matches to return
 * @returns {Promise<Object>} - Job matches and stats
 */
async function getUserJobMatches(userId, limit = 5) {
    try {
        // Get the user's resumes
        const { data: resumes, error: resumesError } = await supabaseAdmin
            .from('resumes')
            .select('id, title, status')
            .eq('user_id', userId)
            .in('status', ['parsed', 'analyzed', 'completed'])
            .order('created_at', { ascending: false });

        if (resumesError) {
            throw new Error(`Failed to fetch user resumes: ${resumesError.message}`);
        }

        if (!resumes || resumes.length === 0) {
            return {
                success: true,
                message: 'No analyzed resumes found for this user',
                matches: [],
                stats: {
                    totalMatches: 0,
                    averageScore: 0,
                    topMatchScore: 0
                }
            };
        }

        // Get job matches for the most recent resume
        const primaryResumeId = resumes[0].id;

        // Check if we already have matches
        const { data: existingMatches, error: matchesError } = await supabaseAdmin
            .from('job_matches')
            .select(`
                *,
                jobs(id, title, company_name, location, job_types, salary_min, salary_max, description)
            `)
            .eq('resume_id', primaryResumeId)
            .order('match_score', { ascending: false })
            .limit(limit);

        if (matchesError) {
            throw new Error(`Error fetching existing matches: ${matchesError.message}`);
        }

        // If no matches found, generate them
        if (!existingMatches || existingMatches.length === 0) {
            console.log('No existing matches found, generating new matches');

            // Extract skills if needed (the job matcher will handle this too, but this is a pre-check)
            const skillsResult = await extractSkillsFromResume(primaryResumeId);

            if (!skillsResult.success) {
                console.warn('Skills extraction warning:', skillsResult.error);
            }

            // Find job matches
            const matchResult = await findJobMatches(primaryResumeId);

            if (!matchResult.success) {
                throw new Error(`Failed to generate job matches: ${matchResult.error}`);
            }

            // Fetch the newly created matches
            const { data: newMatches, error: newMatchesError } = await supabaseAdmin
                .from('job_matches')
                .select(`
                    *,
                    jobs(id, title, company_name, location, job_types, salary_min, salary_max, description)
                `)
                .eq('resume_id', primaryResumeId)
                .order('match_score', { ascending: false })
                .limit(limit);

            if (newMatchesError) {
                throw new Error(`Error fetching new matches: ${newMatchesError.message}`);
            }

            return formatJobMatchesResponse(newMatches || [], primaryResumeId, resumes[0].title);
        }

        return formatJobMatchesResponse(existingMatches, primaryResumeId, resumes[0].title);
    } catch (error) {
        console.error('Error in getUserJobMatches:', error);
        return {
            success: false,
            error: error.message || 'Unknown error getting job matches'
        };
    }
}

/**
 * Format job matches response with stats
 * @param {Array} matches - The job matches
 * @param {string} resumeId - The resume ID
 * @param {string} resumeTitle - The resume title
 * @returns {Object} - Formatted response
 */
function formatJobMatchesResponse(matches, resumeId, resumeTitle) {
    // Calculate stats
    const scores = matches.map(match => match.match_score);
    const totalMatches = matches.length;
    const averageScore = totalMatches > 0
        ? Math.round(scores.reduce((sum, score) => sum + score, 0) / totalMatches)
        : 0;
    const topMatchScore = totalMatches > 0 ? Math.max(...scores) : 0;

    // Format matches for display
    const formattedMatches = matches.map(match => ({
        id: match.id,
        jobId: match.job_id,
        score: match.match_score,
        title: match.jobs.title,
        company: match.jobs.company_name,
        location: match.jobs.location || 'Remote',
        jobType: match.jobs.job_types || 'Full-time',
        salaryMin: match.jobs.salary_min,
        salaryMax: match.jobs.salary_max,
        matchingSkills: match.match_details?.matching_skills || [],
        missingSkills: match.match_details?.missing_skills || [],
        description: match.jobs.description?.substring(0, 150) + (match.jobs.description?.length > 150 ? '...' : '')
    }));

    return {
        success: true,
        resumeId,
        resumeTitle,
        matches: formattedMatches,
        stats: {
            totalMatches,
            averageScore,
            topMatchScore
        }
    };
}

/**
 * Get detailed job match for a specific job
 * @param {string} resumeId - The resume ID
 * @param {string} jobId - The job ID
 * @returns {Promise<Object>} - Detailed job match
 */
async function getDetailedJobMatch(resumeId, jobId) {
    try {
        // Check if we have an AI-enhanced analysis
        const { data: match, error: matchError } = await supabaseAdmin
            .from('job_matches')
            .select(`
                *,
                jobs(id, title, company_name, location, job_types, salary_min, salary_max, description, requirements)
            `)
            .eq('resume_id', resumeId)
            .eq('job_id', jobId)
            .single();

        if (matchError) {
            throw new Error(`Match not found: ${matchError.message}`);
        }

        // Check if it has AI analysis
        if (!match.match_details?.aiGenerated) {
            // Generate AI analysis
            console.log('No AI analysis found, generating one');
            const analysisResult = await analyzeJobMatchWithAI(resumeId, jobId);

            if (!analysisResult.success) {
                console.warn('AI analysis failed, using basic match details', analysisResult.error);
                // Continue with basic match data
            } else {
                // Refresh match data with AI analysis
                const { data: updatedMatch, error: updateError } = await supabaseAdmin
                    .from('job_matches')
                    .select(`
                        *,
                        jobs(id, title, company_name, location, job_types, salary_min, salary_max, description, requirements)
                    `)
                    .eq('resume_id', resumeId)
                    .eq('job_id', jobId)
                    .single();

                if (!updateError) {
                    return {
                        success: true,
                        match: updatedMatch,
                        enhanced: true
                    };
                }
            }
        }

        return {
            success: true,
            match,
            enhanced: !!match.match_details?.aiGenerated
        };
    } catch (error) {
        console.error('Error in getDetailedJobMatch:', error);
        return {
            success: false,
            error: error.message || 'Unknown error getting detailed job match'
        };
    }
}

/**
 * Get job recommendations based on user resumes
 * @param {string} userId - The user ID
 * @param {number} limit - Maximum number of recommendations
 * @returns {Promise<Object>} - Job recommendations
 */
async function getJobRecommendations(userId, limit = 3) {
    try {
        // Get the user's most recent resume that has been analyzed
        const { data: recentResume, error: resumeError } = await supabaseAdmin
            .from('resumes')
            .select('id, title')
            .eq('user_id', userId)
            .in('status', ['analyzed', 'completed'])
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (resumeError) {
            // If no analyzed resume, get the most recent parsed resume
            const { data: parsedResume, error: parsedError } = await supabaseAdmin
                .from('resumes')
                .select('id, title')
                .eq('user_id', userId)
                .eq('status', 'parsed')
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (parsedError) {
                return {
                    success: true,
                    message: 'No analyzed or parsed resumes found',
                    recommendations: []
                };
            }

            // Use the parsed resume instead
            const potentialJobs = await getPotentialJobs(parsedResume.id);

            if (!potentialJobs.success) {
                throw new Error(`Failed to get potential jobs: ${potentialJobs.error}`);
            }

            // Format for display
            const recommendations = (potentialJobs.jobs || [])
                .slice(0, limit)
                .map(job => ({
                    id: job.id,
                    title: job.title,
                    company: job.company_name,
                    location: job.location || 'Remote',
                    jobType: job.job_types || 'Full-time',
                    description: job.description?.substring(0, 150) + (job.description?.length > 150 ? '...' : '')
                }));

            return {
                success: true,
                resumeId: parsedResume.id,
                resumeTitle: parsedResume.title,
                recommendations,
                source: 'potential_jobs'
            };
        }

        // Get job matches for the analyzed resume
        const jobMatches = await getUserJobMatches(userId, limit);

        if (!jobMatches.success) {
            throw new Error(`Failed to get job matches: ${jobMatches.error}`);
        }

        return {
            success: true,
            resumeId: recentResume.id,
            resumeTitle: recentResume.title,
            recommendations: jobMatches.matches,
            source: 'job_matches'
        };
    } catch (error) {
        console.error('Error in getJobRecommendations:', error);
        return {
            success: false,
            error: error.message || 'Unknown error getting job recommendations'
        };
    }
}

module.exports = {
    getUserJobMatches,
    getDetailedJobMatch,
    getJobRecommendations
};