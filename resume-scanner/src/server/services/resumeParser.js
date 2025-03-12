// src/server/services/resumeParser.js

/**
 * Extract contact information from text
 */
function extractContactInfo(text) {
    // Basic patterns for email, phone, etc.
    const patterns = {
        email: /\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/gi,
        phone: /(?:\+?\d{1,3}[- ]?)?\(?(?:\d{3})\)?[- ]?(?:\d{3})[- ]?(?:\d{4})/g,
        linkedin: /(?:linkedin\.com\/(?:in|profile)\/[a-zA-Z0-9_-]+)/gi,
    };

    const contactInfo = {};

    // Extract using patterns
    for (const [key, pattern] of Object.entries(patterns)) {
        const matches = text.match(pattern);
        if (matches && matches.length > 0) {
            contactInfo[key] = matches[0];
        }
    }

    // Try to extract name from first few lines
    const lines = text.split('\n').slice(0, 5);
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && trimmed.length > 3 && trimmed.length < 40) {
            contactInfo.name = trimmed;
            break;
        }
    }

    return contactInfo;
}

/**
 * Extract skills from text using common keywords
 */
function extractSkills(text) {
    const commonSkills = [
        'javascript', 'python', 'java', 'html', 'css', 'react', 'node', 'express',
        'mongodb', 'sql', 'nosql', 'git', 'github', 'aws', 'docker', 'kubernetes',
        'typescript', 'angular', 'vue', 'php', 'c++', 'c#', 'ruby', 'swift',
        'flutter', 'react native', 'android', 'ios', 'figma', 'photoshop',
        'illustrator', 'adobe', 'leadership', 'communication', 'teamwork', 'agile'
    ];

    const foundSkills = [];
    const textLower = text.toLowerCase();

    for (const skill of commonSkills) {
        if (textLower.includes(skill)) {
            foundSkills.push(skill);
        }
    }

    return foundSkills;
}

/**
 * Identify sections in resume text
 */
function identifySections(text) {
    const sections = {};
    const lines = text.split('\n');

    // Simple section detection
    let currentSection = 'header';
    sections[currentSection] = [];

    const sectionKeywords = {
        education: ['education', 'academic', 'university', 'college', 'school', 'degree'],
        experience: ['experience', 'employment', 'work history', 'professional'],
        skills: ['skills', 'abilities', 'competencies'],
        projects: ['projects', 'portfolio'],
        certifications: ['certifications', 'licenses', 'credentials']
    };

    for (const line of lines) {
        const lineLower = line.toLowerCase().trim();

        // Check if this line is a section header
        let foundSection = false;
        for (const [section, keywords] of Object.entries(sectionKeywords)) {
            if (keywords.some(keyword => lineLower.includes(keyword))) {
                currentSection = section;
                if (!sections[currentSection]) {
                    sections[currentSection] = [];
                }
                foundSection = true;
                break;
            }
        }

        if (!foundSection) {
            if (!sections[currentSection]) {
                sections[currentSection] = [];
            }
            sections[currentSection].push(line);
        }
    }

    // Convert arrays to strings
    const result = {};
    for (const [section, lines] of Object.entries(sections)) {
        if (lines.length > 0) {
            result[section] = lines.join('\n');
        }
    }

    return result;
}

/**
 * Main parsing function
 */
function parseResumeText(text) {
    const sections = identifySections(text);
    const contactInfo = extractContactInfo(text);
    const skills = extractSkills(text);

    return {
        contactInfo,
        skills,
        sections,
        rawText: text
    };
}

module.exports = {
    parseResumeText,
    extractContactInfo,
    extractSkills,
    identifySections
};