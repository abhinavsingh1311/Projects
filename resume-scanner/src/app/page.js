// src/app/page.js
'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/server/utils/supabase-client';
import Login from '@/component/login';
import Link from 'next/link';

export default function Home() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [resumes, setResumes] = useState([]);

  useEffect(() => {
    async function getUser() {
      try {
        // Get current user
        const { data, error } = await supabase.auth.getUser();

        if (!error && data.user) {
          setUser(data.user);

          // Fetch resumes if user is authenticated
          const { data: resumeData } = await supabase
            .from('resumes')
            .select('*')
            .eq('user_id', data.user.id)
            .order('created_at', { ascending: false });

          setResumes(resumeData || []);
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    }

    getUser();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setResumes([]);
  };

  if (loading) {
    return <div className="p-4 text-center">Loading...</div>;
  }

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto p-4">
        <h1 className="text-3xl font-bold text-center mb-8">Resume Scanner</h1>
        <Login />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">My Resumes</h1>
        <div className="flex gap-4">
          <Link
            href="/upload"
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Upload Resume
          </Link>
          <button
            onClick={handleSignOut}
            className="bg-gray-200 px-4 py-2 rounded hover:bg-gray-300"
          >
            Sign Out
          </button>
        </div>
      </div>

      {resumes.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <p className="mb-4">No resumes found. Upload your first resume to get started.</p>
          <Link
            href="/upload"
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Upload Resume
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {resumes.map(resume => (
            <div key={resume.id} className="border rounded p-4 shadow-sm">
              <h3 className="font-medium text-lg">{resume.title}</h3>
              <p className="text-sm text-gray-500 mb-3">
                Uploaded: {new Date(resume.created_at).toLocaleDateString()}
              </p>
              <div className="flex justify-between items-center">
                <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
                  {resume.status}
                </span>
                <a
                  href={resume.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline"
                >
                  View Resume
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}