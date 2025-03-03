// src/utils/constants.js
export const RESUME_STATUSES = {
    UPLOADED: 'uploaded',     // Initial state after upload
    PARSING: 'parsing',       // Text extraction in progress
    PARSED: 'parsed',         // Text extraction complete
    ANALYZING: 'analyzing',   // AI analysis in progress
    ANALYZED: 'analyzed',     // AI analysis complete
    COMPLETED: 'completed',   // Full process complete
    FAILED: 'failed',         // Processing failed
    REPROCESSING: 'reprocessing' // Force reprocessing
};