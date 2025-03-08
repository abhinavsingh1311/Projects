// src/pages/api/resumes/[id]/parsed-data.js

import { supabaseAdmin } from '@/server/config/database_connection';

export default async function handler(req, res) {
    // Allow CORS for development
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { id } = req.query;

        if (!id) {
            return res.status(400).json({ error: 'Resume ID is required' });
        }

        // First, check if the resume exists
        const { data: resume, error: resumeError } = await supabaseAdmin
            .from('resumes')
            .select('id, status')
            .eq('id', id)
            .single();

        if (resumeError) {
            return res.status(404).json({ error: 'Resume not found' });
        }

        // Get the parsed data
        const { data: parsedData, error: dataError } = await supabaseAdmin
            .from('resume_parsed_data')
            .select('*')
            .eq('resume_id', id)
            .single();

        if (dataError) {
            if (dataError.code === 'PGRST116') { // Resource not found
                return res.status(404).json({
                    error: 'Parsed data not found',
                    resumeStatus: resume.status
                });
            }
            return res.status(500).json({ error: 'Error retrieving parsed data' });
        }

        return res.status(200).json({
            success: true,
            resumeId: id,
            resumeStatus: resume.status,
            parsedData: parsedData.parsed_data,
            rawText: parsedData.raw_text,
            processedAt: parsedData.processed_at
        });
    } catch (error) {
        console.error('API error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}