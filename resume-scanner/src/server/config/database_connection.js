// src/server/config/database_connection.js
const { createClient } = require('@supabase/supabase-js');

// For server-side, regular env vars are fine
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase env variables');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server side
const supabaseAdmin = supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey)
    : null;

// Helper function to check if admin access is available
function hasAdminAccess() {
    return !!supabaseAdmin;
}

module.exports = {
    supabase,
    supabaseAdmin,
    hasAdminAccess
};