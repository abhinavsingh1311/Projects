'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/server/utils/supabase-client';
import Link from 'next/link';

export default function Home() {
  const [user, setUser] = useState(null);
  const [resumes, setResumes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchUserAndResumes() {
      try {
        setLoading(true);

        // First check if user is authenticated
        const { data, error: authError } = await supabase.auth.getUser();

        if (authError) {
          console.log("Auth error detected:", authError);
          setUser(null);
          return;
        }

        const currentUser = data?.user;
        setUser(currentUser);

        // If user is authenticated, fetch their resumes
        if (currentUser) {
          const { data: resumesData, error: resumesError } = await supabase
            .from('resumes')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false });

          if (resumesError) throw resumesError;

          setResumes(resumesData || []);
        }
      }
      catch (error) {
        console.error('Error:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    }

    fetchUserAndResumes();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setResumes([]);
  };

  const handleViewResume = async (resume) => {
    try {
      // Use file_path directly if available
      if (!resume.file_path) {
        alert('File path information is missing. Please try uploading the resume again.');
        return;
      }

      console.log('Creating signed URL for:', resume.file_path);

      const { data, error } = await supabase.storage
        .from('resumes')
        .createSignedUrl(resume.file_path, 60 * 60); // 1 hour expiry for testing

      if (error) {
        console.error('Error creating signed URL:', error);
        throw error;
      }

      console.log('Successfully created signed URL');

      // Open the signed URL in a new tab
      window.open(data.signedUrl, '_blank');
    } catch (error) {
      console.error('Error viewing resume:', error);
      alert('Could not view the resume. Please try again later.');
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      uploaded: { color: 'bg-blue-100 text-blue-800 border-blue-200', label: 'Uploaded' },
      parsing: { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', label: 'Processing' },
      analyzed: { color: 'bg-green-100 text-green-800 border-green-200', label: 'Analyzed' },
      failed: { color: 'bg-red-100 text-red-800 border-red-200', label: 'Failed' },
      pending: { color: 'bg-gray-100 text-gray-800 border-gray-200', label: 'Pending' }
    };

    const config = statusConfig[status] || statusConfig.pending;

    return (
      <span className={`${config.color} px-2.5 py-0.5 rounded-full text-xs font-medium border`}>
        {config.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto"></div>
          <p className="mt-3 text-gray-600 dark:text-gray-400">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-cover bg-center" style={{ backgroundImage: 'url(/bg-leaves.jpg)' }}>
        <div className="absolute inset-0 bg-black bg-opacity-60"></div>
        <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Resume Scanner</h1>
            <p className="text-xl text-white/80 max-w-2xl">Upload your resume and get instant analysis and job matches</p>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-xl p-8 md:p-10 w-full max-w-md border border-white/20">
            <h2 className="text-2xl font-semibold text-white mb-6 text-center">Get Started</h2>
            <div className="flex flex-col space-y-4">
              <Link
                href="/auth/signin"
                className="w-full py-3 px-4 bg-white text-gray-900 font-medium rounded-lg hover:bg-white/90 transition duration-200 text-center"
              >
                Sign In
              </Link>
              <Link
                href="/auth/signup"
                className="w-full py-3 px-4 bg-white/10 text-white border border-white/30 font-medium rounded-lg hover:bg-white/20 transition duration-200 text-center"
              >
                Create Account
              </Link>
            </div>

            <div className="mt-8 text-center">
              <p className="text-white/70 text-sm">
                Scan your resume, get personalized job matches, and improve your application success rate
              </p>
            </div>
          </div>

          <div className="mt-16 flex flex-wrap justify-center gap-8 md:gap-16 text-center max-w-4xl">
            <div className="w-full md:w-auto flex-1 min-w-[250px]">
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 h-full border border-white/20">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="text-lg font-semibold text-white mb-2">Resume Analysis</h3>
                <p className="text-white/70 text-sm">Get detailed insights on your resume's strengths and areas for improvement</p>
              </div>
            </div>

            <div className="w-full md:w-auto flex-1 min-w-[250px]">
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 h-full border border-white/20">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <h3 className="text-lg font-semibold text-white mb-2">Job Matching</h3>
                <p className="text-white/70 text-sm">Find jobs that match your skills and experience with our AI-powered algorithm</p>
              </div>
            </div>

            <div className="w-full md:w-auto flex-1 min-w-[250px]">
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 h-full border border-white/20">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <h3 className="text-lg font-semibold text-white mb-2">Smart Suggestions</h3>
                <p className="text-white/70 text-sm">Get personalized suggestions to improve your resume and increase interview chances</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex-shrink-0 flex items-center">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Resume Scanner</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                href="/upload"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Upload Resume
              </Link>

              <div className="relative">
                <button
                  onClick={handleSignOut}
                  className="inline-flex items-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white"
                >
                  <span className="sr-only">Sign out</span>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">My Resumes</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Manage your uploaded resumes and view their analysis
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 dark:bg-red-900/30 dark:border-red-800 dark:text-red-400">
              Error: {error}
              <button
                onClick={() => window.location.reload()}
                className="ml-2 underline"
              >
                Try Again
              </button>
            </div>
          )}

          {resumes.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-8 text-center">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-gray-100 dark:bg-gray-700">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="mt-5 text-lg font-medium text-gray-900 dark:text-white">No resumes found</h3>
              <p className="mt-2 text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                Get started by uploading your resume to receive analysis and job recommendations.
              </p>
              <div className="mt-6">
                <Link
                  href="/upload"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                >
                  Upload Your First Resume
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {resumes.map(resume => (
                <div key={resume.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700 transition-all hover:shadow-md">
                  <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex justify-between items-start">
                      <div className="truncate">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate" title={resume.title}>
                          {resume.title}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          Uploaded on {new Date(resume.created_at).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </p>
                      </div>
                      {getStatusBadge(resume.status)}
                    </div>
                  </div>

                  <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 flex justify-between items-center">
                    <div className="flex items-center">
                      {resume.file_type === 'pdf' ? (
                        <svg className="h-5 w-5 text-red-500" fill="currentColor" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512">
                          <path d="M181.9 256.1c-5-16-4.9-46.9-2-46.9 8.4 0 7.6 36.9 2 46.9zm-1.7 47.2c-7.7 20.2-17.3 43.3-28.4 62.7 18.3-7 39-17.2 62.9-21.9-12.7-9.6-24.9-23.4-34.5-40.8zM86.1 428.1c0 .8 13.2-5.4 34.9-40.2-6.7 6.3-29.1 24.5-34.9 40.2zM248 160h136v328c0 13.3-10.7 24-24 24H24c-13.3 0-24-10.7-24-24V24C0 10.7 10.7 0 24 0h200v136c0 13.2 10.8 24 24 24zm-8 171.8c-20-12.2-33.3-29-42.7-53.8 4.5-18.5 11.6-46.6 6.2-64.2-4.7-29.4-42.4-26.5-47.8-6.8-5 18.3-.4 44.1 8.1 77-11.6 27.6-28.7 64.6-40.8 85.8-.1 0-.1.1-.2.1-27.1 13.9-73.6 44.5-54.5 68 5.6 6.9 16 10 21.5 10 17.9 0 35.7-18 61.1-61.8 25.8-8.5 54.1-19.1 79-23.2 21.7 11.8 47.1 19.5 64 19.5 29.2 0 31.2-32 19.7-43.4-13.9-13.6-54.3-9.7-73.6-7.2zM377 105L279 7c-4.5-4.5-10.6-7-17-7h-6v128h128v-6.1c0-6.3-2.5-12.4-7-16.9zm-74.1 255.3c4.1-2.7-2.5-11.9-42.8-9 37.1 15.8 42.8 9 42.8 9z" />
                        </svg>
                      ) : (
                        <svg className="h-5 w-5 text-blue-500" fill="currentColor" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512">
                          <path d="M224 136V0H24C10.7 0 0 10.7 0 24v464c0 13.3 10.7 24 24 24h336c13.3 0 24-10.7 24-24V160H248c-13.2 0-24-10.8-24-24zm57.1 120H208c-8.8 0-16 7.2-16 16v48c0 8.8 7.2 16 16 16h73.1c8.8 0 16-7.2 16-16v-48c0-8.8-7.2-16-16-16zm-56 304H112c-8.8 0-16-7.2-16-16v-48c0-8.8 7.2-16 16-16h113.1c8.8 0 16 7.2 16 16v48c0 8.8-7.2 16-16 16zm-56-152H112c-8.8 0-16-7.2-16-16v-48c0-8.8 7.2-16 16-16h113.1c8.8 0 16 7.2 16 16v48c0 8.8-7.2 16-16 16zm224-72v48c0 8.8-7.2 16-16 16H368c-8.8 0-16-7.2-16-16v-48c0-8.8 7.2-16 16-16h49.1c8.8 0 16 7.2 16 16z" />
                        </svg>
                      )}
                      <span className="ml-2 text-xs uppercase font-medium text-gray-500 dark:text-gray-400">
                        {resume.file_type?.toUpperCase()}
                      </span>
                    </div>

                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleViewResume(resume)}
                        className="text-sm text-primary hover:text-primary-dark dark:text-primary-light dark:hover:text-primary font-medium inline-flex items-center"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        View
                      </button>

                      {resume.status === 'analyzed' && (
                        <Link
                          href={`/analysis/${resume.id}`}
                          className="text-sm text-primary hover:text-primary-dark dark:text-primary-light dark:hover:text-primary font-medium inline-flex items-center"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                          Analysis
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}