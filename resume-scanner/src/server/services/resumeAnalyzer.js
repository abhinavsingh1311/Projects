// src/server/services/resumeAnalyzer.js
const { OpenAI } = require("openai");
const { supabaseAdmin } = require("../config/database_connection");

// Initialize OpenAI client with API key from environment variables
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Update analyzeResumeWithAI() with better prompting:
async function analyzeResumeWithAI(resumeText) {
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{
                role: 'system',
                content: `Analyze this resume strictly using this JSON format:
{
  "overall_score": 0-100,
  "skills": {
    "technical": ["skill1", "skill2"],
    "soft": ["skill1", "skill2"],
    "tools": ["tool1", "tool2"]
  },
  "experience_summary": "2-3 sentences",
  "education_summary": "2-3 sentences",
  "strengths": ["strength1", "strength2"],
  "improvement_areas": ["area1", "area2"],
  "ats_compatibility": {
    "score": 0-100,
    "issues": ["issue1", "issue2"],
    "recommendations": ["recommendation1"]
  },
  "keywords": ["keyword1", "keyword2"]
}`
            }, {
                role: 'user',
                content: `RESUME CONTENT:\n${resumeText.substring(0, 12000)}`
            }],
            temperature: 0.1,
            response_format: { type: "json_object" }
        });

        // Add validation
        const analysis = JSON.parse(response.choices[0].message.content);
        if (!analysis.skills?.technical) {
            throw new Error('Invalid analysis format from AI');
        }

        return { success: true, analysis };
    } catch (error) {
        console.error('AI Analysis Error:', error);
        return {
            success: false,
            error: `AI analysis failed: ${error.message}`
        };
    }
}

// Main function to analyze a resume by ID
async function analyzeResume(resumeId) {
    try {
        // Update status to analyzing
        await supabaseAdmin
            .from('resumes')
            .update({ status: 'analyzing' })
            .eq('id', resumeId);

        // Get the parsed text
        const { data: parsedData, error: parsedError } = await supabaseAdmin
            .from('resume_parsed_data')
            .select('raw_text')
            .eq('resume_id', resumeId)
            .single();

        if (parsedError) throw new Error(`Failed to fetch parsed resume data: ${parsedError.message}`);

        // Send to AI for analysis
        const analysisResult = await analyzeResumeWithAI(parsedData.raw_text);
        if (!analysisResult.success) throw new Error(`AI analysis failed: ${analysisResult.error}`);

        // Store the analysis results
        const { error: insertError } = await supabaseAdmin
            .from('resume_analysis')
            .insert([{
                resume_id: resumeId,
                analysis_json: analysisResult.analysis,
                model_version: analysisResult.model || 'unknown',
                raw_response: analysisResult.usage || {},
                created_at: new Date().toISOString()
            }]);

        if (insertError) throw new Error(`Failed to store analysis results: ${insertError.message}`);

        // Process and save skills
        await processAndSaveSkills(resumeId, analysisResult);

        // Update resume status
        await supabaseAdmin
            .from('resumes')
            .update({
                status: 'analyzed',
                last_analyzed_at: new Date().toISOString()
            })
            .eq('id', resumeId);

        return { success: true, resumeId, analysis: analysisResult.analysis };
    } catch (error) {
        console.error(`Error in resume analysis process:`, error);

        // Update resume status to failed_analysis
        await supabaseAdmin
            .from('resumes')
            .update({
                status: 'analysis_failed',
                processing_error: error.message || 'Unknown analysis error'
            })
            .eq('id', resumeId);

        return {
            success: false,
            resumeId,
            error: error.message || 'Unknown error during resume analysis'
        };
    }
}

/**
 * Update resume status with metadata
 * @param {string} resumeId - Resume ID
 * @param {string} status - New status
 * @param {string} errorMessage - Optional error message
 */
async function updateResumeStatus(resumeId, status, errorMessage = null) {
    try {
        const updateData = {
            status,
            last_processed_at: new Date().toISOString()
        };

        if (status === 'analyzed') {
            updateData.last_analyzed_at = new Date().toISOString();
        }

        if (errorMessage) {
            updateData.processing_error = errorMessage;
        } else {
            // Clear any previous errors if successful
            updateData.processing_error = null;
        }

        const { error } = await supabaseAdmin
            .from('resumes')
            .update(updateData)
            .eq('id', resumeId);

        if (error) {
            console.error(`Failed to update resume status to ${status}:`, error);
            return false;
        }

        return true;
    } catch (error) {
        console.error(`Exception updating resume status to ${status}:`, error);
        return false;
    }
}

/**
 * Store AI analysis results in the database
 * @param {string} resumeId - Resume ID
 * @param {Object} analysisResult - Analysis results from AI
 * @returns {Promise<Object>} - Saved analysis record
 */
async function storeAnalysisResults(resumeId, analysisResult) {
    try {
        const analysisData = {
            resume_id: resumeId,
            analysis_json: analysisResult.analysis,
            model_version: analysisResult.model || 'unknown',
            raw_response: {
                usage: analysisResult.usage || {},
                timestamp: new Date().toISOString()
            },
            created_at: new Date().toISOString()
        };

        const { data, error } = await supabaseAdmin
            .from('resume_analysis')
            .insert([analysisData])
            .select()
            .single();

        if (error) {
            console.error('Error storing analysis results:', error);
            throw new Error(`Failed to store analysis results: ${error.message}`);
        }

        return data;
    } catch (error) {
        console.error('Exception storing analysis results:', error);
        throw error;
    }
}

/**
 * Process and save skills extracted from the resume
 * @param {string} resumeId - Resume ID
 * @param {Object} analysisResult - Skills data from analysis
 */
async function processAndSaveSkills(resumeId, analysisResult) {
    try {
        const skillsData = analysisResult.analysis_json.skills;
        if (!skillsData) return;

        // Combine all skills from different categories
        const allSkills = [
            ...(skillsData.technical || []),
            ...(skillsData.soft || []),
            ...(skillsData.tools || [])
        ];

        // Get parsed data for additional skills
        const { data: parsedData } = await supabaseAdmin
            .from('resume_parsed_data')
            .select('parsed_data')
            .eq('resume_id', resumeId)
            .single();

        // Merge with parsed skills
        if (parsedData?.parsed_data?.skills) {
            allSkills.push(...parsedData.parsed_data.skills);
        }

        // Remove duplicates
        const uniqueSkills = [...new Set(allSkills)];

        if (uniqueSkills.length === 0) return;

        // Process skill storage
        for (const skillName of uniqueSkills) {
            // Skill normalization and storage logic
            const { data: existingSkill } = await supabaseAdmin
                .from('skills')
                .select('id')
                .ilike('name', skillName)
                .maybeSingle();

            let skillId;
            if (!existingSkill) {
                const { data: newSkill } = await supabaseAdmin
                    .from('skills')
                    .insert([{
                        name: skillName,
                        category: determineSkillCategory(skillName)
                    }])
                    .select('id')
                    .single();
                skillId = newSkill.id;
            } else {
                skillId = existingSkill.id;
            }

            // Link to resume
            await supabaseAdmin
                .from('resume_skills')
                .upsert({
                    resume_id: resumeId,
                    skill_id: skillId,
                    created_at: new Date().toISOString()
                }, {
                    onConflict: 'resume_id,skill_id'
                });
        }
    } catch (error) {
        console.error('Error processing skills:', error);
    }
}

function determineSkillCategory(skillName) {
    const categories = {
        technical: ['programming', 'framework', 'database', 'cloud', 'devops'],
        soft: ['communication', 'leadership', 'teamwork'],
        tools: ['software', 'tool', 'platform']
    };

    const lowerSkill = skillName.toLowerCase();
    for (const [category, keywords] of Object.entries(categories)) {
        if (keywords.some(keyword => lowerSkill.includes(keyword))) {
            return category;
        }
    }
    return 'other';
}

/**
 * Determine skill level based on analysis context
 * @param {string} skillName - Name of the skill
 * @param {Object} skillsData - Complete skills data from analysis
 * @returns {string} - Skill level (beginner, intermediate, advanced, expert)
 */
function determineSkillLevel(skillName, skillsData) {
    // Default to intermediate if we can't determine
    return 'intermediate';
}

/**
 * Find job matches for a resume based on skills
 * @param {string} resumeId - Resume ID 
 * @param {Object} skillsData - Skills data from analysis
 */
async function findJobMatches(resumeId, skillsData) {
    try {
        if (!skillsData) return;

        // Combine all skills
        const allSkills = [
            ...(skillsData.technical || []),
            ...(skillsData.soft || []),
            ...(skillsData.tools || []),
            ...(skillsData.certifications || [])
        ];

        if (allSkills.length === 0) return;

        // First get all the skill IDs
        const { data: skillsIds, error: skillsError } = await supabaseAdmin
            .from('skills')
            .select('id, name')
            .in('name', allSkills);

        if (skillsError) {
            console.error('Error fetching skill IDs:', skillsError);
            return;
        }

        const skillIdMap = skillsIds.reduce((map, skill) => {
            map[skill.name] = skill.id;
            return map;
        }, {});

        // Find jobs that require any of these skills
        const { data: jobSkills, error: jobsError } = await supabaseAdmin
            .from('job_skills')
            .select(`
                job_id,
                skill_id,
                is_required,
                skills(name, category)
            `)
            .in('skill_id', skillsIds.map(s => s.id));

        if (jobsError) {
            console.error('Error fetching job skills:', jobsError);
            return;
        }

        if (!jobSkills || jobSkills.length === 0) {
            console.log('No jobs found matching the skills');
            return;
        }

        // Group skills by job
        const jobSkillMap = jobSkills.reduce((map, jobSkill) => {
            if (!map[jobSkill.job_id]) {
                map[jobSkill.job_id] = {
                    requiredSkills: [],
                    optionalSkills: [],
                    skillsMap: {}
                };
            }

            if (jobSkill.is_required) {
                map[jobSkill.job_id].requiredSkills.push(jobSkill.skill_id);
            } else {
                map[jobSkill.job_id].optionalSkills.push(jobSkill.skill_id);
            }

            map[jobSkill.job_id].skillsMap[jobSkill.skill_id] = jobSkill.skills.name;
            return map;
        }, {});

        // Now fetch the actual jobs
        const { data: jobs, error: jobsFetchError } = await supabaseAdmin
            .from('jobs')
            .select('*')
            .in('id', Object.keys(jobSkillMap));

        if (jobsFetchError) {
            console.error('Error fetching jobs:', jobsFetchError);
            return;
        }

        // Calculate match scores for each job
        const jobMatches = jobs.map(job => {
            const jobSkills = jobSkillMap[job.id];

            // Get resume skill IDs
            const resumeSkillIds = Object.values(skillIdMap);

            // Calculate match percentage
            const matchingRequiredSkills = jobSkills.requiredSkills.filter(id =>
                resumeSkillIds.includes(id)
            );

            const matchingOptionalSkills = jobSkills.optionalSkills.filter(id =>
                resumeSkillIds.includes(id)
            );

            // Calculate score
            let score = 0;
            const totalRequired = jobSkills.requiredSkills.length;
            const totalOptional = jobSkills.optionalSkills.length;

            // Required skills are weighted more (70% of score)
            if (totalRequired > 0) {
                score += (matchingRequiredSkills.length / totalRequired) * 70;
            } else {
                // If no required skills, then the 70% is automatically added
                score += 70;
            }

            // Optional skills make up the remaining 30%
            if (totalOptional > 0) {
                score += (matchingOptionalSkills.length / totalOptional) * 30;
            }

            // Generate matching and missing skills lists
            const matchingSkills = [
                ...matchingRequiredSkills,
                ...matchingOptionalSkills
            ].map(id => jobSkills.skillsMap[id]);

            const missingRequiredSkills = jobSkills.requiredSkills
                .filter(id => !resumeSkillIds.includes(id))
                .map(id => jobSkills.skillsMap[id]);

            return {
                resume_id: resumeId,
                job_id: job.id,
                match_score: score,
                match_details: {
                    matching_skills: matchingSkills,
                    missing_skills: missingRequiredSkills,
                    total_required: totalRequired,
                    total_optional: totalOptional,
                    matched_required: matchingRequiredSkills.length,
                    matched_optional: matchingOptionalSkills.length
                },
                created_at: new Date().toISOString()
            };
        });

        // Save job matches to the database
        for (const match of jobMatches) {
            const { error: matchSaveError } = await supabaseAdmin
                .from('job_matches')
                .upsert([match], {
                    onConflict: 'resume_id,job_id'
                });

            if (matchSaveError) {
                console.error(`Error saving job match for job ${match.job_id}:`, matchSaveError);
            }
        }

        console.log(`Successfully calculated and saved ${jobMatches.length} job matches for resume ${resumeId}`);

    } catch (error) {
        console.error('Error finding job matches:', error);
    }
}

/**
 * Re-analyze a resume that has already been analyzed
 * @param {string} resumeId - The ID of the resume to re-analyze
 * @returns {Promise<Object>} - The analysis results
 */
async function reanalyzeResume(resumeId) {
    try {
        // Delete existing analysis if any
        await supabaseAdmin
            .from('resume_analysis')
            .delete()
            .eq('resume_id', resumeId);

        // Clear existing skill connections
        await supabaseAdmin
            .from('resume_skills')
            .delete()
            .eq('resume_id', resumeId);

        // Clear existing job matches
        await supabaseAdmin
            .from('job_matches')
            .delete()
            .eq('resume_id', resumeId);

        // Run analysis
        return await analyzeResume(resumeId);
    } catch (error) {
        console.error('Error during resume re-analysis:', error);
        return {
            success: false,
            resumeId,
            error: error.message || 'Unknown error during resume re-analysis'
        };
    }
}

/**
 * Get the analysis results for a resume
 * @param {string} resumeId - The ID of the resume
 * @returns {Promise<Object>} - The analysis data
 */
async function getResumeAnalysis(resumeId) {
    try {
        const { data, error } = await supabaseAdmin
            .from('resume_analysis')
            .select('*')
            .eq('resume_id', resumeId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error) {
            throw error;
        }

        // Also get associated skills
        const { data: skills, error: skillsError } = await supabaseAdmin
            .from('resume_skills')
            .select(`
                level,
                skills(id, name, category)
            `)
            .eq('resume_id', resumeId);

        if (skillsError) {
            console.warn('Error fetching resume skills:', skillsError);
        }

        // Get job matches
        const { data: jobMatches, error: matchesError } = await supabaseAdmin
            .from('job_matches')
            .select(`
                match_score,
                match_details,
                jobs(id, title, company_name, location)
            `)
            .eq('resume_id', resumeId)
            .order('match_score', { ascending: false })
            .limit(5);

        if (matchesError) {
            console.warn('Error fetching job matches:', matchesError);
        }

        return {
            success: true,
            analysis: data,
            skills: skills || [],
            jobMatches: jobMatches || [],
            enhancedData: {
                skillsByCategory: organizeSkillsByCategory(skills || []),
                topMatches: (jobMatches || []).slice(0, 3)
            }
        };
    } catch (error) {
        console.error('Error fetching resume analysis:', error);
        return {
            success: false,
            error: error.message || 'Failed to fetch analysis'
        };
    }
}

/**
 * Organize skills by category for better display
 * @param {Array} skills - Skills array from database
 * @returns {Object} - Skills organized by category
 */
function organizeSkillsByCategory(skills) {
    const result = {
        technical: [],
        soft: [],
        tools: [],
        certifications: [],
        other: []
    };

    skills.forEach(skillItem => {
        const skill = skillItem.skills;
        const category = skill.category || 'other';

        // Map database category to our display categories
        let targetCategory = 'other';
        if (category === 'technical') targetCategory = 'technical';
        else if (category === 'soft') targetCategory = 'soft';
        else if (category === 'tool') targetCategory = 'tools';
        else if (category === 'certification') targetCategory = 'certifications';

        result[targetCategory].push({
            id: skill.id,
            name: skill.name,
            level: skillItem.level
        });
    });

    return result;
}

/**
 * Get ATS improvement recommendations based on analysis
 * @param {string} resumeId - Resume ID
 * @returns {Promise<Object>} - ATS recommendations
 */
async function getATSRecommendations(resumeId) {
    try {
        const { data, error } = await supabaseAdmin
            .from('resume_analysis')
            .select('analysis_json')
            .eq('resume_id', resumeId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error) {
            throw error;
        }

        if (!data || !data.analysis_json || !data.analysis_json.ats_compatibility) {
            return {
                success: false,
                error: 'No ATS compatibility data found'
            };
        }

        const atsData = data.analysis_json.ats_compatibility;

        return {
            success: true,
            atsScore: atsData.score,
            issues: atsData.issues || [],
            recommendations: atsData.recommendations || []
        };
    } catch (error) {
        console.error('Error fetching ATS recommendations:', error);
        return {
            success: false,
            error: error.message || 'Failed to fetch ATS recommendations'
        };
    }
}

/**
 * Generate personalized improvement suggestions for a resume
 * @param {string} resumeId - The resume ID
 * @returns {Promise<Object>} - Improvement suggestions
 */
async function generateImprovementSuggestions(resumeId) {
    try {
        // Get the resume analysis
        const { data: analysis, error: analysisError } = await supabaseAdmin
            .from('resume_analysis')
            .select('analysis_json')
            .eq('resume_id', resumeId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (analysisError) {
            throw analysisError;
        }

        // Get job matches to include in suggestions
        const { data: jobMatches, error: matchesError } = await supabaseAdmin
            .from('job_matches')
            .select(`
                job_id,
                match_score,
                match_details,
                jobs(title, company_name)
            `)
            .eq('resume_id', resumeId)
            .order('match_score', { ascending: false })
            .limit(3);

        if (matchesError) {
            console.warn('Error fetching job matches for suggestions:', matchesError);
        }

        // Extract job titles and missing skills
        const jobInfo = (jobMatches || []).map(match => ({
            title: match.jobs.title,
            company: match.jobs.company_name,
            score: match.match_score,
            missingSkills: (match.match_details?.missing_skills || []).slice(0, 5)
        }));

        // Process improvement areas from analysis
        const improvementAreas = analysis.analysis_json.improvement_areas || [];
        const atsIssues = analysis.analysis_json.ats_compatibility?.issues || [];

        // Organize suggestions by category
        const suggestions = {
            content: improvementAreas.filter(item =>
                !item.toLowerCase().includes('ats') &&
                !item.toLowerCase().includes('format')
            ),
            formatting: improvementAreas.filter(item =>
                item.toLowerCase().includes('format')
            ),
            ats: atsIssues,
            skills: []
        };

        // Add skill suggestions based on job matches
        if (jobInfo.length > 0) {
            // Get all missing skills across top job matches
            const allMissingSkills = jobInfo.flatMap(job => job.missingSkills);

            // Count occurrences of each skill
            const skillCounts = allMissingSkills.reduce((counts, skill) => {
                counts[skill] = (counts[skill] || 0) + 1;
                return counts;
            }, {});

            // Sort by frequency
            const topMissingSkills = Object.entries(skillCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([skill]) => skill);

            if (topMissingSkills.length > 0) {
                suggestions.skills.push(
                    `Consider adding these skills to your resume: ${topMissingSkills.join(', ')}`
                );
            }

            // Add job-specific suggestions
            jobInfo.forEach(job => {
                if (job.score < 70 && job.missingSkills.length > 0) {
                    suggestions.skills.push(
                        `To improve your match for ${job.title} at ${job.company}, add these skills: ${job.missingSkills.join(', ')}`
                    );
                }
            });
        }

        return {
            success: true,
            suggestions,
            targetJobs: jobInfo
        };
    } catch (error) {
        console.error('Error generating improvement suggestions:', error);
        return {
            success: false,
            error: error.message || 'Failed to generate improvement suggestions'
        };
    }
}

/**
 * Process all resumes that have been parsed but not analyzed
 * @returns {Promise<Object>} - Processing results
 */
async function analyzeAllParsedResumes() {
    try {
        // Find all resumes with status 'parsed'
        const { data: pendingResumes, error: fetchError } = await supabaseAdmin
            .from('resumes')
            .select('id')
            .in('status', ['parsed', 'parsed_with_warnings']);

        if (fetchError) throw fetchError;

        console.log(`Found ${pendingResumes.length} parsed resumes to analyze`);

        const results = {
            total: pendingResumes.length,
            successful: 0,
            failed: 0,
            details: []
        };

        // Analyze each resume
        for (const resume of pendingResumes) {
            try {
                const result = await analyzeResume(resume.id);

                if (result.success) {
                    results.successful++;
                } else {
                    results.failed++;
                }

                results.details.push(result);
            } catch (error) {
                results.failed++;
                results.details.push({
                    success: false,
                    resumeId: resume.id,
                    error: error.message || 'Unknown error'
                });
            }
        }

        return results;
    } catch (error) {
        console.error('Error analyzing parsed resumes:', error);
        return {
            success: false,
            error: error.message || 'Unknown error analyzing parsed resumes'
        };
    }
}

module.exports = {
    analyzeResumeWithAI,
    analyzeResume,
    reanalyzeResume,
    getResumeAnalysis,
    analyzeAllParsedResumes,
    getATSRecommendations,
    generateImprovementSuggestions,
    findJobMatches,
    processAndSaveSkills
};