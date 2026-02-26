const db = require('../../db');

const ScheduleController = {
    async getByDoctor(req, res) {
        const { doctorId } = req.params;
        try {
            const result = await db.query(
                'SELECT * FROM doctor_schedules WHERE doctor_id = $1 AND is_active = TRUE ORDER BY special_date NULLS FIRST, weekday ASC, start_time ASC',
                [doctorId]
            );
            res.json(result.rows);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    async create(req, res) {
        const { doctor_id, weekdays, start_time, end_time, special_date, special_dates } = req.body;
        try {
            const results = [];

            if (special_date || special_dates) {
                // Special specific date schedule
                const dates = special_dates || [special_date];
                for (const date of dates) {
                    const result = await db.query(
                        'INSERT INTO doctor_schedules (doctor_id, special_date, start_time, end_time) VALUES ($1, $2, $3, $4) RETURNING *',
                        [doctor_id, date, start_time, end_time]
                    );
                    results.push(result.rows[0]);
                }
            } else {
                // Regular recurring schedule
                // Handle both single day and multiple days
                const days = Array.isArray(weekdays) ? weekdays : [weekdays];

                for (const weekday of days) {
                    const result = await db.query(
                        'INSERT INTO doctor_schedules (doctor_id, weekday, start_time, end_time) VALUES ($1, $2, $3, $4) RETURNING *',
                        [doctor_id, weekday, start_time, end_time]
                    );
                    results.push(result.rows[0]);
                }
            }

            res.status(201).json(results);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    async delete(req, res) {
        const { id } = req.params;
        try {
            await db.query('UPDATE doctor_schedules SET is_active = FALSE WHERE id = $1', [id]);
            res.json({ message: 'Schedule removed' });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
};

module.exports = ScheduleController;
