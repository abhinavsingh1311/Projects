// src/server/services/textExtractor.js

const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

/**
 * Identifies the type of file based on the file extension or mime type
 * @param {string} filename - Original filename with extension
 * @param {string} mimeType - MIME type of the file
 * @returns {string|null} - Returns 'pdf', 'docx', 'doc', or null if unsupported
 */
function identifyFileType(filename, mimeType) {
    // Check by MIME type first (more reliable)
    if (mimeType === 'application/pdf') {
        return 'pdf';
    } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        return 'docx';
    } else if (mimeType === 'application/msword') {
        return 'doc';
    } else if (mimeType === 'text/plain') {
        return 'txt';
    }

    // Fallback to extension check
    if (filename) {
        const extension = filename.split('.').pop().toLowerCase();
        if (extension === 'pdf') {
            return 'pdf';
        } else if (extension === 'docx') {
            return 'docx';
        } else if (extension === 'doc') {
            return 'doc';
        } else if (extension === 'txt') {
            return 'txt';
        }
    }

    return null; // Unsupported file type
}

/**
 * Extracts text content from a PDF buffer
 * @param {Buffer} buffer - PDF file as a buffer
 * @returns {Promise<{text: string, metadata: Object}>} - Extracted text content and metadata
 */
async function extractFromPdf(buffer) {
    try {
        // Validate buffer before processing
        if (!Buffer.isBuffer(buffer)) {
            throw new Error('Invalid PDF buffer format');
        }

        // Check minimum PDF length
        if (buffer.length < 100) {
            throw new Error('PDF file appears to be empty');
        }

        const data = await pdfParse(buffer);

        // Check if PDF has very little text, might be a scan
        if (data.text.trim().length < 100) {
            console.log('PDF has little text, might be a scanned document');
            return {
                text: data.text,
                metadata: {
                    pageCount: data.numpages,
                    author: data.info?.Author || '',
                    title: data.info?.Title || '',
                    creationDate: data.info?.CreationDate || '',
                    warningMsg: 'This PDF contains very little text and may be a scanned document.'
                }
            };
        }

        return {
            text: data.text,
            metadata: {
                pageCount: data.numpages,
                author: data.info?.Author || '',
                title: data.info?.Title || '',
                creationDate: data.info?.CreationDate || '',
            }
        };
    } catch (error) {
        console.error('Error extracting text from PDF:', error);
        throw new Error(`Failed to extract text from PDF: ${error.message}`);
    }
}

/**
 * Extracts text content from a DOCX buffer
 * @param {Buffer} buffer - DOCX file as a buffer
 * @returns {Promise<{text: string, metadata: Object}>} - Extracted text content and metadata
 */
async function extractFromDocx(buffer) {
    try {
        const result = await mammoth.extractRawText({ buffer });
        return {
            text: result.value,
            metadata: {
                warnings: result.messages,
            }
        };
    } catch (error) {
        console.error('Error extracting text from DOCX:', error);
        throw new Error(`Failed to extract text from DOCX: ${error.message}`);
    }
}

/**
 * Extracts text content from a DOC buffer (legacy Word format)
 * @param {Buffer} buffer - DOC file as a buffer
 * @returns {Promise<{text: string, metadata: Object}>} - Extracted text content or error message
 */
async function extractFromDoc(buffer) {
    try {
        // Attempt to use mammoth, which has limited DOC support
        const result = await mammoth.extractRawText({ buffer });
        return {
            text: result.value,
            metadata: {
                format: 'Legacy DOC format',
                warnings: result.messages,
            }
        };
    } catch (error) {
        console.error('Error extracting text from DOC:', error);
        throw new Error('Legacy DOC format has limited support. Please convert to DOCX for better results.');
    }
}

/**
 * Extracts text from a plain text file
 * @param {Buffer} buffer - Text file as a buffer
 * @returns {Promise<{text: string, metadata: Object}>} - Text content
 */
async function extractFromText(buffer) {
    try {
        const text = buffer.toString('utf8');
        return {
            text,
            metadata: {
                processingType: 'Direct text extraction'
            }
        };
    } catch (error) {
        console.error('Error extracting from text file:', error);
        throw new Error(`Text file extraction failed: ${error.message}`);
    }
}
/**
 * Main function to extract text from document buffers
 * @param {Buffer} buffer - File buffer
 * @param {string} fileType - Type of file ('pdf', 'docx', 'doc', 'txt')
 * @param {string} originalFilename - Original filename (optional)
 * @returns {Promise<{text: string, metadata: Object}>} - Extracted text and metadata
 */
async function extractText(buffer, fileType, originalFilename = '') {
    if (!buffer) {
        throw new Error('No file buffer provided');
    }

    // If fileType not provided, try to identify it
    if (!fileType && originalFilename) {
        fileType = identifyFileType(originalFilename);
    }

    if (!fileType) {
        throw new Error('Unsupported or unidentified file type');
    }

    console.log(`Extracting text from ${fileType.toUpperCase()} file: ${originalFilename}`);

    switch (fileType.toLowerCase()) {
        case 'pdf':
            return await extractFromPdf(buffer);

        case 'docx':
            return await extractFromDocx(buffer);

        case 'doc':
            return await extractFromDoc(buffer);

        case 'txt':
            return await extractFromText(buffer);

        default:
            throw new Error(`Unsupported file type: ${fileType}`);
    }
}

/**
 * Cleanup function to normalize extracted text
 * @param {string} text - Raw extracted text
 * @returns {string} - Normalized text
 */
function cleanupText(text) {
    if (!text) return '';

    return text
        // Replace multiple spaces with a single space
        .replace(/\s+/g, ' ')
        // Replace multiple newlines with at most 2
        .replace(/\n{3,}/g, '\n\n')
        // Remove non-printable characters
        .replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F]/g, '')
        // Replace tabs with spaces
        .replace(/\t/g, ' ')
        // Trim whitespace
        .trim();
}

/**
 * Validates the extraction result to ensure quality
 * @param {string} text - Extracted text
 * @param {Object} metadata - Extraction metadata
 * @returns {Object} - Validation result with potential warnings
 */
function validateExtractionResult(text, metadata) {
    const warnings = [];
    const result = { isValid: true, warnings };

    // Check for minimum text length
    if (!text || text.length < 50) {
        warnings.push('Extracted text is very short. File might be empty or contain mostly images.');
        result.isValid = text.length > 0;
    }

    // Check for text structure issues
    if (text && !text.includes('\n') && text.length > 500) {
        warnings.push('Text has no line breaks. Formatting may have been lost during extraction.');
    }

    // Check for potential encoding issues
    if (text && (text.includes('�') || text.includes('□'))) {
        warnings.push('Text contains replacement characters. There might be encoding issues.');
    }

    // PDF-specific checks
    if (metadata.pageCount === 1 && text.length < 200) {
        warnings.push('Single-page document with little text. May be a scan or image-based PDF.');
    }

    return result;
}

module.exports = {
    identifyFileType,
    extractText,
    cleanupText,
    validateExtractionResult
};