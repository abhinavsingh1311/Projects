// src/server/services/extractionErrorHandler.js

/**
 * Error types for the extraction process
 */
const ERROR_TYPES = {
    AUTHENTICATION: 'Authentication failed',
    FILE_NOT_FOUND: 'File not found',
    UNSUPPORTED_FILE: 'Unsupported file type',
    EXTRACTION_FAILED: 'Text extraction failed',
    DATABASE_ERROR: 'Database operation failed',
    PROTECTED_DOCUMENT: 'Document is password protected',
    CORRUPTED_FILE: 'File appears to be corrupted',
    EMPTY_DOCUMENT: 'Document contains no extractable text',
    UNKNOWN: 'Unknown error occurred'
};

/**
 * Maps extraction errors to user-friendly messages
 * @param {Error} error - The original error
 * @param {string} phase - The phase where the error occurred
 * @returns {Object} - Structured error information
 */
function handleExtractionError(error, phase = 'processing') {
    let errorType = 'UNKNOWN';
    let userMessage = ERROR_TYPES.UNKNOWN;
    let technicalDetails = error.message || 'No technical details available';

    // Determine error type based on message
    const message = error.message || '';

    if (message.includes('authentication') || message.includes('auth')) {
        errorType = 'AUTHENTICATION';
        userMessage = ERROR_TYPES.AUTHENTICATION;
    } else if (message.includes('not found') || message.includes('404')) {
        errorType = 'FILE_NOT_FOUND';
        userMessage = ERROR_TYPES.FILE_NOT_FOUND;
    } else if (message.includes('unsupported file') || message.includes('invalid file type')) {
        errorType = 'UNSUPPORTED_FILE';
        userMessage = ERROR_TYPES.UNSUPPORTED_FILE;
    } else if (message.includes('extraction failed')) {
        errorType = 'EXTRACTION_FAILED';
        userMessage = ERROR_TYPES.EXTRACTION_FAILED;
    } else if (message.includes('database') || message.includes('SQL')) {
        errorType = 'DATABASE_ERROR';
        userMessage = ERROR_TYPES.DATABASE_ERROR;
    } else if (message.includes('password') || message.includes('encrypted')) {
        errorType = 'PROTECTED_DOCUMENT';
        userMessage = ERROR_TYPES.PROTECTED_DOCUMENT;
    } else if (message.includes('corrupt') || message.includes('malformed')) {
        errorType = 'CORRUPTED_FILE';
        userMessage = ERROR_TYPES.CORRUPTED_FILE;
    } else if (message.includes('no text') || message.includes('empty document')) {
        errorType = 'EMPTY_DOCUMENT';
        userMessage = ERROR_TYPES.EMPTY_DOCUMENT;
    }

    // Log error for debugging
    console.error(`Extraction error during ${phase}:`, {
        errorType,
        userMessage,
        technicalDetails,
        originalError: error
    });

    return {
        errorType,
        userMessage,
        technicalDetails,
        phase
    };
}

/**
 * Records an extraction error in the database
 */
async function recordExtractionError(resumeId, errorInfo) {
    try {
        await supabaseAdmin.from('resume_processing_errors').insert([{
            resume_id: resumeId,
            error_type: errorInfo.errorType,
            user_message: errorInfo.userMessage,
            technical_details: errorInfo.technicalDetails,
            phase: errorInfo.phase,
            occurred_at: new Date().toISOString()
        }]);
    } catch (dbError) {
        console.error('Failed to record extraction error:', dbError);
        // Don't throw here to avoid cascading errors
    }
}

module.exports = {
    ERROR_TYPES,
    handleExtractionError,
    recordExtractionError
};