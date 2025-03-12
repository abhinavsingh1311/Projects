// src/app/resume/[id]/analysis/page.js
'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ResumeAnalysisPage() {
    const params = useParams();
    const router = useRouter();
    const { id } = params;

    const [loading, setLoading] = useState(true);
    const [analysis, setAnalysis] = useState(null);
    const [resume, setResume] = useState(null);
    const [error, setError] = useState(null);
    const [analyzing, setAnalyzing] = useState(false);

    useEffect(() => {
        if (!id) return;

        const fetchAnalysis = async () => {
            try {
                setLoading(true);

                // Fetch analysis
                const response = await fetch(`/api/resumes/${id}/analysis`);

                if (response.ok) {
                    const data = await response.json();
                    setAnalysis(data.analysis);
                    setResume({
                        id: data.resumeId,
                        title: data.resumeTitle,
                        status: data.resumeStatus
                    });
                } else {
                    const errorData = await response.json();

                    // If analysis not found but resume exists
                    if (response.status === 404 && errorData.resumeStatus) {
                        setResume({
                            id,
                            status: errorData.resumeStatus
                        });

                        // If resume is parsed but not analyzed, we can offer to analyze
                        if (['parsed', 'uploaded'].includes(errorData.resumeStatus)) {
                            setError('This resume has not been analyzed yet.');
                        } else if (errorData.resumeStatus === 'analyzing') {
                            setError('Analysis is in progress. Please check back in a moment.');

                            // Poll for status updates
                            const intervalId = setInterval(async () => {
                                const statusResponse = await fetch(`/api/resumes/${id}/status`);
                                if (statusResponse.ok) {
                                    const statusData = await statusResponse.json();

                                    if (statusData.status === 'analyzed') {
                                        clearInterval(intervalId);
                                        window.location.reload();
                                    } else if (statusData.status === 'analysis_failed') {
                                        clearInterval(intervalId);
                                        setError(`Analysis failed: ${statusData.error || 'Unknown error'}`);
                                    }
                                }
                            }, 5000);

                            return () => clearInterval(intervalId);
                        } else {
                            setError(`Resume is in ${errorData.resumeStatus} state. It needs to be parsed before analysis.`);
                        }
                    } else {
                        throw new Error(errorData.error || 'Failed to fetch analysis');
                    }
                }
            } catch (error) {
                console.error('Error fetching analysis:', error);
                setError(error.message);
            } finally {
                setLoading(false);
            }
        };

        fetchAnalysis();
    }, [id]);

    const handleAnalyzeResume = async () => {
        try {
            setAnalyzing(true);
            setError(null);

            const response = await fetch(`/api/resumes/${id}/analyze`, {
                method: 'POST',
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to start analysis');
            }

            // Show analyzing message
            setError('Analysis started. This may take a minute or two. The page will refresh when the analysis is complete.');

            // Poll for status updates
            const intervalId = setInterval(async () => {
                const statusResponse = await fetch(`/api/resumes/${id}/status`);
                if (statusResponse.ok) {
                    const statusData = await statusResponse.json();

                    if (statusData.status === 'analyzed') {
                        clearInterval(intervalId);
                        window.location.reload();
                    } else if (statusData.status === 'analysis_failed') {
                        clearInterval(intervalId);
                        setError(`Analysis failed: ${statusData.error || 'Unknown error'}`);
                        setAnalyzing(false);
                    }
                }
            }, 5000);

            return () => clearInterval(intervalId);

        } catch (error) {
            console.error('Error analyzing resume:', error);
            setError(error.message);
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

    if (error && !analysis) {
        return (
            <div className="container mx-auto p-6">
                <div className="bg-white rounded-lg shadow-sm border border-brown-light overflow-hidden">
                    <div className="p-6">
                        <h1 className="text-2xl font-bold text-gray-900 mb-4">Resume Analysis</h1>
                        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg mb-6">
                            <p className="text-yellow-700">{error}</p>
                        </div>

                        {resume && ['parsed', 'uploaded'].includes(resume.status) && (
                            <button
                                onClick={handleAnalyzeResume}
                                disabled={analyzing}
                                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-brown hover:bg-brown-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brown"
                            >
                                {analyzing ? 'Analyzing...' : 'Analyze Resume'}
                            </button>
                        )}

                        <Link href={`/resume/${id}`} className="mt-4 inline-block text-brown hover:underline">
                            Back to Resume
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    if (!analysis) {
        return (
            <div className="container mx-auto p-6">
                <div className="bg-white rounded-lg shadow-sm border border-brown-light overflow-hidden">
                    <div className="p-6">
                        <h1 className="text-2xl font-bold text-gray-900 mb-4">Resume Analysis</h1>
                        <p className="text-gray-600 mb-4">No analysis data available for this resume.</p>
                        <Link href={`/resume/${id}`} className="text-brown hover:underline">
                            Back to Resume
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6">
            <div className="bg-white rounded-lg shadow-sm border border-brown-light overflow-hidden mb-6">
                <div className="p-6">
                    <h1 className="text-2xl font-bold text-gray-900 mb-4">
                        Analysis: {resume?.title || 'Resume'}
                    </h1>

                    {/* Overall Score Card */}
                    <div className="mb-8 bg-gradient-to-r from-brown-light to-brown p-6 rounded-lg text-white">
                        <div className="flex justify-between items-center">
                            <div>
                                <h2 className="text-lg font-semibold">Overall Score</h2>
                                <p className="text-sm opacity-80">Based on content, format, and effectiveness</p>
                            </div>
                            <div className="text-5xl font-bold">{analysis.overall_score}/100</div>
                        </div>

                        {/* Progress Bar */}
                        <div className="mt-4">
                            <div className="w-full bg-white/20 rounded-full h-2.5">
                                <div
                                    className="h-2.5 rounded-full bg-white"
                                    style={{ width: `${analysis.overall_score}%` }}
                                ></div>
                            </div>
                        </div>
                    </div>

                    {/* Skills */}
                    <div className="mb-8">
                        <h2 className="text-xl font-semibold text-gray-800 mb-4">Skills</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Technical Skills */}
                            <div className="bg-blue-50 p-4 rounded-lg">
                                <h3 className="font-medium text-blue-800 mb-2">Technical Skills</h3>
                                <div className="flex flex-wrap gap-2">
                                    {analysis.skills?.technical?.map((skill, index) => (
                                        <span key={index} className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm">
                                            {skill}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* Soft Skills */}
                            <div className="bg-green-50 p-4 rounded-lg">
                                <h3 className="font-medium text-green-800 mb-2">Soft Skills</h3>
                                <div className="flex flex-wrap gap-2">
                                    {analysis.skills?.soft?.map((skill, index) => (
                                        <span key={index} className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-sm">
                                            {skill}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* Tools & Technologies */}
                            <div className="bg-purple-50 p-4 rounded-lg">
                                <h3 className="font-medium text-purple-800 mb-2">Tools & Technologies</h3>
                                <div className="flex flex-wrap gap-2">
                                    {analysis.skills?.tools?.map((skill, index) => (
                                        <span key={index} className="bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-sm">
                                            {skill}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Strengths and Improvements */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                        {/* Strengths */}
                        <div className="bg-green-50 p-6 rounded-lg">
                            <h3 className="text-lg font-medium text-green-800 mb-4">Strengths</h3>
                            <ul className="space-y-2">
                                {analysis.strengths?.map((strength, index) => (
                                    <li key={index} className="flex items-start">
                                        <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-green-100 text-green-500 mr-2 mt-0.5">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                        </span>
                                        <span>{strength}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Improvement Areas */}
                        <div className="bg-yellow-50 p-6 rounded-lg">
                            <h3 className="text-lg font-medium text-yellow-800 mb-4">Areas for Improvement</h3>
                            <ul className="space-y-2">
                                {analysis.improvement_areas?.map((area, index) => (
                                    <li key={index} className="flex items-start">
                                        <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-yellow-100 text-yellow-500 mr-2 mt-0.5">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                            </svg>
                                        </span>
                                        <span>{area}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* Experience and Education */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                        {/* Experience Summary */}
                        <div className="bg-gray-50 p-6 rounded-lg">
                            <h3 className="text-lg font-medium text-gray-800 mb-3">Experience Summary</h3>
                            <p className="text-gray-700">{analysis.experience_summary}</p>
                        </div>

                        {/* Education Summary */}
                        <div className="bg-gray-50 p-6 rounded-lg">
                            <h3 className="text-lg font-medium text-gray-800 mb-3">Education Summary</h3>
                            <p className="text-gray-700">{analysis.education_summary}</p>
                        </div>
                    </div>

                    {/* ATS Compatibility */}
                    <div className="mb-8">
                        <h2 className="text-xl font-semibold text-gray-800 mb-4">ATS Compatibility</h2>
                        <div className="bg-white border border-gray-200 rounded-lg p-6">
                            <div className="flex justify-between items-center mb-4">
                                <div>
                                    <h3 className="text-lg font-medium text-gray-800">ATS Score</h3>
                                    <p className="text-sm text-gray-500">How well your resume works with Applicant Tracking Systems</p>
                                </div>
                                <div className="text-2xl font-bold text-brown">{analysis.ats_compatibility?.score}/100</div>
                            </div>

                            <div className="w-full bg-gray-200 rounded-full h-2.5 mb-6">
                                <div
                                    className={`h-2.5 rounded-full ${
                                        analysis.ats_compatibility?.score >= 80 ? 'bg-green-500' :
                                            analysis.ats_compatibility?.score >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                                    }`}
                                    style={{ width: `${analysis.ats_compatibility?.score}%` }}
                                ></div>
                            </div>

                            {analysis.ats_compatibility?.issues?.length > 0 && (
                                <div className="mb-4">
                                    <h4 className="text-md font-medium text-gray-800 mb-2">Issues</h4>
                                    <ul className="list-disc pl-5 space-y-1">
                                        {analysis.ats_compatibility.issues.map((issue, index) => (
                                            <li key={index} className="text-gray-700">{issue}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {analysis.ats_compatibility?.recommendations?.length > 0 && (
                                <div>
                                    <h4 className="text-md font-medium text-gray-800 mb-2">Recommendations</h4>
                                    <ul className="list-disc pl-5 space-y-1">
                                        {analysis.ats_compatibility.recommendations.map((rec, index) => (
                                            <li key={index} className="text-gray-700">{rec}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Keywords */}
                    {analysis.keywords?.length > 0 && (
                        <div className="mb-8">
                            <h2 className="text-xl font-semibold text-gray-800 mb-4">Key Terms in Your Resume</h2>
                            <div className="bg-gray-50 p-6 rounded-lg">
                                <div className="flex flex-wrap gap-2">
                                    {analysis.keywords.map((keyword, index) => (
                                        <span key={index} className="bg-brown-light/20 text-brown-dark px-3 py-1 rounded-full text-sm">
                                            {keyword}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="mt-6 flex gap-4">
                        <Link
                            href={`/resume/${id}`}
                            className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
                        >
                            Back to Resume
                        </Link>

                        <button
                            onClick={handleAnalyzeResume}
                            disabled={analyzing}
                            className="px-4 py-2 bg-brown text-white rounded hover:bg-brown-dark disabled:opacity-50"
                        >
                            {analyzing ? 'Analyzing...' : 'Re-analyze Resume'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}