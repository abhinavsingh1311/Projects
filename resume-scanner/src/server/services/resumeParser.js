// src/server/services/resumeParser.js

const { extractTextWithValidation } = require('./textExtractor');

/**
 * Identify sections in the resume text
 * @param {string} text - Resume text content
 * @returns {Object} - Detected sections with their text content
 */
function identifySections(text) {
    // Common section headers patterns
    const sectionPatterns = {
        education: /\b(education|academic|qualifications?|degrees?|academic background)\b/i,
        experience: /\b(experience|employment|work history|professional experience|career history)\b/i,
        skills: /\b(skills?|competenc(ies|e)|technical|technologies|proficiencies)\b/i,
        projects: /\b(projects?|portfolio|case studies)\b/i,
        summary: /\b(summary|profile|objective|professional summary|about me)\b/i,
        contact: /\b(contact|email|phone|address|contact information)\b/i,
        certifications: /\b(certifications?|licenses?|accreditations?)\b/i,
    };

    // Split text into lines
    const lines = text.split('\n').map(line => line.trim()).filter(Boolean);

    // Initialize sections object
    const sections = { header: [] };
    let currentSection = 'header';

    // Define section arrays
    for (const section in sectionPatterns) {
        sections[section] = [];
    }

    // Flag to track if we've passed the header section
    let pastHeader = false;
    const headerLimit = Math.min(10, Math.floor(lines.length * 0.1)); // Header shouldn't be more than 10% of the resume
    let lineCounter = 0;

    // Identify sections based on section headers
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        lineCounter++;

        if (!line) continue;

        // After a certain number of lines, assume we're past the header
        if (currentSection === 'header' && lineCounter > headerLimit) {
            pastHeader = true;
        }

        // Check if line is a section header
        let isSectionHeader = false;

        // Headers often have these characteristics
        const potentialHeader = line.length < 100 && // Not too long
            (line.toUpperCase() === line || // ALL CAPS
                /^[A-Z]/.test(line) || // Starts with capital
                line.endsWith(':') || // Ends with colon
                !line.includes(' ')); // Single word

        if (potentialHeader) {
            for (const [section, pattern] of Object.entries(sectionPatterns)) {
                if (pattern.test(line)) {
                    // Previous section is no longer active
                    currentSection = section;
                    pastHeader = true; // Once we hit a section, we're definitely past the header
                    isSectionHeader = true;
                    break;
                }
            }
        }

        // Add line to current section
        if (!isSectionHeader) {
            // If we've moved past header but haven't categorized into a section yet,
            // put it in a general "body" section
            if (pastHeader && currentSection === 'header') {
                if (!sections['body']) {
                    sections['body'] = [];
                }
                sections['body'].push(line);
            } else {
                sections[currentSection].push(line);
            }
        }
    }

    // Convert arrays to strings
    const result = {};
    for (const section in sections) {
        if (sections[section].length > 0) {
            result[section] = sections[section].join('\n');
        }
    }

    return result;
}

/**
 * Extract contact information
 * @param {string} text - Resume text (typically header section)
 * @returns {Object} - Extracted contact info
 */
function extractContactInfo(text) {
    // Enhanced regex patterns for common contact info
    const patterns = {
        email: /\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/gi,
        phone: /(?:\+?\d{1,3}[- ]?)?\(?(?:\d{3})\)?[- ]?(?:\d{3})[- ]?(?:\d{4})/g,
        linkedin: /(?:linkedin\.com\/(?:in|profile)\/[a-zA-Z0-9_-]+)/gi,
        github: /(?:github\.com\/[a-zA-Z0-9_-]+)/gi,
        website: /\b(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/gi,
    };

    const contactInfo = {};

    // Extract using patterns
    for (const [key, pattern] of Object.entries(patterns)) {
        const matches = text.match(pattern);
        if (matches && matches.length > 0) {
            contactInfo[key] = matches[0];
        }
    }

    // Extract name - looking for patterns
    const namePatterns = [
        // Look for lines with just a name (1-3 words, all capitalized or first letter capitalized)
        /^([A-Z][a-z]+(?: [A-Z][a-z]+){0,2})$/m,
        // Look for lines with all caps (likely name)
        /^([A-Z]+(?:\s+[A-Z]+){0,2})$/m
    ];

    for (const pattern of namePatterns) {
        const match = text.match(pattern);
        if (match && match[1].length > 3 && match[1].length < 60) {
            contactInfo.name = match[1];
            break;
        }
    }

    // If no name found, try first non-empty line if not too long
    if (!contactInfo.name) {
        const lines = text.split('\n').map(line => line.trim());
        for (const line of lines) {
            if (line && line.length > 3 && line.length < 60) {
                // Check if it's not just contact info
                if (!Object.values(contactInfo).some(val => line.includes(val))) {
                    contactInfo.name = line;
                    break;
                }
            }
        }
    }

    return contactInfo;
}

/**
 * Extract skills from resume text
 * @param {string} text - Resume text
 * @returns {Array} - Extracted skills
 */
// function extractSkills(text) {
//     // Common skill keywords
//     const skillsDatabase = {
//         programmingLanguages: [
//             'javascript', 'python', 'java', 'c++', 'c#', 'php', 'ruby', 'swift', 'kotlin',
//             'go', 'rust', 'scala', 'typescript', 'perl', 'r', 'matlab', 'bash', 'powershell',
//             'assembly', 'objective-c', 'dart', 'julia', 'haskell', 'clojure', 'groovy', 'cobol'
//         ],
//         webTechnologies: [
//             'html', 'css', 'react', 'angular', 'vue', 'node', 'express', 'django', 'flask',
//             'spring', 'laravel', 'asp.net', 'jquery', 'bootstrap', 'tailwind', 'sass',
//             'less', 'webpack', 'babel', 'graphql', 'rest', 'soap', 'pwa', 'spa', 'ssr',
//             'next.js', 'gatsby', 'svelte', 'webgl', 'web components'
//         ],
//         databases: [
//             'sql', 'nosql', 'mysql', 'postgresql', 'mongodb', 'firebase', 'dynamodb',
//             'cassandra', 'redis', 'oracle', 'sqlite', 'mariadb', 'couchdb', 'elasticsearch',
//             'neo4j', 'supabase'
//         ],
//         cloudServices: [
//             'aws', 'azure', 'google cloud', 'gcp', 'heroku', 'digitalocean', 'netlify',
//             'vercel', 'cloudflare', 'lambda', 'ec2', 's3', 'rds', 'fargate', 'eks', 'ecs'
//         ],
//         devOpsTools: [
//             'git', 'docker', 'kubernetes', 'jenkins', 'circleci', 'travis ci', 'github actions',
//             'ansible', 'terraform', 'prometheus', 'grafana', 'elk stack', 'gitlab ci',
//             'bitbucket pipelines'
//         ],
//         softSkills: [
//             'communication', 'leadership', 'teamwork', 'problem solving', 'time management',
//             'critical thinking', 'adaptability', 'creativity', 'emotional intelligence',
//             'conflict resolution', 'decision making', 'project management', 'negotiation',
//             'presentation', 'public speaking'
//         ]
//     };
//
//     // Flatten the skills list
//     const allSkills = Object.values(skillsDatabase).flat();
//
//     // Extract skills using more advanced pattern matching
//     const foundSkills = [];
//     const textLower = text.toLowerCase();
//
//     // Pattern-based extraction
//     for (const skill of allSkills) {
//         // Use word boundary to match whole words
//         const pattern = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
//
//         if (pattern.test(textLower)) {
//             // If not already found
//             if (!foundSkills.includes(skill)) {
//                 foundSkills.push(skill);
//             }
//         }
//     }
//
//     // Extract skills listed in bullet points
//     const bulletPointPattern = /[•\-*]\s*([^•\-*\n]+)/g;
//     let match;
//     while ((match = bulletPointPattern.exec(text)) !== null) {
//         const bulletPoint = match[1].trim().toLowerCase();
//
//         // Check if this bullet point might be a skill not in our database
//         if (
//             bulletPoint.length < 30 && // Not too long
//             !bulletPoint.includes(' and ') && // Not a compound phrase
//             bulletPoint.split(' ').length <= 3 && // Max 3 words
//             !foundSkills.some(skill => bulletPoint.includes(skill.toLowerCase())) // Not already found
//         ) {
//             // Add capitalized version
//             foundSkills.push(bulletPoint.replace(/\b\w/g, l => l.toUpperCase()));
//         }
//     }
//
//     return foundSkills;
// }
function extractSkills(text) {
    const foundSkills = []; // Initialize the array
    const bulletPointPattern = /([•\-*▶]|\d+\.)\s*([^•\-*\n]+)/gi;
    let match;

    const normalizeSkill = skill => skill
        .replace(/:\s*$/, '')
        .replace(/^[\d\.\-\*▶ ]+/, '')
        .trim()
        .toLowerCase();

    const isValidSkill = skill =>
        skill.length > 2 &&
        skill.length < 50 &&
        !/\d{3,}/.test(skill) &&
        !/http(s)?:\/\//i.test(skill);

    while ((match = bulletPointPattern.exec(text)) !== null) {
        const rawSkill = match[2].trim();
        const normalizedSkill = normalizeSkill(rawSkill);

        if (isValidSkill(normalizedSkill)) {
            const formattedSkill = normalizedSkill
                .split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');

            if (!foundSkills.includes(formattedSkill)) {
                foundSkills.push(formattedSkill);
            }
        }
    }

    return foundSkills; // Add return statement
}



/**
 * Parse resume text into structured sections and data
 * @param {string} text - The extracted resume text
 * @returns {Object} - Structured resume data
 */
function parseResumeText(text) {
    const sections = identifySections(text);
    const contactInfo = extractContactInfo(sections.header || text);
    const skills = extractSkills(sections.skills || text);

    return {
        contactInfo,
        skills,
        sections,
        rawText: text,
        metadata: {
            sectionCount: Object.keys(sections).length,
            skillCount: skills.length
        }
    };
}
/**
 * Process a resume file to extract and parse its content
 * @param {Buffer} fileBuffer - The resume file buffer
 * @param {string} fileType - File type (pdf, docx, etc.)
 * @param {string} fileName - Original filename
 * @returns {Promise<Object>} - Processing result with extracted data
 */
// src/server/services/resumeParser.js
async function processResume(fileBuffer, fileType) {
    try {
        // Allow txt files in validation
        if (!['pdf', 'docx', 'doc', 'txt'].includes(fileType.toLowerCase())) {
            throw new Error('Unsupported file type');
        }

        // Add file size validation
        if (fileBuffer.length > 10 * 1024 * 1024) {
            throw new Error('File size exceeds 10MB limit');
        }

        // Rest of the processing logic...
    } catch (error) {
        console.error('Processing error:', error);
        return {
            success: false,
            error: error.message,
            errorType: 'VALIDATION_ERROR'
        };
    }
}

module.exports = {
    processResume,
    parseResumeText,
    identifySections,
    extractContactInfo,
    extractSkills
};