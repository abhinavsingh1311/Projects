'use client';
import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/server/utils/supabase-client";
import Link from 'next/link';
import { Upload, FileType, CheckCircle, AlertTriangle, File, X, Cloud } from 'lucide-react';

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
    const [processingStatus, setProcessingStatus] = useState(null);
    const [processingProgress, setProcessingProgress] = useState(0);
    const [showTips, setShowTips] = useState(false);

    // Poll for processing status when processing
    useEffect(() => {
        let interval;
        if (processing && resumeId) {
            interval = setInterval(async () => {
                try {
                    const response = await fetch(`/api/resumes/${resumeId}/status`);
                    if (response.ok) {
                        const data = await response.json();
                        setProcessingStatus(data.status);

                        // If we have a progress percentage, use it
                        if (data.progressPercentage) {
                            setProcessingProgress(data.progressPercentage);
                        } else {
                            // Otherwise increment our simulated progress
                            setProcessingProgress(prev => Math.min(prev + 5, 95));
                        }

                        // If processing is complete
                        if (['parsed', 'analyzed', 'completed'].includes(data.status)) {
                            clearInterval(interval);
                            setProcessing(false);
                            setProcessingProgress(100);

                            // Delay the success state slightly for better UX
                            setTimeout(() => {
                                setSuccess(true);
                            }, 1000);
                        }

                        // If processing failed
                        if (data.status === 'failed') {
                            clearInterval(interval);
                            setProcessing(false);
                            setError(data.error || 'Processing failed. Please try again.');
                        }
                    }
                } catch (error) {
                    console.error('Error checking processing status:', error);
                }
            }, 2000);
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [processing, resumeId]);

    const validateFile = useCallback((selectedFile) => {
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
                    <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                        <span className="text-red-600 font-semibold">PDF</span>
                    </div>
                );
            case 'doc':
            case 'docx':
                return (
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                        <span className="text-blue-600 font-semibold">DOC</span>
                    </div>
                );
            default:
                return (
                    <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                        <File className="h-6 w-6 text-gray-500" />
                    </div>
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

            // Create a sanitized file path
            const fileExt = file.name.split('.').pop();
            const sanitizedName = file.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
            const fileName = `${Date.now()}_${sanitizedName}`;
            const filePath = `${user.id}/${fileName}`;

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

            const resumeData = {
                title: title || 'Untitled Resume',
                user_id: user.id,
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
            try {
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

                // Note: we don't set success here - we'll wait for the polling to detect completion
                setUploading(false);
                setUploadProgress(0);

            } catch (processingError) {
                console.error('Error triggering resume processing:', processingError);
                setProcessing(false);
                setError('Your resume was uploaded but processing failed. You can try again later.');
                setUploading(false);
            }

        } catch (error) {
            console.error('Error uploading resume:', error);
            setError(error.message || 'An error occurred during upload');
            setUploading(false);
            setProcessing(false);
        }
    };

    const renderProcessingStatus = () => {
        if (!processing) return null;

        return (
            <div className="mt-8 bg-white p-6 rounded-lg shadow-sm border border-brown-light">
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
                    {processingStatus === 'analyzing' ? (
                        <p>We're analyzing your resume content to extract skills, experience, and provide personalized insights. This may take a minute...</p>
                    ) : (
                        <p>We're processing your resume to extract all the important information. Please wait...</p>
                    )}
                </div>

                <div className="mt-4 flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-brown mr-2"></div>
                    <span className="text-sm text-gray-600">Please don't close this page</span>
                </div>
            </div>
        );
    };

    if (success) {
        return (
            <div className='max-w-lg mx-auto p-8 bg-white rounded-xl shadow-lg'>
                <div className='text-center'>
                    <div className="bg-green-100 rounded-full h-20 w-20 flex items-center justify-center mx-auto mb-4">
                        <CheckCircle className="w-10 h-10 text-green-500" />
                    </div>
                    <h2 className="text-2xl font-bold mb-2 text-gray-800">Resume Processed Successfully!</h2>
                    <p className="mb-6 text-gray-600">
                        Your resume has been uploaded and processed. You can now view the analysis and job matches.
                    </p>
                    <div className="flex flex-col space-y-3 sm:flex-row sm:space-y-0 sm:space-x-4 justify-center">
                        <Link
                            href={`/resume/${resumeId}`}
                            className="px-6 py-3 bg-primary text-white font-medium rounded-lg hover:bg-primary-dark transition duration-200"
                        >
                            View Analysis
                        </Link>
                        <Link
                            href="/"
                            className="px-6 py-3 bg-primary text-white font-medium rounded-lg hover:bg-primary-dark transition duration-200"
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
        )
    }

    return (
        <div className="max-w-lg mx-auto p-8 bg-white rounded-xl shadow-lg">
            <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Upload Your Resume</h2>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-6 flex items-start">
                    <AlertTriangle className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
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
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                        placeholder="e.g., Software Engineer Resume"
                    />
                </div>

                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Resume File
                    </label>

                    <div
                        className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer 
                            ${dragActive ? 'border-primary bg-primary/5' : 'border-gray-300'}
                            ${file ? 'bg-gray-50' : ''}
                            hover:border-primary hover:bg-primary/5 transition-colors`}
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
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        ) : (
                            <>
                                <Cloud className="w-12 h-12 text-gray-400 mb-3" />
                                <p className="text-center mb-1 font-medium text-gray-700">
                                    Drag & drop your file here or <span className="text-primary">browse</span>
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
                    {uploading ? (
                        <div className="flex items-center">
                            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                            Uploading...
                        </div>
                    ) : (
                        <div className="flex items-center">
                            <Upload className="h-5 w-5 mr-2" />
                            Upload Resume
                        </div>
                    )}
                </button>
            </form>

            {renderProcessingStatus()}

            <div className="mt-6 border-t pt-4 border-gray-200">
                <button
                    className="flex items-center text-sm text-gray-700 hover:text-brown mb-2"
                    onClick={() => setShowTips(!showTips)}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 mr-1 transition-transform ${showTips ? 'rotate-90' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                    {showTips ? 'Hide Resume Tips' : 'Show Resume Tips'}
                </button>

                {showTips && (
                    <div className="mt-2 space-y-3">
                        <div className="bg-blue-50 p-3 rounded-lg">
                            <h4 className="text-sm font-medium text-blue-800 mb-1">Formatting Tips</h4>
                            <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
                                <li>Use a clean, professional template with clear section headings</li>
                                <li>Include your name, contact information, and LinkedIn at the top</li>
                                <li>Use bulleted lists to highlight accomplishments</li>
                                <li>Keep your resume to 1-2 pages maximum</li>
                            </ul>
                        </div>

                        <div className="bg-green-50 p-3 rounded-lg">
                            <h4 className="text-sm font-medium text-green-800 mb-1">ATS Optimization</h4>
                            <ul className="text-xs text-green-700 space-y-1 list-disc list-inside">
                                <li>Use a simple, standard font like Arial or Calibri</li>
                                <li>Avoid tables, columns, headers/footers, and text boxes</li>
                                <li>Include keywords from job descriptions you're applying to</li>
                                <li>Use standard section headings (Experience, Education, Skills)</li>
                            </ul>
                        </div>

                        <div className="bg-purple-50 p-3 rounded-lg">
                            <h4 className="text-sm font-medium text-purple-800 mb-1">Content Tips</h4>
                            <ul className="text-xs text-purple-700 space-y-1 list-disc list-inside">
                                <li>Quantify achievements with numbers and percentages</li>
                                <li>Focus on results and impact, not just responsibilities</li>
                                <li>Tailor your resume for each job application</li>
                                <li>Include a skills section with relevant technical and soft skills</li>
                            </ul>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}