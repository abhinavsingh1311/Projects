// src/server/services/jobMatcher.js
const { supabaseAdmin } = require("../config/database_connection");
const { OpenAI } = require("openai");

// Initialize OpenAI client with API key from environment variables
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Find job matches for a resume based on skills and experience
 * @param {string} resumeId - Resume ID 
 * @returns {Promise<Object>} - Matching results
 */
async function findJobMatches(resumeId) {
    try {
        // Get resume information
        const { data: resume, error: resumeError } = await supabaseAdmin
            .from('resumes')
            .select('id, title, status')
            .eq('id', resumeId)
            .single();

        if (resumeError) {
            throw new Error(`Resume not found: ${resumeError.message}`);
        }

        // Get resume's parsed data
        const { data: parsedData, error: parsedError } = await supabaseAdmin
            .from('resume_parsed_data')
            .select('raw_text, parsed_data')
            .eq('resume_id', resumeId)
            .single();

        if (parsedError) {
            throw new Error(`Parsed data not found: ${parsedError.message}`);
        }

        // Get resume's analysis
        const { data: analysis, error: analysisError } = await supabaseAdmin
            .from('resume_analysis')
            .select('analysis_json')
            .eq('resume_id', resumeId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        // Get all the skills associated with this resume
        const { data: resumeSkills, error: skillsError } = await supabaseAdmin
            .from('resume_skills')
            .select(`
                skill_id,
                level,
                skills(id, name, category)
            `)
            .eq('resume_id', resumeId);

        if (skillsError) {
            console.warn('Error getting resume skills:', skillsError);
        }

        const skills = resumeSkills ? resumeSkills.map(rs => ({
            id: rs.skill_id,
            name: rs.skills.name,
            category: rs.skills.category,
            level: rs.level
        })) : [];

        // Add skills from the analysis if they're not already in our list
        if (analysis && analysis.analysis_json && analysis.analysis_json.skills) {
            const allAnalysisSkills = [
                ...(analysis.analysis_json.skills.technical || []),
                ...(analysis.analysis_json.skills.soft || []),
                ...(analysis.analysis_json.skills.tools || [])
            ];

            // Get existing skill names
            const existingSkillNames = skills.map(s => s.name.toLowerCase());

            // Add new skills from analysis
            for (const skillName of allAnalysisSkills) {
                if (!existingSkillNames.includes(skillName.toLowerCase())) {
                    skills.push({
                        name: skillName,
                        category: 'from_analysis',
                        level: 'intermediate' // Default level
                    });
                }
            }
        }

        // Fetch all jobs
        const { data: allJobs, error: jobsError } = await supabaseAdmin
            .from('jobs')
            .select('*');

        if (jobsError) {
            throw new Error(`Error fetching jobs: ${jobsError.message}`);
        }

        if (!allJobs || allJobs.length === 0) {
            return {
                success: true,
                message: 'No jobs available to match',
                matches: []
            };
        }

        // Get all job skills
        const { data: jobSkills, error: jobSkillsError } = await supabaseAdmin
            .from('job_skills')
            .select(`
                job_id,
                skill_id,
                is_required,
                skills(id, name, category)
            `);

        if (jobSkillsError) {
            throw new Error(`Error fetching job skills: ${jobSkillsError.message}`);
        }

        // Organize job skills by job_id
        const jobSkillMap = {};
        jobSkills.forEach(js => {
            if (!jobSkillMap[js.job_id]) {
                jobSkillMap[js.job_id] = {
                    required: [],
                    optional: [],
                    allSkills: []
                };
            }
            const skillInfo = {
                id: js.skill_id,
                name: js.skills.name,
                category: js.skills.category,
                required: js.is_required
            };
            if (js.is_required) {
                jobSkillMap[js.job_id].required.push(skillInfo);
            } else {
                jobSkillMap[js.job_id].optional.push(skillInfo);
            }
            jobSkillMap[js.job_id].allSkills.push(skillInfo);
        });

        // Calculate matches and scores
        const matches = await calculateJobMatches(
            resumeId,
            allJobs,
            jobSkillMap,
            skills,
            parsedData.raw_text
        );

        // Store the matches in the database
        await saveJobMatches(resumeId, matches);

        return {
            success: true,
            resumeId,
            matchCount: matches.length,
            topMatches: matches.slice(0, 5)
        };
    } catch (error) {
        console.error('Error finding job matches:', error);
        return {
            success: false,
            error: error.message || 'Unknown error finding job matches'
        };
    }
}

/**
 * Calculate job match scores
 * @param {string} resumeId - Resume ID
 * @param {Array} jobs - All available jobs
 * @param {Object} jobSkillMap - Map of job skills
 * @param {Array} resumeSkills - Resume skills
 * @param {string} resumeText - Raw resume text
 * @returns {Array} - Job matches with scores
 */
async function calculateJobMatches(resumeId, jobs, jobSkillMap, resumeSkills, resumeText) {
    // Extract just the skill names from resume skills for easier comparison
    const resumeSkillNames = resumeSkills.map(s => s.name.toLowerCase());

    // Calculate initial match scores based on skill overlap
    const matches = jobs.map(job => {
        // Skip jobs with no skills
        if (!jobSkillMap[job.id]) {
            return {
                resumeId,
                jobId: job.id,
                score: 0,
                matchDetails: {
                    skillMatch: 0,
                    keywordMatch: 0,
                    matchingSkills: [],
                    missingSkills: []
                }
            };
        }

        const jobRequiredSkills = jobSkillMap[job.id].required;
        const jobOptionalSkills = jobSkillMap[job.id].optional;
        const allJobSkills = jobSkillMap[job.id].allSkills;

        // Find matching and missing skills
        const matchingSkills = [];
        const missingSkills = [];

        // Check required skills
        jobRequiredSkills.forEach(skill => {
            if (resumeSkillNames.includes(skill.name.toLowerCase())) {
                matchingSkills.push(skill.name);
            } else {
                missingSkills.push(skill.name);
            }
        });

        // Check optional skills
        jobOptionalSkills.forEach(skill => {
            if (resumeSkillNames.includes(skill.name.toLowerCase())) {
                matchingSkills.push(skill.name);
            }
        });

        // Calculate skill match percentage
        const requiredWeight = 0.7; // Required skills are 70% of the score
        const optionalWeight = 0.3; // Optional skills are 30% of the score

        let skillScore = 0;
        if (jobRequiredSkills.length > 0) {
            const requiredMatchPercentage = matchingSkills.filter(skill =>
                jobRequiredSkills.some(rs => rs.name.toLowerCase() === skill.toLowerCase())
            ).length / jobRequiredSkills.length;
            skillScore += requiredMatchPercentage * requiredWeight * 100;
        } else {
            // If no required skills, award the full required portion
            skillScore += requiredWeight * 100;
        }

        if (jobOptionalSkills.length > 0) {
            const optionalMatchPercentage = matchingSkills.filter(skill =>
                jobOptionalSkills.some(os => os.name.toLowerCase() === skill.toLowerCase())
            ).length / jobOptionalSkills.length;
            skillScore += optionalMatchPercentage * optionalWeight * 100;
        }

        // Add bonus for additional skills beyond those required
        if (matchingSkills.length > (jobRequiredSkills.length + jobOptionalSkills.length) * 0.8) {
            skillScore = Math.min(skillScore + 5, 100);
        }

        // Calculate keyword match (simple version)
        let keywordScore = 0;
        if (job.description) {
            const jobKeywords = extractKeywords(job.description);
            const resumeWords = resumeText.toLowerCase().split(/\W+/);

            let keywordMatches = 0;
            jobKeywords.forEach(keyword => {
                if (resumeWords.includes(keyword.toLowerCase())) {
                    keywordMatches++;
                }
            });

            keywordScore = jobKeywords.length > 0 ?
                (keywordMatches / jobKeywords.length) * 100 : 0;
        }

        // Final score is 80% skill match, 20% keyword match
        const finalScore = (skillScore * 0.8) + (keywordScore * 0.2);

        return {
            resumeId,
            jobId: job.id,
            score: Math.round(finalScore * 10) / 10, // Round to 1 decimal place
            matchDetails: {
                skillMatch: Math.round(skillScore),
                keywordMatch: Math.round(keywordScore),
                matchingSkills,
                missingSkills,
                requiredSkillsCount: jobRequiredSkills.length,
                optionalSkillsCount: jobOptionalSkills.length,
                matchedRequiredCount: matchingSkills.filter(skill =>
                    jobRequiredSkills.some(rs => rs.name.toLowerCase() === skill.toLowerCase())
                ).length
            }
        };
    });

    // Sort by score (descending)
    return matches.sort((a, b) => b.score - a.score);
}

/**
 * Save job matches to the database
 * @param {string} resumeId - Resume ID
 * @param {Array} matches - Job matches
 */
async function saveJobMatches(resumeId, matches) {
    try {
        // Clear existing matches
        await supabaseAdmin
            .from('job_matches')
            .delete()
            .eq('resume_id', resumeId);

        // Only save matches with a score > 0
        const matchesToSave = matches
            .filter(match => match.score > 0)
            .map(match => ({
                resume_id: resumeId,
                job_id: match.jobId,
                match_score: match.score,
                match_details: match.matchDetails,
                created_at: new Date().toISOString()
            }));

        if (matchesToSave.length === 0) return;

        // Insert new matches
        const { error } = await supabaseAdmin
            .from('job_matches')
            .insert(matchesToSave);

        if (error) {
            console.error('Error saving job matches:', error);
        }
    } catch (error) {
        console.error('Error in saveJobMatches:', error);
    }
}

/**
 * Extract important keywords from job description
 * @param {string} text - Job description
 * @returns {Array} - Keywords
 */
function extractKeywords(text) {
    // Simple keyword extraction - you could use NLP libraries for better results
    const commonWords = new Set([
        'the', 'and', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'with', 'by',
        'about', 'as', 'of', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
        'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
        'shall', 'should', 'can', 'could', 'may', 'might', 'must', 'our', 'we',
        'us', 'your', 'you', 'their', 'they', 'them', 'he', 'she', 'it', 'his',
        'her', 'its', 'who', 'whom', 'whose', 'what', 'which', 'that', 'this',
        'these', 'those', 'job', 'work', 'position', 'candidate', 'company',
        'team', 'role', 'experience', 'required', 'qualifications', 'skills'
    ]);

    // Split text into words, remove common words and short words
    const words = text.split(/\W+/)
        .map(word => word.toLowerCase())
        .filter(word => !commonWords.has(word) && word.length > 3);

    // Count word frequency
    const wordCounts = {};
    words.forEach(word => {
        wordCounts[word] = (wordCounts[word] || 0) + 1;
    });

    // Get top keywords by frequency
    return Object.entries(wordCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([word]) => word);
}

/**
 * Enhanced job matching using AI
 * @param {string} resumeId - Resume ID
 * @param {string} jobId - Job ID
 * @returns {Promise<Object>} - Detailed AI analysis of match
 */
async function analyzeJobMatchWithAI(resumeId, jobId) {
    try {
        // Get resume text
        const { data: resumeData, error: resumeError } = await supabaseAdmin
            .from('resume_parsed_data')
            .select('raw_text')
            .eq('resume_id', resumeId)
            .single();

        if (resumeError) {
            throw new Error(`Resume text not found: ${resumeError.message}`);
        }

        // Get job data
        const { data: job, error: jobError } = await supabaseAdmin
            .from('jobs')
            .select('*')
            .eq('id', jobId)
            .single();

        if (jobError) {
            throw new Error(`Job not found: ${jobError.message}`);
        }

        // Use OpenAI to analyze the match
        const response = await openai.chat.completions.create({
            model: process.env.OPENAI_MODEL || "gpt-4o-mini",
            messages: [
                {
                    role: 'system',
                    content: `You are an expert resume reviewer with deep knowledge of job matching. 
                    Analyze how well a resume matches a job description and provide a detailed report in JSON format.`
                },
                {
                    role: 'user',
                    content: `I need a detailed match analysis between this resume and job.
                    
                    RESUME:
                    ${resumeData.raw_text}
                    
                    JOB DESCRIPTION:
                    Title: ${job.title}
                    Company: ${job.company_name}
                    Description: ${job.description}
                    
                    Provide a detailed analysis of how well this resume matches the job requirements. Return your analysis in this JSON format:
                    {
                        "matchPercentage": number (0-100),
                        "overallAssessment": string,
                        "strengths": string[],
                        "gaps": string[],
                        "recommendations": string[],
                        "keySkillsPresent": string[],
                        "keySkillsMissing": string[],
                        "experienceAlignment": {
                            "score": number (0-100),
                            "assessment": string
                        },
                        "educationAlignment": {
                            "score": number (0-100),
                            "assessment": string
                        },
                        "culturalFit": {
                            "score": number (0-100),
                            "assessment": string
                        }
                    }`
                }
            ],
            temperature: 0.2,
            response_format: { type: "json_object" }
        });

        // Parse the response
        const analysisResult = JSON.parse(response.choices[0].message.content);

        // Save the enhanced analysis to the database
        await supabaseAdmin
            .from('job_matches')
            .update({
                match_score: analysisResult.matchPercentage,
                match_details: {
                    ...analysisResult,
                    aiGenerated: true,
                    analyzedAt: new Date().toISOString()
                }
            })
            .eq('resume_id', resumeId)
            .eq('job_id', jobId);

        return {
            success: true,
            resumeId,
            jobId,
            analysis: analysisResult
        };
    } catch (error) {
        console.error('Error analyzing job match with AI:', error);
        return {
            success: false,
            error: error.message || 'Unknown error analyzing job match'
        };
    }
}

/**
 * Gets potential jobs based on resume skills
 * @param {string} resumeId - Resume ID
 * @returns {Promise<Object>} - Potential jobs
 */
async function getPotentialJobs(resumeId) {
    try {
        // Get the resume skills
        const { data: resumeSkills, error: skillsError } = await supabaseAdmin
            .from('resume_skills')
            .select(`
                skills(id, name, category)
            `)
            .eq('resume_id', resumeId);

        if (skillsError) {
            throw new Error(`Error getting resume skills: ${skillsError.message}`);
        }

        // Extract skill IDs
        const skillIds = resumeSkills.map(rs => rs.skills.id);

        if (skillIds.length === 0) {
            return {
                success: true,
                message: 'No skills found for this resume',
                jobs: []
            };
        }

        // Find jobs that require any of these skills
        const { data: jobsWithSkills, error: jobsError } = await supabaseAdmin
            .from('job_skills')
            .select(`
                job_id
            `)
            .in('skill_id', skillIds)
            .limit(100);

        if (jobsError) {
            throw new Error(`Error finding jobs with skills: ${jobsError.message}`);
        }

        if (!jobsWithSkills || jobsWithSkills.length === 0) {
            return {
                success: true,
                message: 'No matching jobs found',
                jobs: []
            };
        }

        // Get unique job IDs
        const jobIds = [...new Set(jobsWithSkills.map(j => j.job_id))];

        // Get the job details
        const { data: jobs, error: jobDetailsError } = await supabaseAdmin
            .from('jobs')
            .select('*')
            .in('id', jobIds)
            .limit(50);

        if (jobDetailsError) {
            throw new Error(`Error getting job details: ${jobDetailsError.message}`);
        }

        return {
            success: true,
            resumeId,
            jobCount: jobs.length,
            jobs
        };
    } catch (error) {
        console.error('Error getting potential jobs:', error);
        return {
            success: false,
            error: error.message || 'Unknown error getting potential jobs'
        };
    }
}

module.exports = {
    findJobMatches,
    analyzeJobMatchWithAI,
    getPotentialJobs
};