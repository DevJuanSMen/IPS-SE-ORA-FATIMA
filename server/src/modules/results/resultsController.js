const db = require('../../db');

// List all patients with their result folders (lab dashboard view)
const getPatientFolders = async (req, res) => {
    try {
        const result = await db.query(`
            SELECT p.id, p.full_name, p.phone, p.document_id,
                   COUNT(pr.id) as result_count,
                   MAX(pr.created_at) as last_upload
            FROM patients p
            LEFT JOIN patient_results pr ON p.id = pr.patient_id
            GROUP BY p.id, p.full_name, p.phone, p.document_id
            ORDER BY last_upload DESC NULLS LAST
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Get all results for a patient
const getPatientResults = async (req, res) => {
    const { patient_id } = req.params;
    try {
        const result = await db.query(
            'SELECT id, file_name, mime_type, created_at FROM patient_results WHERE patient_id = $1 ORDER BY created_at DESC',
            [patient_id]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Get a single result (with full base64 data)
const getResultById = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db.query('SELECT * FROM patient_results WHERE id = $1', [id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Result not found' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Upload a result (base64 image)
const uploadResult = async (req, res) => {
    const { patient_id, file_name, file_data, mime_type } = req.body;
    if (!patient_id || !file_name || !file_data) {
        return res.status(400).json({ error: 'patient_id, file_name, and file_data are required' });
    }
    try {
        const result = await db.query(
            'INSERT INTO patient_results (patient_id, file_name, file_data, mime_type, uploaded_by) VALUES ($1, $2, $3, $4, $5) RETURNING id, file_name, mime_type, created_at',
            [patient_id, file_name, file_data, mime_type || 'image/jpeg', req.user?.id || null]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Delete a result
const deleteResult = async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM patient_results WHERE id = $1', [id]);
        res.json({ message: 'Result deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = {
    getPatientFolders,
    getPatientResults,
    getResultById,
    uploadResult,
    deleteResult
};
