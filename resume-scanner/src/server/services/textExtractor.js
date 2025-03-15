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
 * Extract text from various file types
 * @param {Buffer} buffer - The file as a buffer
 * @param {string} fileType - Type of file (pdf, docx, doc, txt)
 * @returns {Promise<Object>} - Extracted text and metadata
 */
async function extractText(buffer, fileType) {
    try {
        if (!buffer) {
            throw new Error('No file buffer provided');
        }

        console.log(`Extracting text from ${fileType.toUpperCase()} file:`);

        // For PDF files
        if (fileType.toLowerCase() === 'pdf') {
            // Make sure we're passing a proper buffer to pdf-parse
            if (!(buffer instanceof Buffer)) {
                console.log('Converting to Buffer for PDF parsing');
                buffer = Buffer.from(buffer);
            }

            // Logging buffer details for debugging
            console.log(`Buffer length: ${buffer.length}, is Buffer: ${buffer instanceof Buffer}`);

            // PDF-parse expects an object with a 'data' property containing the buffer
            const pdfData = { data: buffer };
            const data = await pdfParse(pdfData);

            return {
                text: data.text,
                metadata: {
                    pageCount: data.numpages || 0,
                    author: data.info?.Author || '',
                    title: data.info?.Title || '',
                    fileType: 'pdf'
                }
            };
        }
        else if (fileType.toLowerCase() === 'docx' || fileType.toLowerCase() === 'doc') {
            // For this quick fix, just return the buffer as a string
            // In production, use proper DOCX/DOC parser
            return {
                text: buffer.toString('utf8').replace(/[^\x20-\x7E\r\n]/g, ''),
                metadata: {
                    fileType: fileType.toLowerCase()
                }
            };
        }
        else if (fileType.toLowerCase() === 'txt') {
            return {
                text: buffer.toString('utf8'),
                metadata: {
                    fileType: 'txt'
                }
            };
        }
        else {
            throw new Error(`Unsupported file type: ${fileType}`);
        }
    } catch (error) {
        console.error('Error extracting text:', error);
        throw error;
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

// src/server/services/textExtractor.js
async function extractTextWithValidation(buffer, fileType, filePath) {
    try {
        console.log(`Extracting text from ${fileType} file: ${filePath}`);

        if (!buffer) {
            return {
                success: false,
                errorDetails: 'No file buffer provided'
            };
        }

        // Make sure buffer is properly formatted for pdf-parse
        let processedBuffer = buffer;

        // If it's not a plain buffer or instance of Uint8Array, try to convert it
        if (fileType === 'pdf' && !(buffer instanceof Uint8Array)) {
            console.log('Converting buffer format for PDF parsing');
            // If it's an ArrayBuffer, convert to Buffer
            if (buffer instanceof ArrayBuffer) {
                processedBuffer = Buffer.from(buffer);
            }
            // If it's a Blob or File, convert to ArrayBuffer then Buffer
            else if (buffer.arrayBuffer) {
                const arrayBuffer = await buffer.arrayBuffer();
                processedBuffer = Buffer.from(arrayBuffer);
            }
            // Log the buffer type for debugging
            console.log('Buffer type:', processedBuffer.constructor.name);
        }

        // Extract the text using the existing function with the properly formatted buffer
        const extractionResult = await extractText(processedBuffer, fileType);

        if (!extractionResult || !extractionResult.text) {
            return {
                success: false,
                errorDetails: 'Text extraction failed to return content'
            };
        }

        // Clean up the text
        const cleanedText = cleanupText(extractionResult.text);

        // Validate the extraction result
        const validation = validateExtractionResult(cleanedText, extractionResult.metadata || {});

        return {
            success: true,
            text: cleanedText,
            metadata: extractionResult.metadata || {},
            validation
        };
    } catch (error) {
        console.error('Error in extractTextWithValidation:', error);
        return {
            success: false,
            errorDetails: error.message || 'Unknown error during text extraction and validation'
        };
    }
}

module.exports = {
    identifyFileType,
    extractText,
    cleanupText,
    validateExtractionResult,
    extractTextWithValidation
};