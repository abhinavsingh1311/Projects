// src/server/config/database_connection.js
const { createClient } = require('@supabase/supabase-js');

// Fix typo: "supbaseUrl" -> "supabaseUrl"
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase env variables');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server side
const supabaseAdmin = supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey)
    : null;

module.exports = { supabase, supabaseAdmin };