// src/components/resume/ResumeProcessingStatus.js
'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ResumeProcessingStatus({ resumeId, initialStatus, onStatusChange }) {
    const [status, setStatus] = useState(initialStatus || 'loading');
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState(null);
    const [timeRemaining, setTimeRemaining] = useState(null);
    const [checkCount, setCheckCount] = useState(0);
    const router = useRouter();
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true); // Track mount state
        return () => setIsMounted(false);
    }, []);

    useEffect(() => {
        if (!isMounted || !resumeId) return;

        const interval = setInterval(async () => {
            try {
                const response = await fetch(`/api/resumes/${resumeId}/status`);
                const data = await response.json();
                if (!isMounted) return;

                // Handle status updates
            } catch (error) {
                console.error('Status check failed:', error);
                if (isMounted) setStatus('error');
            }
        }, 2000);

        return () => clearInterval(interval);
    }, [isMounted, resumeId]);

    // // Status checking with exponential backoff
    // useEffect(() => {
    //     if (!resumeId) return;
    //
    //     // Don't poll if we're in a final state
    //     const finalStates = ['parsed', 'analyzed', 'completed', 'failed'];
    //     if (finalStates.includes(status)) {
    //         if (onStatusChange) onStatusChange(status);
    //         return;
    //     }
    //
    //     let intervalId;
    //     let timeout;
    //
    //     const checkStatus = async () => {
    //         try {
    //             const response = await fetch(`/api/resumes/${resumeId}/status`);
    //
    //             if (!response.ok) {
    //                 const errorData = await response.json();
    //                 setError(errorData.error || 'Error checking status');
    //                 return;
    //             }
    //
    //             const data = await response.json();
    //
    //             // Update state with new information
    //             setStatus(data.status);
    //             if (data.progressPercentage) setProgress(data.progressPercentage);
    //             if (data.estimatedTimeRemaining) setTimeRemaining(data.estimatedTimeRemaining);
    //
    //             // Call the callback if provided
    //             if (onStatusChange) onStatusChange(data.status);
    //
    //             // If we've reached a final state, clear the interval
    //             if (finalStates.includes(data.status)) {
    //                 clearInterval(intervalId);
    //
    //                 // Special case for failure
    //                 if (data.status === 'failed') {
    //                     setError(data.error || 'Processing failed');
    //                 }
    //             }
    //
    //             // Increment check count for backoff calculation
    //             setCheckCount(prev => prev + 1);
    //
    //         } catch (error) {
    //             console.error('Error checking resume status:', error);
    //             setError('Failed to check processing status');
    //         }
    //     };
    //
    //     // Initial check
    //     checkStatus();
    //
    //     // Calculate polling interval with exponential backoff
    //     // Start with 2s, then increase, but cap at 10s
    //     const getPollingInterval = () => {
    //         const baseInterval = 2000; // 2 seconds
    //         const maxInterval = 10000; // 10 seconds
    //         const calculatedInterval = Math.min(baseInterval * Math.pow(1.5, checkCount), maxInterval);
    //         return calculatedInterval;
    //     };
    //
    //     // Set up polling with dynamic interval
    //     const setupNextPoll = () => {
    //         const interval = getPollingInterval();
    //         timeout = setTimeout(() => {
    //             checkStatus();
    //             setupNextPoll();
    //         }, interval);
    //     };
    //
    //     setupNextPoll();
    //
    //     // Cleanup
    //     return () => {
    //         if (timeout) clearTimeout(timeout);
    //     };
    // }, [resumeId, status, checkCount, onStatusChange]);

    // Render appropriate UI based on status
    const renderStatusUI = () => {
        switch (status) {
            case 'loading':
                return (
                    <div className="flex items-center justify-center p-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                        <span className="ml-2 text-sm text-gray-600">Checking status...</span>
                    </div>
                );

            case 'uploaded':
                return (
                    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div className="ml-3">
                                <h3 className="text-sm font-medium text-yellow-800">Resume needs processing</h3>
                                <div className="mt-2 text-sm text-yellow-700">
                                    <p>Your resume is uploaded but has not been processed yet.</p>
                                </div>
                                <div className="mt-3">
                                    <button
                                        onClick={() => {
                                            fetch('/api/process-resume', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ resumeId, force: true })
                                            });
                                            setStatus('parsing');
                                            setProgress(0);
                                        }}
                                        className="bg-yellow-400 px-3 py-1 rounded-md text-xs font-medium text-yellow-900 hover:bg-yellow-500"
                                    >
                                        Process Now
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 'parsing':
            case 'analyzing':
                return (
                    // src/components/resume/ResumeProcessingStatus.js (continued)
                    <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            </div>
                            <div className="ml-3">
                                <h3 className="text-sm font-medium text-blue-800">
                                    {status === 'parsing' ? 'Processing resume...' : 'Analyzing resume...'}
                                </h3>
                                <div className="mt-2">
                                    <div className="flex items-center">
                                        <div className="w-full bg-blue-200 rounded-full h-2">
                                            <div
                                                className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                                                style={{ width: `${progress}%` }}
                                            ></div>
                                        </div>
                                        <span className="ml-2 text-xs text-blue-800">{progress}%</span>
                                    </div>
                                    {timeRemaining && (
                                        <p className="text-xs text-blue-700 mt-1">
                                            Estimated time remaining: {timeRemaining > 60
                                                ? `${Math.floor(timeRemaining / 60)} min ${timeRemaining % 60} sec`
                                                : `${timeRemaining} seconds`}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 'parsed':
            case 'analyzed':
            case 'completed':
                return (
                    <div className="bg-green-50 border-l-4 border-green-400 p-4">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <svg className="h-5 w-5 text-green-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div className="ml-3">
                                <h3 className="text-sm font-medium text-green-800">Processing complete</h3>
                                <div className="mt-2 text-sm text-green-700">
                                    <p>{status === 'parsed'
                                        ? 'Your resume has been processed successfully.'
                                        : 'Your resume has been analyzed and is ready to view.'}</p>
                                </div>
                                {status === 'parsed' && (
                                    <div className="mt-3">
                                        <button
                                            onClick={() => {
                                                fetch(`/api/resumes/${resumeId}/analyze`, {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' }
                                                });
                                                setStatus('analyzing');
                                                setProgress(0);
                                            }}
                                            className="bg-green-700 text-white px-3 py-1 rounded-md text-xs font-medium hover:bg-green-800"
                                        >
                                            Analyze Now
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );

            case 'failed':
                return (
                    <div className="bg-red-50 border-l-4 border-red-400 p-4">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <svg className="h-5 w-5 text-red-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div className="ml-3">
                                <h3 className="text-sm font-medium text-red-800">Processing failed</h3>
                                <div className="mt-2 text-sm text-red-700">
                                    <p>{error || 'There was an error processing your resume.'}</p>
                                </div>
                                <div className="mt-3">
                                    <button
                                        onClick={() => {
                                            fetch('/api/process-resume', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ resumeId, force: true })
                                            });
                                            setStatus('parsing');
                                            setProgress(0);
                                            setError(null);
                                        }}
                                        className="bg-red-700 text-white px-3 py-1 rounded-md text-xs font-medium hover:bg-red-800"
                                    >
                                        Try Again
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                );

            default:
                return (
                    <div className="bg-gray-50 border-l-4 border-gray-400 p-4">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <svg className="h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div className="ml-3">
                                <h3 className="text-sm font-medium text-gray-800">Unknown status</h3>
                                <div className="mt-2 text-sm text-gray-700">
                                    <p>The current status of your resume is unknown: {status}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className="resume-processing-status">
            {renderStatusUI()}
        </div>
    );
}