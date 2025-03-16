// src/server/services/jobMatcher.js - Updated to use OpenAI directly
const { OpenAI } = require('openai');
const { supabaseAdmin } = require('../config/database_connection');

// Initialize OpenAI client with API key from environment variables
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Find job matches for a resume based on skills using OpenAI
 * @param {string} resumeId - Resume ID
 * @returns {Promise<Object>} - Matching results
 */
async function findJobMatches(resumeId) {
    try {
        console.log(`Finding job matches for resume ID: ${resumeId}`);

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

        // Extract skills from various sources
        let skills = [];

        // From resume_skills table
        if (resumeSkills && resumeSkills.length > 0) {
            skills = resumeSkills.map(rs => rs.skills.name);
        }

        // Add skills from the analysis if they're not already in our list
        if (analysis && analysis.analysis_json && analysis.analysis_json.skills) {
            const allAnalysisSkills = [
                ...(analysis.analysis_json.skills.technical || []),
                ...(analysis.analysis_json.skills.soft || []),
                ...(analysis.analysis_json.skills.tools || [])
            ];

            // Get existing skill names
            const existingSkillNames = skills.map(s => s.toLowerCase());

            // Add new skills from analysis
            for (const skillName of allAnalysisSkills) {
                if (!existingSkillNames.includes(skillName.toLowerCase())) {
                    skills.push(skillName);
                }
            }
        }

        // If we still don't have skills, extract them directly from parsed text
        if (skills.length === 0 && parsedData.raw_text) {
            console.log("No skills found, extracting directly from resume text...");

            // Use OpenAI to extract skills
            const extractionResponse = await openai.chat.completions.create({
                model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
                messages: [
                    {
                        role: 'system',
                        content: `You are a skilled resume parser. Extract all professional skills from the provided resume text. 
                        Return the skills as a comma-separated list of single words or short phrases. Include technical skills, 
                        soft skills, tools, programming languages, and other job-relevant competencies.`
                    },
                    {
                        role: 'user',
                        content: parsedData.raw_text.substring(0, 4000) // Limit to prevent token issues
                    }
                ],
                temperature: 0.3,
            });

            const extractedSkillsText = extractionResponse.choices[0].message.content;
            skills = extractedSkillsText.split(',').map(s => s.trim()).filter(s => s);
            console.log(`Extracted ${skills.length} skills directly from resume text`);
        }

        if (skills.length === 0) {
            throw new Error("No skills found in the resume. Cannot find job matches without skills.");
        }

        console.log(`Found ${skills.length} skills to use for job matching`);
        console.log("Skills:", skills.join(", "));

        // Get job matches using OpenAI
        const jobMatchResponse = await openai.chat.completions.create({
            model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
            messages: [
                {
                    role: 'system',
                    content: `You are an expert job matching system. Based on a candidate's skills and experience, provide 
            5-7 realistic job matches that would be suitable. Format your response as a JSON array with the following structure:
            
            [
              {
                "title": "Job Title",
                "company": "Company Name",
                "location": "Location (city or Remote)",
                "jobType": "Full-time/Part-time/Contract",
                "description": "Brief job description",
                "requirements": "Key requirements for the role",
                "matchingSkills": ["Skill1", "Skill2", "Skill3"], // Skills from the resume that match this job
                "missingSkills": ["Skill4", "Skill5"], // Important skills for this job that aren't in the resume
                "salaryRange": "$X - $Y",
                "score": 85, // Match percentage (1-100)
                "url": "https://example.com/job-posting" // Include a realistic job board URL (LinkedIn, Indeed, etc.)
              }
            ]
            
            Make each job realistic and well-matched to the provided skills. For URLs, use realistic job board domains 
            like linkedin.com/jobs, indeed.com, glassdoor.com, etc. with paths that look like real job listings.`
                },,
                {
                    role: 'user',
                    content: `These are my skills: ${skills.join(", ")}
                    
                    ${analysis && analysis.analysis_json && analysis.analysis_json.experience_summary ?
                        `My experience: ${analysis.analysis_json.experience_summary}` : ''}
                        
                    Please find 5-7 suitable job matches. Return only the JSON array.`
                }
            ],
            temperature: 0.7,
            response_format: { type: "json_object" }
        });

        // Parse and process the job matches
        let jsonContent = jobMatchResponse.choices[0].message.content;
        let jobMatches;

        try {
            // Handle case where response might not be properly formatted
            const jsonObject = JSON.parse(jsonContent);
            jobMatches = Array.isArray(jsonObject) ? jsonObject :
                (jsonObject.jobs || jsonObject.matches || []);
        } catch (jsonError) {
            console.error("Error parsing JSON from OpenAI:", jsonError);
            // Try to extract JSON from the text if it's not properly formatted
            const jsonMatch = jsonContent.match(/\[\s*\{.*\}\s*\]/s);
            if (jsonMatch) {
                try {
                    jobMatches = JSON.parse(jsonMatch[0]);
                } catch (e) {
                    throw new Error("Failed to parse job matches from OpenAI response");
                }
            } else {
                throw new Error("Invalid response format from OpenAI");
            }
        }

        // Store the job matches in the database
        console.log(`Storing ${jobMatches.length} job matches for resume ${resumeId}`);

        // Clear existing matches first
        await supabaseAdmin
            .from('job_matches')
            .delete()
            .eq('resume_id', resumeId);

        // Process and store each job match
        for (const match of jobMatches) {
            // In the job storage section of findJobMatches
            const { data: jobData, error: jobError } = await supabaseAdmin
                .from('jobs')
                .upsert({
                    title: match.title,
                    company_name: match.company,
                    location: match.location || 'Remote',
                    job_types: match.jobType || 'Full-time',
                    description: match.description || '',
                    requirements: match.requirements || '',
                    salary_min: parseInt(match.salaryRange?.split('-')[0]?.replace(/\D/g, '') || 0),
                    salary_max: parseInt(match.salaryRange?.split('-')[1]?.replace(/\D/g, '') || 0),
                    url: match.url || `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(match.title)}`, // Default URL if none provided
                    source: 'openai',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'title,company_name',
                    ignoreDuplicates: false
                })
                .select('id')
                .single();

            if (jobError) {
                console.warn(`Warning: Failed to store job "${match.title}":`, jobError);
                continue;
            }

            // Then store the match
            const { error: matchError } = await supabaseAdmin
                .from('job_matches')
                .insert({
                    resume_id: resumeId,
                    job_id: jobData.id,
                    match_score: match.score || 0,
                    match_details: {
                        matchingSkills: match.matchingSkills || [],
                        missingSkills: match.missingSkills || [],
                        skillMatch: match.score || 0,
                        keywordMatch: 0,
                        aiGenerated: true
                    },
                    created_at: new Date().toISOString()
                });

            if (matchError) {
                console.warn(`Warning: Failed to store job match for "${match.title}":`, matchError);
            }
        }

        return {
            success: true,
            resumeId,
            matchCount: jobMatches.length,
            topMatchScore: Math.max(...jobMatches.map(m => m.score || 0), 0),
            message: `Found ${jobMatches.length} job matches`
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
 * Analyze job match using AI for more detailed insights
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
            model: process.env.OPENAI_MODEL || "gpt-3.5-turbo",
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
                    ${resumeData.raw_text.substring(0, 4000)}
                    
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
    // We'll directly use findJobMatches since we're now using OpenAI for job matching
    return findJobMatches(resumeId);
}

module.exports = {
    findJobMatches,
    analyzeJobMatchWithAI,
    getPotentialJobs
};