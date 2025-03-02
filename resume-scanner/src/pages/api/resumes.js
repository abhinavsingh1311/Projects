import { getResumes } from "@/server/api/resumes";

export default async function handler(req, res) {
    try {
        const userId = req.query.userId || req.body.userId;
        if (!userId) {
            return res.status(400).json({ error: 'User ID is required' });
        }
        const resumes = await getResumes(userId);
        return res.status(200).json({ resumes });

    }
    catch (error) {
        console.error('Error', error);
        return res.status(500).json({ error: 'Failed to fetch resumes' });

    }

}