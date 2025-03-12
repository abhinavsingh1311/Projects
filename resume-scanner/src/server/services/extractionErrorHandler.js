// src/server/services/extractionErrorHandler.js
const { supabaseAdmin } = require("../config/database_connection");

// Error types
const ERROR_TYPES = {
    AUTHENTICATION: 'Authentication failed',
    FILE_NOT_FOUND: 'File not found',
    UNSUPPORTED_FILE: 'Unsupported file type',
    EXTRACTION_FAILED: 'Text extraction failed',
    DATABASE_ERROR: 'Database operation failed',
    PROTECTED_DOCUMENT: 'Document is password protected',
    CORRUPTED_FILE: 'File appears to be corrupted',
    EMPTY_DOCUMENT: 'Document contains no extractable text',
    OCR_FAILED: 'OCR processing failed',
    FILE_TOO_LARGE: 'File is too large to process',
    RATE_LIMIT_EXCEEDED: 'Rate limit exceeded',
    NETWORK_ERROR: 'Network error occurred',
    API_ERROR: 'External API error',
    TIMEOUT_ERROR: 'Processing timed out',
    UNKNOWN: 'Unknown error occurred'
};

function handleExtractionError(error, phase = 'processing') {
    let errorType = 'UNKNOWN';
    let userMessage = ERROR_TYPES.UNKNOWN;
    let technicalDetails = error.message || 'No technical details available';
    let recoveryAction = null;

    // Determine error type based on message
    const message = error.message || '';

    if (message.includes('authentication') || message.includes('auth') || message.includes('permission')) {
        errorType = 'AUTHENTICATION';
        userMessage = ERROR_TYPES.AUTHENTICATION;
        recoveryAction = "Please sign out and sign back in, then try again.";
    } else if (message.includes('not found') || message.includes('404') || message.includes('no such file')) {
        errorType = 'FILE_NOT_FOUND';
        userMessage = ERROR_TYPES.FILE_NOT_FOUND;
        recoveryAction = "Please re-upload your file and try again.";
    } else if (message.includes('unsupported file') || message.includes('invalid file type')) {
        errorType = 'UNSUPPORTED_FILE';
        userMessage = ERROR_TYPES.UNSUPPORTED_FILE;
        recoveryAction = "Please upload a PDF, DOC, or DOCX file instead.";
    } else if (message.includes('extraction failed')) {
        errorType = 'EXTRACTION_FAILED';
        userMessage = ERROR_TYPES.EXTRACTION_FAILED;
        recoveryAction = "Try converting your document to PDF and upload again.";
    } else if (message.includes('database') || message.includes('SQL')) {
        errorType = 'DATABASE_ERROR';
        userMessage = ERROR_TYPES.DATABASE_ERROR;
        recoveryAction = "Please try again in a few minutes.";
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
        phase,
        recoveryAction
    };
}

async function recordExtractionError(resumeId, errorInfo) {
    try {
        // Implement error recording here
        return true;
    } catch (dbError) {
        console.error('Failed to record extraction error:', dbError);
        return false;
    }
}

async function hasRecentErrors(resumeId, phase, timeWindowMinutes = 30) {
    try {
        // Implement checking for recent errors here
        return false;
    } catch (error) {
        console.error('Exception checking for recent errors:', error);
        return false;
    }
}

module.exports = {
    ERROR_TYPES,
    handleExtractionError,
    recordExtractionError,
    hasRecentErrors
};