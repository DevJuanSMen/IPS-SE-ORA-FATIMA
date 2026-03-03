const db = require('../../db');

// Get all FAQs (public)
const getFaqs = async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM chatbot_faqs WHERE is_active = TRUE ORDER BY created_at ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Get all FAQs including inactive (admin/receptionist)
const getAllFaqs = async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM chatbot_faqs ORDER BY created_at ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Create FAQ
const createFaq = async (req, res) => {
    const { question, answer } = req.body;
    if (!question || !answer) return res.status(400).json({ error: 'question and answer are required' });
    try {
        const result = await db.query(
            'INSERT INTO chatbot_faqs (question, answer) VALUES ($1, $2) RETURNING *',
            [question, answer]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Update FAQ
const updateFaq = async (req, res) => {
    const { id } = req.params;
    const { question, answer, is_active } = req.body;
    try {
        const result = await db.query(
            'UPDATE chatbot_faqs SET question = COALESCE($1, question), answer = COALESCE($2, answer), is_active = COALESCE($3, is_active), updated_at = NOW() WHERE id = $4 RETURNING *',
            [question, answer, is_active, id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'FAQ not found' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Delete FAQ
const deleteFaq = async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM chatbot_faqs WHERE id = $1', [id]);
        res.json({ message: 'FAQ deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Patient submits a message/suggestion
const submitMessage = async (req, res) => {
    const { patient_id, patient_name, message } = req.body;
    if (!message) return res.status(400).json({ error: 'message is required' });
    try {
        const result = await db.query(
            'INSERT INTO patient_messages (patient_id, patient_name, message) VALUES ($1, $2, $3) RETURNING *',
            [patient_id || null, patient_name || 'Anónimo', message]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Get all messages (admin/receptionist inbox)
const getMessages = async (req, res) => {
    const { status } = req.query;
    try {
        let query = 'SELECT * FROM patient_messages';
        const params = [];
        if (status) {
            query += ' WHERE status = $1';
            params.push(status);
        }
        query += ' ORDER BY created_at DESC';
        const result = await db.query(query, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Count pending messages (for bell notification)
const getPendingCount = async (req, res) => {
    try {
        const result = await db.query("SELECT COUNT(*) as count FROM patient_messages WHERE status = 'PENDING'");
        res.json({ count: parseInt(result.rows[0].count) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Reply to a patient message
const replyMessage = async (req, res) => {
    const { id } = req.params;
    const { reply } = req.body;
    if (!reply) return res.status(400).json({ error: 'reply is required' });
    try {
        const result = await db.query(
            `UPDATE patient_messages SET reply = $1, status = 'REPLIED', replied_by = $2, replied_at = NOW() 
             WHERE id = $3 RETURNING *`,
            [reply, req.user.id, id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Message not found' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Get messages for a specific patient (for patient to see their replies)
const getPatientMessages = async (req, res) => {
    const { patient_id } = req.params;
    try {
        const result = await db.query(
            'SELECT * FROM patient_messages WHERE patient_id = $1 ORDER BY created_at DESC',
            [patient_id]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Count replies for patient (for patient bell notification)
const getPatientUnreadReplies = async (req, res) => {
    const { patient_id } = req.params;
    try {
        const result = await db.query(
            "SELECT COUNT(*) as count FROM patient_messages WHERE patient_id = $1 AND status = 'REPLIED' AND replied_at > NOW() - INTERVAL '7 days'",
            [patient_id]
        );
        res.json({ count: parseInt(result.rows[0].count) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = {
    getFaqs,
    getAllFaqs,
    createFaq,
    updateFaq,
    deleteFaq,
    submitMessage,
    getMessages,
    getPendingCount,
    replyMessage,
    getPatientMessages,
    getPatientUnreadReplies
};
