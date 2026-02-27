const db = require('../../db');

const ServiceController = {
    async getAll(req, res) {
        try {
            const result = await db.query('SELECT * FROM services ORDER BY name ASC');
            res.json(result.rows);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    async create(req, res) {
        const { name } = req.body;
        try {
            const result = await db.query(
                'INSERT INTO services (name) VALUES ($1) RETURNING *',
                [name]
            );
            res.status(201).json(result.rows[0]);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    async update(req, res) {
        const { id } = req.params;
        const { name, is_active } = req.body;
        try {
            const result = await db.query(
                'UPDATE services SET name = $1, is_active = $2 WHERE id = $3 RETURNING *',
                [name, is_active !== undefined ? is_active : true, id]
            );
            if (result.rows.length === 0) return res.status(404).json({ error: 'Service not found' });
            res.json(result.rows[0]);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    async delete(req, res) {
        const { id } = req.params;
        try {
            const result = await db.query(
                'UPDATE services SET is_active = FALSE WHERE id = $1 RETURNING *',
                [id]
            );
            if (result.rows.length === 0) return res.status(404).json({ error: 'Service not found' });
            res.json({ message: 'Service deactivated' });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
};

module.exports = ServiceController;
