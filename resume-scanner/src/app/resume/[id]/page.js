// src/app/resume/[id]/page.js
'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/server/utils/supabase-client';
import Link from 'next/link';

export default function ResumePage() {
    const params = useParams();
    const router = useRouter();
    const { id } = params;
    const [analyzing, setAnalyzing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [resume, setResume] = useState(null);
    const [parsedData, setParsedData] = useState(null);
    const [error, setError] = useState(null);
    const [processingStatus, setProcessingStatus] = useState('loading');

    useEffect(() => {
        if (!id) return;

        const fetchResume = async () => {
            try {
                setLoading(true);

                // Fetch resume details
                const { data: resumeData, error: resumeError } = await supabase
                    .from('resumes')
                    .select('*')
                    .eq('id', id)
                    .single();

                if (resumeError) throw resumeError;
                setResume(resumeData);

                // Fetch parsed data if available
                if (['parsed', 'analyzed', 'completed'].includes(resumeData.status)) {
                    const response = await fetch(`/api/resumes/${id}/parsed-data`);
                    if (response.ok) {
                        const data = await response.json();
                        setParsedData(data);
                    }
                }

                setProcessingStatus(resumeData.status);

                // If status is 'uploaded' or 'parsing', check status periodically
                if (['uploaded', 'parsing'].includes(resumeData.status)) {
                    const intervalId = setInterval(async () => {
                        const { data: updatedResume } = await supabase
                            .from('resumes')
                            .select('status, processing_error')
                            .eq('id', id)
                            .single();

                        if (updatedResume) {
                            setProcessingStatus(updatedResume.status);

                            // If parsing is complete, fetch parsed data
                            if (['parsed', 'analyzed', 'completed'].includes(updatedResume.status)) {
                                clearInterval(intervalId);
                                const response = await fetch(`/api/resumes/${id}/parsed-data`);
                                if (response.ok) {
                                    const data = await response.json();
                                    setParsedData(data);
                                }
                            }

                            // If parsing failed, show error
                            if (updatedResume.status === 'failed') {
                                clearInterval(intervalId);
                                setError(updatedResume.processing_error || 'Processing failed');
                            }
                        }
                    }, 5000); // Check every 5 seconds

                    return () => clearInterval(intervalId);
                }
            } catch (error) {
                console.error('Error fetching resume:', error);
                setError(error.message);
            } finally {
                setLoading(false);
            }
        };

        fetchResume();
    }, [id]);

    const handleProcessNow = async () => {
        try {
            setError(null);
            setProcessingStatus('parsing');

            // Get the current session token
            const { data: { session } } = await supabase.auth.getSession();

            if (!session) {
                throw new Error('Authentication required');
            }

            const response = await fetch('/api/process-resume', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                    resumeId: id,
                    force: true
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to start processing');
            }

            // Start polling for status updates
            const intervalId = setInterval(async () => {
                const { data: updatedResume } = await supabase
                    .from('resumes')
                    .select('status, processing_error')
                    .eq('id', id)
                    .single();

                if (updatedResume) {
                    setProcessingStatus(updatedResume.status);

                    // If parsing is complete, fetch parsed data
                    if (['parsed', 'analyzed', 'completed'].includes(updatedResume.status)) {
                        clearInterval(intervalId);
                        const response = await fetch(`/api/resumes/${id}/parsed-data`);
                        if (response.ok) {
                            const data = await response.json();
                            setParsedData(data);
                        }
                    }

                    // If parsing failed, show error
                    if (updatedResume.status === 'failed') {
                        clearInterval(intervalId);
                        setError(updatedResume.processing_error || 'Processing failed');
                    }
                }
            }, 3000); // Check every 3 seconds

            return () => clearInterval(intervalId);

        } catch (error) {
            console.error('Error processing resume:', error);
            setError(error.message);
            setProcessingStatus('failed');
        }
    };

    const handleAnalyzeResume = async () => {
        try {
            setAnalyzing(true);
            setError(null);

            // Get the current session token
            const { data: { session } } = await supabase.auth.getSession();

            if (!session) {
                throw new Error('Authentication required');
            }

            const response = await fetch(`/api/resumes/${id}/analyze`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ resumeId: id, force: false }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to analyze resume');
            }

            // Poll for status updates or navigate to analysis page
            router.push(`/resume/${id}/analysis`);

        } catch (error) {
            console.error('Error analyzing resume:', error);
            setError(error.message);
        } finally {
            setAnalyzing(false);
        }
    };

    if (loading) {
        return (
            <div className="container mx-auto p-6">
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brown"></div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="container mx-auto p-6">
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-6">
                    <p>Error: {error}</p>
                    <button
                        onClick={handleProcessNow}
                        className="mt-4 bg-brown text-white px-4 py-2 rounded-lg hover:bg-brown-dark"
                    >
                        Try Again
                    </button>
                </div>
                <Link href="/" className="text-brown hover:underline">
                    Back to My Resumes
                </Link>
            </div>
        );
    }

    if (!resume) {
        return (
            <div className="container mx-auto p-6">
                <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg mb-6">
                    <p>Resume not found</p>
                </div>
                <Link href="/" className="text-brown hover:underline">
                    Back to My Resumes
                </Link>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6">
            <div className="mb-6">
                <Link href="/" className="text-brown hover:underline flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                    </svg>
                    Back to My Resumes
                </Link>
            </div>

            <div className="bg-white shadow-sm rounded-lg overflow-hidden border border-gray-200 mb-6">
                <div className="p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h1 className="text-2xl font-bold text-gray-900">{resume.title}</h1>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${processingStatus === 'parsed' || processingStatus === 'analyzed' || processingStatus === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : processingStatus === 'parsing' || processingStatus === 'uploading'
                                ? 'bg-blue-100 text-blue-800'
                                : processingStatus === 'failed'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-gray-100 text-gray-800'
                            }`}>
                            {processingStatus === 'parsed' || processingStatus === 'analyzed' || processingStatus === 'completed'
                                ? 'Processed'
                                : processingStatus === 'parsing'
                                    ? 'Processing'
                                    : processingStatus === 'uploaded'
                                        ? 'Uploaded'
                                        : processingStatus === 'failed'
                                            ? 'Failed'
                                            : processingStatus}
                        </span>
                    </div>

                    <div className="flex items-center text-sm text-gray-500 mb-6">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Uploaded on {new Date(resume.created_at).toLocaleDateString()}
                    </div>

                    {processingStatus === 'uploaded' && (
                        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
                            <div className="flex">
                                <div className="flex-shrink-0">
                                    <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <div className="ml-3">
                                    <h3 className="text-sm font-medium text-yellow-800">Resume not processed yet</h3>
                                    <div className="mt-2 text-sm text-yellow-700">
                                        <p>Your resume has been uploaded but hasn't been processed for analysis yet.</p>
                                    </div>
                                    <div className="mt-4">
                                        <button
                                            onClick={handleProcessNow}
                                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-brown hover:bg-brown-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brown"
                                        >
                                            Process Now
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {processingStatus === 'parsing' && (
                        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
                            <div className="flex">
                                <div className="flex-shrink-0">
                                    <svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                </div>
                                <div className="ml-3">
                                    <h3 className="text-sm font-medium text-blue-800">Processing your resume</h3>
                                    <div className="mt-2 text-sm text-blue-700">
                                        <p>We're extracting information from your resume. This may take a moment.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {parsedData && ['parsed', 'analyzed', 'completed'].includes(processingStatus) && (
                        <div>
                            {/* Resume Skills Section */}
                            <div className="mb-8">
                                <h2 className="text-xl font-semibold text-gray-800 mb-4">Skills Identified</h2>

                                {parsedData.parsedData.skills && parsedData.parsedData.skills.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                        {parsedData.parsedData.skills.map((skill, index) => (
                                            <span key={index} className="bg-brown-light/20 text-brown-dark px-3 py-1 rounded-full text-sm">
                                                {skill}
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-gray-500 italic">No skills were identified. Try processing the resume again or manually add your skills.</p>
                                )}
                            </div>

                            {/* Contact Information */}
                            <div className="mb-8">
                                <h2 className="text-xl font-semibold text-gray-800 mb-4">Contact Information</h2>
                                <div className="bg-gray-50 rounded-lg p-4">
                                    {parsedData.parsedData.contactInfo && Object.keys(parsedData.parsedData.contactInfo).length > 0 ? (
                                        <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                                            {parsedData.parsedData.contactInfo.name && (
                                                <div className="sm:col-span-1">
                                                    <dt className="text-sm font-medium text-gray-500">Name</dt>
                                                    <dd className="mt-1 text-sm text-gray-900">{parsedData.parsedData.contactInfo.name}</dd>
                                                </div>
                                            )}
                                            {parsedData.parsedData.contactInfo.email && (
                                                <div className="sm:col-span-1">
                                                    <dt className="text-sm font-medium text-gray-500">Email</dt>
                                                    <dd className="mt-1 text-sm text-gray-900">{parsedData.parsedData.contactInfo.email}</dd>
                                                </div>
                                            )}
                                            {parsedData.parsedData.contactInfo.phone && (
                                                <div className="sm:col-span-1">
                                                    <dt className="text-sm font-medium text-gray-500">Phone</dt>
                                                    <dd className="mt-1 text-sm text-gray-900">{parsedData.parsedData.contactInfo.phone}</dd>
                                                </div>
                                            )}
                                            {parsedData.parsedData.contactInfo.linkedin && (
                                                <div className="sm:col-span-1">
                                                    <dt className="text-sm font-medium text-gray-500">LinkedIn</dt>
                                                    <dd className="mt-1 text-sm text-gray-900">{parsedData.parsedData.contactInfo.linkedin}</dd>
                                                </div>
                                            )}
                                            {parsedData.parsedData.contactInfo.website && (
                                                <div className="sm:col-span-1">
                                                    <dt className="text-sm font-medium text-gray-500">Website</dt>
                                                    <dd className="mt-1 text-sm text-gray-900">{parsedData.parsedData.contactInfo.website}</dd>
                                                </div>
                                            )}
                                        </dl>
                                    ) : (
                                        <p className="text-gray-500 italic">No contact information was identified.</p>
                                    )}
                                </div>
                            </div>

                            {/* Resume Sections */}
                            {parsedData.parsedData.sections && Object.entries(parsedData.parsedData.sections).filter(([key, value]) => value).length > 0 && (
                                <div className="mb-8">
                                    <h2 className="text-xl font-semibold text-gray-800 mb-4">Resume Sections</h2>

                                    <div className="space-y-6">
                                        {parsedData.parsedData.sections.summary && (
                                            <div>
                                                <h3 className="text-lg font-medium text-gray-800 mb-2">Summary</h3>
                                                <div className="bg-gray-50 p-4 rounded-lg">
                                                    <p className="text-gray-700 whitespace-pre-line">{parsedData.parsedData.sections.summary}</p>
                                                </div>
                                            </div>
                                        )}

                                        {parsedData.parsedData.sections.experience && (
                                            <div>
                                                <h3 className="text-lg font-medium text-gray-800 mb-2">Experience</h3>
                                                <div className="bg-gray-50 p-4 rounded-lg">
                                                    <p className="text-gray-700 whitespace-pre-line">{parsedData.parsedData.sections.experience}</p>
                                                </div>
                                            </div>
                                        )}

                                        {parsedData.parsedData.sections.education && (
                                            <div>
                                                <h3 className="text-lg font-medium text-gray-800 mb-2">Education</h3>
                                                <div className="bg-gray-50 p-4 rounded-lg">
                                                    <p className="text-gray-700 whitespace-pre-line">{parsedData.parsedData.sections.education}</p>
                                                </div>
                                            </div>
                                        )}

                                        {parsedData.parsedData.sections.projects && (
                                            <div>
                                                <h3 className="text-lg font-medium text-gray-800 mb-2">Projects</h3>
                                                <div className="bg-gray-50 p-4 rounded-lg">
                                                    <p className="text-gray-700 whitespace-pre-line">{parsedData.parsedData.sections.projects}</p>
                                                </div>
                                            </div>
                                        )}

                                        {parsedData.parsedData.sections.certifications && (
                                            <div>
                                                <h3 className="text-lg font-medium text-gray-800 mb-2">Certifications</h3>
                                                <div className="bg-gray-50 p-4 rounded-lg">
                                                    <p className="text-gray-700 whitespace-pre-line">{parsedData.parsedData.sections.certifications}</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="mt-8">
                                <div className="flex flex-wrap gap-4">
                                    <button
                                        onClick={handleProcessNow}
                                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-brown hover:bg-brown-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brown"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                        Re-process Resume
                                    </button>

                                    <button
                                        onClick={() => window.open(resume.file_url, '_blank')}
                                        className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                        View Original Resume
                                    </button>

                                    {resume.status === 'analyzed' || resume.status === 'completed' ? (
                                        <Link
                                            href={`/resume/${resume.id}/analysis`}
                                            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-brown hover:bg-brown-dark"
                                        >
                                            <svg className="w-4 h-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                            </svg>
                                            View Analysis
                                        </Link>
                                    ) : (
                                        <button
                                            onClick={handleAnalyzeResume}
                                            disabled={analyzing || resume.status === 'analyzing' || resume.status === 'uploading'}
                                            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-brown hover:bg-brown-dark disabled:opacity-50"
                                        >
                                            {analyzing || resume.status === 'analyzing' ? 'Analyzing...' : 'Analyze Resume'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Raw Text Section (for debugging) */}
            {parsedData && (
                <div className="bg-white shadow-sm rounded-lg overflow-hidden border border-gray-200 mb-6">
                    <div className="p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-semibold text-gray-800">Raw Extracted Text</h2>
                            <button
                                onClick={() => navigator.clipboard.writeText(parsedData.rawText)}
                                className="text-brown hover:text-brown-dark"
                                title="Copy to clipboard"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                                    <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                                </svg>
                            </button>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-lg">
                            <pre className="text-xs text-gray-700 overflow-auto whitespace-pre-wrap h-64">
                                {parsedData.rawText}
                            </pre>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}