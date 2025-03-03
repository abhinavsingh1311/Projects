// src/component/resumeUpload.js
'use client';
import { useState, useCallback } from "react";
import { supabase } from "@/server/utils/supabase-client";
import Link from 'next/link';

export default function ResumeUpload() {
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

    const validateFile = useCallback((selectedFile) => {
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
    }, []);

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
        // Reset previous errors
        setError(null);

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

    const getFileIcon = (fileType) => {
        switch (fileType) {
            case 'pdf':
                return (
                    <svg className="w-10 h-10 text-brown" fill="currentColor" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512">
                        <path d="M181.9 256.1c-5-16-4.9-46.9-2-46.9 8.4 0 7.6 36.9 2 46.9zm-1.7 47.2c-7.7 20.2-17.3 43.3-28.4 62.7 18.3-7 39-17.2 62.9-21.9-12.7-9.6-24.9-23.4-34.5-40.8zM86.1 428.1c0 .8 13.2-5.4 34.9-40.2-6.7 6.3-29.1 24.5-34.9 40.2zM248 160h136v328c0 13.3-10.7 24-24 24H24c-13.3 0-24-10.7-24-24V24C0 10.7 10.7 0 24 0h200v136c0 13.2 10.8 24 24 24zm-8 171.8c-20-12.2-33.3-29-42.7-53.8 4.5-18.5 11.6-46.6 6.2-64.2-4.7-29.4-42.4-26.5-47.8-6.8-5 18.3-.4 44.1 8.1 77-11.6 27.6-28.7 64.6-40.8 85.8-.1 0-.1.1-.2.1-27.1 13.9-73.6 44.5-54.5 68 5.6 6.9 16 10 21.5 10 17.9 0 35.7-18 61.1-61.8 25.8-8.5 54.1-19.1 79-23.2 21.7 11.8 47.1 19.5 64 19.5 29.2 0 31.2-32 19.7-43.4-13.9-13.6-54.3-9.7-73.6-7.2zM377 105L279 7c-4.5-4.5-10.6-7-17-7h-6v128h128v-6.1c0-6.3-2.5-12.4-7-16.9zm-74.1 255.3c4.1-2.7-2.5-11.9-42.8-9 37.1 15.8 42.8 9 42.8 9z" />
                    </svg>
                );
            case 'doc':
            case 'docx':
                return (
                    <svg className="w-10 h-10 text-brown" fill="currentColor" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512">
                        <path d="M224 136V0H24C10.7 0 0 10.7 0 24v464c0 13.3 10.7 24 24 24h336c13.3 0 24-10.7 24-24V160H248c-13.2 0-24-10.8-24-24zm57.1 120H208c-8.8 0-16 7.2-16 16v48c0 8.8 7.2 16 16 16h73.1c8.8 0 16-7.2 16-16v-48c0-8.8-7.2-16-16-16zm-56 304H112c-8.8 0-16-7.2-16-16v-48c0-8.8 7.2-16 16-16h113.1c8.8 0 16 7.2 16 16v48c0 8.8-7.2 16-16 16zm-56-152H112c-8.8 0-16-7.2-16-16v-48c0-8.8 7.2-16 16-16h113.1c8.8 0 16 7.2 16 16v48c0 8.8-7.2 16-16 16zm224-72v48c0 8.8-7.2 16-16 16H368c-8.8 0-16-7.2-16-16v-48c0-8.8 7.2-16 16-16h49.1c8.8 0 16 7.2 16 16z" />
                    </svg>
                );
            default:
                return (
                    <svg className="w-10 h-10 text-brown-light" fill="currentColor" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512">
                        <path d="M224 136V0H24C10.7 0 0 10.7 0 24v464c0 13.3 10.7 24 24 24h336c13.3 0 24-10.7 24-24V160H248c-13.2 0-24-10.8-24-24zm160-14.1v6.1H256V0h6.1c6.4 0 12.5 2.5 17 7l97.9 98c4.5 4.5 7 10.6 7 16.9z" />
                    </svg>
                );
        }
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

            // Get user session
            const { data: { user }, error: authError } = await supabase.auth.getUser();
            if (authError || !user) {
                throw new Error(authError?.message || 'Authentication required. Please sign in again.');
            }

            console.log("Authenticated user:", user.id);

            // Create a sanitized file path
            const fileExt = file.name.split('.').pop();
            const sanitizedName = file.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
            const fileName = `${Date.now()}_${sanitizedName}`;
            const filePath = `${user.id}/${fileName}`;

            console.log(`Uploading file to path: ${filePath}`);

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
                console.error('Upload error details:', uploadError);
                throw new Error(`File upload failed: ${uploadError.message}`);
            }

            console.log('File uploaded successfully');

            // Get the file URL
            const { data: signedData, error: signedError } = await supabase.storage
                .from('resumes')
                .createSignedUrl(filePath, 60 * 60 * 24 * 30);

            if (signedError) {
                console.error('Error creating signed URL:', signedError);
                throw new Error(`Failed to generate URL for the uploaded file: ${signedError.message}`);
            }
            const fileUrl = signedData.signedUrl;
            console.log('Signed URL generated:', fileUrl);

            const resumeData = {
                title: title || 'Untitled Resume',
                user_id: user.id,
                file_path: filePath,
                file_url: fileUrl,
                file_type: getFileType(file),
                status: 'uploaded',
                created_at: new Date().toISOString()
            };

            console.log('Saving resume data:', resumeData);

            // Insert resume record into database
            const { data: insertedResume, error: dbError } = await supabase
                .from('resumes')
                .insert([resumeData])
                .select('id')
                .single();

            if (dbError) {
                console.error('Database insertion error:', dbError);
                throw new Error(`Failed to save resume information: ${dbError.message}`);
            }

            console.log('Resume saved successfully with ID:', insertedResume.id);
            setResumeId(insertedResume.id);

            // Trigger text extraction processing
            try {
                console.log('Triggering resume processing...');
                setProcessing(true);

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
                    // We don't fail the upload, but show a warning
                } else {
                    const processingResult = await processingResponse.json();
                    if (processingResult.success) {
                        console.log('Resume processing initiated successfully');
                    } else {
                        console.warn('Processing warning:', processingResult.error || 'Unknown processing issue');
                    }
                }
            } catch (processingError) {
                console.error('Error triggering resume processing:', processingError);
                // Show a warning toast but don't fail the upload
                // In a real app, we might use a toast library here
                console.warn('Your resume was uploaded but processing might be delayed. You can try again later.');
            } finally {
                setProcessing(false);
            }

            setSuccess(true);
            setFile(null);
            setTitle('');
            setUploadProgress(0);

        } catch (error) {
            console.error('Error uploading resume:', error);
            setError(error.message || 'An error occurred during upload');
        } finally {
            setUploading(false);
        }
    };

    if (success) {
        return (
            <div className='max-w-lg mx-auto p-8 bg-white rounded-xl shadow-lg dark:bg-gray-800'>
                <div className='text-center'>
                    <div className="bg-green-100 dark:bg-green-900 rounded-full h-20 w-20 flex items-center justify-center mx-auto mb-4">
                        <svg className="w-10 h-10 text-green-500 dark:text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold mb-2 text-gray-800 dark:text-white">Resume Uploaded Successfully!</h2>
                    <p className="mb-6 text-gray-600 dark:text-gray-300">
                        Your resume has been uploaded and is being processed. You'll be able to view the analysis shortly.
                    </p>
                    <div className="flex flex-col space-y-3 sm:flex-row sm:space-y-0 sm:space-x-4 justify-center">
                        <Link
                            href={`/resume/${resumeId}`}
                            className="px-6 py-3 bg-primary text-white font-medium rounded-lg hover:bg-primary-dark transition duration-200"
                        >
                            View Resume
                        </Link>
                        <Link
                            href="/"
                            className="px-6 py-3 bg-primary text-white font-medium rounded-lg hover:bg-primary-dark transition duration-200"
                        >
                            Go to My Resumes
                        </Link>
                        <button
                            onClick={() => setSuccess(false)}
                            className="px-6 py-3 bg-white text-gray-700 font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition duration-200 dark:bg-gray-700 dark:text-white dark:border-gray-600 dark:hover:bg-gray-600"
                        >
                            Upload Another Resume
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="max-w-lg mx-auto p-8 bg-white rounded-xl shadow-lg dark:bg-gray-800">
            <h2 className="text-2xl font-bold mb-6 text-center text-gray-800 dark:text-white">Upload Your Resume</h2>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-6 dark:bg-red-900/30 dark:border-red-800 dark:text-red-400">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Resume Title
                    </label>
                    <input
                        type="text"
                        id="title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        placeholder="e.g., Software Engineer Resume"
                    />
                </div>

                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Resume File
                    </label>

                    <div
                        className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer 
                            ${dragActive ? 'border-primary bg-primary/5' : 'border-gray-300 dark:border-gray-700'}
                            ${file ? 'bg-gray-50 dark:bg-gray-800' : ''}
                            hover:border-primary hover:bg-primary/5 transition-colors dark:hover:border-primary/70 dark:hover:bg-primary/10`}
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
                                {getFileIcon(getFileType(file))}
                                <div>
                                    <p className="font-medium text-gray-800 dark:text-white">{file.name}</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">{(file.size / 1024).toFixed(1)} KB</p>
                                </div>
                                <button
                                    type="button"
                                    className="ml-2 text-gray-400 hover:text-red-500"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setFile(null);
                                    }}
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                                    </svg>
                                </button>
                            </div>
                        ) : (
                            <>
                                <svg className="w-12 h-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                                </svg>
                                <p className="text-center mb-1 font-medium text-gray-700 dark:text-gray-300">
                                    Drag & drop your file here or <span className="text-primary">browse</span>
                                </p>
                                <p className="text-center text-xs text-gray-500 dark:text-gray-400">
                                    Supports PDF, DOC, DOCX (Max 10MB)
                                </p>
                            </>
                        )}
                    </div>
                </div>

                <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    <p>Your resume will be processed to extract skills, experience, and other information for analysis.</p>
                </div>

                {uploadProgress > 0 && uploadProgress < 100 && (
                    <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 my-4">
                        <div
                            className="bg-primary h-2.5 rounded-full transition-all duration-300"
                            style={{ width: `${uploadProgress}%` }}
                        ></div>
                        <p className="text-xs text-gray-500 mt-1 text-right">{uploadProgress}% uploaded</p>
                    </div>
                )}

                <button
                    type="submit"
                    disabled={uploading || processing || !file}
                    className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white ${(uploading || processing || !file)
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary'
                        } transition-colors duration-200`}
                >
                    {uploading || processing ? (
                        <div className="flex items-center">
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            {uploading ? 'Uploading...' : 'Processing...'}
                        </div>
                    ) : (
                        "Upload Resume"
                    )}
                </button>
            </form>

            <div className="mt-6 border-t pt-4 border-gray-200 dark:border-gray-700">
                <h3 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-2">Tips for better results:</h3>
                <ul className="list-disc list-inside text-xs text-gray-600 dark:text-gray-400 space-y-1">
                    <li>Use a well-formatted PDF for best extraction accuracy</li>
                    <li>Ensure your resume includes a skills section</li>
                    <li>Keep your resume under 10MB in size</li>
                    <li>Text-based documents work better than scanned images</li>
                </ul>
            </div>
        </div>
    );
}