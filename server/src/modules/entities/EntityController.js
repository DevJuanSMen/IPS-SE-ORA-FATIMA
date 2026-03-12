const db = require('../../db');

const EntityController = {
    async getAll(req, res) {
        try {
            const result = await db.query('SELECT * FROM entities ORDER BY name ASC');
            res.json(result.rows);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    async getActive(req, res) {
        try {
            const result = await db.query('SELECT * FROM entities WHERE is_active = TRUE ORDER BY name ASC');
            res.json(result.rows);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    async create(req, res) {
        const { name } = req.body;
        try {
            const result = await db.query(
                'INSERT INTO entities (name) VALUES ($1) RETURNING *',
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
                'UPDATE entities SET name = $1, is_active = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
                [name, is_active, id]
            );
            if (result.rows.length === 0) return res.status(404).json({ error: 'Entity not found' });
            res.json(result.rows[0]);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    async toggleStatus(req, res) {
        const { id } = req.params;
        try {
            const result = await db.query(
                'UPDATE entities SET is_active = NOT is_active, updated_at = NOW() WHERE id = $1 RETURNING *',
                [id]
            );
            if (result.rows.length === 0) return res.status(404).json({ error: 'Entity not found' });
            res.json(result.rows[0]);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
};

module.exports = EntityController;
