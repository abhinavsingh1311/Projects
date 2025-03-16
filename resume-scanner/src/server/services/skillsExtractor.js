// src/server/services/skillsExtractor.js
const { OpenAI } = require('openai');
const { supabaseAdmin } = require('../config/database_connection');

// Initialize OpenAI client with API key from environment variables
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Extract skills from resume text using AI
 * @param {string} resumeId - The ID of the resume
 * @returns {Promise<Object>} - The extracted skills
 */
async function extractSkillsFromResume(resumeId) {
    try {
        console.log(`Starting skills extraction for resume ID: ${resumeId}`);

        // Get the resume parsed data
        const { data: parsedData, error: parsedError } = await supabaseAdmin
            .from('resume_parsed_data')
            .select('raw_text')
            .eq('resume_id', resumeId)
            .single();

        if (parsedError) {
            console.error('Error fetching parsed resume text:', parsedError);
            throw new Error(`Failed to fetch parsed resume data: ${parsedError.message}`);
        }

        if (!parsedData || !parsedData.raw_text) {
            throw new Error('No parsed text found for this resume.');
        }

        // Check if we already have analysis for this resume
        const { data: existingAnalysis, error: analysisError } = await supabaseAdmin
            .from('resume_analysis')
            .select('analysis_json')
            .eq('resume_id', resumeId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        // If we have existing analysis with skills, use that
        if (existingAnalysis && existingAnalysis.analysis_json && existingAnalysis.analysis_json.skills) {
            console.log('Using existing analysis for skills extraction');
            return {
                success: true,
                skills: existingAnalysis.analysis_json.skills,
                source: 'existing_analysis'
            };
        }

        // Extract skills with AI
        console.log('No existing analysis found, performing AI extraction');
        const extractionResult = await extractSkillsWithAI(parsedData.raw_text);

        if (!extractionResult.success) {
            throw new Error(`AI skills extraction failed: ${extractionResult.error}`);
        }

        // Store the extracted skills
        await storeExtractedSkills(resumeId, extractionResult.skills);

        return {
            success: true,
            resumeId,
            skills: extractionResult.skills,
            source: 'fresh_extraction'
        };
    } catch (error) {
        console.error(`Error in skills extraction process:`, error);
        return {
            success: false,
            resumeId,
            error: error.message || 'Unknown error during skills extraction'
        };
    }
}

/**
 * Extract skills from text using OpenAI
 * @param {string} text - The text to extract skills from
 * @returns {Promise<Object>} - The extracted skills
 */
async function extractSkillsWithAI(text) {
    try {
        const response = await openai.chat.completions.create({
            model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
            messages: [
                {
                    role: 'system',
                    content: `You are an expert skills extractor for resumes. Extract all skills from the provided text and categorize them. 
                    Return only a JSON object with the following structure:
                    {
                        "technical": string[],  // Technical skills like programming languages, frameworks, etc.
                        "soft": string[],       // Soft skills like communication, leadership, etc.
                        "tools": string[],      // Tools and software proficiency
                        "languages": string[],  // Human languages (if any)
                        "certifications": string[] // Professional certifications (if any)
                    }
                    Be comprehensive but precise. Do not include explanatory text outside the JSON structure.`
                },
                {
                    role: 'user',
                    content: text
                }
            ],
            temperature: 0.2,
            response_format: { type: "json_object" }
        });

        const skillsJson = response.choices[0].message.content;
        const skills = JSON.parse(skillsJson);

        return {
            success: true,
            skills,
            model: response.model
        };
    } catch (error) {
        console.error('Error extracting skills with AI:', error);
        return {
            success: false,
            error: error.message || 'Unknown error during AI skills extraction'
        };
    }
}

/**
 * Store extracted skills in the database
 * @param {string} resumeId - Resume ID
 * @param {Object} skills - Extracted skills object
 */
async function storeExtractedSkills(resumeId, skills) {
    try {
        // Combine all skills from different categories
        const allSkills = [
            ...(skills.technical || []),
            ...(skills.soft || []),
            ...(skills.tools || []),
            ...(skills.languages || []),
            ...(skills.certifications || [])
        ];

        // Remove duplicates
        const uniqueSkills = [...new Set(allSkills)];

        if (uniqueSkills.length === 0) return;

        // Process skill storage
        for (const skillName of uniqueSkills) {
            // Determine category
            let category = 'other';
            if (skills.technical && skills.technical.includes(skillName)) {
                category = 'technical';
            } else if (skills.soft && skills.soft.includes(skillName)) {
                category = 'soft';
            } else if (skills.tools && skills.tools.includes(skillName)) {
                category = 'tool';
            } else if (skills.languages && skills.languages.includes(skillName)) {
                category = 'language';
            } else if (skills.certifications && skills.certifications.includes(skillName)) {
                category = 'certification';
            }

            // Check if skill exists
            const { data: existingSkill } = await supabaseAdmin
                .from('skills')
                .select('id')
                .ilike('name', skillName)
                .maybeSingle();

            let skillId;
            if (!existingSkill) {
                // Create skill
                const { data: newSkill, error: skillError } = await supabaseAdmin
                    .from('skills')
                    .insert([{
                        name: skillName,
                        category,
                        created_at: new Date().toISOString()
                    }])
                    .select('id')
                    .single();

                if (skillError) {
                    console.error(`Error creating skill ${skillName}:`, skillError);
                    continue;
                }

                skillId = newSkill.id;
            } else {
                skillId = existingSkill.id;
            }

            // Link skill to resume
            const { error: linkError } = await supabaseAdmin
                .from('resume_skills')
                .upsert([{
                    resume_id: resumeId,
                    skill_id: skillId,
                    level: 'intermediate', // Default level
                    created_at: new Date().toISOString()
                }], {
                    onConflict: 'resume_id,skill_id'
                });

            if (linkError) {
                console.error(`Error linking skill ${skillName} to resume:`, linkError);
            }
        }

        console.log(`Stored ${uniqueSkills.length} skills for resume ${resumeId}`);
    } catch (error) {
        console.error('Error storing extracted skills:', error);
    }
}

module.exports = {
    extractSkillsFromResume,
    extractSkillsWithAI,
    storeExtractedSkills
};