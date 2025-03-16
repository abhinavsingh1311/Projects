// src/pages/api/job-matches.js - Updated with fallback for storing issues
import { supabase } from '@/server/utils/supabase-client';
import { supabaseAdmin } from '@/server/config/database_connection';
import {getJobRecommendations} from "@/server/services/jobMatchingService";
const { findJobMatches } = require('@/server/services/jobMatcher');

export default async function handler(req, res) {
    // Set CORS headers for development
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow GET requests
    if (req.method !== 'GET') {
        return res.status(405).json({
            success: false,
            error: 'Method not allowed'
        });
    }

    try {
        // Authenticate user
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }

        const token = authHeader.split(' ')[1];
        // Authentication code here...
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            return res.status(401).json({
                success: false,
                error: 'Authentication failed'
            });
        }

        // Check if we're requesting recommendations
        const { type } = req.query;

        if (type === 'recommendations') {
            console.log('Fetching job recommendations for user:', user.id);

            // Call the recommendations service
            const recommendations = await getJobRecommendations(user.id);

            if (!recommendations.success) {
                return res.status(500).json({
                    success: false,
                    error: recommendations.error || 'Failed to get job recommendations'
                });
            }

            return res.status(200).json(recommendations);
        }

        // Get the user's most recent analyzed resume
        const { data: recentResume, error: resumeError } = await supabaseAdmin
            .from('resumes')
            .select('id, title, status')
            .eq('user_id', user.id)
            .in('status', ['parsed', 'analyzed', 'completed']) // Include all processed states
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (resumeError) {
            return res.status(404).json({
                success: false,
                message: 'No analyzed resumes found for this user',
                matches: [],
                stats: {
                    totalMatches: 0,
                    averageScore: 0,
                    topMatchScore: 0
                }
            });
        }

        // Check if we have existing job matches
        const { data: existingMatches, error: matchesError } = await supabaseAdmin
            .from('job_matches')
            .select(`
                id, job_id, match_score, match_details,
                jobs(id, title, company_name, location, job_types, salary_min, salary_max, description)
            `)
            .eq('resume_id', recentResume.id)
            .order('match_score', { ascending: false });

        // If we have matches, use them
        if (!matchesError && existingMatches && existingMatches.length > 0) {
            console.log(`Found ${existingMatches.length} existing matches for resume ${recentResume.id}`);
            return formatAndReturnMatches(res, existingMatches, recentResume);
        }

        // Otherwise generate new matches using OpenAI
        console.log('No existing matches found, generating new matches with OpenAI');

        // Call the findJobMatches function which now uses OpenAI
        const matchResult = await findJobMatches(recentResume.id);

        if (!matchResult.success) {
            return res.status(500).json({
                success: false,
                error: matchResult.error || 'Failed to generate job matches'
            });
        }

        // Check if any matches were stored
        const { data: newMatches, error: newMatchesError } = await supabaseAdmin
            .from('job_matches')
            .select(`
                id, job_id, match_score, match_details,
                jobs(id, title, company_name, location, job_types, salary_min, salary_max, description)
            `)
            .eq('resume_id', recentResume.id)
            .order('match_score', { ascending: false });

        // If there are stored matches, use them
        if (!newMatchesError && newMatches && newMatches.length > 0) {
            console.log(`Using ${newMatches.length} stored job matches`);
            return formatAndReturnMatches(res, newMatches, recentResume);
        }

        // If we couldn't store matches but have OpenAI response, return it directly
        // This is our fallback when database storage fails
        if (matchResult.rawMatches && matchResult.rawMatches.length > 0) {
            console.log('Using raw OpenAI job matches since storage failed');

            // When formatting matches for display
            const formattedMatches = matches.map(match => ({
                id: match.id,
                jobId: match.job_id,
                score: match.match_score,
                title: match.jobs?.title || 'Unknown Job',
                company: match.jobs?.company_name || 'Unknown Company',
                location: match.jobs?.location || 'Remote',
                jobType: match.jobs?.job_types || 'Full-time',
                salaryMin: match.jobs?.salary_min,
                salaryMax: match.jobs?.salary_max,
                matchingSkills: match.match_details?.matchingSkills || [],
                missingSkills: match.match_details?.missingSkills || [],
                description: match.jobs?.description?.substring(0, 150) + (match.jobs?.description?.length > 150 ? '...' : ''),
                url: match.jobs?.url || `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(match.jobs?.title || 'jobs')}`
            }));

            // Calculate stats
            const scores = formattedMatches.map(match => match.score);
            const totalMatches = formattedMatches.length;
            const averageScore = totalMatches > 0
                ? Math.round(scores.reduce((sum, score) => sum + score, 0) / totalMatches)
                : 0;
            const topMatchScore = totalMatches > 0 ? Math.max(...scores) : 0;

            return res.status(200).json({
                success: true,
                resumeId: recentResume.id,
                resumeTitle: recentResume.title,
                matches: formattedMatches,
                fromOpenAI: true, // Flag to indicate these are direct from OpenAI
                stats: {
                    totalMatches,
                    averageScore,
                    topMatchScore
                }
            });
        }

        // If we got here, we couldn't get or store any matches
        return res.status(404).json({
            success: false,
            message: 'No job matches found and could not generate new matches',
            matches: [],
            stats: {
                totalMatches: 0,
                averageScore: 0,
                topMatchScore: 0
            }
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

// Helper function to format matches for response
function formatAndReturnMatches(res, matches, resumeInfo) {
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
        title: match.jobs?.title || 'Unknown Job',
        company: match.jobs?.company_name || 'Unknown Company',
        location: match.jobs?.location || 'Remote',
        jobType: match.jobs?.job_types || 'Full-time',
        salaryMin: match.jobs?.salary_min,
        salaryMax: match.jobs?.salary_max,
        matchingSkills: match.match_details?.matchingSkills || [],
        missingSkills: match.match_details?.missingSkills || [],
        description: match.jobs?.description?.substring(0, 150) + (match.jobs?.description?.length > 150 ? '...' : '')
    }));

    return res.status(200).json({
        success: true,
        resumeId: resumeInfo.id,
        resumeTitle: resumeInfo.title,
        matches: formattedMatches,
        stats: {
            totalMatches,
            averageScore,
            topMatchScore
        }
    });
}