'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/server/utils/supabase-client';
import { useRouter } from 'next/navigation';

export default function AuthCallbackPage() {
    const [message, setMessage] = useState('Processing authentication...');
    const router = useRouter();

    useEffect(() => {
        const handleCallback = async () => {
            try {
                // Check if we have a hash fragment from email confirmation
                const hashFragment = window.location.hash;

                if (hashFragment) {
                    setMessage('Confirming your email address...');

                    // The hash contains tokens that Supabase will process automatically
                    const { error } = await supabase.auth.getSession();

                    if (error) {
                        throw error;
                    }

                    setMessage('Email confirmed successfully! Redirecting to dashboard...');
                    setTimeout(() => router.push('/'), 2000);
                } else {
                    // Check if the user is already signed in
                    const { data } = await supabase.auth.getSession();

                    if (data.session) {
                        setMessage('You are already signed in. Redirecting to dashboard...');
                        setTimeout(() => router.push('/'), 2000);
                    } else {
                        setMessage('Authentication error. Redirecting to sign in page...');
                        setTimeout(() => router.push('/auth/signin'), 2000);
                    }
                }
            } catch (error) {
                console.error('Error processing authentication:', error);
                setMessage(`Authentication error: ${error.message}. Redirecting to sign in page...`);
                setTimeout(() => router.push('/auth/signin'), 3000);
            }
        };

        handleCallback();
    }, [router]);

    return (
        <div className="container mx-auto p-4 flex justify-center items-center min-h-screen">
            <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
                <h1 className="text-xl font-semibold mb-2">Authentication</h1>
                <p>{message}</p>
            </div>
        </div>
    );
}