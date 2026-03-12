const db = require('../../db');

const DoctorController = {
    async getAll(req, res) {
        try {
            const result = await db.query(`
        SELECT d.*, 
               array_agg(s.name) as specialty_names,
               array_agg(s.id) as specialty_ids
        FROM doctors d 
        LEFT JOIN doctor_specialties ds ON d.id = ds.doctor_id
        LEFT JOIN specialties s ON ds.specialty_id = s.id 
        GROUP BY d.id
        ORDER BY d.full_name ASC
      `);
            res.json(result.rows);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    async getById(req, res) {
        const { id } = req.params;
        try {
            const result = await db.query(`
        SELECT d.*, 
               array_agg(s.name) as specialty_names,
               array_agg(s.id) as specialty_ids
        FROM doctors d 
        LEFT JOIN doctor_specialties ds ON d.id = ds.doctor_id
        LEFT JOIN specialties s ON ds.specialty_id = s.id 
        WHERE d.id = $1
        GROUP BY d.id
      `, [id]);
            if (result.rows.length === 0) return res.status(404).json({ error: 'Doctor not found' });
            res.json(result.rows[0]);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    async create(req, res) {
        const { full_name, specialty_ids, phone } = req.body;
        try {
            await db.query('BEGIN');
            const result = await db.query(
                'INSERT INTO doctors (full_name, phone) VALUES ($1, $2) RETURNING *',
                [full_name, phone]
            );
            const doctorId = result.rows[0].id;

            if (specialty_ids && Array.isArray(specialty_ids)) {
                for (const sId of specialty_ids) {
                    await db.query('INSERT INTO doctor_specialties (doctor_id, specialty_id) VALUES ($1, $2)', [doctorId, sId]);
                }
            }

            await db.query('COMMIT');
            res.status(201).json(result.rows[0]);
        } catch (err) {
            await db.query('ROLLBACK');
            res.status(500).json({ error: err.message });
        }
    },

    async getBySpecialty(req, res) {
        const { specialtyId } = req.params;
        try {
            const result = await db.query(
                `SELECT d.* FROM doctors d
                 JOIN doctor_specialties ds ON d.id = ds.doctor_id
                 WHERE ds.specialty_id = $1 AND d.is_active = TRUE 
                 ORDER BY d.full_name ASC`,
                [specialtyId]
            );
            res.json(result.rows);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    async update(req, res) {
        const { id } = req.params;
        const { full_name, specialty_ids, phone, is_active } = req.body;
        try {
            await db.query('BEGIN');
            const result = await db.query(
                `UPDATE doctors 
                 SET full_name = $1, phone = $2, is_active = $3 
                 WHERE id = $4 RETURNING *`,
                [full_name, phone, is_active !== undefined ? is_active : true, id]
            );
            
            if (result.rows.length === 0) {
                await db.query('ROLLBACK');
                return res.status(404).json({ error: 'Doctor not found' });
            }

            // Sync specialties
            await db.query('DELETE FROM doctor_specialties WHERE doctor_id = $1', [id]);
            if (specialty_ids && Array.isArray(specialty_ids)) {
                for (const sId of specialty_ids) {
                    await db.query('INSERT INTO doctor_specialties (doctor_id, specialty_id) VALUES ($1, $2)', [id, sId]);
                }
            }

            await db.query('COMMIT');
            res.json(result.rows[0]);
        } catch (err) {
            await db.query('ROLLBACK');
            res.status(500).json({ error: err.message });
        }
    },

    async delete(req, res) {
        const { id } = req.params;
        try {
            const result = await db.query(
                'UPDATE doctors SET is_active = FALSE WHERE id = $1 RETURNING *',
                [id]
            );
            if (result.rows.length === 0) return res.status(404).json({ error: 'Doctor not found' });
            res.json({ message: 'Doctor deactivated' });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
};

module.exports = DoctorController;
