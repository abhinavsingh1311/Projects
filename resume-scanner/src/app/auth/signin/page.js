'use client';
import { useState } from 'react';
import { supabase } from '@/server/utils/supabase-client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function SignInPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const router = useRouter();

    const handleSignIn = async (e) => {
        e.preventDefault();

        if (!email || !password) {
            setError('Please enter both email and password');
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const { error } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (error) throw error;

            // Redirect to dashboard on successful sign in
            router.push('/');

        } catch (error) {
            console.error('Error signing in:', error);
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-cream">
            <div className="absolute inset-0 bg-cream-light opacity-40"></div>

            <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md z-10 border border-brown-light">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-2xl font-bold text-brown">Sign in</h1>
                    <button
                        className="text-brown-light hover:text-brown"
                        onClick={() => router.push('/')}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-6">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSignIn} className="space-y-6">
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-text mb-1">
                            Email or phone number
                        </label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-3 rounded-lg border border-brown-light focus:outline-none focus:ring-2 focus:ring-brown focus:border-transparent bg-cream-light"
                            required
                        />
                    </div>

                    <div>
                        <div className="flex justify-between mb-1">
                            <label htmlFor="password" className="block text-sm font-medium text-text">
                                Password
                            </label>
                        </div>
                        <div className="relative">
                            <input
                                id="password"
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-3 rounded-lg border border-brown-light focus:outline-none focus:ring-2 focus:ring-brown focus:border-transparent bg-cream-light"
                                required
                            />
                            <button
                                type="button"
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-brown-light hover:text-brown"
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                {showPassword ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                        <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                                    </svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                                        <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                                    </svg>
                                )}
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="flex items-center">
                            <input
                                id="remember-me"
                                type="checkbox"
                                checked={rememberMe}
                                onChange={(e) => setRememberMe(e.target.checked)}
                                className="h-4 w-4 text-brown focus:ring-brown border-brown-light rounded"
                            />
                            <label htmlFor="remember-me" className="ml-2 block text-sm text-text">
                                Remember me
                            </label>
                        </div>

                        <div className="text-sm">
                            <Link href="/auth/reset-password" className="text-brown hover:text-brown-dark">
                                Need help?
                            </Link>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 px-4 bg-brown hover:bg-brown-dark focus:ring-4 focus:ring-brown-light focus:outline-none text-white font-medium rounded-lg transition duration-200 ease-in-out"
                    >
                        {loading ? (
                            <div className="flex items-center justify-center">
                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Signing in...
                            </div>
                        ) : (
                            "Sign in"
                        )}
                    </button>
                </form>

                <div className="mt-6 text-center text-sm">
                    <p className="text-text-light">
                        Don't have an account?{' '}
                        <Link href="/auth/signup" className="text-brown hover:text-brown-dark font-medium">
                            Sign up
                        </Link>
                    </p>
                </div>

                <div className="mt-4 text-xs text-center text-text-light">
                    This page is protected by Google reCAPTCHA to ensure you're not a bot.{' '}
                    <a href="#" className="text-brown hover:text-brown-dark">
                        Learn more
                    </a>.
                </div>
            </div>
        </div>
    );
}