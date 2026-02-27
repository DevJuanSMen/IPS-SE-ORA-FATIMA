const db = require('../../db');

// Helper to get date range from query params (default: last 30 days)
const getRange = (query) => {
    const to = query.to || new Date().toISOString().split('T')[0];
    const fromDefault = new Date();
    fromDefault.setDate(fromDefault.getDate() - 30);
    const from = query.from || fromDefault.toISOString().split('T')[0];
    return { from, to };
};

const ReportsController = {

    // GET /api/reports/summary
    async getSummary(req, res) {
        try {
            const { from, to } = getRange(req.query);

            const [totalCitas, citasHoy, pacientesUnicos, canceladas, doctoresActivos, conversaciones] = await Promise.all([
                db.query(`SELECT COUNT(*) as count FROM appointments WHERE start_datetime::date BETWEEN $1 AND $2`, [from, to]),
                db.query(`SELECT COUNT(*) as count FROM appointments WHERE start_datetime::date = CURRENT_DATE`),
                db.query(`SELECT COUNT(DISTINCT patient_id) as count FROM appointments WHERE start_datetime::date BETWEEN $1 AND $2`, [from, to]),
                db.query(`SELECT COUNT(*) as count FROM appointments WHERE status = 'CANCELLED' AND start_datetime::date BETWEEN $1 AND $2`, [from, to]),
                db.query(`SELECT COUNT(*) as count FROM doctors WHERE is_active = TRUE`),
                db.query(`SELECT COUNT(*) as count FROM conversation_sessions WHERE state != 'IDLE'`)
            ]);

            const total = parseInt(totalCitas.rows[0].count) || 0;
            const cancelled = parseInt(canceladas.rows[0].count) || 0;
            const cancelRate = total > 0 ? ((cancelled / total) * 100).toFixed(1) : '0.0';

            res.json({
                totalCitas: total,
                citasHoy: parseInt(citasHoy.rows[0].count) || 0,
                pacientesUnicos: parseInt(pacientesUnicos.rows[0].count) || 0,
                canceladas: cancelled,
                cancelRate,
                doctoresActivos: parseInt(doctoresActivos.rows[0].count) || 0,
                conversacionesActivas: parseInt(conversaciones.rows[0].count) || 0,
                range: { from, to }
            });
        } catch (err) {
            console.error('Reports summary error:', err);
            res.status(500).json({ error: err.message });
        }
    },

    // GET /api/reports/by-specialty
    async getBySpecialty(req, res) {
        try {
            const { from, to } = getRange(req.query);
            const result = await db.query(`
                SELECT s.name, COUNT(a.id) as total,
                       SUM(CASE WHEN a.status = 'CANCELLED' THEN 1 ELSE 0 END) as canceladas,
                       SUM(CASE WHEN a.status = 'BOOKED' THEN 1 ELSE 0 END) as agendadas,
                       SUM(CASE WHEN a.status = 'ATTENDED' THEN 1 ELSE 0 END) as atendidas
                FROM specialties s
                LEFT JOIN appointments a ON a.specialty_id = s.id
                    AND a.start_datetime::date BETWEEN $1 AND $2
                GROUP BY s.name
                ORDER BY total DESC
                LIMIT 15
            `, [from, to]);
            res.json(result.rows);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    // GET /api/reports/by-doctor
    async getByDoctor(req, res) {
        try {
            const { from, to } = getRange(req.query);
            const result = await db.query(`
                SELECT d.full_name as name, COUNT(a.id) as total,
                       SUM(CASE WHEN a.status = 'CANCELLED' THEN 1 ELSE 0 END) as canceladas,
                       SUM(CASE WHEN a.status = 'ATTENDED' THEN 1 ELSE 0 END) as atendidas,
                       MAX(s.name) as especialidad
                FROM doctors d
                LEFT JOIN appointments a ON a.doctor_id = d.id
                    AND a.start_datetime::date BETWEEN $1 AND $2
                LEFT JOIN specialties s ON a.specialty_id = s.id
                GROUP BY d.id, d.full_name
                ORDER BY total DESC
                LIMIT 15
            `, [from, to]);
            res.json(result.rows);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    // GET /api/reports/by-service
    async getByService(req, res) {
        try {
            const { from, to } = getRange(req.query);
            const result = await db.query(`
                SELECT sv.name, COUNT(a.id) as total
                FROM services sv
                LEFT JOIN specialties sp ON sp.service_id = sv.id
                LEFT JOIN appointments a ON a.specialty_id = sp.id
                    AND a.start_datetime::date BETWEEN $1 AND $2
                GROUP BY sv.name
                ORDER BY total DESC
            `, [from, to]);
            res.json(result.rows);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    // GET /api/reports/by-entity
    async getByEntity(req, res) {
        try {
            const { from, to } = getRange(req.query);
            // Notes field stores JSON with entidad key
            const result = await db.query(`
                SELECT 
                    COALESCE(
                        NULLIF(TRIM(notes::json->>'entidad'), ''),
                        'Sin especificar'
                    ) as entidad,
                    COUNT(*) as total
                FROM appointments
                WHERE start_datetime::date BETWEEN $1 AND $2
                    AND notes IS NOT NULL AND notes != '' AND notes != 'null'
                    AND notes ~ '^\\{.*\\}$'
                GROUP BY entidad
                ORDER BY total DESC
            `, [from, to]);
            res.json(result.rows);
        } catch (err) {
            // If no JSON notes yet, return empty gracefully
            res.json([]);
        }
    },

    // GET /api/reports/trends (last 8 weeks)
    async getTrends(req, res) {
        try {
            const result = await db.query(`
                SELECT 
                    TO_CHAR(DATE_TRUNC('week', start_datetime), 'DD/MM') as semana,
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) as canceladas,
                    SUM(CASE WHEN status = 'ATTENDED' THEN 1 ELSE 0 END) as atendidas
                FROM appointments
                WHERE start_datetime >= NOW() - INTERVAL '8 weeks'
                GROUP BY DATE_TRUNC('week', start_datetime)
                ORDER BY DATE_TRUNC('week', start_datetime) ASC
            `);
            res.json(result.rows);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
};

module.exports = ReportsController;
