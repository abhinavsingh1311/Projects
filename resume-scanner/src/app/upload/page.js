'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/server/utils/supabase-client';
import ResumeUpload from '@/components/ResumeUpload';
import Link from 'next/link';

export default function UploadPage() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check if user is authenticated
        const getUser = async () => {
            try {
                const { data, error } = await supabase.auth.getUser();
                if (error) {
                    console.error('Auth error:', error);
                } else {
                    setUser(data.user);
                }
            } catch (error) {
                console.error('Error checking authentication:', error);
            } finally {
                setLoading(false);
            }
        };

        getUser();
    }, []);

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
                <h1 className="text-2xl font-bold mb-4">Sign In Required</h1>
                <p className="mb-4">You need to sign in to upload resumes.</p>
                <button
                    onClick={() => window.location.href = '/api/auth/signin'}
                    className="bg-primary text-white px-4 py-2 rounded hover:bg-primary-dark"
                >
                    Sign In
                </button>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4">
            <div className="mb-8">
                <Link href="/" className="text-primary hover:underline inline-flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                    </svg>
                    Back to My Resumes
                </Link>
            </div>

            <div className="text-center mb-8">
                <h1 className="text-2xl font-bold">Upload Your Resume</h1>
                <p className="text-gray-600 mt-2">
                    Upload your resume to get detailed analysis and job recommendations
                </p>
            </div>

            <ResumeUpload />

            <div className="mt-8 bg-blue-50 rounded-lg p-4 max-w-md mx-auto">
                <h3 className="font-medium text-blue-800 mb-2">Supported File Types</h3>
                <ul className="list-disc list-inside text-sm text-blue-700 space-y-1">
                    <li>PDF documents (.pdf)</li>
                    <li>Microsoft Word documents (.doc, .docx)</li>
                </ul>
            </div>
        </div>
    );
}