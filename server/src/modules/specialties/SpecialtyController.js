const db = require('../../db');

const SpecialtyController = {
    async getAll(req, res) {
        try {
            const result = await db.query(`
                SELECT sp.*, se.name as service_name 
                FROM specialties sp
                LEFT JOIN services se ON sp.service_id = se.id
                ORDER BY sp.name ASC
            `);
            res.json(result.rows);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    async create(req, res) {
        const { name, description, duration_minutes, service_id } = req.body;
        try {
            const result = await db.query(
                'INSERT INTO specialties (name, description, duration_minutes, service_id) VALUES ($1, $2, $3, $4) RETURNING *',
                [name, description, duration_minutes, service_id || null]
            );
            res.status(201).json(result.rows[0]);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    async update(req, res) {
        const { id } = req.params;
        const { name, description, duration_minutes, is_active, service_id } = req.body;
        try {
            const result = await db.query(
                'UPDATE specialties SET name = $1, description = $2, duration_minutes = $3, is_active = $4, service_id = $5 WHERE id = $6 RETURNING *',
                [name, description, duration_minutes, is_active !== undefined ? is_active : true, service_id || null, id]
            );
            if (result.rows.length === 0) return res.status(404).json({ error: 'Specialty not found' });
            res.json(result.rows[0]);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    async delete(req, res) {
        const { id } = req.params;
        try {
            // Soft delete
            const result = await db.query(
                'UPDATE specialties SET is_active = FALSE WHERE id = $1 RETURNING *',
                [id]
            );
            if (result.rows.length === 0) return res.status(404).json({ error: 'Specialty not found' });
            res.json({ message: 'Specialty deactivated' });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
};

module.exports = SpecialtyController;
