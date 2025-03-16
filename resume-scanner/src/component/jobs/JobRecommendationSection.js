'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/server/utils/supabase-client';
import Link from 'next/link';
import { Briefcase, ChevronRight, ExternalLink, AlertTriangle } from 'lucide-react';

export default function JobRecommendationsSection() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [recommendations, setRecommendations] = useState([]);
    const [resumeInfo, setResumeInfo] = useState(null);

    useEffect(() => {
        const fetchRecommendations = async () => {
            try {
                setLoading(true);

                // Get the current session token
                const { data: { session } } = await supabase.auth.getSession();

                if (!session) {
                    // Not authenticated, set empty state
                    setLoading(false);
                    return;
                }

                // Fetch job recommendations
                const response = await fetch('/api/job-matches?type=recommendations', {
                    headers: {
                        'Authorization': `Bearer ${session.access_token}`
                    }
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    // If it's just because there are no recommendations, don't show as error
                    if (response.status === 404 || errorData.message?.includes('No analyzed resumes')) {
                        setRecommendations([]);
                        return;
                    }
                    throw new Error(errorData.error || 'Failed to fetch job recommendations');
                }

                const data = await response.json();

                setRecommendations(data.recommendations || []);
                setResumeInfo({
                    id: data.resumeId,
                    title: data.resumeTitle
                });
            } catch (error) {
                console.error('Error fetching job recommendations:', error);
                setError(error.message);
            } finally {
                setLoading(false);
            }
        };

        fetchRecommendations();
    }, []);

    // Not authenticated or still loading
    if (!resumeInfo && !loading && !error) {
        return null;
    }

    // Loading state
    if (loading) {
        return (
            <div className="bg-white rounded-lg shadow-sm border border-brown-light p-6 mb-8">
                <h3 className="text-lg font-semibold text-brown mb-4">Job Recommendations</h3>
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
                <h3 className="text-lg font-semibold text-brown mb-4">Job Recommendations</h3>
                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
                    <div className="flex">
                        <div className="flex-shrink-0">
                            <AlertTriangle className="h-5 w-5 text-red-500" />
                        </div>
                        <div className="ml-3">
                            <p className="text-sm text-red-700">
                                {error || 'Failed to load job recommendations. Please try again later.'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // No recommendations state
    if (recommendations.length === 0) {
        return (
            <div className="bg-white rounded-lg shadow-sm border border-brown-light p-6 mb-8">
                <h3 className="text-lg font-semibold text-brown mb-4">Job Recommendations</h3>
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg">
                    <div className="flex">
                        <div className="flex-shrink-0">
                            <Briefcase className="h-5 w-5 text-yellow-600" />
                        </div>
                        <div className="ml-3">
                            <p className="text-sm text-yellow-700">
                                No job recommendations available yet. Upload your resume to get personalized job recommendations.
                            </p>
                            <div className="mt-3">
                                <Link
                                    href="/upload"
                                    className="inline-flex items-center text-sm font-medium text-brown hover:text-brown-dark"
                                >
                                    Upload Resume <ChevronRight className="ml-1 h-4 w-4" />
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Show recommendations
    return (
        <div className="bg-white rounded-lg shadow-sm border border-brown-light p-6 mb-8">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold text-brown">Job Recommendations</h3>
                <div className="flex items-center text-sm text-gray-600">
                    <span>Based on: </span>
                    <span className="ml-1 font-medium text-brown truncate max-w-[200px]" title={resumeInfo.title}>
                        {resumeInfo.title}
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {recommendations.map((job, index) => (
                    <div key={index} className="border border-brown-light rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                        <div className="bg-brown-light/10 p-3">
                            <h4 className="font-medium text-brown truncate" title={job.title}>{job.title}</h4>
                            <p className="text-sm text-brown-light truncate" title={job.company}>{job.company}</p>
                        </div>

                        <div className="p-3">
                            <div className="flex items-center text-xs text-gray-500 mb-3">
                                <div className="flex items-center mr-3">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    {job.location}
                                </div>
                                <div className="flex items-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                    {job.jobType}
                                </div>
                            </div>

                            <p className="text-xs text-gray-600 line-clamp-3 mb-3">
                                {job.description || 'No description available'}
                            </p>

                            {job.score && (
                                <div className="flex justify-between items-center mb-3">
                                    <span className="text-xs text-gray-500">Match score:</span>
                                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                                        job.score >= 80 ? 'bg-green-100 text-green-800' :
                                            job.score >= 60 ? 'bg-yellow-100 text-yellow-800' :
                                                'bg-red-100 text-red-800'
                                    }`}>
                                        {Math.round(job.score)}%
                                    </span>
                                </div>
                            )}

                            <div className="flex justify-end">
                                <a
                                    href={job.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center text-xs font-medium text-brown hover:text-brown-dark"
                                 >
                                 View Details
                                <ExternalLink className="ml-1 h-3 w-3" />
                              </a>
                        </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-6 text-center">
                <Link
                    href="/job-recommendations"
                    className="inline-flex items-center px-4 py-2 border border-brown rounded-md text-sm font-medium text-brown hover:bg-brown-light/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brown"
                >
                    View More Recommendations
                    <ChevronRight className="ml-1.5 h-4 w-4" />
                </Link>
            </div>
        </div>
    );
}