export function validatePdfBuffer(buffer) {
    // Check for PDF magic number
    const header = buffer.slice(0, 4).toString();
    if (header !== '%PDF') {
        throw new Error('Invalid PDF file signature');
    }

    // Check for valid PDF ending
    const footer = buffer.slice(-6).toString();
    if (!footer.includes('%%EOF')) {
        throw new Error('PDF appears to be truncated');
    }

    // Check reasonable file size
    if (buffer.length > 10 * 1024 * 1024) { // 10MB
        throw new Error('PDF exceeds size limit');
    }
}