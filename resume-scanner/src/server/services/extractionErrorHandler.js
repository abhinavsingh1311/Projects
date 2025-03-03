// src/server/services/extractionErrorHandler.js
const { supabaseAdmin } = require("../config/database_connection");

/**
 * Error types for the extraction process, expanded with more specific categories
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
    OCR_FAILED: 'OCR processing failed',
    FILE_TOO_LARGE: 'File is too large to process',
    RATE_LIMIT_EXCEEDED: 'Rate limit exceeded',
    NETWORK_ERROR: 'Network error occurred',
    API_ERROR: 'External API error',
    TIMEOUT_ERROR: 'Processing timed out',
    UNKNOWN: 'Unknown error occurred'
};

/**
 * Maps extraction errors to user-friendly messages with improved categorization
 * @param {Error} error - The original error
 * @param {string} phase - The phase where the error occurred
 * @returns {Object} - Structured error information
 */
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
    } else if (message.includes('password') || message.includes('encrypted')) {
        errorType = 'PROTECTED_DOCUMENT';
        userMessage = ERROR_TYPES.PROTECTED_DOCUMENT;
        recoveryAction = "Please remove the password protection from your document and try again.";
    } else if (message.includes('corrupt') || message.includes('malformed')) {
        errorType = 'CORRUPTED_FILE';
        userMessage = ERROR_TYPES.CORRUPTED_FILE;
        recoveryAction = "Try opening and re-saving your document, then upload again.";
    } else if (message.includes('no text') || message.includes('empty document')) {
        errorType = 'EMPTY_DOCUMENT';
        userMessage = ERROR_TYPES.EMPTY_DOCUMENT;
        recoveryAction = "Ensure your document contains text rather than just images.";
    } else if (message.includes('OCR')) {
        errorType = 'OCR_FAILED';
        userMessage = ERROR_TYPES.OCR_FAILED;
        recoveryAction = "Your document may contain scanned images. Try uploading a text-based version instead.";
    } else if (message.includes('too large') || message.includes('size limit')) {
        errorType = 'FILE_TOO_LARGE';
        userMessage = ERROR_TYPES.FILE_TOO_LARGE;
        recoveryAction = "Please reduce your file size to under 10MB and try again.";
    } else if (message.includes('rate limit') || message.includes('too many requests')) {
        errorType = 'RATE_LIMIT_EXCEEDED';
        userMessage = ERROR_TYPES.RATE_LIMIT_EXCEEDED;
        recoveryAction = "Please wait a few minutes before trying again.";
    } else if (message.includes('network') || message.includes('connection')) {
        errorType = 'NETWORK_ERROR';
        userMessage = ERROR_TYPES.NETWORK_ERROR;
        recoveryAction = "Please check your internet connection and try again.";
    } else if (message.includes('timeout')) {
        errorType = 'TIMEOUT_ERROR';
        userMessage = ERROR_TYPES.TIMEOUT_ERROR;
        recoveryAction = "The document is too complex. Try simplifying or splitting it.";
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

/**
 * Records an extraction error in the database with improved handling
 * @param {string} resumeId - The resume ID related to the error
 * @param {Object} errorInfo - Error information from handleExtractionError
 * @returns {Promise<boolean>} - Success indicator
 */
async function recordExtractionError(resumeId, errorInfo) {
    try {
        const { hasAdminAccess } = require("../config/database_connection");

        // If we don't have admin access, just log the error
        if (!hasAdminAccess()) {
            console.warn('Cannot record error to database - missing admin access');
            return false;
        }

        await supabaseAdmin.from('resume_processing_errors').insert([{
            resume_id: resumeId,
            error_type: errorInfo.errorType,
            user_message: errorInfo.userMessage,
            technical_details: errorInfo.technicalDetails,
            phase: errorInfo.phase,
            recovery_action: errorInfo.recoveryAction,
            occurred_at: new Date().toISOString()
        }]);

        return true;
    } catch (dbError) {
        console.error('Failed to record extraction error:', dbError);
        // Don't throw here to avoid cascading errors
        return false;
    }
}

/**
 * Check if a resume has recent errors in specific phase
 * @param {string} resumeId - Resume ID to check
 * @param {string} phase - Processing phase to check
 * @param {number} timeWindowMinutes - Time window in minutes to check for recent errors
 * @returns {Promise<boolean>} - Whether recent errors exist
 */
async function hasRecentErrors(resumeId, phase, timeWindowMinutes = 30) {
    try {
        const { hasAdminAccess } = require("../config/database_connection");

        // If we don't have admin access, assume no recent errors
        if (!hasAdminAccess()) {
            console.warn('Cannot check for recent errors - missing admin access');
            return false;
        }

        // Calculate time threshold
        const thresholdTime = new Date();
        thresholdTime.setMinutes(thresholdTime.getMinutes() - timeWindowMinutes);

        // Query for recent errors
        const { data, error } = await supabaseAdmin
            .from('resume_processing_errors')
            .select('id')
            .eq('resume_id', resumeId)
            .eq('phase', phase)
            .gte('occurred_at', thresholdTime.toISOString())
            .limit(1);

        if (error) {
            console.error('Error checking for recent errors:', error);
            return false;
        }

        return data && data.length > 0;
    } catch (error) {
        console.error('Exception checking for recent errors:', error);
        return false;
    }
}

/**
 * Get user-friendly recovery suggestion for an error type
 * @param {string} errorType - The type of error
 * @returns {string} - Recovery suggestion
 */
function getRecoverySuggestion(errorType) {
    const recoverySuggestions = {
        AUTHENTICATION: "Try signing out and signing back in, then attempt again.",
        FILE_NOT_FOUND: "Please upload your file again.",
        UNSUPPORTED_FILE: "Please use a PDF, DOCX, or DOC file format.",
        EXTRACTION_FAILED: "Try saving your document as a PDF and upload again.",
        DATABASE_ERROR: "Wait a few minutes and try again.",
        PROTECTED_DOCUMENT: "Remove the password protection from your document and try again.",
        CORRUPTED_FILE: "Your file appears to be damaged. Try recreating or re-exporting it.",
        EMPTY_DOCUMENT: "Ensure your document contains actual text content, not just images.",
        OCR_FAILED: "For scanned documents, ensure the text is clear and the scan quality is high.",
        FILE_TOO_LARGE: "Reduce your file size to under 10MB and try again.",
        RATE_LIMIT_EXCEEDED: "Please wait a few minutes before trying again.",
        NETWORK_ERROR: "Check your internet connection and try again.",
        TIMEOUT_ERROR: "Your document might be too complex. Try splitting it into smaller parts.",
        API_ERROR: "Our service is experiencing issues. Please try again later.",
        UNKNOWN: "Try uploading your resume again or use a different file format."
    };

    return recoverySuggestions[errorType] || recoverySuggestions.UNKNOWN;
}

module.exports = {
    ERROR_TYPES,
    handleExtractionError,
    recordExtractionError,
    hasRecentErrors,
    getRecoverySuggestion
};