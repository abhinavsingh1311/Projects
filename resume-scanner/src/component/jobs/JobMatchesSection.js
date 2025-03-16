'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/server/utils/supabase-client';
import Link from 'next/link';
import { Briefcase, ChevronRight, ExternalLink, Check, AlertTriangle } from 'lucide-react';

export default function JobMatchesSection() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [jobMatches, setJobMatches] = useState([]);
    const [resumeInfo, setResumeInfo] = useState(null);
    const [stats, setStats] = useState({ totalMatches: 0, averageScore: 0, topMatchScore: 0 });
    const [processingMatch, setProcessingMatch] = useState(false);

    // Initial load of job matches
    useEffect(() => {
        fetchJobMatches();
    }, []);

    // Fetch job matches using the existing API
    const fetchJobMatches = async () => {
        try {
            setLoading(true);
            setError(null);

            // Get the current session token
            const { data: { session } } = await supabase.auth.getSession();

            if (!session) {
                // Not authenticated, set empty state
                setLoading(false);
                return;
            }

            // Call your existing job matching API
            const response = await fetch('/api/job-matches', {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                }
            });

            // If the API returns a 404 or message about no matches, set empty state
            if (!response.ok) {
                const errorData = await response.json();
                if (response.status === 404 || errorData.message?.includes('No analyzed resumes')) {
                    setJobMatches([]);
                    setStats({ totalMatches: 0, averageScore: 0, topMatchScore: 0 });
                    setLoading(false);
                    return;
                }
                throw new Error(errorData.error || 'Failed to fetch job matches');
            }

            const data = await response.json();

            setJobMatches(data.matches || []);
            setResumeInfo({
                id: data.resumeId,
                title: data.resumeTitle
            });
            setStats(data.stats || { totalMatches: 0, averageScore: 0, topMatchScore: 0 });
        } catch (error) {
            console.error('Error fetching job matches:', error);
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    // Function to manually trigger job matching
    const handleTriggerMatching = async () => {
        if (!resumeInfo || !resumeInfo.id || processingMatch) return;

        try {
            setProcessingMatch(true);
            setError(null);

            // Get the current session token
            const { data: { session } } = await supabase.auth.getSession();

            if (!session) {
                throw new Error('You must be signed in to match jobs');
            }

            // Call the API to find job matches
            const response = await fetch(`/api/resumes/${resumeInfo.id}/find-matches`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ force: true })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to find job matches');
            }

            // Refresh the matches
            await fetchJobMatches();

        } catch (error) {
            console.error('Error triggering job matching:', error);
            setError(error.message);
        } finally {
            setProcessingMatch(false);
        }
    };

    // Format salary range
    const formatSalary = (min, max) => {
        if (!min && !max) return 'Salary not specified';
        if (min && !max) return `$${min.toLocaleString()}+`;
        if (!min && max) return `Up to $${max.toLocaleString()}`;
        return `$${min.toLocaleString()} - $${max.toLocaleString()}`;
    };

    // Not authenticated or still loading
    if (!resumeInfo && !loading && !error) {
        return null;
    }

    // Loading state
    if (loading) {
        return (
            <div className="bg-white rounded-lg shadow-sm border border-brown-light p-6 mb-8">
                <h3 className="text-lg font-semibold text-brown mb-4">Job Matches</h3>
                <div className="flex justify-center items-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-brown"></div>
                </div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="bg-white rounded-lg shadow-sm border border-brown-light p-6 mb-8">
                <h3 className="text-lg font-semibold text-brown mb-4">Job Matches</h3>
                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
                    <div className="flex">
                        <div className="flex-shrink-0">
                            <AlertTriangle className="h-5 w-5 text-red-500" />
                        </div>
                        <div className="ml-3">
                            <p className="text-sm text-red-700">
                                {error || 'Failed to load job matches. Please try again later.'}
                            </p>
                        </div>
                    </div>
                </div>

                <button
                    onClick={fetchJobMatches}
                    className="mt-4 px-4 py-2 bg-brown text-white rounded-md hover:bg-brown-dark"
                >
                    Try Again
                </button>
            </div>
        );
    }

    // No matches state
    if (jobMatches.length === 0) {
        return (
            <div className="bg-white rounded-lg shadow-sm border border-brown-light p-6 mb-8">
                <h3 className="text-lg font-semibold text-brown mb-4">Job Matches</h3>
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg">
                    <div className="flex">
                        <div className="flex-shrink-0">
                            <Briefcase className="h-5 w-5 text-yellow-600" />
                        </div>
                        <div className="ml-3">
                            <p className="text-sm text-yellow-700">
                                No job matches found for your resume. Upload a resume with skills to get matched with jobs.
                            </p>

                            {resumeInfo && (
                                <div className="mt-3">
                                    <button
                                        onClick={handleTriggerMatching}
                                        disabled={processingMatch}
                                        className="inline-flex items-center text-sm font-medium text-brown hover:text-brown-dark"
                                    >
                                        {processingMatch ? (
                                            <>
                                                <div className="animate-spin h-4 w-4 mr-2 border-t-2 border-b-2 border-brown rounded-full"></div>
                                                Finding matches...
                                            </>
                                        ) : (
                                            <>
                                                Find matches <ChevronRight className="ml-1 h-4 w-4" />
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}

                            {!resumeInfo && (
                                <div className="mt-3">
                                    <Link
                                        href="/upload"
                                        className="inline-flex items-center text-sm font-medium text-brown hover:text-brown-dark"
                                    >
                                        Upload Resume <ChevronRight className="ml-1 h-4 w-4" />
                                    </Link>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Show matches
    return (
        <div className="bg-white rounded-lg shadow-sm border border-brown-light p-6 mb-8">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-brown">Job Matches</h3>
                <div className="flex items-center text-sm text-gray-600">
                    <span>Based on: </span>
                    <span className="ml-1 font-medium text-brown truncate max-w-[200px]" title={resumeInfo.title}>
                        {resumeInfo.title}
                    </span>
                </div>
            </div>

            {/* Stats cards */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-cream-light p-4 rounded-lg">
                    <div className="text-sm text-brown-light mb-1">Total Matches</div>
                    <div className="text-2xl font-bold text-brown">{stats.totalMatches}</div>
                </div>
                <div className="bg-cream-light p-4 rounded-lg">
                    <div className="text-sm text-brown-light mb-1">Average Match</div>
                    <div className="text-2xl font-bold text-brown">{stats.averageScore}%</div>
                </div>
                <div className="bg-cream-light p-4 rounded-lg">
                    <div className="text-sm text-brown-light mb-1">Top Match</div>
                    <div className="text-2xl font-bold text-brown">{stats.topMatchScore}%</div>
                </div>
            </div>

            {/* Job matches list */}
            <div className="space-y-4">
                {jobMatches.map(match => (
                    <div key={match.id} className="border border-brown-light rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex justify-between">
                            <div>
                                <h4 className="font-medium text-lg text-brown">{match.title}</h4>
                                <p className="text-brown-light">{match.company}</p>
                            </div>
                            <div className="text-right">
                                <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                                    match.score >= 80 ? 'bg-green-100 text-green-800' :
                                        match.score >= 60 ? 'bg-yellow-100 text-yellow-800' :
                                            'bg-red-100 text-red-800'
                                }`}>
                                    {Math.round(match.score)}% Match
                                </div>
                                <p className="text-sm text-gray-500 mt-1">
                                    {formatSalary(match.salaryMin, match.salaryMax)}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center text-sm text-gray-500 mt-2">
                            <div className="flex items-center mr-4">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                {match.location}
                            </div>
                            <div className="flex items-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                                {match.jobType}
                            </div>
                        </div>

                        {/* Skills match section */}
                        {match.matchingSkills && match.matchingSkills.length > 0 && (
                            <div className="mt-3">
                                <div className="flex items-center text-sm font-medium text-green-700 mb-1">
                                    <Check className="h-4 w-4 mr-1" />
                                    <span>Matching Skills</span>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                    {match.matchingSkills.slice(0, 5).map((skill, idx) => (
                                        <span key={idx} className="bg-green-50 text-green-700 px-2 py-0.5 rounded-full text-xs">
                                            {skill}
                                        </span>
                                    ))}
                                    {match.matchingSkills.length > 5 && (
                                        <span className="text-xs text-gray-500">+{match.matchingSkills.length - 5} more</span>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* View details button */}
                        <div className="mt-4 flex justify-end">
                            <a
                            href={match.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-3 py-1.5 border border-brown text-sm font-medium rounded-md text-brown hover:bg-brown-light/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brown"
                            >
                            View Job Details
                            <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                          </a>
                       </div>
                    </div>
                ))}
            </div>

            {/* Refresh matches button and view more button */}
            <div className="mt-6 flex justify-center space-x-4">
                <button
                    onClick={handleTriggerMatching}
                    disabled={processingMatch}
                    className="px-4 py-2 border border-brown rounded-md text-sm font-medium text-brown hover:bg-brown-light/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brown disabled:opacity-50"
                >
                    {processingMatch ? (
                        <span className="flex items-center">
                            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-brown mr-2"></div>
                            Finding New Matches...
                        </span>
                    ) : (
                        'Find New Matches'
                    )}
                </button>

                {stats.totalMatches > jobMatches.length && (
                    <Link
                        href={`/resume/${resumeInfo.id}/job-matches`}
                        className="px-4 py-2 bg-brown text-white rounded-md text-sm font-medium hover:bg-brown-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brown"
                    >
                        View All {stats.totalMatches} Matches
                        <ChevronRight className="ml-1.5 h-4 w-4 inline-block" />
                    </Link>
                )}
            </div>
        </div>
    );
}