// src/app/upload/page.js

'use client';
import { useState } from 'react';
import { supabase } from '@/server/utils/supabase-client';
import Link from 'next/link';

export default function UploadPage() {
    const [file, setFile] = useState(null);
    const [title, setTitle] = useState('');
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);
    const [dragActive, setDragActive] = useState(false);
    const [resumeId, setResumeId] = useState(null);
    const [processing, setProcessing] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [fileValidation, setFileValidation] = useState({ valid: false, message: '' });
    const [processingStatus, setProcessingStatus] = useState(null);
    const [processingProgress, setProcessingProgress] = useState(0);


    // Validate the file
    const validateFile = (selectedFile) => {
        // Reset previous errors
        setError(null);

        // Basic validation
        if (!selectedFile) {
            return { valid: false, message: 'Please select a file' };
        }

        // Size validation (max 10MB)
        const maxSize = 10 * 1024 * 1024; // 10MB in bytes
        if (selectedFile.size > maxSize) {
            return {
                valid: false,
                message: `File is too large (${(selectedFile.size / (1024 * 1024)).toFixed(2)}MB). Maximum size is 10MB.`
            };
        }

        // Type validation
        const allowedTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];

        if (!allowedTypes.includes(selectedFile.type)) {
            return {
                valid: false,
                message: 'Invalid file type. Please upload a PDF, DOC, or DOCX file.'
            };
        }

        // If all checks pass
        return { valid: true, message: 'File is valid' };
    };

    const handleFileChange = (e) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            processFile(selectedFile);
        }
    };

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            processFile(e.dataTransfer.files[0]);
        }
    };

    const processFile = (selectedFile) => {
        // Validate the file
        const validation = validateFile(selectedFile);
        setFileValidation(validation);

        if (validation.valid) {
            setFile(selectedFile);
            // Auto-populate title from filename if empty
            if (!title) {
                // Remove extension and replace underscores/hyphens with spaces
                let suggestedTitle = selectedFile.name.split('.')[0]
                    .replace(/[_-]/g, ' ')
                    .replace(/\s+/g, ' ') // Normalize spaces
                    .trim();

                // Capitalize words
                suggestedTitle = suggestedTitle
                    .split(' ')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(' ');

                setTitle(suggestedTitle);
            }
        } else {
            setFile(null);
            setError(validation.message);
        }
    };

    const getFileType = (file) => {
        const types = {
            'application/pdf': 'pdf',
            'application/msword': 'doc',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx'
        };
        return types[file.type] || 'unknown';
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!file) {
            setError('Please select a file to upload');
            return;
        }

        try {
            setUploading(true);
            setError(null);
            setUploadProgress(0);

            // Create a sanitized file path
            const fileExt = file.name.split('.').pop();
            const sanitizedName = file.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
            const fileName = `${session.user.id}/${Date.now()}_${sanitizedName}`;
            const filePath = `uploads/${fileName}`;

            // Set up upload with progress tracking
            const uploadOptions = {
                upsert: true,
                onUploadProgress: (progress) => {
                    // Calculate percentage completion
                    const percentage = Math.round((progress.loaded / progress.total) * 100);
                    setUploadProgress(percentage);
                }
            };

            // Upload the file
            const { error: uploadError } = await supabase.storage
                .from('resumes')
                .upload(filePath, file, uploadOptions);

            if (uploadError) {
                throw new Error(`File upload failed: ${uploadError.message}`);
            }

            // Get the file URL
            const { data: signedData, error: signedError } = await supabase.storage
                .from('resumes')
                .createSignedUrl(filePath, 60 * 60 * 24 * 30);

            if (signedError) {
                throw new Error(`Failed to generate URL for the uploaded file: ${signedError.message}`);
            }
            const fileUrl = signedData.signedUrl;

            // Create a unique ID for the resume
            const resumeData = {
                title: title || 'Untitled Resume',
                file_path: filePath,
                file_url: fileUrl,
                file_type: getFileType(file),
                status: 'uploaded',
                created_at: new Date().toISOString()
            };

            // Insert resume record into database
            const { data: insertedResume, error: dbError } = await supabase
                .from('resumes')
                .insert([resumeData])
                .select('id')
                .single();

            if (dbError) {
                throw new Error(`Failed to save resume information: ${dbError.message}`);
            }

            setResumeId(insertedResume.id);

            // Trigger text extraction processing
            setProcessing(true);
            setProcessingProgress(0);
            setProcessingStatus('processing');

            const processingResponse = await fetch('/api/process-resume', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ resumeId: insertedResume.id }),
            });

            if (!processingResponse.ok) {
                const errorData = await processingResponse.json();
                console.warn('Processing warning:', errorData.error || 'Unknown processing issue');
            }

            // Start polling for status updates
            const statusCheckInterval = setInterval(async () => {
                try {
                    const statusResponse = await fetch(`/api/resumes/${insertedResume.id}/status`);
                    if (statusResponse.ok) {
                        const statusData = await statusResponse.json();
                        setProcessingStatus(statusData.status);
                        if (statusData.progressPercentage) {
                            setProcessingProgress(statusData.progressPercentage);
                        }

                        // If processing is complete or failed
                        if (['parsed', 'analyzed', 'completed', 'failed'].includes(statusData.status)) {
                            clearInterval(statusCheckInterval);
                            setProcessing(false);

                            if (statusData.status === 'failed') {
                                setError(statusData.error || 'Processing failed');
                            } else {
                                setSuccess(true);
                            }
                        }
                    }
                } catch (error) {
                    console.error('Error checking status:', error);
                }
            }, 2000);

            setUploading(false);
            setUploadProgress(100);

        } catch (error) {
            console.error('Error uploading resume:', error);
            setError(error.message || 'An error occurred during upload');
            setUploading(false);
            setProcessing(false);
        }
    };

    if (success) {
        return (
            <div className='max-w-lg mx-auto p-8 bg-white rounded-xl shadow-lg'>
                <div className='text-center'>
                    <div className="bg-green-100 rounded-full h-20 w-20 flex items-center justify-center mx-auto mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold mb-2 text-gray-800">Resume Processed Successfully!</h2>
                    <p className="mb-6 text-gray-600">
                        Your resume has been uploaded and processed. You can now view the analysis and extracted data.
                    </p>
                    <div className="flex flex-col space-y-3 sm:flex-row sm:space-y-0 sm:space-x-4 justify-center">
                        <Link
                            href={`/resume/${resumeId}`}
                            className="px-6 py-3 bg-brown text-white font-medium rounded-lg hover:bg-brown-dark transition duration-200"
                        >
                            View Results
                        </Link>
                        <Link
                            href="/"
                            className="px-6 py-3 bg-brown text-white font-medium rounded-lg hover:bg-brown-dark transition duration-200"
                        >
                            Go to Dashboard
                        </Link>
                        <button
                            onClick={() => {
                                setSuccess(false);
                                setFile(null);
                                setTitle('');
                                setUploadProgress(0);
                                setProcessingProgress(0);
                                setResumeId(null);
                            }}
                            className="px-6 py-3 bg-white text-gray-700 font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition duration-200"
                        >
                            Upload Another Resume
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-lg mx-auto p-8 bg-white rounded-xl shadow-lg">
            <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Upload Your Resume</h2>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-6 flex items-start">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>{error}</span>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                        Resume Title
                    </label>
                    <input
                        type="text"
                        id="title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brown focus:border-transparent"
                        placeholder="e.g., Software Engineer Resume"
                    />
                </div>

                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Resume File
                    </label>

                    <div
                        className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer 
              ${dragActive ? 'border-brown bg-brown/5' : 'border-gray-300'}
              ${file ? 'bg-gray-50' : ''}
              hover:border-brown hover:bg-brown/5 transition-colors`}
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                        onClick={() => document.getElementById('file-upload').click()}
                    >
                        <input
                            type="file"
                            id="file-upload"
                            onChange={handleFileChange}
                            className="hidden"
                            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        />

                        {file ? (
                            <div className="flex items-center space-x-4">
                                <div className={`h-12 w-12 rounded-lg flex items-center justify-center
                  ${file.type === 'application/pdf' ? 'bg-red-100' : 'bg-blue-100'}`}>
                  <span className={`text-sm font-medium 
                    ${file.type === 'application/pdf' ? 'text-red-700' : 'text-blue-700'}`}>
                    {getFileType(file).toUpperCase()}
                  </span>
                                </div>
                                <div>
                                    <p className="font-medium text-gray-800">{file.name}</p>
                                    <p className="text-sm text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                                </div>
                                <button
                                    type="button"
                                    className="ml-2 text-gray-400 hover:text-red-500"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setFile(null);
                                    }}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        ) : (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                </svg>
                                <p className="text-center mb-1 font-medium text-gray-700">
                                    Drag & drop your file here or <span className="text-brown">browse</span>
                                </p>
                                <p className="text-center text-xs text-gray-500">
                                    Supports PDF, DOC, DOCX (Max 10MB)
                                </p>
                            </>
                        )}
                    </div>
                </div>

                {uploadProgress > 0 && uploadProgress < 100 && (
                    <div className="w-full bg-gray-200 rounded-full h-2.5 my-4">
                        <div
                            className="bg-brown h-2.5 rounded-full transition-all duration-300"
                            style={{ width: `${uploadProgress}%` }}
                        ></div>
                        <p className="text-xs text-gray-500 mt-1 text-right">{uploadProgress}% uploaded</p>
                    </div>
                )}

                {processing && (
                    <div className="mt-8 bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                        <h3 className="font-medium text-lg text-gray-800 mb-4">Processing Your Resume</h3>

                        <div className="mb-4">
                            <div className="flex justify-between text-sm mb-1">
                                <span>{processingStatus === 'analyzing' ? 'Analyzing your resume...' : 'Extracting resume content...'}</span>
                                <span>{processingProgress}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2.5">
                                <div
                                    className="bg-brown h-2.5 rounded-full transition-all duration-500 ease-in-out"
                                    style={{ width: `${processingProgress}%` }}
                                ></div>
                            </div>
                        </div>

                        <div className="text-sm text-gray-600">
                            <p>We are processing your resume to extract all the important information. Please wait...</p>
                        </div>

                        <div className="mt-4 flex items-center">
                            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-brown mr-2"></div>
                            <span className="text-sm text-gray-600">Please donot close this page</span>
                        </div>
                    </div>
                )}

                <button
                    type="submit"
                    disabled={uploading || processing || !file}
                    className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white ${(uploading || processing || !file)
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-brown hover:bg-brown-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brown'
                    } transition-colors duration-200`}
                >
                    {uploading ? (
                        <div className="flex items-center">
                            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                            Uploading...
                        </div>
                    ) : (
                        <div className="flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                            Upload Resume
                        </div>
                    )}
                </button>
            </form>

            <div className="mt-6 border-t pt-4 border-gray-200">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Supported File Types</h4>
                <ul className="text-xs text-gray-500 space-y-1 list-disc list-inside">
                    <li>PDF Documents (.pdf) - Best compatibility</li>
                    <li>Microsoft Word Documents (.doc, .docx)</li>
                    <li>Plain Text Files (.txt)</li>
                </ul>
            </div>
        </div>
    );
}