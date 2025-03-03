// src/utils/status-manager.js
export const RESUME_STATUSES = {
    UPLOADED: 'uploaded',
    PARSING: 'parsing',
    PARSED: 'parsed',
    ANALYZING: 'analyzing',
    ANALYZED: 'analyzed',
    COMPLETED: 'completed',
    FAILED: 'failed',
    REPROCESSING: 'reprocessing'
};

export function getStatusLabel(status) {
    const labels = {
        [RESUME_STATUSES.UPLOADED]: 'Uploaded',
        [RESUME_STATUSES.PARSING]: 'Extracting Text',
        [RESUME_STATUSES.PARSED]: 'Text Extracted',
        [RESUME_STATUSES.ANALYZING]: 'Analyzing',
        [RESUME_STATUSES.ANALYZED]: 'Analysis Complete',
        [RESUME_STATUSES.COMPLETED]: 'Completed',
        [RESUME_STATUSES.FAILED]: 'Failed',
        [RESUME_STATUSES.REPROCESSING]: 'Reprocessing'
    };
    return labels[status] || 'Unknown';
}

export function getStatusColor(status) {
    const colors = {
        [RESUME_STATUSES.UPLOADED]: 'bg-yellow-100 text-yellow-800',
        [RESUME_STATUSES.PARSING]: 'bg-blue-100 text-blue-800',
        [RESUME_STATUSES.PARSED]: 'bg-blue-100 text-blue-800',
        [RESUME_STATUSES.ANALYZING]: 'bg-purple-100 text-purple-800',
        [RESUME_STATUSES.ANALYZED]: 'bg-purple-100 text-purple-800',
        [RESUME_STATUSES.COMPLETED]: 'bg-green-100 text-green-800',
        [RESUME_STATUSES.FAILED]: 'bg-red-100 text-red-800',
        [RESUME_STATUSES.REPROCESSING]: 'bg-orange-100 text-orange-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
}

export function isProcessing(status) {
    return [
        RESUME_STATUSES.PARSING,
        RESUME_STATUSES.ANALYZING,
        RESUME_STATUSES.REPROCESSING
    ].includes(status);
}

export function hasCompleted(status) {
    return [
        RESUME_STATUSES.COMPLETED,
        RESUME_STATUSES.ANALYZED,
        RESUME_STATUSES.PARSED
    ].includes(status);
}