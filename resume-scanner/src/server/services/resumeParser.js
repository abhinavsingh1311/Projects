// src/server/services/resumeParser.js
const { extractTextWithValidation } = require('./textExtractor');
const { handleExtractionError } = require('./extractionErrorHandler');

/**
 * Simple section identification using regex patterns
 * @param {string} text - The resume text
 * @returns {Object} - Identified sections
 */
function identifySections(text) {
    const sectionPatterns = {
        education: /education|academic|qualification|degree/i,
        experience: /experience|employment|work history|professional/i,
        skills: /skill|competenc|technical|technolog/i,
        projects: /project/i,
        summary: /summary|profile|objective/i,
        contact: /contact|email|phone|address/i,
        certifications: /certif|licens/i,
    };

    // Split text into lines
    const lines = text.split('\n').map(line => line.trim());

    // Initialize variables
    const sections = { header: [] };
    let currentSection = 'header';

    // Define section arrays
    for (const section in sectionPatterns) {
        sections[section] = [];
    }

    // Identify sections based on section headers
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;

        // Check if line is a section header
        let isSectionHeader = false;

        for (const [section, pattern] of Object.entries(sectionPatterns)) {
            if (pattern.test(line) && line.length < 100) {  // Ensure it's not just a line that happens to contain a keyword
                currentSection = section;
                isSectionHeader = true;
                break;
            }
        }

        // Add line to current section
        if (!isSectionHeader) {
            sections[currentSection].push(line);
        }
    }

    // Convert arrays to strings
    const result = {};
    for (const section in sections) {
        result[section] = sections[section].join('\n');
    }

    return result;
}

/**
 * Extract basic contact information using regex patterns
 * @param {string} text - The resume text (typically header section)
 * @returns {Object} - Extracted contact info
 */
function extractContactInfo(text) {
    // Define regex patterns for common contact info
    const patterns = {
        email: /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi,
        phone: /(\+\d{1,3}[\s.-])?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g,
        linkedin: /linkedin\.com\/in\/[a-zA-Z0-9_-]+/gi,
        website: /https?:\/\/(?:www\.)?([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi,
    };

    const contactInfo = {};

    // Extract using patterns
    for (const [key, pattern] of Object.entries(patterns)) {
        const matches = text.match(pattern);
        if (matches && matches.length > 0) {
            contactInfo[key] = matches[0];
        }
    }

    // Try to extract name (very basic approach)
    const lines = text.split('\n').map(line => line.trim());
    if (lines.length > 0 && lines[0].length > 0 && lines[0].length < 60) {
        contactInfo.name = lines[0]; // Assuming the first non-empty line might be the name
    }

    return contactInfo;
}

/**
 * Extract skills using simple keyword matching
 * @param {string} text - The skills section or full text
 * @returns {Array} - Extracted skills
 */
function extractSkills(text) {
    // This is a simple approach - a more robust solution would use NLP
    // Define common skill keywords (expand this list as needed)
    const commonSkills = [
        'javascript', 'react', 'node', 'html', 'css', 'python', 'java', 'c++', 'c#',
        'sql', 'nosql', 'mongodb', 'postgresql', 'mysql', 'git', 'agile', 'scrum',
        'aws', 'azure', 'docker', 'kubernetes', 'linux', 'windows', 'macos',
        'communication', 'leadership', 'teamwork', 'problem solving'
    ];

    const foundSkills = [];
    const textLower = text.toLowerCase();

    // Check for each skill
    for (const skill of commonSkills) {
        const regex = new RegExp(`\\b${skill}\\b`, 'i');
        if (regex.test(textLower)) {
            foundSkills.push(skill);
        }
    }

    return foundSkills;
}

/**
 * Parse resume text into structured sections and data
 * @param {string} text - The extracted resume text
 * @returns {Object} - Structured resume data
 */
function parseResumeText(text) {
    // Identify sections
    const sections = identifySections(text);

    // Extract contact information from header
    const contactInfo = extractContactInfo(sections.header || text);

    // Extract skills
    const skills = extractSkills(sections.skills || text);

    // For now, we'll just include the raw text for other sections
    // In a more advanced implementation, you would parse these sections more thoroughly
    const result = {
        contactInfo,
        skills,
        sections: {
            summary: sections.summary || '',
            experience: sections.experience || '',
            education: sections.education || '',
            projects: sections.projects || '',
            certifications: sections.certifications || '',
        },
        rawText: text
    };

    return result;
}

/**
 * Process a resume file to extract and parse its content
 * @param {Buffer} fileBuffer - The resume file buffer
 * @param {string} fileName - Original filename
 * @param {string} fileType - File type (pdf, docx, etc.)
 * @returns {Promise<Object>} - Processing result with extracted data
 */
async function processResume(fileBuffer, fileName, fileType) {
    try {
        // Extract text from file
        const extractionResult = await extractTextWithValidation(fileBuffer, fileType, fileName);

        if (!extractionResult.success) {
            return {
                success: false,
                errorType: extractionResult.errorType,
                errorDetails: extractionResult.errorDetails
            };
        }

        // Clean and normalize the text
        const cleanedText = extractionResult.text.replace(/\r\n/g, '\n').replace(/\t/g, ' ');

        // Parse the resume text
        const parsedData = parseResumeText(cleanedText);

        return {
            success: true,
            parsedData,
            metadata: extractionResult.metadata,
            validation: extractionResult.validation,
            rawText: cleanedText
        };
    } catch (error) {
        console.error('Resume processing error:', error);
        return {
            success: false,
            errorType: 'PROCESSING_ERROR',
            errorDetails: error.message
        };
    }
}

module.exports = {
    processResume,
    identifySections,
    extractContactInfo,
    extractSkills,
    parseResumeText
};