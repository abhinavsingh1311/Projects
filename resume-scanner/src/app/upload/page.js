'use client';
import { useState, useEffect } from 'react';
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
    const [processingStatus, setProcessingStatus] = useState(null);
    const [processingProgress, setProcessingProgress] = useState(0);

    const validateFile = (selectedFile) => {
        setError(null);
        if (!selectedFile) return { valid: false, message: 'Please select a file' };

        const maxSize = 10 * 1024 * 1024;
        if (selectedFile.size > maxSize) {
            return {
                valid: false,
                message: `File size ${(selectedFile.size/(1024*1024)).toFixed(1)}MB exceeds 10MB limit`
            };
        }

        const allowedTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];

        if (!allowedTypes.includes(selectedFile.type)) {
            return {
                valid: false,
                message: 'Only PDF, DOC, and DOCX files are allowed'
            };
        }

        return { valid: true, message: 'Valid file' };
    };

    const handleFileChange = (e) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) processFile(selectedFile);
    };

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(e.type === "dragenter" || e.type === "dragover");
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        const file = e.dataTransfer.files?.[0];
        file && processFile(file);
    };

    const processFile = (file) => {
        const validation = validateFile(file);
        if (!validation.valid) {
            setError(validation.message);
            setFile(null);
            return;
        }

        setFile(file);
        if (!title) {
            const cleanName = file.name
                .replace(/\.[^/.]+$/, "") // Remove extension
                .replace(/[_-]/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            setTitle(cleanName);
        }
    };

    const getFileType = (file) => {
        const typeMap = {
            'application/pdf': 'pdf',
            'application/msword': 'doc',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx'
        };
        return typeMap[file.type] || 'unknown';
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

            // Get fresh session
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (!session || sessionError) throw new Error('Session expired - please sign in again');

            // Verify valid user
            const { data: { user }, error: userError } = await supabase.auth.getUser(session.access_token);
            if (!user || userError) throw new Error('User authentication failed');

            // Upload file to storage
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}_${user.id}_${file.name.replace(/\.[^/.]+$/, "")}.${fileExt}`;
            const filePath = `user-${user.id}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('resumes')
                .upload(filePath, file, {
                    upsert: false,
                    onUploadProgress: (progress) => {
                        setUploadProgress(Math.round((progress.loaded / progress.total) * 100));
                    }
                });

            if (uploadError) throw new Error(`File upload failed: ${uploadError.message}`);

            // Create signed URL
            const { data: signedUrlData, error: urlError } = await supabase.storage
                .from('resumes')
                .createSignedUrl(filePath, 60 * 60);

            if (urlError) throw new Error(`URL generation failed: ${urlError.message}`);

            // Create database record
            const { data: resumeData, error: dbError } = await supabase
                .from('resumes')
                .insert([{
                    title: title || 'Untitled Resume',
                    user_id: user.id,
                    file_path: filePath,
                    file_url: signedUrlData.signedUrl,
                    file_type: getFileType(file),
                    status: 'uploaded'
                }])
                .select('id')
                .single();

            if (dbError) throw new Error(`Database error: ${dbError.message}`);

            setResumeId(resumeData.id);
            setProcessing(true);
            setProcessingProgress(10);

            // Start processing pipeline
            const processResponse = await fetch(`/api/resumes/${resumeData.id}/process-resume`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ resumeId: resumeData.id })
            });

            if (!processResponse.ok) {
                const errorData = await processResponse.json();
                throw new Error(errorData.error || 'Processing initialization failed');
            }

            // Poll for status updates
            const pollInterval = setInterval(async () => {
                try {
                    const statusResponse = await fetch(`/api/resumes/${resumeData.id}/status`, {
                        headers: {
                            'Authorization': `Bearer ${session.access_token}`
                        }
                    });

                    if (!statusResponse.ok) {
                        clearInterval(pollInterval);
                        throw new Error('Status check failed');
                    }

                    const statusData = await statusResponse.json();

                    setProcessingStatus(statusData.status);
                    setProcessingProgress(statusData.progress || 0);

                    if (['parsed', 'analyzed', 'completed', 'failed'].includes(statusData.status)) {
                        clearInterval(pollInterval);
                        setProcessing(false);

                        if (statusData.status === 'failed') {
                            throw new Error(statusData.error || 'Processing failed');
                        } else {
                            setSuccess(true);
                        }
                    }
                } catch (error) {
                    console.error('Polling error:', error);
                    setError(error.message);
                    setProcessing(false);
                    clearInterval(pollInterval);
                }
            }, 2000);

        } catch (error) {
            console.error('Upload error:', error);
            setError(error.message);
            setUploading(false);
            setProcessing(false);
        } finally {
            setUploading(false);
        }
    };

    if (success) {
        return (
            <div className="max-w-lg mx-auto p-8 bg-white rounded-xl shadow-lg">
                <div className="text-center">
                    <div className="bg-green-100 rounded-full h-20 w-20 flex items-center justify-center mx-auto mb-4">
                        <svg className="h-10 w-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold mb-4 text-gray-800">Upload Successful!</h2>
                    <div className="flex flex-col space-y-3 sm:flex-row sm:space-x-4 sm:space-y-0 justify-center">
                        <Link
                            href={`/resume/${resumeId}`}
                            className="px-6 py-3 bg-brown text-white rounded-lg hover:bg-brown-dark transition-colors"
                        >
                            View Analysis
                        </Link>
                        <button
                            onClick={() => {
                                setFile(null);
                                setTitle('');
                                setSuccess(false);
                                setResumeId(null);
                            }}
                            className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                            Upload Another
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-lg mx-auto p-8 bg-white rounded-xl shadow-lg">
            <h1 className="text-2xl font-bold mb-6 text-center text-gray-800">Upload Resume</h1>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-lg mb-6 flex items-start">
                    <svg className="h-5 w-5 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>{error}</span>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Resume Title
                    </label>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brown focus:border-transparent"
                        placeholder="Software Engineer Resume"
                    />
                </div>

                <div
                    className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
                        ${dragActive ? 'border-brown bg-brown/10' : 'border-gray-300'}
                        ${file ? 'bg-gray-50' : ''}`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => document.getElementById('hidden-file-input').click()}
                >
                    <input
                        type="file"
                        id="hidden-file-input"
                        className="hidden"
                        onChange={handleFileChange}
                        accept=".pdf,.doc,.docx"
                    />

                    {file ? (
                        <div className="flex items-center justify-center space-x-4">
                            <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${
                                file.type === 'application/pdf' ? 'bg-red-100' : 'bg-blue-100'
                            }`}>
                                <span className={`text-sm font-medium ${
                                    file.type === 'application/pdf' ? 'text-red-700' : 'text-blue-700'
                                }`}>
                                    {getFileType(file).toUpperCase()}
                                </span>
                            </div>
                            <div className="text-left">
                                <p className="font-medium text-gray-800">{file.name}</p>
                                <p className="text-sm text-gray-500">{(file.size/1024).toFixed(1)} KB</p>
                            </div>
                            <button
                                type="button"
                                className="text-gray-400 hover:text-red-500 ml-2"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setFile(null);
                                }}
                            >
                                ✕
                            </button>
                        </div>
                    ) : (
                        <>
                            <svg className="h-12 w-12 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                            <p className="text-gray-700 mb-1">
                                Drag file here or <span className="text-brown font-medium">browse</span>
                            </p>
                            <p className="text-sm text-gray-500">
                                PDF, DOC, DOCX (Max 10MB)
                            </p>
                        </>
                    )}
                </div>

                {uploadProgress > 0 && (
                    <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                            className="bg-brown h-2 rounded-full transition-all duration-300"
                            style={{ width: `${uploadProgress}%` }}
                        />
                    </div>
                )}

                <button
                    type="submit"
                    disabled={uploading || processing || !file}
                    className={`w-full py-3 px-4 rounded-lg font-medium text-white transition-colors
                        ${uploading || processing || !file
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-brown hover:bg-brown-dark'}`}
                >
                    {uploading ? 'Uploading...' : 'Upload Resume'}
                </button>
            </form>
        </div>
    );
}