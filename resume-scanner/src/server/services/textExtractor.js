// src/server/services/textExtractor.js
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const { createWorker } = require('tesseract.js');

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
    } else if (mimeType === 'image/jpeg' || mimeType === 'image/png') {
        return 'image';
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
        } else if (['jpg', 'jpeg', 'png'].includes(extension)) {
            return 'image';
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
        const options = {
            // Set max pages to prevent extremely large PDFs from causing issues
            max: 100
        };

        const data = await pdfParse(buffer, options);

        // Check if PDF has very little text, might be a scan that needs OCR
        if (data.text.trim().length < 100) {
            console.log('PDF has little text, attempting OCR...');
            return await attemptOCROnPDF(buffer, data);
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

        // Try OCR as a fallback for problematic PDFs
        if (error.message.includes('file has been damaged') ||
            error.message.includes('Invalid PDF structure')) {
            console.log('PDF parsing failed, attempting OCR as fallback...');
            return await attemptOCROnPDF(buffer);
        }

        throw new Error(`Failed to extract text from PDF: ${error.message}`);
    }
}

/**
 * Attempts to use OCR on a PDF that might be image-based or have little text
 * @param {Buffer} buffer - PDF file as a buffer
 * @param {Object} existingData - Any data already extracted from the PDF
 * @returns {Promise<{text: string, metadata: Object}>} - OCR extracted text and metadata
 */
async function attemptOCROnPDF(buffer, existingData = null) {
    // Note: In a real implementation, you would need to convert the PDF pages to images
    // and then run OCR on each page. This is a simplified version.

    // This is a placeholder for a more robust OCR implementation
    console.log('OCR on PDFs would be implemented here');

    // Return the existing data if we have it, or a placeholder message
    return {
        text: existingData?.text || 'PDF requires OCR processing for full text extraction.',
        metadata: {
            ...(existingData?.metadata || {}),
            ocrAttempted: true,
            processingNote: 'This document appears to be image-based and requires OCR for full text extraction.'
        }
    };
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
 * Extracts text from an image using OCR
 * @param {Buffer} buffer - Image file as a buffer
 * @returns {Promise<{text: string, metadata: Object}>} - OCR extracted text
 */
async function extractFromImage(buffer) {
    const worker = await createWorker();

    try {
        await worker.loadLanguage('eng');
        await worker.initialize('eng');

        // Convert buffer to appropriate format for Tesseract
        const result = await worker.recognize(buffer);

        await worker.terminate();

        return {
            text: result.data.text,
            metadata: {
                ocrConfidence: result.data.confidence,
                processingType: 'OCR',
            }
        };
    } catch (error) {
        if (worker) await worker.terminate();
        console.error('Error performing OCR on image:', error);
        throw new Error(`OCR processing failed: ${error.message}`);
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
 * @param {string} fileType - Type of file ('pdf', 'docx', 'doc', 'image', 'txt')
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

        case 'image':
            return await extractFromImage(buffer);

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

    // OCR-specific checks
    if (metadata.ocrConfidence && metadata.ocrConfidence < 80) {
        warnings.push(`OCR confidence is low (${metadata.ocrConfidence}%). Some text may be incorrectly recognized.`);
    }

    return result;
}

/**
 * Enhanced extraction with validation and detailed error reporting
 * @param {Buffer} buffer - File buffer
 * @param {string} fileType - File type
 * @param {string} filename - Original filename
 * @returns {Promise<Object>} - Extraction result with validation
 */
async function extractTextWithValidation(buffer, fileType, filename) {
    try {
        const { text, metadata } = await extractText(buffer, fileType, filename);

        // Clean up the text
        const cleanedText = cleanupText(text);

        // Validate the extraction
        const validationResult = validateExtractionResult(cleanedText, metadata);

        return {
            success: true,
            text: cleanedText,
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
        } else if (error.message.includes('empty') || error.message.includes('no text')) {
            errorType = 'EMPTY_DOCUMENT';
        } else if (error.message.includes('OCR')) {
            errorType = 'OCR_PROCESSING_ERROR';
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
    extractText,
    cleanupText,
};