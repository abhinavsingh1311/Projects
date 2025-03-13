// pages/api/resumes/[id]/status.js
import { supabaseAdmin } from "@/server/config/database_connection";

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { id } = req.query;

        // Validate required parameters
        if (!id) {
            return res.status(400).json({ error: 'Resume ID is required' });
        }

        // Authentication
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const token = authHeader.split(' ')[1];
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

        if (authError || !user) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        // Get resume status with ownership check
        const { data: resume, error: dbError } = await supabaseAdmin
            .from('resumes')
            .select(`
                status,
                processing_error,
                created_at,
                last_processed_at,
                user_id
            `)
            .eq('id', id)
            .eq('user_id', user.id)
            .single();

        if (dbError) {
            const statusCode = dbError.code === 'PGRST116' ? 404 : 500;
            return res.status(statusCode).json({
                error: dbError.code === 'PGRST116'
                    ? 'Resume not found'
                    : 'Database error',
                code: dbError.code
            });
        }


        return res.status(200).json({
            status: resume.status,
            error: resume.processing_error,
            progressPercentage: calculateProgress(resume.status),
            createdAt: resume.created_at,
            processedAt: resume.last_processed_at
        });

    } catch (error) {
        console.error('Status check error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
}

// Enhanced progress calculation
function calculateProgress(status) {
    const progressMap = {
        uploaded: 10,
        parsing: 40,
        parsed: 70,
        analyzing: 85,
        analyzed: 95,
        completed: 100,
        failed: 0
    };
    return progressMap[status] || 25;
}