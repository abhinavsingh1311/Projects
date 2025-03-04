'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/server/utils/supabase-client';
import { AlertTriangle, CheckCircle, Info, Edit, Download, Clipboard } from 'lucide-react';

export default function ResumeImprovementSuggestions({ resumeId }) {
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [suggestions, setSuggestions] = useState(null);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('content');
    const [copiedItem, setCopiedItem] = useState(null);

    useEffect(() => {
        if (!resumeId) return;
        fetchSuggestions();
    }, [resumeId]);

    const fetchSuggestions = async () => {
        try {
            setLoading(true);

            // First check if we have existing suggestions
            const { data: existingSuggestions, error: fetchError } = await supabase
                .from('resume_improvement_suggestions')
                .select('*')
                .eq('resume_id', resumeId)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

            if (existingSuggestions) {
                setSuggestions(existingSuggestions.suggestions);
            } else {
                // If no existing suggestions, generate them
                await generateSuggestions();
            }
        } catch (error) {
            console.error('Error fetching suggestions:', error);
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    const generateSuggestions = async () => {
        try {
            setGenerating(true);

            const response = await fetch(`/api/resumes/${resumeId}/improvement-suggestions`, {
                method: 'POST',
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to generate suggestions');
            }

            const data = await response.json();

            if (data.success && data.suggestions) {
                setSuggestions(data.suggestions);
            } else {
                throw new Error(data.error || 'No suggestions generated');
            }
        } catch (error) {
            console.error('Error generating suggestions:', error);
            setError(error.message);
        } finally {
            setGenerating(false);
        }
    };

    const handleCopyText = (text, id) => {
        navigator.clipboard.writeText(text).then(() => {
            setCopiedItem(id);
            setTimeout(() => setCopiedItem(null), 2000);
        });
    };

    if (loading) {
        return (
            <div className="bg-white rounded-lg shadow-sm border border-brown-light overflow-hidden p-6">
                <div className="flex justify-center items-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-brown"></div>
                </div>
            </div>
        );
    }

    if (generating) {
        return (
            <div className="bg-white rounded-lg shadow-sm border border-brown-light overflow-hidden p-6">
                <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-brown mx-auto mb-4"></div>
                    <h3 className="text-lg font-medium text-gray-800 mb-2">Generating Suggestions</h3>
                    <p className="text-gray-600">
                        Our AI is analyzing your resume to generate personalized improvement suggestions. This may take a moment...
                    </p>
                </div>
            </div>
        );
    }

    if (error && !suggestions) {
        return (
            <div className="bg-white rounded-lg shadow-sm border border-brown-light overflow-hidden p-6">
                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
                    <div className="flex">
                        <div className="flex-shrink-0">
                            <AlertTriangle className="h-5 w-5 text-red-500" />
                        </div>
                        <div className="ml-3">
                            <h3 className="text-sm font-medium text-red-800">Error generating suggestions</h3>
                            <div className="mt-2 text-sm text-red-700">
                                <p>{error}</p>
                            </div>
                            <div className="mt-4">
                                <button
                                    onClick={generateSuggestions}
                                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                                >
                                    Try Again
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (!suggestions) {
        return (
            <div className="bg-white rounded-lg shadow-sm border border-brown-light overflow-hidden p-6">
                <div className="text-center py-8">
                    <Info className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-800 mb-2">No Suggestions Available</h3>
                    <p className="text-gray-600 mb-4">
                        We haven't generated improvement suggestions for this resume yet.
                    </p>
                    <button
                        onClick={generateSuggestions}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-brown hover:bg-brown-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brown"
                    >
                        Generate Suggestions
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg shadow-sm border border-brown-light overflow-hidden">
            <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-medium text-gray-800">Resume Improvement Suggestions</h2>
                    <button
                        onClick={generateSuggestions}
                        className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-brown hover:bg-brown-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brown"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Regenerate
                    </button>
                </div>

                {/* Info callout */}
                <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg mb-6">
                    <div className="flex">
                        <div className="flex-shrink-0">
                            <Info className="h-5 w-5 text-blue-500" />
                        </div>
                        <div className="ml-3">
                            <p className="text-sm text-blue-700">
                                These AI-generated suggestions can help improve your resume. Click any suggestion to copy it to your clipboard.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Suggestion Tabs */}
                <div className="border-b border-gray-200 mb-6">
                    <nav className="flex -mb-px space-x-8">
                        <button
                            onClick={() => setActiveTab('content')}
                            className={`py-4 px-1 text-sm font-medium ${activeTab === 'content'
                                    ? 'border-b-2 border-brown text-brown'
                                    : 'border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            Content
                        </button>
                        <button
                            onClick={() => setActiveTab('formatting')}
                            className={`py-4 px-1 text-sm font-medium ${activeTab === 'formatting'
                                    ? 'border-b-2 border-brown text-brown'
                                    : 'border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            Formatting
                        </button>
                        <button
                            onClick={() => setActiveTab('ats')}
                            className={`py-4 px-1 text-sm font-medium ${activeTab === 'ats'
                                    ? 'border-b-2 border-brown text-brown'
                                    : 'border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            ATS Optimization
                        </button>
                        <button
                            onClick={() => setActiveTab('skills')}
                            className={`py-4 px-1 text-sm font-medium ${activeTab === 'skills'
                                    ? 'border-b-2 border-brown text-brown'
                                    : 'border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            Skills
                        </button>
                    </nav>
                </div>

                {/* Content Suggestions */}
                {activeTab === 'content' && (
                    <div>
                        <h3 className="text-md font-medium text-gray-800 mb-3">Content Improvements</h3>

                        {suggestions.content && suggestions.content.length > 0 ? (
                            <ul className="space-y-3">
                                {suggestions.content.map((suggestion, index) => (
                                    <li
                                        key={`content-${index}`}
                                        className="bg-white border rounded-lg p-3 hover:bg-gray-50 cursor-pointer transition"
                                        onClick={() => handleCopyText(suggestion, `content-${index}`)}
                                    >
                                        <div className="flex items-start">
                                            <div className="flex-shrink-0 pt-0.5">
                                                <CheckCircle className="h-5 w-5 text-green-500" />
                                            </div>
                                            <div className="ml-3 flex-1">
                                                <p className="text-sm text-gray-700">{suggestion}</p>
                                                {copiedItem === `content-${index}` && (
                                                    <span className="text-xs text-green-600 mt-1 inline-block">Copied to clipboard!</span>
                                                )}
                                            </div>
                                            <div className="ml-2">
                                                <Clipboard className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-gray-500 italic">No content suggestions available.</p>
                        )}

                        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                            <h4 className="text-sm font-medium text-yellow-800 mb-2">Tips for Better Content</h4>
                            <ul className="text-sm text-yellow-700 space-y-1 list-disc list-inside">
                                <li>Use action verbs to start bullet points (achieved, improved, led)</li>
                                <li>Quantify achievements with specific numbers or percentages</li>
                                <li>Focus on results and impact, not just responsibilities</li>
                                <li>Tailor content to match the specific job you're applying for</li>
                            </ul>
                        </div>
                    </div>
                )}

                {/* Formatting Suggestions */}
                {activeTab === 'formatting' && (
                    <div>
                        <h3 className="text-md font-medium text-gray-800 mb-3">Formatting Improvements</h3>

                        {suggestions.formatting && suggestions.formatting.length > 0 ? (
                            <ul className="space-y-3">
                                {suggestions.formatting.map((suggestion, index) => (
                                    <li
                                        key={`formatting-${index}`}
                                        className="bg-white border rounded-lg p-3 hover:bg-gray-50 cursor-pointer transition"
                                        onClick={() => handleCopyText(suggestion, `formatting-${index}`)}
                                    >
                                        <div className="flex items-start">
                                            <div className="flex-shrink-0 pt-0.5">
                                                <CheckCircle className="h-5 w-5 text-blue-500" />
                                            </div>
                                            <div className="ml-3 flex-1">
                                                <p className="text-sm text-gray-700">{suggestion}</p>
                                                {copiedItem === `formatting-${index}` && (
                                                    <span className="text-xs text-green-600 mt-1 inline-block">Copied to clipboard!</span>
                                                )}
                                            </div>
                                            <div className="ml-2">
                                                <Clipboard className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-gray-500 italic">No formatting suggestions available.</p>
                        )}

                        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <h4 className="text-sm font-medium text-blue-800 mb-2">Formatting Best Practices</h4>
                            <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
                                <li>Use a clean, professional template with consistent spacing</li>
                                <li>Ensure margins are between 0.5-1 inch on all sides</li>
                                <li>Use standard fonts (Arial, Calibri, Times New Roman) at 10-12pt size</li>
                                <li>Keep your resume to 1-2 pages maximum</li>
                                <li>Use bold for section headings and job titles for better readability</li>
                            </ul>
                        </div>
                    </div>
                )}

                {/* ATS Suggestions */}
                {activeTab === 'ats' && (
                    <div>
                        <h3 className="text-md font-medium text-gray-800 mb-3">ATS Optimization</h3>

                        {suggestions.ats && suggestions.ats.length > 0 ? (
                            <ul className="space-y-3">
                                {suggestions.ats.map((suggestion, index) => (
                                    <li
                                        key={`ats-${index}`}
                                        className="bg-white border rounded-lg p-3 hover:bg-gray-50 cursor-pointer transition"
                                        onClick={() => handleCopyText(suggestion, `ats-${index}`)}
                                    >
                                        <div className="flex items-start">
                                            <div className="flex-shrink-0 pt-0.5">
                                                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                                            </div>
                                            <div className="ml-3 flex-1">
                                                <p className="text-sm text-gray-700">{suggestion}</p>
                                                {copiedItem === `ats-${index}` && (
                                                    <span className="text-xs text-green-600 mt-1 inline-block">Copied to clipboard!</span>
                                                )}
                                            </div>
                                            <div className="ml-2">
                                                <Clipboard className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-gray-500 italic">No ATS optimization suggestions available.</p>
                        )}

                        <div className="mt-6 bg-purple-50 border border-purple-200 rounded-lg p-4">
                            <h4 className="text-sm font-medium text-purple-800 mb-2">ATS Tips</h4>
                            <ul className="text-sm text-purple-700 space-y-1 list-disc list-inside">
                                <li>Use standard section headers (Experience, Education, Skills)</li>
                                <li>Include keywords from the job description</li>
                                <li>Avoid tables, headers/footers, text boxes, and images</li>
                                <li>Use a simple chronological or hybrid format</li>
                                <li>Save as a .docx or .pdf file (check job requirements)</li>
                                <li>Use standard job titles that ATS systems recognize</li>
                            </ul>
                        </div>
                    </div>
                )}

                {/* Skills Suggestions */}
                {activeTab === 'skills' && (
                    <div>
                        <h3 className="text-md font-medium text-gray-800 mb-3">Skills Enhancements</h3>

                        {suggestions.skills && suggestions.skills.length > 0 ? (
                            <ul className="space-y-3">
                                {suggestions.skills.map((suggestion, index) => (
                                    <li
                                        key={`skills-${index}`}
                                        className="bg-white border rounded-lg p-3 hover:bg-gray-50 cursor-pointer transition"
                                        onClick={() => handleCopyText(suggestion, `skills-${index}`)}
                                    >
                                        <div className="flex items-start">
                                            <div className="flex-shrink-0 pt-0.5">
                                                <Info className="h-5 w-5 text-purple-500" />
                                            </div>
                                            <div className="ml-3 flex-1">
                                                <p className="text-sm text-gray-700">{suggestion}</p>
                                                {copiedItem === `skills-${index}` && (
                                                    <span className="text-xs text-green-600 mt-1 inline-block">Copied to clipboard!</span>
                                                )}
                                            </div>
                                            <div className="ml-2">
                                                <Clipboard className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-gray-500 italic">No skills suggestions available.</p>
                        )}

                        {suggestions.targetJobs && suggestions.targetJobs.length > 0 && (
                            <div className="mt-6">
                                <h4 className="text-sm font-medium text-gray-700 mb-3">Target Job Matches</h4>
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <p className="text-sm text-gray-600 mb-3">
                                        These suggestions are based on the following job matches:
                                    </p>
                                    <ul className="space-y-3">
                                        {suggestions.targetJobs.map((job, index) => (
                                            <li key={index} className="text-sm">
                                                <span className="font-medium">{job.title}</span> at {job.company}
                                                {job.missingSkills && job.missingSkills.length > 0 && (
                                                    <div className="mt-1">
                                                        <span className="text-xs text-gray-500">Missing skills: </span>
                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                            {job.missingSkills.map((skill, i) => (
                                                                <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                                                                    {skill}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        )}

                        <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
                            <h4 className="text-sm font-medium text-green-800 mb-2">Skills Best Practices</h4>
                            <ul className="text-sm text-green-700 space-y-1 list-disc list-inside">
                                <li>Include a dedicated skills section on your resume</li>
                                <li>Group skills by category (technical, soft, tools)</li>
                                <li>Match skills to the job description keywords</li>
                                <li>Demonstrate skills through achievements in your experience</li>
                                <li>Keep skills relevant to the position you're applying for</li>
                            </ul>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}