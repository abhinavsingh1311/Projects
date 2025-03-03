import { useState } from "react";
import { supabase } from "@/server/utils/supabase-client";

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw new error;

            window.location.reload();

        } catch (error) {
            setMessage(error.message);

        } finally {
            setLoading(false);
        }

    };

    return (
        <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">Sign In</h2>
            {message && (
                <div className="bg-red-100 text-red-700 p-3 rounded mb-4">
                    {message}
                </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
                <div>
                    <label className="block mb-1">Email</label>
                    <input
                        type='email'
                        value={email}
                        onchange={(e) => setEmail(e.target.value)}
                        className="w-full px-3 py-2 border rounded"
                        required
                    />

                </div>
                <div>
                    <label className="block mb-1">Password</label>
                    <input
                        type='password'
                        value={password}
                        onchange={(e) => setPassword(e.target.value)}
                        className="w-full px-3 py-2 border rounded"
                        required
                    />

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 disabled:opacity-50"
                    >
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>


                </div>
            </form>
        </div>
    )


}