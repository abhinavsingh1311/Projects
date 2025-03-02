import { useState, useEffect } from 'react';
import { supabase } from '@/server/utils/supabase-client';

export function userResumes() {
    const [resumes, setResumes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        async function fetchResumes() {
            try {
                setLoading(true);

                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    throw new Error('User not authenticated');
                }

                const { data, error } = await supabase
                    .schema('public')
                    .from('resumes')
                    .select('*')
                    .eq('user_id', user.id);


                if (error) throw error;

                setResumes(data || []);
            }

            catch (error) {
                console.log('Error fetching resumes:', error);
                setError(error.message);
            } finally {
                setLoading(false);
            }
        }
        fetchResumes();
    }, []);

    return { resumes, loading, error };
}