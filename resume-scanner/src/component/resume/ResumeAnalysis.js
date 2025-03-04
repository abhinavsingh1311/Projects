'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/server/utils/supabase-client';
import { Award, Check, AlertTriangle, FileText, Briefcase, Tool, Star, BarChart2, Download, Brain, ArrowUpRight } from 'lucide-react';

export default function ResumeAnalysisPage() {
    const params = useParams();
    const router = useRouter();
    const { id } = params;

    const [loading, setLoading] = useState(true);
    const [resume, setResume] = useState(null);
    const [analysis, setAnalysis] = useState(null);
    const [error, setError] = useState(null);
    const [reanalyzing, setReanalyzing] = useState(false);
    const [activeTab, setActiveTab] = useState('overview');
    const [skills, setSkills] = useState([]);
    const [jobMatches, setJobMatches] = useState([]);

    useEffect(() => {
        if (!id) return;
        fetchResumeAnalysis();
    }, [id]);

    const fetchResumeAnalysis = async () => {
        try {
            setLoading(true);
            setError(null);

            // Fetch resume details
            const { data: resumeData, error: resumeError } = await supabase
                .from('resumes')
                .select('*')
                .eq('id', id)
                .single();

            if (resumeError) throw resumeError;
            setResume(resumeData);

            // Fetch analysis data
            const { data: analysisData, error: analysisError } = await supabase
                .from('resume_analysis')
                .select('*')
                .eq('resume_id', id)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (analysisError) {
                // If no analysis found, but resume exists
                if (analysisError.code === 'PGRST116') {
                    setError('No analysis found for this resume. You can analyze it now.');
                } else {
                    throw analysisError;
                }
            } else {
                setAnalysis(analysisData.analysis_json);
            }

            // Fetch skills
            const { data: skillsData, error: skillsError } = await supabase
                .from('resume_skills')
                .select(`
                    level,
                    skills(id, name, category)
                `)
                .eq('resume_id', id);

            if (!skillsError) {
                setSkills(skillsData || []);
            }

            // Fetch job matches
            const { data: matchesData, error: matchesError } = await supabase
                .from('job_matches')
                .select(`
                    *,
                    jobs(id, title, company_name, location, job_types, salary_min, salary_max)
                `)
                .eq('resume_id', id)
                .order('match_score', { ascending: false })
                .limit(5);

            if (!matchesError) {
                setJobMatches(matchesData || []);
            }

        } catch (error) {
            console.error('Error fetching analysis:', error);
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleReanalyze = async () => {
        try {
            setReanalyzing(true);
            setError(null);

            const response = await fetch(`/api/resumes/${id}/analyze`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ force: true }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to analyze resume');
            }

            // Wait a moment and then fetch the new analysis
            setTimeout(() => {
                fetchResumeAnalysis();
                setReanalyzing(false);
            }, 2000);

        } catch (error) {
            console.error('Error analyzing resume:', error);
            setError(error.message);
            setReanalyzing(false);
        }
    };

    // Format salary range
    const formatSalary = (min, max) => {
        if (!min && !max) return 'Not specified';
        if (min && !max) return `$${min.toLocaleString()}+`;
        if (!min && max) return `Up to $${max.toLocaleString()}`;
        return `$${min.toLocaleString()} - $${max.toLocaleString()}`;
    };

    // Group skills by category
    const skillsByCategory = skills.reduce((acc, skill) => {
        const category = skill.skills.category || 'other';
        if (!acc[category]) acc[category] = [];
        acc[category].push({
            id: skill.skills.id,
            name: skill.skills.name,
            level: skill.level
        });
        return acc;
    }, {});

    if (loading) {
        return (
            <div className="container mx-auto p-6 flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brown mx-auto"></div>
                    <p className="mt-3 text-brown">Loading analysis...</p>
                </div>
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
                    Back to Dashboard
                </Link>
            </div>

            {error ? (
                <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-brown-light">
                    <div className="p-6">
                        <div className="flex items-center mb-4">
                            <div className="bg-red-100 rounded-full p-2 mr-3">
                                <AlertTriangle className="h-6 w-6 text-red-600" />
                            </div>
                            <h1 className="text-2xl font-bold text-gray-900">
                                Analysis Not Available
                            </h1>
                        </div>

                        <p className="text-gray-600 mb-6">{error}</p>

                        <button
                            onClick={handleReanalyze}
                            disabled={reanalyzing}
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-brown hover:bg-brown-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brown disabled:opacity-50"
                        >
                            {reanalyzing ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                                    Analyzing...
                                </>
                            ) : (
                                <>
                                    <Brain className="mr-2 h-4 w-4" />
                                    Analyze Now
                                </>
                            )}
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-brown-light mb-6">
                        <div className="p-6">
                            <div className="flex flex-col md:flex-row md:justify-between md:items-center">
                                <div>
                                    <h1 className="text-2xl font-bold text-gray-900 mb-1">
                                        {resume.title}
                                    </h1>
                                    <p className="text-gray-500 text-sm">
                                        Uploaded on {new Date(resume.created_at).toLocaleDateString()}
                                        {resume.last_analyzed_at && (
                                            <> • Analyzed on {new Date(resume.last_analyzed_at).toLocaleDateString()}</>
                                        )}
                                    </p>
                                </div>

                                <div className="mt-4 md:mt-0 flex space-x-3">
                                    <button
                                        onClick={() => window.open(`/api/resumes/${id}/download`, '_blank')}
                                        className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                                    >
                                        <Download className="h-4 w-4 mr-2" />
                                        Download
                                    </button>
                                    <button
                                        onClick={handleReanalyze}
                                        disabled={reanalyzing}
                                        className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-brown hover:bg-brown-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brown disabled:opacity-50"
                                    >
                                        {reanalyzing ? (
                                            <>
                                                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                                                Analyzing...
                                            </>
                                        ) : (
                                            <>
                                                <Brain className="h-4 w-4 mr-2" />
                                                Re-analyze
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Overall Score Card */}
                            <div className="mt-6 bg-gradient-to-r from-brown-light to-brown rounded-lg p-6 text-white">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <h2 className="text-lg font-semibold flex items-center">
                                            <Award className="h-5 w-5 mr-2" />
                                            Overall Score
                                        </h2>
                                        <p className="text-sm opacity-80">Based on content quality, relevance, and effectiveness</p>
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
                        </div>
                    </div>

                    {/* Tabs Navigation */}
                    <div className="border-b border-gray-200 mb-6">
                        <nav className="flex -mb-px">
                            <button
                                onClick={() => setActiveTab('overview')}
                                className={`mr-8 py-4 px-1 text-sm font-medium ${activeTab === 'overview'
                                        ? 'border-b-2 border-brown text-brown'
                                        : 'border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                            >
                                Overview
                            </button>
                            <button
                                onClick={() => setActiveTab('skills')}
                                className={`mr-8 py-4 px-1 text-sm font-medium ${activeTab === 'skills'
                                        ? 'border-b-2 border-brown text-brown'
                                        : 'border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                            >
                                Skills
                            </button>
                            <button
                                onClick={() => setActiveTab('ats')}
                                className={`mr-8 py-4 px-1 text-sm font-medium ${activeTab === 'ats'
                                        ? 'border-b-2 border-brown text-brown'
                                        : 'border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                            >
                                ATS Compatibility
                            </button>
                            <button
                                onClick={() => setActiveTab('jobs')}
                                className={`mr-8 py-4 px-1 text-sm font-medium ${activeTab === 'jobs'
                                        ? 'border-b-2 border-brown text-brown'
                                        : 'border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                            >
                                Job Matches
                            </button>
                        </nav>
                    </div>

                    {/* Overview Tab */}
                    {activeTab === 'overview' && (
                        <div className="space-y-6">
                            {/* Strengths and Improvements */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Strengths */}
                                <div className="bg-white p-6 rounded-lg shadow-sm border border-brown-light">
                                    <h3 className="text-lg font-medium text-gray-800 mb-4 flex items-center">
                                        <Check className="h-5 w-5 mr-2 text-green-500" />
                                        Strengths
                                    </h3>
                                    {analysis.strengths && analysis.strengths.length > 0 ? (
                                        <ul className="space-y-2">
                                            {analysis.strengths.map((strength, index) => (
                                                <li key={index} className="flex items-start">
                                                    <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-green-100 text-green-500 mr-2 mt-0.5">
                                                        <Check className="h-3 w-3" />
                                                    </span>
                                                    <span className="text-gray-700">{strength}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="text-gray-500 italic">No specific strengths were identified.</p>
                                    )}
                                </div>

                                {/* Improvements */}
                                <div className="bg-white p-6 rounded-lg shadow-sm border border-brown-light">
                                    <h3 className="text-lg font-medium text-gray-800 mb-4 flex items-center">
                                        <AlertTriangle className="h-5 w-5 mr-2 text-yellow-500" />
                                        Areas for Improvement
                                    </h3>
                                    {analysis.improvement_areas && analysis.improvement_areas.length > 0 ? (
                                        <ul className="space-y-2">
                                            {analysis.improvement_areas.map((area, index) => (
                                                <li key={index} className="flex items-start">
                                                    <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-yellow-100 text-yellow-500 mr-2 mt-0.5">
                                                        <AlertTriangle className="h-3 w-3" />
                                                    </span>
                                                    <span className="text-gray-700">{area}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="text-gray-500 italic">No specific improvement areas were identified.</p>
                                    )}
                                </div>
                            </div>

                            {/* Experience and Education */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Experience Summary */}
                                <div className="bg-white p-6 rounded-lg shadow-sm border border-brown-light">
                                    <h3 className="text-lg font-medium text-gray-800 mb-4 flex items-center">
                                        <Briefcase className="h-5 w-5 mr-2 text-brown" />
                                        Experience Summary
                                    </h3>
                                    <p className="text-gray-700">{analysis.experience_summary}</p>

                                    {analysis.experience_level && (
                                        <div className="mt-4 flex items-center">
                                            <span className="text-sm text-gray-500 mr-2">Experience Level:</span>
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium bg-brown-light/20 text-brown-dark`}>
                                                {analysis.experience_level}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Education Summary */}
                                <div className="bg-white p-6 rounded-lg shadow-sm border border-brown-light">
                                    <h3 className="text-lg font-medium text-gray-800 mb-4 flex items-center">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-brown" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path d="M12 14l9-5-9-5-9 5 9 5z" />
                                            <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
                                        </svg>
                                        Education Summary
                                    </h3>
                                    <p className="text-gray-700">{analysis.education_summary}</p>
                                </div>
                            </div>

                            {/* Keyword Recommendations */}
                            <div className="bg-white p-6 rounded-lg shadow-sm border border-brown-light">
                                <h3 className="text-lg font-medium text-gray-800 mb-4 flex items-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-brown" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                                    </svg>
                                    Recommended Keywords
                                </h3>
                                <p className="mb-4 text-gray-700">
                                    Including these keywords can improve your resume's visibility to recruiters and ATS systems:
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {analysis.keywords && analysis.keywords.length > 0 ? (
                                        analysis.keywords.map((keyword, index) => (
                                            <span key={index} className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
                                                {keyword}
                                            </span>
                                        ))
                                    ) : (
                                        <p className="text-gray-500 italic">No keyword recommendations available.</p>
                                    )}
                                </div>
                            </div>

                            {/* Career Path */}
                            {analysis.career_path && (
                                <div className="bg-white p-6 rounded-lg shadow-sm border border-brown-light">
                                    <h3 className="text-lg font-medium text-gray-800 mb-4 flex items-center">
                                        <ArrowUpRight className="h-5 w-5 mr-2 text-brown" />
                                        Career Path Assessment
                                    </h3>
                                    <p className="text-gray-700">{analysis.career_path}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Skills Tab */}
                    {activeTab === 'skills' && (
                        <div className="space-y-6">
                            {/* Technical Skills */}
                            <div className="bg-white p-6 rounded-lg shadow-sm border border-brown-light">
                                <h3 className="text-lg font-medium text-gray-800 mb-4 flex items-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                                    </svg>
                                    Technical Skills
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {analysis.skills.technical && analysis.skills.technical.length > 0 ? (
                                        analysis.skills.technical.map((skill, index) => (
                                            <div key={index} className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                                                <span className="font-medium text-blue-800">{skill}</span>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-gray-500 italic">No technical skills identified.</p>
                                    )}
                                </div>
                            </div>

                            {/* Soft Skills */}
                            <div className="bg-white p-6 rounded-lg shadow-sm border border-brown-light">
                                <h3 className="text-lg font-medium text-gray-800 mb-4 flex items-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                                    </svg>
                                    Soft Skills
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {analysis.skills.soft && analysis.skills.soft.length > 0 ? (
                                        analysis.skills.soft.map((skill, index) => (
                                            <div key={index} className="bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                                                <span className="font-medium text-green-800">{skill}</span>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-gray-500 italic">No soft skills identified.</p>
                                    )}
                                </div>
                            </div>

                            {/* Tools & Technologies */}
                            <div className="bg-white p-6 rounded-lg shadow-sm border border-brown-light">
                                <h3 className="text-lg font-medium text-gray-800 mb-4 flex items-center">
                                    <Tool className="h-5 w-5 mr-2 text-purple-600" />
                                    Tools & Technologies
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {analysis.skills.tools && analysis.skills.tools.length > 0 ? (
                                        analysis.skills.tools.map((tool, index) => (
                                            <div key={index} className="bg-purple-50 border border-purple-200 rounded-lg px-3 py-2">
                                                <span className="font-medium text-purple-800">{tool}</span>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-gray-500 italic">No tools or technologies identified.</p>
                                    )}
                                </div>
                            </div>

                            {/* Certifications */}
                            {analysis.skills.certifications && analysis.skills.certifications.length > 0 && (
                                <div className="bg-white p-6 rounded-lg shadow-sm border border-brown-light">
                                    <h3 className="text-lg font-medium text-gray-800 mb-4 flex items-center">
                                        <Award className="h-5 w-5 mr-2 text-yellow-600" />
                                        Certifications
                                    </h3>
                                    <div className="flex flex-wrap gap-2">
                                        {analysis.skills.certifications.map((cert, index) => (
                                            <div key={index} className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
                                                <span className="font-medium text-yellow-800">{cert}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Missing Important Skills */}
                            {jobMatches.length > 0 && (
                                <div className="bg-white p-6 rounded-lg shadow-sm border border-brown-light">
                                    <h3 className="text-lg font-medium text-gray-800 mb-4 flex items-center">
                                        <AlertTriangle className="h-5 w-5 mr-2 text-yellow-600" />
                                        Frequently Requested Skills You're Missing
                                    </h3>
                                    <p className="mb-4 text-gray-700">
                                        Based on job matches, consider adding these skills to your resume:
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {jobMatches
                                            .filter(match => match.match_details && match.match_details.missing_skills)
                                            .flatMap(match => match.match_details.missing_skills)
                                            .filter((skill, index, self) => self.indexOf(skill) === index)
                                            .slice(0, 10)
                                            .map((skill, index) => (
                                                <div key={index} className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
                                                    <span className="font-medium text-orange-800">{skill}</span>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ATS Compatibility Tab */}
                    {activeTab === 'ats' && (
                        <div className="space-y-6">
                            {/* ATS Score */}
                            <div className="bg-white p-6 rounded-lg shadow-sm border border-brown-light">
                                <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6">
                                    <div>
                                        <h3 className="text-lg font-medium text-gray-800 flex items-center">
                                            <FileText className="h-5 w-5 mr-2 text-brown" />
                                            ATS Compatibility Score
                                        </h3>
                                        <p className="text-sm text-gray-500 mt-1">
                                            How well your resume works with Applicant Tracking Systems
                                        </p>
                                    </div>
                                    <div className="mt-4 md:mt-0">
                                        <div className={`text-3xl font-bold ${analysis.ats_compatibility.score >= 80 ? 'text-green-600' :
                                                analysis.ats_compatibility.score >= 60 ? 'text-yellow-600' :
                                                    'text-red-600'
                                            }`}>
                                            {analysis.ats_compatibility.score}/100
                                        </div>
                                    </div>
                                </div>

                                {/* ATS Progress Bar */}
                                <div className="w-full bg-gray-200 rounded-full h-4 mb-6">
                                    <div
                                        className={`h-4 rounded-full ${analysis.ats_compatibility.score >= 80 ? 'bg-green-600' :
                                                analysis.ats_compatibility.score >= 60 ? 'bg-yellow-500' :
                                                    'bg-red-500'
                                            }`}
                                        style={{ width: `${analysis.ats_compatibility.score}%` }}
                                    >
                                    </div>
                                </div>

                                {/* ATS Rating */}
                                <div className="bg-gray-50 p-4 rounded-lg mb-6">
                                    <div className="font-medium mb-2">Rating: {
                                        analysis.ats_compatibility.score >= 80 ? 'Excellent' :
                                            analysis.ats_compatibility.score >= 70 ? 'Very Good' :
                                                analysis.ats_compatibility.score >= 60 ? 'Good' :
                                                    analysis.ats_compatibility.score >= 50 ? 'Fair' :
                                                        'Poor'
                                    }</div>
                                    <p className="text-sm text-gray-600">
                                        {analysis.ats_compatibility.score >= 80 ?
                                            'Your resume will perform excellently with most ATS systems. You should not have any technical issues getting your resume past the ATS stage.' :
                                            analysis.ats_compatibility.score >= 60 ?
                                                'Your resume will work well with most ATS systems, but may have some minor issues that could be improved.' :
                                                'Your resume has significant ATS compatibility issues that may prevent it from being properly parsed by applicant tracking systems.'
                                        }
                                    </p>
                                </div>
                            </div>

                            {/* ATS Issues */}
                            <div className="bg-white p-6 rounded-lg shadow-sm border border-brown-light">
                                <h3 className="text-lg font-medium text-gray-800 mb-4 flex items-center">
                                    <AlertTriangle className="h-5 w-5 mr-2 text-yellow-600" />
                                    ATS Issues
                                </h3>
                                {analysis.ats_compatibility.issues && analysis.ats_compatibility.issues.length > 0 ? (
                                    <ul className="space-y-3">
                                        {analysis.ats_compatibility.issues.map((issue, index) => (
                                            <li key={index} className="flex items-start pb-3 border-b border-gray-100 last:border-0">
                                                <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-yellow-100 text-yellow-600 mr-2 mt-0.5 flex-shrink-0">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                    </svg>
                                                </span>
                                                <span className="text-gray-700">{issue}</span>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-gray-500 italic">No ATS issues were identified.</p>
                                )}
                            </div>

                            {/* ATS Recommendations */}
                            <div className="bg-white p-6 rounded-lg shadow-sm border border-brown-light">
                                <h3 className="text-lg font-medium text-gray-800 mb-4 flex items-center">
                                    <Check className="h-5 w-5 mr-2 text-green-600" />
                                    Recommendations
                                </h3>
                                {analysis.ats_compatibility.recommendations && analysis.ats_compatibility.recommendations.length > 0 ? (
                                    <ul className="space-y-3">
                                        {analysis.ats_compatibility.recommendations.map((rec, index) => (
                                            <li key={index} className="flex items-start pb-3 border-b border-gray-100 last:border-0">
                                                <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-green-100 text-green-600 mr-2 mt-0.5 flex-shrink-0">
                                                    <Check className="h-3 w-3" />
                                                </span>
                                                <span className="text-gray-700">{rec}</span>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-gray-500 italic">No recommendations available.</p>
                                )}
                            </div>

                            {/* ATS Best Practices */}
                            <div className="bg-white p-6 rounded-lg shadow-sm border border-brown-light">
                                <h3 className="text-lg font-medium text-gray-800 mb-4 flex items-center">
                                    <Star className="h-5 w-5 mr-2 text-yellow-500" />
                                    ATS Best Practices
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-gray-50 p-4 rounded-lg">
                                        <h4 className="font-medium text-gray-800 mb-2">Formatting</h4>
                                        <ul className="text-sm space-y-1 text-gray-700">
                                            <li>• Use simple, standard fonts (Arial, Calibri, Times New Roman)</li>
                                            <li>• Avoid text boxes, tables, headers/footers, and columns</li>
                                            <li>• Use standard section headings (Experience, Education, Skills)</li>
                                            <li>• Save as a PDF or .docx file format</li>
                                        </ul>
                                    </div>
                                    <div className="bg-gray-50 p-4 rounded-lg">
                                        <h4 className="font-medium text-gray-800 mb-2">Content</h4>
                                        <ul className="text-sm space-y-1 text-gray-700">
                                            <li>• Include keywords from the job description</li>
                                            <li>• Spell out acronyms at least once</li>
                                            <li>• Use standard job titles</li>
                                            <li>• Include a skills section with relevant skills</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Job Matches Tab */}
                    {activeTab === 'jobs' && (
                        <div className="space-y-6">
                            {jobMatches.length === 0 ? (
                                <div className="bg-white p-6 rounded-lg shadow-sm border border-brown-light text-center">
                                    <div className="flex items-center justify-center h-16 w-16 mx-auto bg-yellow-100 rounded-full mb-4">
                                        <Briefcase className="h-8 w-8 text-yellow-600" />
                                    </div>
                                    <h3 className="text-lg font-medium text-gray-800 mb-2">No Job Matches Found</h3>
                                    <p className="text-gray-600 max-w-md mx-auto">
                                        We couldn't find any job matches for your resume. This could be because there are no jobs in our database that match your skills, or because your resume needs more specific skills.
                                    </p>
                                </div>
                            ) : (
                                <>
                                    <div className="bg-white p-6 rounded-lg shadow-sm border border-brown-light">
                                        <h3 className="text-lg font-medium text-gray-800 mb-4 flex items-center">
                                            <Briefcase className="h-5 w-5 mr-2 text-brown" />
                                            Top Job Matches
                                        </h3>
                                        <p className="text-gray-600 mb-6">
                                            Based on your resume, these jobs are the best matches for your skills and experience:
                                        </p>

                                        <div className="space-y-6">
                                            {jobMatches.map(match => (
                                                <div key={match.id} className="border-b pb-6 last:border-0 last:pb-0">
                                                    <div className="flex justify-between">
                                                        <div>
                                                            <h4 className="font-semibold text-lg text-gray-900">{match.jobs.title}</h4>
                                                            <p className="text-brown">{match.jobs.company_name}</p>
                                                            <p className="text-sm text-gray-500 mt-1">{match.jobs.location || 'Remote'}</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${match.match_score >= 80 ? 'bg-green-100 text-green-800' :
                                                                    match.match_score >= 60 ? 'bg-yellow-100 text-yellow-800' :
                                                                        'bg-red-100 text-red-800'
                                                                }`}>
                                                                {Math.round(match.match_score)}% Match
                                                            </div>
                                                            <p className="text-sm text-gray-500 mt-1">
                                                                {formatSalary(match.jobs.salary_min, match.jobs.salary_max)}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {/* Match Details */}
                                                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        {/* Matching Skills */}
                                                        <div>
                                                            <h5 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                                                                <Check className="h-4 w-4 mr-1 text-green-500" />
                                                                Matching Skills
                                                            </h5>
                                                            <div className="flex flex-wrap gap-2">
                                                                {match.match_details && match.match_details.matching_skills ? (
                                                                    match.match_details.matching_skills.slice(0, 6).map((skill, idx) => (
                                                                        <span key={idx} className="bg-green-50 text-green-700 px-2 py-0.5 rounded-full text-xs">
                                                                            {skill}
                                                                        </span>
                                                                    ))
                                                                ) : (
                                                                    <span className="text-gray-500 text-sm">No matching skills identified</span>
                                                                )}
                                                                {match.match_details && match.match_details.matching_skills && match.match_details.matching_skills.length > 6 && (
                                                                    <span className="text-xs text-gray-500">+{match.match_details.matching_skills.length - 6} more</span>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Missing Skills */}
                                                        <div>
                                                            <h5 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                                                                <AlertTriangle className="h-4 w-4 mr-1 text-yellow-500" />
                                                                Missing Skills
                                                            </h5>
                                                            <div className="flex flex-wrap gap-2">
                                                                {match.match_details && match.match_details.missing_skills && match.match_details.missing_skills.length > 0 ? (
                                                                    match.match_details.missing_skills.slice(0, 6).map((skill, idx) => (
                                                                        <span key={idx} className="bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded-full text-xs">
                                                                            {skill}
                                                                        </span>
                                                                    ))
                                                                ) : (
                                                                    <span className="text-green-600 text-sm">No missing required skills!</span>
                                                                )}
                                                                {match.match_details && match.match_details.missing_skills && match.match_details.missing_skills.length > 6 && (
                                                                    <span className="text-xs text-gray-500">+{match.match_details.missing_skills.length - 6} more</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="mt-4 flex justify-end">
                                                        <button className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-brown hover:bg-brown-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brown">
                                                            View Job & Apply
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="bg-white p-6 rounded-lg shadow-sm border border-brown-light">
                                        <h3 className="text-lg font-medium text-gray-800 mb-4 flex items-center">
                                            <BarChart2 className="h-5 w-5 mr-2 text-brown" />
                                            Match Analysis
                                        </h3>

                                        {/* Skills Gap Analysis */}
                                        <div className="mb-6">
                                            <h4 className="font-medium text-gray-700 mb-3">Skills Gap Analysis</h4>
                                            <p className="text-gray-600 mb-4">
                                                Based on your job matches, here are the most frequently requested skills you're missing:
                                            </p>

                                            <div className="bg-gray-50 p-4 rounded-lg">
                                                {jobMatches
                                                    .filter(match => match.match_details && match.match_details.missing_skills)
                                                    .flatMap(match => match.match_details.missing_skills)
                                                    .reduce((counts, skill) => {
                                                        counts[skill] = (counts[skill] || 0) + 1;
                                                        return counts;
                                                    }, {})
                                                    .constructor.entries(Object.entries)
                                                    .sort((a, b) => b[1] - a[1])
                                                    .slice(0, 5)
                                                    .map(([skill, count], index) => (
                                                        <div key={index} className="mb-2 last:mb-0">
                                                            <div className="flex justify-between items-center mb-1">
                                                                <span className="text-sm font-medium text-gray-700">{skill}</span>
                                                                <span className="text-xs text-gray-500">
                                                                    {count} of {jobMatches.length} jobs
                                                                </span>
                                                            </div>
                                                            <div className="w-full bg-gray-200 rounded-full h-2">
                                                                <div
                                                                    className="bg-yellow-500 h-2 rounded-full"
                                                                    style={{ width: `${(count / jobMatches.length) * 100}%` }}
                                                                ></div>
                                                            </div>
                                                        </div>
                                                    ))}
                                            </div>
                                        </div>

                                        <div className="mb-6">
                                            <h4 className="font-medium text-gray-700 mb-3">Job Title Alignment</h4>
                                            <p className="text-sm text-gray-600">
                                                Based on your skills and experience, these job titles align well with your profile:
                                            </p>
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                {[...new Set(jobMatches.map(match => match.jobs.title))].slice(0, 6).map((title, idx) => (
                                                    <span key={idx} className="bg-brown-light/20 text-brown px-3 py-1 rounded-full text-sm">
                                                        {title}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <h4 className="font-medium text-gray-700 mb-3">Recommendation</h4>
                                            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
                                                <p className="text-blue-700">
                                                    To improve your job matches, consider adding the missing skills identified above to your resume.
                                                    Focus on skills that appear most frequently in job matches. If you already have these skills
                                                    but they're not on your resume, be sure to include them with specific examples.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}