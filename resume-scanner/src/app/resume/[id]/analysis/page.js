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

            // src/app/resume/[id]/analysis/page.js (continued)
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
                <div className="mb-6">
                    <Link href={`/resume/${id}`} className="text-brown hover:underline flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                        </svg>
                        Back to Resume
                    </Link>
                </div>

                <div className="bg-white shadow-sm rounded-lg overflow-hidden border border-gray-200 mb-6">
                    <div className="p-6">
                        <h1 className="text-2xl font-bold text-gray-900 mb-4">Resume Analysis</h1>

                        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
                            <div className="flex">
                                <div className="flex-shrink-0">
                                    <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <div className="ml-3">
                                    <h3 className="text-sm font-medium text-yellow-800">Analysis not available</h3>
                                    <div className="mt-2 text-sm text-yellow-700">
                                        <p>{error}</p>
                                    </div>
                                    {resume && ['parsed', 'uploaded'].includes(resume.status) && (
                                        <div className="mt-4">
                                            <button
                                                onClick={handleAnalyzeResume}
                                                disabled={analyzing}
                                                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-brown hover:bg-brown-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brown disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {analyzing ? (
                                                    <>
                                                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                        </svg>
                                                        Analyzing...
                                                    </>
                                                ) : (
                                                    'Analyze Resume'
                                                )}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6">
            <div className="mb-6">
                <Link href={`/resume/${id}`} className="text-brown hover:underline flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                    </svg>
                    Back to Resume
                </Link>
            </div>

            <div className="bg-white shadow-sm rounded-lg overflow-hidden border border-gray-200 mb-6">
                <div className="p-6">
                    <h1 className="text-2xl font-bold text-gray-900 mb-4">
                        {resume?.title ? `Analysis: ${resume.title}` : 'Resume Analysis'}
                    </h1>

                    {/* Overall Score Card */}
                    <div className="mb-8">
                        <div className="bg-gradient-to-r from-brown-light to-brown p-6 rounded-lg text-white shadow-md">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h2 className="text-lg font-semibold">Overall Score</h2>
                                    <p className="text-sm opacity-80">Based on content, format, and effectiveness</p>
                                </div>
                                <div className="text-5xl font-bold">{analysis.overallScore}/100</div>
                            </div>

                            {/* Progress Bar */}
                            <div className="mt-4">
                                <div className="w-full bg-white/20 rounded-full h-2.5">
                                    <div
                                        className="h-2.5 rounded-full bg-white"
                                        style={{ width: `${analysis.overallScore}%` }}
                                    ></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Skills Analysis */}
                    <div className="mb-8">
                        <h2 className="text-xl font-semibold text-gray-800 mb-4">Skills Analysis</h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Technical Skills */}
                            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                <h3 className="text-lg font-medium text-gray-800 mb-3">Technical Skills</h3>
                                {analysis.skills.technical && analysis.skills.technical.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                        {analysis.skills.technical.map((skill, index) => (
                                            <span key={index} className="bg-brown-light/20 text-brown-dark px-3 py-1 rounded-full text-sm">
                                                {skill}
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-gray-500 italic">No technical skills were identified.</p>
                                )}
                            </div>

                            {/* Soft Skills */}
                            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                <h3 className="text-lg font-medium text-gray-800 mb-3">Soft Skills</h3>
                                {analysis.skills.soft && analysis.skills.soft.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                        {analysis.skills.soft.map((skill, index) => (
                                            <span key={index} className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm">
                                                {skill}
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-gray-500 italic">No soft skills were identified.</p>
                                )}
                            </div>

                            {/* Missing Skills */}
                            {analysis.skills.missing && analysis.skills.missing.length > 0 && (
                                <div className="md:col-span-2 bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                                    <h3 className="text-lg font-medium text-yellow-800 mb-3">Missing Skills</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {analysis.skills.missing.map((skill, index) => (
                                            <span key={index} className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm">
                                                {skill}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Experience and Education */}
                    <div className="mb-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Experience Summary */}
                            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                <h3 className="text-lg font-medium text-gray-800 mb-3">Experience Summary</h3>
                                <p className="text-gray-700">{analysis.experienceSummary}</p>
                            </div>

                            {/* Education Summary */}
                            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                <h3 className="text-lg font-medium text-gray-800 mb-3">Education Summary</h3>
                                <p className="text-gray-700">{analysis.educationSummary}</p>
                            </div>
                        </div>
                    </div>

                    {/* Strengths and Improvements */}
                    <div className="mb-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Strengths */}
                            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                                <h3 className="text-lg font-medium text-green-800 mb-3">Strengths</h3>
                                {analysis.strengths && analysis.strengths.length > 0 ? (
                                    <ul className="list-disc pl-5 space-y-2">
                                        {analysis.strengths.map((strength, index) => (
                                            <li key={index} className="text-gray-700">{strength}</li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-gray-500 italic">No specific strengths were identified.</p>
                                )}
                            </div>

                            {/* Suggested Improvements */}
                            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                                <h3 className="text-lg font-medium text-yellow-800 mb-3">Suggested Improvements</h3>
                                {analysis.improvements && analysis.improvements.length > 0 ? (
                                    <ul className="list-disc pl-5 space-y-2">
                                        {analysis.improvements.map((improvement, index) => (
                                            <li key={index} className="text-gray-700">{improvement}</li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-gray-500 italic">No specific improvements were suggested.</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ATS Compatibility */}
                    <div className="mb-8">
                        <h2 className="text-xl font-semibold text-gray-800 mb-4">ATS Compatibility</h2>

                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-medium text-gray-800">ATS Score</h3>
                                <div className="text-2xl font-bold text-brown">{analysis.atsCompatibility.score}/100</div>
                            </div>

                            {/* ATS Progress Bar */}
                            <div className="w-full bg-gray-200 rounded-full h-2.5 mb-6">
                                <div
                                    className={`h-2.5 rounded-full ${analysis.atsCompatibility.score >= 80 ? 'bg-green-600' :
                                            analysis.atsCompatibility.score >= 60 ? 'bg-yellow-500' :
                                                'bg-red-500'
                                        }`}
                                    style={{ width: `${analysis.atsCompatibility.score}%` }}
                                ></div>
                            </div>

                            {/* ATS Issues */}
                            {analysis.atsCompatibility.issues && analysis.atsCompatibility.issues.length > 0 && (
                                <div className="mb-4">
                                    <h4 className="text-md font-medium text-gray-800 mb-2">Issues</h4>
                                    <ul className="list-disc pl-5 space-y-1">
                                        {analysis.atsCompatibility.issues.map((issue, index) => (
                                            <li key={index} className="text-gray-700">{issue}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* ATS Recommendations */}
                            {analysis.atsCompatibility.recommendations && analysis.atsCompatibility.recommendations.length > 0 && (
                                <div>
                                    <h4 className="text-md font-medium text-gray-800 mb-2">Recommendations</h4>
                                    <ul className="list-disc pl-5 space-y-1">
                                        {analysis.atsCompatibility.recommendations.map((recommendation, index) => (
                                            <li key={index} className="text-gray-700">{recommendation}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Keyword Recommendations */}
                    {analysis.keywordRecommendations && analysis.keywordRecommendations.length > 0 && (
                        <div className="mb-8">
                            <h2 className="text-xl font-semibold text-gray-800 mb-4">Recommended Keywords</h2>
                            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                <p className="mb-3 text-gray-700">Consider adding these keywords to improve your resume's relevance:</p>
                                <div className="flex flex-wrap gap-2">
                                    {analysis.keywordRecommendations.map((keyword, index) => (
                                        <span key={index} className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
                                            {keyword}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="mt-8">
                        <div className="flex flex-wrap gap-4">
                            <button
                                onClick={handleAnalyzeResume}
                                disabled={analyzing}
                                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-brown hover:bg-brown-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brown disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {analyzing ? (
                                    <>
                                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Analyzing...
                                    </>
                                ) : (
                                    'Re-analyze Resume'
                                )}
                            </button>

                            <Link
                                href={`/resume/${id}`}
                                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                                View Resume
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}