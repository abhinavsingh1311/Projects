'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/server/utils/supabase-client';
import Link from 'next/link';
import Image from 'next/image';
import DeleteConfirmationModal from '@/component/DeleteConfirmationModal';
import ResumeProcessingStatus from '@/component/resume/ResumeProcessingStatus';
import JobMatchesSection from '@/component/jobs/JobMatchesSection';
import JobRecommendationsSection from '@/component/jobs/JobRecommendationSection';
import { PieChart, BarChart, Clipboard, FileText, Briefcase, Search, Award, Lock } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [user, setUser] = useState(null);
  const [resumes, setResumes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const router = useRouter();
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    resumeId: null,
    resumeTitle: '',
    filePath: null
  });
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredResumes, setFilteredResumes] = useState([]);
  const [sortOption, setSortOption] = useState('newest');
  const [showOnlyCriticalErrors, setShowOnlyCriticalErrors] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [dashboardStats, setDashboardStats] = useState({
    resumeCount: 0,
    analyzedCount: 0,
    topSkills: [],
    matchedJobs: 0,
    averageScore: 0
  });

  // Process resumes to add derived properties
  const processResumes = useCallback((resumesData) => {
    return resumesData.map(resume => ({
      ...resume,
      hasAnalysis: resume.resume_analysis && resume.resume_analysis.length > 0,
      isParsed: resume.status === 'parsed' || resume.status === 'analyzed' || resume.status === 'completed',
      lastUpdated: resume.updated_at || resume.created_at,
      processingStatus: getProcessingStatus(resume.status),
      skillCount: resume.resume_analysis && resume.resume_analysis.length > 0 ?
          (resume.resume_analysis[0].analysis_json?.skills?.technical?.length || 0) +
          (resume.resume_analysis[0].analysis_json?.skills?.soft?.length || 0) : 0,
      overallScore: resume.resume_analysis && resume.resume_analysis.length > 0 ?
          resume.resume_analysis[0].analysis_json?.overall_score || 0 : 0,
      atsScore: resume.resume_analysis && resume.resume_analysis.length > 0 ?
          resume.resume_analysis[0].analysis_json?.ats_compatibility?.score || 0 : 0
    }));
  }, []);

  // Calculate dashboard stats from resume data
  const calculateDashboardStats = useCallback((resumeData) => {
    const analyzed = resumeData.filter(r => r.hasAnalysis).length;
    const allSkills = [];
    resumeData.forEach(resume => {
      if (resume.resume_analysis && resume.resume_analysis.length > 0) {
        const technicalSkills = resume.resume_analysis[0].analysis_json?.skills?.technical || [];
        const softSkills = resume.resume_analysis[0].analysis_json?.skills?.soft || [];
        allSkills.push(...technicalSkills, ...softSkills);
      }
    });

    const skillCounts = {};
    allSkills.forEach(skill => {
      skillCounts[skill] = (skillCounts[skill] || 0) + 1;
    });

    const topSkills = Object.entries(skillCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([skill, count]) => ({ skill, count }));

    const scores = resumeData
        .filter(r => r.hasAnalysis)
        .map(r => r.overallScore);

    const avgScore = scores.length > 0
        ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
        : 0;

    setDashboardStats({
      resumeCount: resumeData.length,
      analyzedCount: analyzed,
      topSkills,
      matchedJobs: 0,
      averageScore: avgScore
    });
  }, []);

  // Main data fetching function - used for initial load and refreshes
  const fetchUserAndResumes = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);

      const { data, error: authError } = await supabase.auth.getUser();

      if (authError) {
        console.log("Auth error detected:", authError);
        setUser(null);
        return;
      }

      const currentUser = data?.user;
      setUser(currentUser);

      if (currentUser) {
        const { data: resumesData, error: resumesError } = await supabase
            .from('resumes')
            .select(`
              *,
              resume_parsed_data(*),
              resume_analysis(id, created_at, analysis_json)
            `)
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false });

        if (resumesError) throw resumesError;

        const processedResumes = processResumes(resumesData || []);
        setResumes(processedResumes);
        setFilteredResumes(processedResumes);

        if (processedResumes.length > 0) {
          calculateDashboardStats(processedResumes);
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setError(error.message);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [calculateDashboardStats, processResumes]);

  // Initial data load
  useEffect(() => {
    fetchUserAndResumes();
  }, [fetchUserAndResumes]);

  // Set up realtime subscriptions
  useEffect(() => {
    if (!user) return;

    const resumesSubscription = supabase
        .channel('resume-changes')
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'resumes', filter: `user_id=eq.${user.id}` },
            () => fetchUserAndResumes(false)
        )
        .subscribe();

    const analysisSubscription = supabase
        .channel('analysis-changes')
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'resume_analysis' },
            () => fetchUserAndResumes(false)
        )
        .subscribe();

    const matchesSubscription = supabase
        .channel('matches-changes')
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'job_matches' },
            () => fetchUserAndResumes(false)
        )
        .subscribe();

    return () => {
      supabase.removeChannel(resumesSubscription);
      supabase.removeChannel(analysisSubscription);
      supabase.removeChannel(matchesSubscription);
    };
  }, [user, fetchUserAndResumes]);

  // Filter and sort resumes when dependencies change
  useEffect(() => {
    if (resumes.length === 0) return;

    let filtered = [...resumes];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(resume =>
          resume.title.toLowerCase().includes(query) ||
          resume.file_type.toLowerCase().includes(query) ||
          resume.status.toLowerCase().includes(query)
      );
    }

    if (showOnlyCriticalErrors) {
      filtered = filtered.filter(resume =>
          resume.status === 'failed' || resume.processing_error
      );
    }

    switch (sortOption) {
      case 'newest':
        filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        break;
      case 'oldest':
        filtered.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        break;
      case 'name_asc':
        filtered.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'name_desc':
        filtered.sort((a, b) => b.title.localeCompare(a.title));
        break;
      case 'status':
        filtered.sort((a, b) => getStatusPriority(a.status) - getStatusPriority(b.status));
        break;
      case 'score':
        filtered.sort((a, b) => b.overallScore - a.overallScore);
        break;
      default:
        filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    setFilteredResumes(filtered);
  }, [resumes, searchQuery, sortOption, showOnlyCriticalErrors]);

  // Auto-hide notifications after timeout
  useEffect(() => {
    if (notification.show) {
      const timer = setTimeout(() => {
        setNotification({ ...notification, show: false });
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Handle resume status change
  const handleStatusChange = useCallback((resumeId, newStatus) => {
    setResumes(prev =>
        prev.map(resume =>
            resume.id === resumeId
                ? { ...resume, status: newStatus, processingStatus: getProcessingStatus(newStatus) }
                : resume
        )
    );
  }, []);

  // Get processing status text
  function getProcessingStatus(status) {
    switch (status) {
      case 'uploaded': return 'Uploaded, Waiting for Processing';
      case 'parsing': return 'Processing Text';
      case 'parsed': return 'Processed';
      case 'analyzing': return 'Analyzing';
      case 'analyzed': return 'Analysis Complete';
      case 'completed': return 'Complete';
      case 'failed': return 'Failed';
      default: return 'Unknown';
    }
  }

  // Get status priority for sorting
  function getStatusPriority(status) {
    const priorities = {
      'failed': 0,
      'parsing': 1,
      'analyzing': 2,
      'uploaded': 3,
      'parsed': 4,
      'analyzed': 5,
      'completed': 6
    };
    return priorities[status] ?? 999;
  }

  // Sign out handler
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setResumes([]);
  };

  // Delete modal handlers
  const openDeleteModal = (resume) => {
    setDeleteModal({
      isOpen: true,
      resumeId: resume.id,
      resumeTitle: resume.title,
      filePath: resume.file_path
    });
  };

  const closeDeleteModal = () => {
    setDeleteModal({
      isOpen: false,
      resumeId: null,
      resumeTitle: '',
      filePath: null
    });
  };

  // Handle resume deletion
  const handleDeleteResume = async () => {
    try {
      setDeleteLoading(true);
      const { resumeId, filePath } = deleteModal;

      if (filePath) {
        const { error: storageError } = await supabase.storage
            .from('resumes')
            .remove([filePath]);
        if (storageError) console.error('Storage deletion error:', storageError);
      }

      const { error: dbError } = await supabase
          .from('resumes')
          .delete()
          .eq('id', resumeId);

      if (dbError) throw dbError;

      setResumes(prev => prev.filter(resume => resume.id !== resumeId));
      setNotification({
        show: true,
        message: 'Resume deleted successfully',
        type: 'success'
      });
      closeDeleteModal();
    } catch (error) {
      console.error('Delete error:', error);
      setNotification({
        show: true,
        message: `Error deleting resume: ${error.message || 'Unknown error'}`,
        type: 'error'
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  // Get status badge with appropriate styling
  const getStatusBadge = (status) => {
    const statusConfig = {
      'uploaded': { color: 'bg-cream border-brown-light text-brown', label: 'Uploaded' },
      'parsing': { color: 'bg-yellow-100 border-yellow-300 text-yellow-800', label: 'Processing' },
      'parsed': { color: 'bg-blue-100 border-blue-300 text-blue-800', label: 'Processed' },
      'analyzing': { color: 'bg-purple-100 border-purple-300 text-purple-800', label: 'Analyzing' },
      'analyzed': { color: 'bg-green-100 border-green-300 text-green-800', label: 'Analyzed' },
      'completed': { color: 'bg-green-100 border-green-300 text-green-800', label: 'Completed' },
      'failed': { color: 'bg-red-100 border-red-300 text-red-800', label: 'Failed' },
      'pending': { color: 'bg-gray-100 border-gray-300 text-gray-800', label: 'Pending' }
    };

    const config = statusConfig[status] ?? statusConfig.pending;
    return (
        <span className={`${config.color} px-2.5 py-0.5 rounded-full text-xs font-medium border`}>
          {config.label}
        </span>
    );
  };

  // Format relative time (e.g., "2 hours ago")
  const formatRelativeTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return 'just now';
    if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
    if (diffHour < 24) return `${diffHour} hour${diffHour === 1 ? '' : 's'} ago`;
    if (diffDay < 30) return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;
    return date.toLocaleDateString();
  };

  // Refresh dashboard data without full page reload
  const refreshDashboard = useCallback(() => {
    setLoading(true);
    fetchUserAndResumes();
  }, [fetchUserAndResumes]);

  // Input handlers
  const handleSearchChange = (e) => setSearchQuery(e.target.value);
  const handleSortChange = (e) => setSortOption(e.target.value);

  // Loading state
  if (loading) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-cream">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brown mx-auto"></div>
            <p className="mt-3 text-brown">Loading your dashboard...</p>
          </div>
        </div>
    );
  }

  // Not logged in state
  if (!user) {
    return (
        <div className="min-h-screen bg-cream relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('/bg-leaves.jpg')] opacity-50 bg-center bg-cover"></div>
          <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4">
            <div className="w-32 h-32 mb-6 relative">
              <Image
                  src="/breadSlice.svg"
                  alt="Resume Scanner Logo"
                  width={200}
                  height={200}
                  className="animate-fade-in"
                  priority
              />
            </div>
            <div className="text-center mb-12 animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <h1 className="text-4xl md:text-5xl font-bold text-brown mb-4">Resume Scanner</h1>
              <p className="text-xl text-brown-dark max-w-2xl text-center"><q style={{
                fontWeight: 'bold',
                fontStyle: 'italic',
                fontFamily: 'fangsong'
              }}>Get instant analysis and job matches</q></p>
            </div>
            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-8 md:p-10 w-full max-w-md border border-brown-light animate-fade-in" style={{ animationDelay: '0.4s' }}>
              <h2 className="text-2xl font-semibold text-brown mb-6 text-center">Get Started</h2>
              <div className="flex flex-col space-y-4">
                <Link href="/auth/signin" className="w-full py-3 px-4 bg-brown text-white font-medium rounded-lg hover:bg-brown-dark transition duration-200 text-center">
                  Sign In
                </Link>
                <Link href="/auth/signup" className="w-full py-3 px-4 bg-white text-brown border border-brown font-medium rounded-lg hover:bg-cream-light transition duration-200 text-center">
                  Create Account
                </Link>
              </div>
              <div className="mt-8 text-center">
                <p className="text-brown-light text-sm">
                  Scan your resume, get personalized job matches, and improve your application success rate
                </p>
              </div>
            </div>
            <div className="mt-16 flex flex-wrap justify-center gap-8 md:gap-16 text-center max-w-4xl animate-fade-in" style={{ animationDelay: '0.6s' }}>
              <div className="w-full md:w-auto flex-1 min-w-[250px]">
                <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 h-full border border-brown-light">
                  <div className="w-16 h-16 mx-auto mb-4 bg-cream rounded-full flex items-center justify-center">
                    <FileText className="h-8 w-8 text-brown" />
                  </div>
                  <h3 className="text-lg font-semibold text-brown mb-2">Resume Analysis</h3>
                  <p className="text-brown-light text-sm">Get detailed insights on your resume's strengths and areas for improvement</p>
                </div>
              </div>

              <div className="w-full md:w-auto flex-1 min-w-[250px]">
                <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 h-full border border-brown-light">
                  <div className="w-16 h-16 mx-auto mb-4 bg-cream rounded-full flex items-center justify-center">
                    <Briefcase className="h-8 w-8 text-brown" />
                  </div>
                  <h3 className="text-lg font-semibold text-brown mb-2">Job Matching</h3>
                  <p className="text-brown-light text-sm">Find jobs that match your skills and experience with our AI-powered algorithm</p>
                </div>
              </div>

              <div className="w-full md:w-auto flex-1 min-w-[250px]">
                <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 h-full border border-brown-light">
                  <div className="w-16 h-16 mx-auto mb-4 bg-cream rounded-full flex items-center justify-center">
                    <Award className="h-8 w-8 text-brown" />
                  </div>
                  <h3 className="text-lg font-semibold text-brown mb-2">Smart Suggestions</h3>
                  <p className="text-brown-light text-sm">Get personalized suggestions to improve your resume and increase interview chances</p>
                </div>
              </div>
            </div>
          </div >
        </div >
    );
  }

  // Main dashboard
  return (
      <div className="min-h-screen bg-cream">
        <header className="bg-white dark:bg-brown-dark shadow-sm border-b border-brown-light sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16 items-center">
              <div className="flex-shrink-0 flex items-center">
                <div className="h-8 w-8 mr-2">
                  <Image src="/breadSlice.svg" alt="Logo" width={32} height={32} priority />
                </div>
                <h1 className="text-xl font-bold text-brown">Resume Scanner</h1>
              </div>
              <div className="flex items-center space-x-4">
                <Link
                    href="/upload"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-brown hover:bg-brown-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brown"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Upload Resume
                </Link>
                <button
                    onClick={handleSignOut}
                    className="inline-flex items-center text-brown hover:text-brown-dark"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="py-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {notification.show && (
                <div className={`mb-6 p-4 rounded-lg border ${notification.type === 'success'
                    ? 'bg-green-50 border-green-200 text-green-800'
                    : 'bg-red-50 border-red-200 text-red-800'} animate-fade-in flex justify-between`}>
                  <div className="flex items-center">
                    {notification.type === 'success' ? (
                        <svg className="h-5 w-5 mr-2 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                    ) : (
                        <svg className="h-5 w-5 mr-2 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    )}
                    {notification.message}
                  </div>
                  <button
                      onClick={() => setNotification({ ...notification, show: false })}
                      className="text-gray-500 hover:text-gray-700"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
            )}

            <div className="mb-6 border-b border-gray-200">
              <nav className="flex -mb-px">
                <button
                    onClick={() => setActiveTab('dashboard')}
                    className={`mr-8 py-4 px-1 text-sm font-medium ${activeTab === 'dashboard'
                        ? 'border-b-2 border-brown text-brown'
                        : 'border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                >
                  Dashboard
                </button>
                <button
                    onClick={() => setActiveTab('resumes')}
                    className={`mr-8 py-4 px-1 text-sm font-medium ${activeTab === 'resumes'
                        ? 'border-b-2 border-brown text-brown'
                        : 'border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                >
                  My Resumes
                </button>
                <button
                    onClick={() => setActiveTab('jobs')}
                    className={`mr-8 py-4 px-1 text-sm font-medium ${activeTab === 'jobs'
                        ? 'border-b-2 border-brown text-brown'
                        : 'border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                >
                  Job Matches
                </button>
              </nav>
            </div>

            {activeTab === 'dashboard' && (
                <div className="mb-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-brown-light">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-500">Total Resumes</p>
                          <p className="text-3xl font-bold text-brown">{dashboardStats.resumeCount}</p>
                        </div>
                        <div className="p-3 bg-brown-light/20 rounded-full">
                          <FileText className="h-6 w-6 text-brown" />
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-gray-500">
                        {dashboardStats.analyzedCount} analyzed ({Math.round((dashboardStats.analyzedCount / dashboardStats.resumeCount) * 100) || 0}%)
                      </p>
                    </div>

                    <div className="bg-white p-6 rounded-lg shadow-sm border border-brown-light">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-500">Average Score</p>
                          <p className="text-3xl font-bold text-brown">{dashboardStats.averageScore}/100</p>
                        </div>
                        <div className="p-3 bg-brown-light/20 rounded-full">
                          <Award className="h-6 w-6 text-brown" />
                        </div>
                      </div>
                      <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
                        <div className="bg-brown h-1.5 rounded-full" style={{ width: `${dashboardStats.averageScore}%` }}></div>
                      </div>
                    </div>

                    <div className="bg-white p-6 rounded-lg shadow-sm border border-brown-light">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-500">Top Skills</p>
                          <p className="text-3xl font-bold text-brown">{dashboardStats.topSkills.length}</p>
                        </div>
                        <div className="p-3 bg-brown-light/20 rounded-full">
                          <Clipboard className="h-6 w-6 text-brown" />
                        </div>
                      </div>
                      <div className="mt-2">
                        {dashboardStats.topSkills.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {dashboardStats.topSkills.slice(0, 3).map((skill, index) => (
                                  <span key={index} className="text-xs bg-brown-light/20 text-brown-dark px-2 py-0.5 rounded-full">
                            {skill.skill}
                          </span>
                              ))}
                            </div>
                        ) : (
                            <p className="text-xs text-gray-500">No skills analyzed yet</p>
                        )}
                      </div>
                    </div>

                    <div className="bg-white p-6 rounded-lg shadow-sm border border-brown-light">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-500">Job Matches</p>
                          <p className="text-3xl font-bold text-brown">{dashboardStats.matchedJobs}</p>
                        </div>
                        <div className="p-3 bg-brown-light/20 rounded-full">
                          <Briefcase className="h-6 w-6 text-brown" />
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-gray-500">
                        Based on your skills and experience
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end mb-6">
                    <button
                        onClick={refreshDashboard}
                        className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-brown hover:bg-brown-dark"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Refresh Dashboard
                    </button>
                  </div>

                  <JobMatchesSection />

                  <JobRecommendationsSection />

                  <div className="bg-white p-6 rounded-lg shadow-sm border border-brown-light mb-8">
                    <h3 className="text-lg font-semibold text-brown mb-4">Recent Resumes</h3>
                    {resumes.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="min-w-full">
                            <thead>
                            <tr className="border-b">
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ATS</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Uploaded</th>
                              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                            </thead>
                            <tbody>
                            {resumes.slice(0, 5).map((resume) => (
                                <tr key={resume.id} className="border-b hover:bg-gray-50">
                                  <td className="px-4 py-3 whitespace-nowrap">
                                    <div className="flex items-center">
                                      <div className="h-8 w-8 flex-shrink-0 mr-3">
                                        {resume.file_type === 'pdf' ? (
                                            <div className="h-8 w-8 bg-red-100 rounded-lg flex items-center justify-center">
                                              <span className="text-xs font-medium text-red-800">PDF</span>
                                            </div>
                                        ) : (
                                            <div className="h-8 w-8 bg-blue-100 rounded-lg flex items-center justify-center">
                                              <span className="text-xs font-medium text-blue-800">DOC</span>
                                            </div>
                                        )}
                                      </div>
                                      <div>
                                        <div className="text-sm font-medium text-gray-900">{resume.title}</div>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap">
                                    {getStatusBadge(resume.status)}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap">
                                    {resume.hasAnalysis ? (
                                        <span className="text-sm font-medium">{resume.overallScore}/100</span>
                                    ) : (
                                        <span className="text-xs text-gray-500">N/A</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap">
                                    {resume.hasAnalysis ? (
                                        <span className={`text-sm font-medium ${resume.atsScore >= 80 ? 'text-green-600' :
                                            resume.atsScore >= 60 ? 'text-yellow-600' :
                                                'text-red-600'
                                        }`}>
                                  {resume.atsScore}%
                                </span>
                                    ) : (
                                        <span className="text-xs text-gray-500">N/A</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                    {formatRelativeTime(resume.created_at)}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                                    <div className="flex justify-end space-x-2">
                                      <Link
                                          href={`/resume/${resume.id}`}
                                          className="text-brown hover:text-brown-dark"
                                      >
                                        View
                                      </Link>
                                      {resume.hasAnalysis && (
                                          <Link
                                              href={`/resume/${resume.id}/analysis`}
                                              className="text-brown hover:text-brown-dark"
                                          >
                                            Analysis
                                          </Link>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                            ))}
                            </tbody>
                          </table>
                        </div>
                    ) : (
                        <div className="text-center py-6">
                          <p className="text-gray-500">No resumes yet. Upload your first resume to get started.</p>
                          <Link
                              href="/upload"
                              className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-brown hover:bg-brown-dark"
                          >
                            Upload Resume
                          </Link>
                        </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-brown-light">
                      <h3 className="text-lg font-semibold text-brown mb-4">Top Skills</h3>
                      {dashboardStats.topSkills.length > 0 ? (
                          <div className="space-y-4">
                            {dashboardStats.topSkills.map((skill, index) => (
                                <div key={index}>
                                  <div className="flex justify-between mb-1">
                                    <span className="text-sm font-medium text-gray-700">{skill.skill}</span>
                                    <span className="text-sm text-gray-500">{skill.count} {skill.count === 1 ? 'resume' : 'resumes'}</span>
                                  </div>
                                  <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div
                                        className="bg-brown rounded-full h-2"
                                        style={{ width: `${(skill.count / dashboardStats.resumeCount) * 100}%` }}
                                    ></div>
                                  </div>
                                </div>
                            ))}
                          </div>
                      ) : (
                          <div className="text-center py-8">
                            <p className="text-gray-500">No skills data available</p>
                          </div>
                      )}
                    </div>

                    <div className="bg-white p-6 rounded-lg shadow-sm border border-brown-light">
                      <h3 className="text-lg font-semibold text-brown mb-4">ATS Compatibility Tips</h3>
                      <div className="space-y-4">
                        <div className="flex items-start">
                          <div className="flex-shrink-0 mt-0.5">
                            <svg className="h-5 w-5 text-brown" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div className="ml-3">
                            <h4 className="text-sm font-medium text-brown">Use Standard Formatting</h4>
                            <p className="text-sm text-gray-600">Simple layouts with clear section headings work best for ATS systems.</p>
                          </div>
                        </div>
                        <div className="flex items-start">
                          <div className="flex-shrink-0 mt-0.5">
                            <svg className="h-5 w-5 text-brown" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div className="ml-3">
                            <h4 className="text-sm font-medium text-brown">Include Keywords</h4>
                            <p className="text-sm text-gray-600">Incorporate relevant keywords from the job description to improve parsing.</p>
                          </div>
                        </div>
                        <div className="flex items-start">
                          <div className="flex-shrink-0 mt-0.5">
                            <svg className="h-5 w-5 text-brown" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div className="ml-3">
                            <h4 className="text-sm font-medium text-brown">Avoid Tables and Graphics</h4>
                            <p className="text-sm text-gray-600">These elements can confuse ATS systems and cause parsing errors.</p>
                          </div>
                        </div>
                        <div className="flex items-start">
                          <div className="flex-shrink-0 mt-0.5">
                            <svg className="h-5 w-5 text-brown" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div className="ml-3">
                            <h4 className="text-sm font-medium text-brown">Use Standard Section Names</h4>
                            <p className="text-sm text-gray-600">Experience, Education, Skills - don't get creative with section titles.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
            )}

            {activeTab === 'resumes' && (
                <>
                  <div className="mb-8">
                    <h2 className="text-2xl font-bold text-brown">My Resumes</h2>
                    <p className="mt-1 text-sm text-brown-light">
                      Manage your uploaded resumes and view their analysis
                    </p>

                    <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="relative">
                        <input
                            type="text"
                            placeholder="Search resumes..."
                            className="w-full px-4 py-2 border border-brown-light rounded-lg focus:outline-none focus:ring-2 focus:ring-brown"
                            value={searchQuery}
                            onChange={handleSearchChange}
                        />
                        <Search className="absolute right-3 top-2.5 h-5 w-5 text-brown-light" />
                      </div>

                      <div className="flex gap-4 items-center">
                        <select
                            className="px-4 py-2 border border-brown-light rounded-lg focus:outline-none focus:ring-2 focus:ring-brown"
                            value={sortOption}
                            onChange={handleSortChange}
                        >
                          <option value="newest">Newest First</option>
                          <option value="oldest">Oldest First</option>
                          <option value="name_asc">Name (A-Z)</option>
                          <option value="name_desc">Name (Z-A)</option>
                          <option value="status">By Status</option>
                          <option value="score">By Score</option>
                        </select>

                        <label className="flex items-center space-x-2 text-sm text-brown">
                          <input
                              type="checkbox"
                              checked={showOnlyCriticalErrors}
                              onChange={(e) => setShowOnlyCriticalErrors(e.target.checked)}
                              className="form-checkbox h-4 w-4 text-brown focus:ring-brown"
                          />
                          <span>Show only critical errors</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {error && (
                      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
                        Error: {error}
                        <button
                            onClick={refreshDashboard}
                            className="ml-2 underline"
                        >
                          Try Again
                        </button>
                      </div>
                  )}

                  {filteredResumes.length === 0 ? (
                      <div className="bg-white rounded-lg shadow-sm border border-brown-light p-8 text-center">
                        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-cream">
                          <FileText className="h-8 w-8 text-brown" />
                        </div>
                        <h3 className="mt-5 text-lg font-medium text-brown">No resumes found</h3>
                        <p className="mt-2 text-brown-light max-w-md mx-auto">
                          {searchQuery ? 'No results match your search' : 'Get started by uploading your first resume'}
                        </p>
                        <div className="mt-6">
                          <Link
                              href="/upload"
                              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-brown hover:bg-brown-dark"
                          >
                            Upload Resume
                          </Link>
                        </div>
                      </div>
                  ) : (
                      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {filteredResumes.map(resume => (
                            <div
                                key={resume.id}
                                className="bg-white rounded-lg shadow-sm overflow-hidden border border-brown-light transition-all hover:shadow-md"
                            >
                              <div className="px-6 py-5 border-b border-brown-light">
                                <div className="flex justify-between items-start">
                                  <div className="truncate">
                                    <h3 className="text-lg font-semibold text-brown truncate" title={resume.title}>
                                      {resume.title}
                                    </h3>
                                    <p className="text-sm text-brown-light mt-1">
                                      Updated {formatRelativeTime(resume.lastUpdated)}
                                    </p>
                                  </div>
                                  {getStatusBadge(resume.status)}
                                </div>
                                {resume.hasAnalysis && (
                                    <div className="mt-2 flex space-x-4 text-sm">
                                      <div className="flex items-center">
                                        <span className="mr-1 text-gray-600">Score:</span>
                                        <span className="font-medium">{resume.overallScore}/100</span>
                                      </div>
                                      <div className="flex items-center">
                                        <span className="mr-1 text-gray-600">ATS:</span>
                                        <span className={`font-medium ${resume.atsScore >= 80 ? 'text-green-600' :
                                            resume.atsScore >= 60 ? 'text-yellow-600' :
                                                'text-red-600'
                                        }`}>
                                {resume.atsScore}%
                              </span>
                                      </div>
                                    </div>
                                )}
                                {resume.hasAnalysis && resume.resume_analysis && resume.resume_analysis.length > 0 && (
                                    <div className="mt-2">
                                      <div className="flex flex-wrap gap-1">
                                        {[
                                          ...(resume.resume_analysis[0].analysis_json?.skills?.technical || []).slice(0, 3),
                                          ...(resume.resume_analysis[0].analysis_json?.skills?.soft || []).slice(0, 2)
                                        ].map((skill, idx) => (
                                            <span key={idx} className="text-xs bg-brown-light/20 text-brown-dark px-2 py-0.5 rounded-full">
                                              {skill}
                                            </span>
                                        ))}
                                      </div>
                                    </div>
                                )}
                              </div>

                              <div className="px-6 py-4 bg-cream-light">
                                <ResumeProcessingStatus
                                    resumeId={resume.id}
                                    status={resume.status}
                                    processingError={resume.processing_error}
                                    onStatusChange={(newStatus) => handleStatusChange(resume.id, newStatus)}
                                />

                                <div className="mt-4 flex justify-between items-center">
                                  <div className="flex items-center">
                                    {resume.file_type === 'pdf' ? (
                                        <svg className="h-5 w-5 text-brown" fill="currentColor" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512">
                                          <path d="M181.9 256.1c-5-16-4.9-46.9-2-46.9 8.4 0 7.6 36.9 2 46.9zm-1.7 47.2c-7.7 20.2-17.3 43.3-28.4 62.7 18.3-7 39-17.2 62.9-21.9-12.7-9.6-24.9-23.4-34.5-40.8zM86.1 428.1c0 .8 13.2-5.4 34.9-40.2-6.7 6.3-29.1 24.5-34.9 40.2zM248 160h136v328c0 13.3-10.7 24-24 24H24c-13.3 0-24-10.7-24-24V24C0 10.7 10.7 0 24 0h200v136c0 13.2 10.8 24 24 24z" />
                                        </svg>
                                    ) : (
                                        <svg className="h-5 w-5 text-brown" fill="currentColor" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512">
                                          <path d="M224 136V0H24C10.7 0 0 10.7 0 24v464c0 13.3 10.7 24 24 24h336c13.3 0 24-10.7 24-24V160H248c-13.2 0-24-10.8-24-24zm57.1 120H305c8.8 0 16 7.2 16 16v48c0 8.8-7.2 16-16 16h-73.1c-8.8 0-16-7.2-16-16v-48c0-8.8 7.2-16 16-16zm-56 296H145.1c-8.8 0-16-7.2-16-16v-48c0-8.8 7.2-16 16-16H233c8.8 0 16 7.2 16 16v48c0 8.8-7.2 16-16 16zm-56-152H89.1c-8.8 0-16-7.2-16-16v-48c0-8.8 7.2-16 16-16H233c8.8 0 16 7.2 16 16v48c0 8.8-7.2 16-16 16zm224-72v48c0 8.8-7.2 16-16 16h-49.1c-8.8 0-16-7.2-16-16v-48c0-8.8 7.2-16 16-16H368c8.8 0 16 7.2 16 16z" />
                                        </svg>
                                    )}
                                    <span className="ml-2 text-xs uppercase font-medium text-brown-light">
                              {resume.file_type?.toUpperCase()}
                            </span>
                                  </div>

                                  <div className="flex space-x-2">
                                    <Link
                                        href={`/resume/${resume.id}`}
                                        className="text-sm text-brown hover:text-brown-dark font-medium inline-flex items-center"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                      </svg>
                                      View
                                    </Link>

                                    {resume.hasAnalysis && (
                                        <Link
                                            href={`/resume/${resume.id}/analysis`}
                                            className="text-sm text-brown hover:text-brown-dark font-medium inline-flex items-center"
                                        >
                                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                          </svg>
                                          Analysis
                                        </Link>
                                    )}

                                    <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openDeleteModal(resume);
                                        }}
                                        className="text-sm text-red-600 hover:text-red-700 font-medium inline-flex items-center"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                      Delete
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                        ))}
                      </div>
                  )}
                </>
            )}

            {activeTab === 'jobs' && (
                <div className="mb-8">
                  <JobMatchesSection />
                  <div className="mt-8">
                    <JobRecommendationsSection />
                  </div>
                </div>
            )}
          </div>
        </main>

        <DeleteConfirmationModal
            isOpen={deleteModal.isOpen}
            onClose={closeDeleteModal}
            onConfirm={handleDeleteResume}
            title={deleteModal.resumeTitle}
            isLoading={deleteLoading}
        />
      </div>
  );
}