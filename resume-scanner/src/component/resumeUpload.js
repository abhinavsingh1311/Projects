'use-client';
import { useState } from "react";
import { supabase } from "@/server/utils/supabase-client";

export default function ResumeUpload() {
    const [file, setFile] = useState(null);
    const [title, setTitle] = useState('');
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        const allowedTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];

        if (selectedFile && allowedTypes.includes(selectedFile.type)) {
            setFile(selectedFile);
            if (!title) {
                setTitle(selectedFile.name.split('.')[0]);
            }
            setError(null);
        } else {
            setFile(null);
            setError('Please select a valid file type (PDF, DOC, or DOCX)');
        }
    };

    const getFileType = (file) => {
        const types = {
            'application/pdf': 'pdf',
            'application/msword': 'doc',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx'
        };
        return types[file.type] || 'unknown';
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!file) {
            setError('Please select a file to upload');
            return;
        }

        try {
            setUploading(true);
            setError(null);

            // Get user session
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                throw new Error('User authentication failed');
            }

            console.log("Authenticated user:", user.id);

            // Create a simple file path
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}.${fileExt}`;
            const filePath = `${user.id}/${fileName}`;

            console.log(`Uploading file to path: ${filePath}`);

            // Upload the file
            const { error: uploadError } = await supabase.storage
                .from('resumes')
                .upload(filePath, file, {
                    upsert: true
                });

            if (uploadError) {
                console.error('Upload error details:', uploadError);
                throw uploadError;
            }

            console.log('File uploaded successfully');

            // Save to database with file path only
            const resumeData = {
                title: title || 'Untitled Resume',
                user_id: user.id,
                file_path: filePath,
                file_type: getFileType(file),
                status: 'uploaded',
                created_at: new Date().toISOString()
            };

            console.log('Saving resume data:', resumeData);

            const { error: dbError } = await supabase
                .from('resumes')
                .insert([resumeData]);

            if (dbError) {
                console.error('Database insertion error:', dbError);
                throw dbError;
            }

            console.log('Resume saved successfully');
            setSuccess(true);
            setFile(null);
            setTitle('');

        } catch (error) {
            console.error('Error uploading resume:', error);
            setError(error.message || 'An error occurred during upload');
        } finally {
            setUploading(false);
        }
    };

    if (success) {
        return (
            <div className='max-w-md mx-auto p-6 bg-white rounded-lg shadow-md dark:bg-gray-800'>
                <div className='text-center'>
                    <svg className="w-16 h-16 mx-auto text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="https://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13L9 17L19 7"></path>
                    </svg>
                    <h2 className="text-xl font-semibold mb-2 mt-4">Resume Uploaded Successfully!</h2>
                    <p className="mb-4">Your resume has been uploaded and will be analyzed shortly</p>
                    <button
                        onClick={() => {
                            setSuccess(false);
                            window.location.href = '/';
                        }}
                        className="bg-primary text-white px-4 py-2 rounded hover:bg-primary-dark"
                    >
                        View My Resumes
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md dark:bg-gray-800">
            <h2 className="text-xl font-semibold mb-4">Upload Your Resume</h2>

            {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="title" className="block text-sm font-medium">
                        Resume Title
                    </label>
                    <input
                        type="text"
                        id="title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="mt-1 block w-full px-3 py-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                        placeholder="e.g., Software Engineer Resume"
                    />
                </div>

                <div>
                    <label htmlFor="resume" className="block text-sm font-medium">
                        Resume File (PDF, DOC, DOCX)
                    </label>
                    <input
                        type="file"
                        id="resume"
                        onChange={handleFileChange}
                        className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary-dark"
                        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    />
                    {file && (
                        <p className="mt-2 text-sm text-gray-500">
                            Selected file: {file.name} ({Math.round(file.size / 1024)} KB)
                        </p>
                    )}
                </div>

                <button
                    type="submit"
                    disabled={uploading}
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
                >
                    {uploading ? 'Uploading...' : 'Upload Resume'}
                </button>
            </form>
        </div>
    )
}