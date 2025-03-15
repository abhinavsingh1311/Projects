// src/server/services/resumeAnalyzer.js
const { OpenAI } = require("openai");
const { supabaseAdmin } = require("../config/database_connection");

// Initialize OpenAI client with API key from environment variables
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Analyzes resume text using OpenAI's API
 * @param {string} resumeText - The extracted resume text
 * @returns {Promise<Object>} - The AI analysis results
 */
async function analyzeResumeWithAI(resumeText) {
    try {
        console.log('Starting AI analysis of resume text...');

        const response = await openai.chat.completions.create({
            model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
            messages: [
                {
                    role: 'system',
                    content: `You are an expert resume analyzer with years of recruiting experience. 
          Analyze the resume text and provide a detailed assessment in the following JSON structure:
          
          {
            "overall_score": number (1-100),
            "skills": {
              "technical": string[],
              "soft": string[],
              "tools": string[]
            },
            "experience_summary": string,
            "education_summary": string,
            "strengths": string[],
            "improvement_areas": string[],
            "ats_compatibility": {
              "score": number (1-100),
              "issues": string[],
              "recommendations": string[]
            },
            "keywords": string[]
          }
          
          Be comprehensive but concise. Focus on actionable insights.`
                },
                {
                    role: 'user',
                    content: resumeText
                }
            ],
            temperature: 0.2,
            response_format: { type: "json_object" }
        });

        // Parse and return the analysis JSON
        const analysisText = response.choices[0].message.content;
        const analysis = JSON.parse(analysisText);

        console.log('AI analysis completed successfully');

        return {
            success: true,
            analysis,
            model: response.model,
            usage: response.usage
        };
    } catch (error) {
        console.error('Error analyzing resume with AI:', error);
        return {
            success: false,
            error: error.message || 'Unknown error during AI analysis',
            errorDetails: error
        };
    }
}

/**
 * Analyze a resume by ID - fetches the parsed text and sends for AI analysis
 * @param {string} resumeId - The ID of the resume to analyze
 * @returns {Promise<Object>} - The analysis results
 */
async function analyzeResume(resumeId) {
    try {
        console.log(`Starting resume analysis for ID: ${resumeId}`);

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

        if (parsedError) {
            console.error('Error fetching parsed resume text:', parsedError);
            throw new Error(`Failed to fetch parsed resume data: ${parsedError.message}`);
        }

        if (!parsedData || !parsedData.raw_text) {
            // Enhanced error logging
            console.error(`No parsed text found for resume ${resumeId}`);

            // Check if resume exists
            const { data: resume } = await supabaseAdmin
                .from('resumes')
                .select('status, file_path')
                .eq('id', resumeId)
                .single();

            if (resume) {
                console.log(`Resume exists with status: ${resume.status}, path: ${resume.file_path}`);
            }

            throw new Error('No parsed text found for this resume. Text extraction may have failed.');
        }

        // Send to AI for analysis
        const analysisResult = await analyzeResumeWithAI(parsedData.raw_text);

        if (!analysisResult.success) {
            throw new Error(`AI analysis failed: ${analysisResult.error}`);
        }

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

        if (insertError) {
            console.error('Error storing analysis results:', insertError);
            throw new Error(`Failed to store analysis results: ${insertError.message}`);
        }

        // Update resume status
        await supabaseAdmin
            .from('resumes')
            .update({
                status: 'analyzed',
                last_analyzed_at: new Date().toISOString()
            })
            .eq('id', resumeId);

        return {
            success: true,
            resumeId,
            analysis: analysisResult.analysis
        };
    } catch (error) {
        console.error(`Error in resume analysis process:`, error);

        // Update resume status to failed_analysis
        try {
            await supabaseAdmin
                .from('resumes')
                .update({
                    status: 'analysis_failed',
                    processing_error: error.message || 'Unknown analysis error'
                })
                .eq('id', resumeId);
        } catch (updateError) {
            console.error('Failed to update status after analysis error:', updateError);
        }

        return {
            success: false,
            resumeId,
            error: error.message || 'Unknown error during resume analysis'
        };
    }
}

/**
 * Process and save skills extracted from the resume
 * @param {string} resumeId - Resume ID
 * @param {Object} analysisResult - Analysis results from AI
 */
async function processAndSaveSkills(resumeId, analysisResult) {
    try {
        const skillsData = analysisResult.analysis.skills;
        if (!skillsData) return;

        // Combine all skills from different categories
        const allSkills = [
            ...(skillsData.technical || []),
            ...(skillsData.soft || []),
            ...(skillsData.tools || [])
        ];

        // Remove duplicates
        const uniqueSkills = [...new Set(allSkills)];

        if (uniqueSkills.length === 0) return;

        // Process skill storage
        for (const skillName of uniqueSkills) {
            // Check if skill exists
            const { data: existingSkill } = await supabaseAdmin
                .from('skills')
                .select('id')
                .ilike('name', skillName)
                .maybeSingle();

            let skillId;
            if (!existingSkill) {
                // Determine category based on which array it came from
                let category = 'other';
                if (skillsData.technical && skillsData.technical.includes(skillName)) {
                    category = 'technical';
                } else if (skillsData.soft && skillsData.soft.includes(skillName)) {
                    category = 'soft';
                } else if (skillsData.tools && skillsData.tools.includes(skillName)) {
                    category = 'tool';
                }

                // Create skill
                const { data: newSkill } = await supabaseAdmin
                    .from('skills')
                    .insert([{
                        name: skillName,
                        category
                    }])
                    .select('id')
                    .single();

                skillId = newSkill.id;
            } else {
                skillId = existingSkill.id;
            }

            // Link skill to resume
            await supabaseAdmin
                .from('resume_skills')
                .upsert([{
                    resume_id: resumeId,
                    skill_id: skillId,
                    level: 'intermediate', // Default level
                    created_at: new Date().toISOString()
                }], {
                    onConflict: 'resume_id,skill_id'
                });
        }

        console.log(`Processed and saved ${uniqueSkills.length} skills for resume ${resumeId}`);
    } catch (error) {
        console.error('Error processing skills:', error);
    }
}
module.exports = {
    analyzeResumeWithAI,
    analyzeResume,
    processAndSaveSkills
};