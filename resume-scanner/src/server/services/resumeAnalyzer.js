// src/server/services/resumeAnalyzer.js
const { Configuration, OpenAIApi } = require("openai");

// Initialize OpenAI with API key
let openai;
try {
    const configuration = new Configuration({
        apiKey: process.env.OPENAI_API_KEY,
    });
    openai = new OpenAIApi(configuration);
} catch (error) {
    console.error("Error initializing OpenAI:", error);
}

/**
 * Analyzes resume text using OpenAI
 * @param {string} resumeText - The extracted resume text
 * @returns {Promise<Object>} - Analysis results
 */
async function analyzeResumeWithAI(resumeText) {
    if (!openai) {
        throw new Error("OpenAI API not initialized");
    }

    try {
        console.log("Starting AI analysis of resume text...");

        const prompt = `
You are an expert resume analyzer with years of recruiting experience. 
Analyze the following resume text and provide structured feedback.

Resume Text:
${resumeText}

Provide a comprehensive analysis in the following JSON format:
{
  "overallScore": number between 1-100,
  "skills": {
    "technical": [list of technical skills identified],
    "soft": [list of soft skills identified],
    "missing": [list of commonly expected skills that are absent]
  },
  "experienceSummary": String summarizing the experience,
  "educationSummary": String summarizing the education,
  "strengths": [list of resume strengths],
  "improvements": [list of suggested improvements],
  "atsCompatibility": {
    "score": number between 1-100,
    "issues": [list of ATS compatibility issues],
    "recommendations": [list of recommendations to improve ATS compatibility]
  },
  "keywordRecommendations": [list of keywords that could be added to enhance the resume]
}

Ensure your response is ONLY the JSON object with no additional text.
`;

        const completion = await openai.createChatCompletion({
            model: process.env.OPENAI_MODEL || "gpt-3.5-turbo",
            messages: [
                { role: "system", content: "You are an expert resume analyst." },
                { role: "user", content: prompt }
            ],
            temperature: 0.2, // Lower temperature for more consistent results
            max_tokens: 2000,
            n: 1
        });

        // Parse the JSON response
        const responseContent = completion.data.choices[0].message.content.trim();
        try {
            const analysisResult = JSON.parse(responseContent);
            console.log("AI analysis completed successfully");
            return {
                success: true,
                analysis: analysisResult,
                model: completion.data.model,
                usage: completion.data.usage
            };
        } catch (jsonError) {
            console.error("Error parsing JSON response:", jsonError);
            throw new Error("Invalid response format from AI analysis");
        }
    } catch (error) {
        console.error("Error analyzing resume with AI:", error);
        return {
            success: false,
            error: error.message || "Unknown error during AI analysis"
        };
    }
}

/**
 * Analyze a resume by ID
 * @param {string} resumeId - The ID of the resume to analyze
 * @param {string} rawText - Optional raw text to analyze (if not provided, it will be fetched)
 * @returns {Promise<Object>} - Analysis results
 */
async function analyzeResume(resumeId, rawText = null) {
    try {
        console.log(`Starting resume analysis for ID: ${resumeId}`);

        // If raw text not provided, fetch it from the database
        if (!rawText) {
            // You need to implement the function to fetch the parsed data
            const parsedData = await getParsedResumeData(resumeId);
            if (!parsedData || !parsedData.raw_text) {
                throw new Error("No parsed text found for this resume");
            }
            rawText = parsedData.raw_text;
        }

        // Send to OpenAI for analysis
        const analysisResult = await analyzeResumeWithAI(rawText);

        if (!analysisResult.success) {
            throw new Error(`AI analysis failed: ${analysisResult.error}`);
        }

        // Store the analysis results in the database
        await storeAnalysisResults(resumeId, analysisResult);

        // Update resume status
        await updateResumeStatus(resumeId, "analyzed");

        return {
            success: true,
            resumeId,
            analysis: analysisResult.analysis
        };
    } catch (error) {
        console.error(`Error in resume analysis process:`, error);
        return {
            success: false,
            resumeId,
            error: error.message || "Unknown error during resume analysis"
        };
    }
}

// Helper functions (implement these based on your database connection)
async function getParsedResumeData(resumeId) {
    // Implement this based on your database connection
    // This should return the parsed resume data from the database
}

async function storeAnalysisResults(resumeId, analysisResult) {
    // Implement this based on your database connection
    // This should store the analysis results in the database
}

async function updateResumeStatus(resumeId, status) {
    // Implement this based on your database connection
    // This should update the resume status in the database
}

module.exports = {
    analyzeResumeWithAI,
    analyzeResume
};