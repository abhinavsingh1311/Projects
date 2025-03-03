// src/server/services/resumeParser.js
const { extractTextWithValidation } = require('./textExtractor');
const { handleExtractionError } = require('./extractionErrorHandler');

/**
 * Enhanced section identification using regex patterns and heuristics
 * @param {string} text - The resume text
 * @returns {Object} - Identified sections
 */
function identifySections(text) {
    // Common section headers patterns with improved regex
    const sectionPatterns = {
        education: /\b(education|academic|qualifications?|degrees?|academic background)\b/i,
        experience: /\b(experience|employment|work history|professional experience|career history)\b/i,
        skills: /\b(skills?|competenc(ies|e)|technical|technologies|proficiencies)\b/i,
        projects: /\b(projects?|portfolio|case studies)\b/i,
        summary: /\b(summary|profile|objective|professional summary|about me)\b/i,
        contact: /\b(contact|email|phone|address|contact information)\b/i,
        certifications: /\b(certifications?|licenses?|accreditations?)\b/i,
        interests: /\b(interests|hobbies|activities|volunteer)\b/i,
        references: /\b(references|recommendations|referees)\b/i,
        languages: /\b(languages|language proficiency)\b/i,
    };

    // Split text into lines
    const lines = text.split('\n').map(line => line.trim()).filter(Boolean);

    // Initialize variables
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

    // Identify sections based on section headers using improved detection
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

        // Headers often have these characteristics:
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
 * Extract contact information using enhanced regex patterns
 * @param {string} text - The resume text (typically header section)
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

    // Extract name - improved approach
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
 * Extract skills using enhanced matching techniques
 * @param {string} text - The skills section or full text
 * @returns {Array} - Extracted skills
 */
function extractSkills(text) {
    // Common skill keywords - expanded taxonomy
    const skillsDatabase = {
        programmingLanguages: [
            'javascript', 'python', 'java', 'c++', 'c#', 'php', 'ruby', 'swift', 'kotlin',
            'go', 'rust', 'scala', 'typescript', 'perl', 'r', 'matlab', 'bash', 'powershell',
            'assembly', 'objective-c', 'dart', 'julia', 'haskell', 'clojure', 'groovy', 'cobol'
        ],
        webTechnologies: [
            'html', 'css', 'react', 'angular', 'vue', 'node', 'express', 'django', 'flask',
            'spring', 'laravel', 'asp.net', 'jquery', 'bootstrap', 'tailwind', 'sass',
            'less', 'webpack', 'babel', 'graphql', 'rest', 'soap', 'pwa', 'spa', 'ssr',
            'next.js', 'gatsby', 'svelte', 'webgl', 'web components'
        ],
        databases: [
            'sql', 'nosql', 'mysql', 'postgresql', 'mongodb', 'firebase', 'dynamodb',
            'cassandra', 'redis', 'oracle', 'sqlite', 'mariadb', 'couchdb', 'elasticsearch',
            'neo4j', 'supabase'
        ],
        cloudServices: [
            'aws', 'azure', 'google cloud', 'gcp', 'heroku', 'digitalocean', 'netlify',
            'vercel', 'cloudflare', 'lambda', 'ec2', 's3', 'rds', 'fargate', 'eks', 'ecs'
        ],
        devOpsTools: [
            'git', 'docker', 'kubernetes', 'jenkins', 'circleci', 'travis ci', 'github actions',
            'ansible', 'terraform', 'prometheus', 'grafana', 'elk stack', 'gitlab ci',
            'bitbucket pipelines'
        ],
        softSkills: [
            'communication', 'leadership', 'teamwork', 'problem solving', 'time management',
            'critical thinking', 'adaptability', 'creativity', 'emotional intelligence',
            'conflict resolution', 'decision making', 'project management', 'negotiation',
            'presentation', 'public speaking'
        ]
    };

    // Flatten the skills list
    const allSkills = Object.values(skillsDatabase).flat();

    // Extract skills using more advanced pattern matching
    const foundSkills = [];
    const textLower = text.toLowerCase();

    // Pattern-based extraction
    for (const skill of allSkills) {
        // Use word boundary to match whole words
        const pattern = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');

        if (pattern.test(textLower)) {
            // If not already found
            if (!foundSkills.includes(skill)) {
                foundSkills.push(skill);
            }
        }
    }

    // Extract skills listed in bullet points
    const bulletPointPattern = /[•\-*]\s*([^•\-*\n]+)/g;
    let match;
    while ((match = bulletPointPattern.exec(text)) !== null) {
        const bulletPoint = match[1].trim().toLowerCase();

        // Check if this bullet point might be a skill not in our database
        if (
            bulletPoint.length < 30 && // Not too long
            !bulletPoint.includes(' and ') && // Not a compound phrase
            bulletPoint.split(' ').length <= 3 && // Max 3 words
            !foundSkills.some(skill => bulletPoint.includes(skill.toLowerCase())) // Not already found
        ) {
            // Add capitalized version
            foundSkills.push(bulletPoint.replace(/\b\w/g, l => l.toUpperCase()));
        }
    }

    return foundSkills;
}

/**
 * Parse resume text into structured sections and data with enhanced extraction
 * @param {string} text - The extracted resume text
 * @returns {Object} - Structured resume data
 */
function parseResumeText(text) {
    // Identify sections
    const sections = identifySections(text);

    // Extract contact information from header
    const contactInfo = extractContactInfo(sections.header || text);

    // Extract skills from the skills section or entire text if skills section not found
    const skills = extractSkills(sections.skills || text);

    // Basic entity extraction for education
    const education = extractEducation(sections.education || '');

    // Basic entity extraction for experience
    const experience = extractExperience(sections.experience || '');

    // For now, keep a raw version of each section
    const result = {
        contactInfo,
        skills,
        education,
        experience,
        sections: {
            summary: sections.summary || '',
            education: sections.education || '',
            experience: sections.experience || '',
            projects: sections.projects || '',
            certifications: sections.certifications || '',
            interests: sections.interests || '',
        },
        rawText: text
    };

    return result;
}

/**
 * Extract education information from text
 * @param {string} text - Education section text
 * @returns {Array} - Array of education items
 */
function extractEducation(text) {
    if (!text) return [];

    const education = [];

    // Simple pattern-based extraction
    // This is a basic implementation - a more robust solution would use NLP

    // Split based on common patterns between education entries
    const entries = text.split(/(?:\n\n|\r\n\r\n|(?:\d{4})\s*\n)/);

    for (const entry of entries) {
        if (!entry.trim()) continue;

        const educationItem = {
            institution: extractInstitution(entry),
            degree: extractDegree(entry),
            date: extractDate(entry),
            gpa: extractGPA(entry),
        };

        // Only add if we have at least an institution or degree
        if (educationItem.institution || educationItem.degree) {
            education.push(educationItem);
        }
    }

    return education;
}

/**
 * Extract experience information from text
 * @param {string} text - Experience section text
 * @returns {Array} - Array of experience items
 */
function extractExperience(text) {
    if (!text) return [];

    const experience = [];

    // Simple pattern-based extraction
    // This is a basic implementation - a more robust solution would use NLP

    // Split based on common patterns between experience entries
    const entries = text.split(/(?:\n\n|\r\n\r\n|(?:\d{4})\s*\n)/);

    for (const entry of entries) {
        if (!entry.trim()) continue;

        const experienceItem = {
            company: extractCompany(entry),
            title: extractJobTitle(entry),
            date: extractDate(entry),
            description: entry.trim(),
        };

        // Only add if we have at least a company or title
        if (experienceItem.company || experienceItem.title) {
            experience.push(experienceItem);
        }
    }

    return experience;
}

// Helper extraction functions
function extractInstitution(text) {
    // Simple extraction - look for common university patterns
    const universityPattern = /(university|college|institute|school) of ([A-Za-z\s]+)|([A-Za-z\s]+) (university|college|institute|school)/i;
    const match = text.match(universityPattern);
    return match ? match[0] : null;
}

function extractDegree(text) {
    // Look for common degree patterns
    const degreePattern = /(?:bachelor|master|doctorate|ph\.?d\.?|b\.?s\.?|m\.?s\.?|b\.?a\.?|m\.?a\.?|m\.?b\.?a\.?)[^\n,]*/i;
    const match = text.match(degreePattern);
    return match ? match[0].trim() : null;
}

function extractCompany(text) {
    // Simple extraction for company name (first line or after specific patterns)
    const lines = text.split('\n');
    if (lines.length > 0) {
        // Look for lines that might be company names (don't contain common job title words)
        const jobTitleWords = ['engineer', 'developer', 'manager', 'director', 'assistant', 'specialist'];
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed && !jobTitleWords.some(word => trimmed.toLowerCase().includes(word))) {
                return trimmed;
            }
        }
    }
    return null;
}

function extractJobTitle(text) {
    // Look for common job title patterns
    const titlePattern = /(?:senior|junior|lead|staff|principal)?\s*(?:software|frontend|backend|full-stack|web|mobile|data|ui|ux|product|project)?\s*(?:engineer|developer|manager|designer|architect|analyst|consultant|specialist|director)/i;
    const match = text.match(titlePattern);
    return match ? match[0].trim() : null;
}

function extractDate(text) {
    // Look for date patterns (MM/YYYY, Month YYYY, YYYY - Present, etc.)
    const datePattern = /(?:\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?|[0-1]?\d)[\/\s,-]+\d{4}\s*(?:-|–|to)\s*(?:Present|Current|Now|(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?|[0-1]?\d)[\/\s,-]+\d{4})?|\b\d{4}\b/i;
    const match = text.match(datePattern);
    return match ? match[0].trim() : null;
}

function extractGPA(text) {
    // Look for GPA patterns (GPA: X.XX, X.XX/4.0, etc.)
    const gpaPattern = /(?:GPA|grade point average)[:\s]+([0-9]\.[0-9]{1,2})(?:\/[0-9]\.[0-9])?/i;
    const match = text.match(gpaPattern);
    return match ? match[1] : null;
}

/**
 * Process a resume file to extract and parse its content with enhanced extraction
 * @param {Buffer} fileBuffer - The resume file buffer
 * @param {string} fileName - Original filename
 * @param {string} fileType - File type (pdf, docx, etc.)
 * @returns {Promise<Object>} - Processing result with extracted data
 */
async function processResume(fileBuffer, fileName, fileType) {
    try {
        console.log(`Processing resume: ${fileName} (${fileType})`);

        // Extract text from file
        const extractionResult = await extractTextWithValidation(fileBuffer, fileType, fileName);

        if (!extractionResult.success) {
            console.error(`Extraction failed for ${fileName}:`, extractionResult.errorDetails);
            return {
                success: false,
                errorType: extractionResult.errorType,
                errorDetails: extractionResult.errorDetails
            };
        }

        // Clean and normalize the text
        const cleanedText = extractionResult.text.replace(/\r\n/g, '\n').replace(/\t/g, ' ');

        // Parse the resume text
        console.log(`Parsing extracted text (${cleanedText.length} characters)`);
        const parsedData = parseResumeText(cleanedText);

        console.log(`Parsing complete. Identified:
            - ${parsedData.skills.length} skills
            - ${parsedData.education.length} education entries 
            - ${parsedData.experience.length} experience entries
            - ${Object.keys(parsedData.contactInfo).length} contact items`);

        // Add confidence metrics to the result
        const confidenceMetrics = {
            overall: calculateOverallConfidence(parsedData),
            sections: {
                contactInfo: calculateSectionConfidence(parsedData.contactInfo, ['name', 'email', 'phone']),
                skills: parsedData.skills.length > 0 ? 0.8 : 0.2,
                education: calculateSectionConfidence(parsedData.education, ['institution', 'degree']),
                experience: calculateSectionConfidence(parsedData.experience, ['company', 'title'])
            }
        };

        return {
            success: true,
            parsedData,
            metadata: extractionResult.metadata,
            validation: extractionResult.validation,
            confidence: confidenceMetrics,
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

/**
 * Calculate overall confidence in the parsing result
 * @param {Object} parsedData - The parsed resume data
 * @returns {number} - Confidence score between 0 and 1
 */
function calculateOverallConfidence(parsedData) {
    let score = 0;
    let weight = 0;

    // Contact info is critical
    if (parsedData.contactInfo.email) {
        score += 0.3;
        weight += 0.3;
    }

    if (parsedData.contactInfo.name) {
        score += 0.2;
        weight += 0.2;
    }

    // Skills are important
    if (parsedData.skills.length > 0) {
        const skillScore = Math.min(parsedData.skills.length / 5, 1) * 0.2;
        score += skillScore;
        weight += 0.2;
    }

    // Education is expected
    if (parsedData.education.length > 0) {
        score += 0.15;
        weight += 0.15;
    }

    // Experience is expected
    if (parsedData.experience.length > 0) {
        score += 0.15;
        weight += 0.15;
    }

    // If we have at least some data, assign a minimum confidence
    if (weight > 0) {
        return Math.max(score / weight, 0.1);
    }

    return 0.1; // Minimum confidence if we couldn't calculate
}

/**
 * Calculate confidence for a specific section
 * @param {Array|Object} section - Section data
 * @param {Array} requiredFields - Fields that should exist
 * @returns {number} - Confidence score between 0 and 1
 */
function calculateSectionConfidence(section, requiredFields) {
    if (!section) return 0;

    if (Array.isArray(section)) {
        if (section.length === 0) return 0;

        // For arrays, check each item has the required fields
        let totalScore = 0;

        for (const item of section) {
            let itemScore = 0;
            for (const field of requiredFields) {
                if (item[field]) {
                    itemScore += 1 / requiredFields.length;
                }
            }
            totalScore += itemScore;
        }

        return totalScore / section.length;
    } else {
        // For objects, check if required fields exist
        let score = 0;

        for (const field of requiredFields) {
            if (section[field]) {
                score += 1 / requiredFields.length;
            }
        }

        return score;
    }
}

module.exports = {
    processResume,
    identifySections,
    extractContactInfo,
    extractSkills,
    parseResumeText,
    extractEducation,
    extractExperience
};