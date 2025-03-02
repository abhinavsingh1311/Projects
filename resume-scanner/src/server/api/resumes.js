// src/server/api/resumes.js
const { supabase, supabaseAdmin } = require("../config/database_connection");

async function getResumes(userId) {
    const { data, error } = await supabaseAdmin
        .schema('public')
        .from('resumes')
        .select("*")
        .eq('user_id', userId);

    if (error) throw error;
    return data;
}

module.exports = { getResumes };