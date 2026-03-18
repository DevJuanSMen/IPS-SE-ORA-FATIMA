const db = require('../db');

const AvailabilityService = {
    // Find a doctor for a specialty
    async findDoctorForSpecialty(specialtyId) {
        const res = await db.query(
            'SELECT d.id FROM doctors d JOIN doctor_specialties ds ON d.id = ds.doctor_id WHERE ds.specialty_id = $1 AND d.is_active = TRUE LIMIT 1',
            [specialtyId]
        );
        return res.rows[0]?.id || null;
    },

    // Get available time slots
    async getAvailableSlots(doctorId, date, specialtyId) {
        // Get doctor's schedule for this day
        // Note: date input is expected to be YYYY-MM-DD string
        const dayOfWeek = new Date(date).getDay();

        // Get schedules. If there is a special_date schedule for this exact date, 
        // it applies. Otherwise, the regular weekday schedule applies.
        // We will fetch both and if there are special_date schedules, we ONLY use those.
        // If not, we use the regular ones.
        const allSchedules = await db.query(
            `SELECT start_time, end_time, special_date, weekday 
             FROM doctor_schedules 
             WHERE doctor_id = $1 
             AND (specialty_id = $4 OR specialty_id IS NULL)
             AND is_active = TRUE 
             AND (special_date = $2 OR (special_date IS NULL AND weekday = $3))`,
            [doctorId, date, dayOfWeek, specialtyId]
        );

        // Filter: If there are any special dates for today, IGNORE the regular recurring weekday schedules.
        // Otherwise use the regular ones.
        const hasSpecialForToday = allSchedules.rows.some(s => s.special_date !== null);
        const schedules = {
            rows: allSchedules.rows.filter(s =>
                hasSpecialForToday ? s.special_date !== null : s.special_date === null
            )
        };

        if (schedules.rows.length === 0) return [];

        // Get blocks for this doctor and date
        const blocks = await db.query(
            'SELECT start_time, end_time FROM doctor_blocks WHERE doctor_id = $1 AND date = $2',
            [doctorId, date]
        );

        let finalSpecialtyId = specialtyId;
        if (!finalSpecialtyId) {
            // Find doctor's first specialty
            const docSpec = await db.query(
                `SELECT specialty_id FROM doctor_specialties WHERE doctor_id = $1 LIMIT 1`,
                [doctorId]
            );
            finalSpecialtyId = docSpec.rows[0]?.specialty_id;
        }

        const spec = finalSpecialtyId ? await db.query(
            'SELECT name, duration_minutes, capacity FROM specialties WHERE id = $1 LIMIT 1',
            [finalSpecialtyId]
        ) : null;

        const capacity = spec?.rows[0]?.capacity || 1;
        const durationMinutes = spec?.rows[0]?.duration_minutes || 20;

        const booked = await db.query(`
            SELECT start_datetime, end_datetime FROM appointments
            WHERE doctor_id = $1 
            AND DATE(start_datetime AT TIME ZONE 'America/Bogota') = $2
            AND status != 'CANCELLED'
        `, [doctorId, date]);

        const bookedRanges = booked.rows.map(row => {
            const startDt = new Date(row.start_datetime);
            const endDt = new Date(row.end_datetime);
            
            // Adjust to timezone or just use the local time from DB equivalent 
            // The DB returns UTC TIMESTAMPTZ, but getHours() gives local time of the Node server.
            // Let's format them in Bogota time using a reliable string slice
            const localeStart = new Date(startDt.toLocaleString('en-US', { timeZone: 'America/Bogota' }));
            const localeEnd = new Date(endDt.toLocaleString('en-US', { timeZone: 'America/Bogota' }));
            
            const startMins = localeStart.getHours() * 60 + localeStart.getMinutes();
            const endMins = localeEnd.getHours() * 60 + localeEnd.getMinutes();
            return { start: startMins, end: endMins };
        });

        const blockedRanges = blocks.rows.map(b => ({
            start: b.start_time.substring(0, 5),
            end: b.end_time.substring(0, 5)
        }));

        // Generate slots
        const slots = [];
        for (const schedule of schedules.rows) {
            const [startHour, startMin] = schedule.start_time.split(':').map(Number);
            const [endHour, endMin] = schedule.end_time.split(':').map(Number);

            let current = startHour * 60 + startMin;
            const end = endHour * 60 + endMin;

            while (current + durationMinutes <= end) {
                const h = Math.floor(current / 60).toString().padStart(2, '0');
                const m = (current % 60).toString().padStart(2, '0');
                const timeSlot = `${h}:${m}`;

                // Check if booked to capacity
                let overlaps = 0;
                for (const range of bookedRanges) {
                    if (current < range.end && (current + durationMinutes) > range.start) {
                        overlaps++;
                    }
                }
                const isBooked = overlaps >= capacity;

                // Check if blocked
                const isBlocked = blockedRanges.some(range => {
                    const [blockStartH, blockStartM] = range.start.split(':').map(Number);
                    const [blockEndH, blockEndM] = range.end.split(':').map(Number);
                    const blockStart = blockStartH * 60 + blockStartM;
                    const blockEnd = blockEndH * 60 + blockEndM;
                    // Block overlaps with slot
                    return current < blockEnd && (current + durationMinutes) > blockStart;
                });

                if (!isBooked && !isBlocked) {
                    slots.push(timeSlot);
                }

                current += durationMinutes;
            }
        }

        return slots;
    }
};

module.exports = AvailabilityService;
