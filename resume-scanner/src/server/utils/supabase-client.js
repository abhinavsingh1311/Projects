// src/server/utils/supabase-client.js
import { createClient } from '@supabase/supabase-js';

// Use NEXT_PUBLIC_ prefix for client-side environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables. Make sure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_KEY are set in .env.local file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);