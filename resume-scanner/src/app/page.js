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
        const { data, error: authError } = await supabase.auth.getUser()
          .catch(err => {
            console.log("Auth error caught:", err);
            return { data: { user: null }, error: null };
          });

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

  const getStatusBadge = (status) => {
    const statusConfig = {
      uploaded: { color: 'bg-blue-100 text-blue-800', label: 'Uploaded' },
      parsing: { color: 'bg-yellow-100 text-yellow-800', label: 'Processing' },
      analyzed: { color: 'bg-green-100 text-green-800', label: 'Analyzed' },
      failed: { color: 'bg-red-100 text-red-800', label: 'Failed' },
      pending: { color: 'bg-gray-100 text-gray-800', label: 'Pending' }
    };

    const config = statusConfig[status] || statusConfig.pending;

    return (
      <span className={`${config.color} px-2 py-1 rounded-full text-xs font-medium`}>
        {config.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4 flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto"></div>
          <p className="mt-3">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto p-4 text-center">
        <h1 className="text-3xl font-bold mb-6">Resume Scanner</h1>
        <div className="max-w-md mx-auto bg-white p-8 rounded-lg shadow-md">
          <p className="mb-6">Upload and analyze your resume to find matching job opportunities</p>
          <div className="flex flex-col space-y-4 sm:flex-row sm:space-y-0 sm:space-x-4 justify-center">
            <Link
              href="/auth/signin"
              className="bg-primary text-white px-6 py-2 rounded-md hover:bg-primary-dark transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/auth/signup"
              className="bg-white text-primary border border-primary px-6 py-2 rounded-md hover:bg-gray-50 transition-colors"
            >
              Sign Up
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-4">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          Error: {error}
        </div>
        <button
          onClick={() => window.location.reload()}
          className="bg-primary text-white px-4 py-2 rounded hover:bg-primary-dark"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">My Resumes</h1>
        <div className="flex items-center space-x-4">
          <Link
            href="/upload"
            className="bg-primary text-white px-4 py-2 rounded hover:bg-primary-dark transition-colors"
          >
            Upload New Resume
          </Link>
          <button
            onClick={handleSignOut}
            className="text-gray-600 hover:text-gray-900"
          >
            Sign Out
          </button>
        </div>
      </div>

      {resumes.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="mb-4 text-lg">No resumes found. Upload your resume to get started!</p>
          <Link
            href="/upload"
            className="bg-primary text-white px-4 py-2 rounded hover:bg-primary-dark inline-block"
          >
            Upload Resume
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {resumes.map(resume => (
            <div key={resume.id} className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="p-5 border-b">
                <div className="flex justify-between items-start">
                  <h3 className="font-semibold text-lg truncate" title={resume.title}>
                    {resume.title}
                  </h3>
                  {getStatusBadge(resume.status)}
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Uploaded: {new Date(resume.created_at).toLocaleDateString()}
                </p>
              </div>

              <div className="p-4 bg-gray-50">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-xs uppercase text-gray-500">File Type:</span>
                    <span className="ml-2 text-sm">{resume.file_type?.toUpperCase()}</span>
                  </div>

                  <div className="flex space-x-2">
                    <a
                      href={resume.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline text-sm"
                    >
                      View
                    </a>

                    {resume.status === 'analyzed' && (
                      <Link
                        href={`/analysis/${resume.id}`}
                        className="text-primary hover:underline text-sm"
                      >
                        Analysis
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}