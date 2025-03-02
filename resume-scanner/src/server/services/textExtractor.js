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
        }
    }

    return null; // Unsupported file type
}

/**
 * Extracts text content from a PDF buffer
 * @param {Buffer} buffer - PDF file as a buffer
 * @returns {Promise<string>} - Extracted text content
 */
async function extractFromPdf(buffer) {
    try {
        const options = {
            // You can add custom options here if needed
            // For example, to limit the number of pages processed:
            // max: 10,
        };

        const data = await pdfParse(buffer, options);
        return data.text;
    } catch (error) {
        console.error('Error extracting text from PDF:', error);
        throw new Error(`Failed to extract text from PDF: ${error.message}`);
    }
}

/**
 * Extracts text content from a DOCX buffer
 * @param {Buffer} buffer - DOCX file as a buffer
 * @returns {Promise<string>} - Extracted text content
 */
async function extractFromDocx(buffer) {
    try {
        const result = await mammoth.extractRawText({ buffer });
        return result.value;
    } catch (error) {
        console.error('Error extracting text from DOCX:', error);
        throw new Error(`Failed to extract text from DOCX: ${error.message}`);
    }
}

/**
 * Extracts text content from a DOC buffer (legacy Word format)
 * Note: This is limited as mammoth primarily supports DOCX
 * @param {Buffer} buffer - DOC file as a buffer
 * @returns {Promise<string>} - Extracted text content or error message
 */
async function extractFromDoc(buffer) {
    try {
        // Attempt to use mammoth, but it has limited DOC support
        const result = await mammoth.extractRawText({ buffer });
        return result.value;
    } catch (error) {
        console.error('Error extracting text from DOC:', error);
        throw new Error('Legacy DOC format has limited support. Please convert to DOCX for better results.');
    }
}

/**
 * Main function to extract text from document buffers
 * @param {Buffer} buffer - File buffer
 * @param {string} fileType - Type of file ('pdf', 'docx', 'doc')
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

    let text = '';
    let metadata = {};

    switch (fileType.toLowerCase()) {
        case 'pdf':
            try {
                const pdfData = await pdfParse(buffer);
                text = pdfData.text;
                metadata = {
                    pageCount: pdfData.numpages,
                    author: pdfData.info?.Author || '',
                    title: pdfData.info?.Title || '',
                    creationDate: pdfData.info?.CreationDate || '',
                };
            } catch (error) {
                throw new Error(`PDF extraction failed: ${error.message}`);
            }
            break;

        case 'docx':
            try {
                const result = await mammoth.extractRawText({ buffer });
                text = result.value;
                metadata = {
                    warnings: result.messages,
                };
            } catch (error) {
                throw new Error(`DOCX extraction failed: ${error.message}`);
            }
            break;

        case 'doc':
            try {
                const result = await extractFromDoc(buffer);
                text = result;
                metadata = {
                    format: 'Legacy DOC format',
                };
            } catch (error) {
                throw new Error(`DOC extraction failed: ${error.message}`);
            }
            break;

        default:
            throw new Error(`Unsupported file type: ${fileType}`);
    }

    // Validate extracted text
    if (!text || text.trim().length === 0) {
        throw new Error('Extraction completed but no text was found in the document');
    }

    return {
        text,
        metadata,
    };
}

/**
 * Cleanup function to normalize extracted text
 * @param {string} text - Raw extracted text
 * @returns {string} - Normalized text
 */
function cleanupText(text) {
    if (!text) return '';

    return text
        // Remove excessive whitespace
        .replace(/\s+/g, ' ')
        // Remove excessive newlines (keep max 2)
        .replace(/\n{3,}/g, '\n\n')
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


/**
 * Enhanced extraction with validation and detailed error reporting
 */
async function extractTextWithValidation(buffer, fileType, filename) {
    try {
        const { text, metadata } = await extractText(buffer, fileType, filename);
        const validationResult = validateExtractionResult(text, metadata);

        return {
            success: true,
            text,
            metadata,
            validation: validationResult
        };
    } catch (error) {
        // Enhanced error categorization
        let errorType = 'EXTRACTION_ERROR';
        let errorDetails = error.message;

        if (error.message.includes('unsupported file type')) {
            errorType = 'UNSUPPORTED_FILE_TYPE';
        } else if (error.message.includes('encrypted') || error.message.includes('password')) {
            errorType = 'PROTECTED_DOCUMENT';
        } else if (error.message.includes('corrupt') || error.message.includes('malformed')) {
            errorType = 'CORRUPTED_FILE';
        }

        return {
            success: false,
            errorType,
            errorDetails,
            originalError: error
        };
    }
}

module.exports = {
    identifyFileType,
    extractTextWithValidation,
    extractFromPdf,
    extractFromDocx,
    extractFromDoc,
    cleanupText,
};