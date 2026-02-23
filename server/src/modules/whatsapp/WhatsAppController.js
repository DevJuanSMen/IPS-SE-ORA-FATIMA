const db = require('../../db');
const AIService = require('../../services/AIService');
const AvailabilityService = require('../../services/AvailabilityService');

let socketIo = null;

const WhatsAppController = {
    setSocket(io) {
        socketIo = io;
    },

    // Helper to log messages
    async logMessage(phone, body, from_me) {
        try {
            await db.query(
                'INSERT INTO messages (phone, body, from_me) VALUES ($1, $2, $3)',
                [phone, body, from_me]
            );
            if (socketIo) {
                socketIo.emit('new_message', { phone, body, from_me });
            }
        } catch (err) {
            console.error('Error logging message:', err);
        }
    },

    // Helper to send and log replies
    async reply(msg, text) {
        console.log(`[BOT-DEBUG] Preparando para responder a ${msg.from}:`, text);
        try {
            await msg.reply(text);
            console.log(`[BOT-DEBUG] Mensaje enviado a WhatsApp exitosamente.`);
        } catch (e) {
            console.error(`[BOT-DEBUG] Error fatal al hacer msg.reply:`, e);
            throw e;
        }
        const cleanPhone = msg.from.split('@')[0];
        await this.logMessage(cleanPhone, text, true);
    },

    // Send generic message (for Admin logic)
    async sendMessage(client, phone, text) {
        try {
            const cleanPhone = String(phone).split('@')[0].trim();
            let chatId = `${cleanPhone}@c.us`;
            try {
                await client.sendMessage(chatId, text);
            } catch (err) {
                console.log(`[AI-BOT] Error sending to @c.us, falling back to @lid for phone ${cleanPhone}`);
                chatId = `${cleanPhone}@lid`;
                await client.sendMessage(chatId, text);
            }
            await this.logMessage(cleanPhone, text, true);
        } catch (error) {
            console.error('Error sending message:', error);
        }
    },

    // Send Booking Confirmation
    async sendBookingConfirmation(client, phone, appointment, specialtyName, doctorName, patientName) {
        const dateStr = new Date(appointment.start_datetime).toLocaleDateString('es-ES', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Bogota'
        });
        const timeStr = new Date(appointment.start_datetime).toLocaleTimeString('es-ES', {
            hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'America/Bogota'
        });

        const message = `✅ *¡Cita Confirmada!*\n\n📅 ${dateStr}\n⏰ ${timeStr}\n🏥 ${specialtyName || ''}\n👨‍⚕️ Dr. ${doctorName || ''}\n👤 ${patientName}\n🔑 Código: *${appointment.confirmation_code}*\n\nPor favor llega 10 minutos antes.`;

        await this.sendMessage(client, phone, message);
    },

    // Get or create session
    async getOrCreateSession(phone) {
        let res = await db.query('SELECT * FROM conversation_sessions WHERE phone = $1', [phone]);
        if (res.rows.length === 0) {
            await db.query(
                'INSERT INTO conversation_sessions (phone, state, is_bot_active) VALUES ($1, $2, $3)',
                [phone, 'ACTIVE', true]
            );
            res = await db.query('SELECT * FROM conversation_sessions WHERE phone = $1', [phone]);
        }
        return res.rows[0];
    },

    // Set bot status
    async setBotStatus(phone, active) {
        await db.query(
            'UPDATE conversation_sessions SET is_bot_active = $1 WHERE phone = $2',
            [active, phone]
        );
    },

    // Reset conversation
    async resetConversation(phone) {
        AIService.resetContext(phone);
        await db.query(
            'UPDATE conversation_sessions SET state = $1, payload_json = $2 WHERE phone = $3',
            ['ACTIVE', {}, phone]
        );
    },

    // Main message handler
    async handleMessage(client, msg) {
        const phone = msg.from.split('@')[0]; // Clean @c.us or @lid
        const text = msg.body.trim();
        console.log(`[AI-BOT] Received from ${msg.from} (clean: ${phone}): "${text}"`);

        try {
            // Check if sender is a doctor
            const doctorCheck = await db.query('SELECT id FROM doctors WHERE phone LIKE $1 AND is_active = TRUE', [`%${phone}%`]);
            if (doctorCheck.rows.length > 0) {
                console.log(`[AI-BOT] Message from doctor ${phone}. Skipping AI logic.`);
                return; // Ignore doctors
            }

            // 1. Log incoming message
            await this.logMessage(phone, text, false);

            let session = await this.getOrCreateSession(phone);

            // 2. Handle special commands that work even when bot is inactive
            if (text.toLowerCase() === 'activar bot') {
                await this.setBotStatus(phone, true);
                await this.resetConversation(phone);
                await this.reply(msg, '✅ Bot reactivado. ¿En qué puedo ayudarte hoy?');
                return;
            }

            if (text.toLowerCase() === 'reiniciar' || text.toLowerCase() === 'empezar de nuevo') {
                await this.resetConversation(phone);
                await this.reply(msg, '🔄 Conversación reiniciada. ¿Cómo puedo ayudarte?');
                return;
            }

            // 3. Skip AI logic if bot is inactive
            if (!session.is_bot_active) {
                console.log(`[AI-BOT] Bot inactive for ${phone}. Skipping.`);
                return;
            }

            // 4. Handle special states (cancellation confirmation)
            if (session.state === 'CONFIRMING_CANCELLATION') {
                await this.handleCancellationConfirmation(client, msg, phone, session, text);
                return;
            }

            if (session.state === 'SELECTING_APPOINTMENT_TO_CANCEL') {
                await this.handleAppointmentSelection(client, msg, phone, session, text);
                return;
            }

            if (session.state === 'CONFIRMING_BOOKING') {
                await this.handleBookingConfirmation(client, msg, phone, session, text);
                return;
            }

            // 5. DETERMINISTIC FLOW (NO AI)

            if (session.state === 'ACTIVE') {
                const txt = `Hola 👋 Bienvenido(a) a la IPS Nuestra Señora de Fátima.\n\nSoy Fátima 🤍 y te ayudaré a agendar tu cita.\n\nPara comenzar, por favor escribe tu número de cédula\n\n(sin puntos ni espacios).`;
                await this.reply(msg, txt);

                await db.query(
                    'UPDATE conversation_sessions SET state = $1, payload_json = $2 WHERE phone = $3',
                    ['AWAITING_ID', '{}', phone]
                );
                return;
            }

            if (session.state === 'AWAITING_ID') {
                const payload = typeof session.payload_json === 'string' ? JSON.parse(session.payload_json) : (session.payload_json || {});

                // Clean ID keeping only numbers
                const cedula = text.replace(/\D/g, '');
                if (cedula.length < 5) {
                    await this.reply(msg, 'Por favor ingresa un número de cédula válido (al menos 5 dígitos).');
                    return;
                }

                payload.patient_id_number = cedula;

                const specialties = await db.query('SELECT id, name FROM specialties WHERE is_active = TRUE');
                let txt = '¡Gracias! ¿Para qué especialidad deseas agendar cita? Responde con el número:\n\n';
                specialties.rows.forEach((s, idx) => {
                    txt += `${idx + 1}. ${s.name}\n`;
                });
                await this.reply(msg, txt);

                payload.specialties = specialties.rows;

                await db.query(
                    'UPDATE conversation_sessions SET state = $1, payload_json = $2 WHERE phone = $3',
                    ['AWAITING_SPECIALTY', JSON.stringify(payload), phone]
                );
                return;
            }

            if (session.state === 'AWAITING_SPECIALTY') {
                const payload = typeof session.payload_json === 'string' ? JSON.parse(session.payload_json) : (session.payload_json || {});
                const index = parseInt(text) - 1;

                if (isNaN(index) || index < 0 || index >= (payload.specialties || []).length) {
                    await this.reply(msg, 'Por favor, responde con un número válido de la lista.');
                    return;
                }

                const specialty = payload.specialties[index];
                const doctorId = await AvailabilityService.findDoctorForSpecialty(specialty.id);

                if (!doctorId) {
                    await this.reply(msg, `No hay médicos disponibles para ${specialty.name} en este momento. Escribe "HOLA" para empezar de nuevo.`);
                    await this.resetConversation(phone);
                    return;
                }

                const availableDates = [];
                let checkDate = new Date();
                checkDate.setHours(0, 0, 0, 0);

                for (let i = 0; i < 15 && availableDates.length < 5; i++) {
                    const dateStr = checkDate.toISOString().split('T')[0];
                    const slots = await AvailabilityService.getAvailableSlots(doctorId, dateStr);
                    if (slots.length > 0) {
                        availableDates.push(dateStr);
                    }
                    checkDate.setDate(checkDate.getDate() + 1);
                }

                if (availableDates.length === 0) {
                    await this.reply(msg, `Lo siento, no hay fechas próximas para ${specialty.name}. Escribe "HOLA" para empezar de nuevo.`);
                    await this.resetConversation(phone);
                    return;
                }

                let txt = `Elegiste ${specialty.name}. ¿Qué fecha prefieres? Responde con el número:\n\n`;
                availableDates.forEach((d, idx) => {
                    const dStr = new Date(d + 'T00:00:00-05:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
                    txt += `${idx + 1}. ${dStr}\n`;
                });

                await this.reply(msg, txt);

                const newPayload = {
                    ...payload,
                    specialty_id: specialty.id,
                    specialty_name: specialty.name,
                    doctor_id: doctorId,
                    available_dates: availableDates
                };
                await db.query(
                    'UPDATE conversation_sessions SET state = $1, payload_json = $2 WHERE phone = $3',
                    ['AWAITING_DATE', JSON.stringify(newPayload), phone]
                );
                return;
            }

            if (session.state === 'AWAITING_DATE') {
                const payload = typeof session.payload_json === 'string' ? JSON.parse(session.payload_json) : (session.payload_json || {});
                const index = parseInt(text) - 1;

                if (isNaN(index) || index < 0 || index >= payload.available_dates.length) {
                    await this.reply(msg, 'Por favor, responde con un número válido de la lista.');
                    return;
                }

                const dateStr = payload.available_dates[index];
                const slots = await AvailabilityService.getAvailableSlots(payload.doctor_id, dateStr);

                if (slots.length === 0) {
                    await this.reply(msg, `Lo siento, ya no hay horarios para esa fecha. Escribe "HOLA" para empezar de nuevo.`);
                    await this.resetConversation(phone);
                    return;
                }

                const dStr = new Date(dateStr + 'T00:00:00-05:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
                let txt = `Para el ${dStr}. ¿A qué hora prefieres tu cita? Responde con el número:\n\n`;
                slots.forEach((s, idx) => {
                    txt += `${idx + 1}. ${s}\n`;
                });

                await this.reply(msg, txt);

                payload.date = dateStr;
                payload.available_slots = slots;
                await db.query(
                    'UPDATE conversation_sessions SET state = $1, payload_json = $2 WHERE phone = $3',
                    ['AWAITING_TIME', JSON.stringify(payload), phone]
                );
                return;
            }

            if (session.state === 'AWAITING_TIME') {
                const payload = typeof session.payload_json === 'string' ? JSON.parse(session.payload_json) : (session.payload_json || {});
                const index = parseInt(text) - 1;

                if (isNaN(index) || index < 0 || index >= payload.available_slots.length) {
                    await this.reply(msg, 'Por favor, responde con un número válido de la lista.');
                    return;
                }

                payload.time = payload.available_slots[index];

                await this.reply(msg, `¡Excelente! Has elegido a las ${payload.time}.\n\nPara completar tu reserva, por favor escribe tu *NOMBRE COMPLETO*.`);

                await db.query(
                    'UPDATE conversation_sessions SET state = $1, payload_json = $2 WHERE phone = $3',
                    ['AWAITING_NAME', JSON.stringify(payload), phone]
                );
                return;
            }

            if (session.state === 'AWAITING_NAME') {
                const payload = typeof session.payload_json === 'string' ? JSON.parse(session.payload_json) : (session.payload_json || {});
                if (text.length < 3) {
                    await this.reply(msg, 'Por favor ingresa un nombre válido (al menos 3 letras).');
                    return;
                }
                payload.patient_name = text;

                const dateStr = new Date(`${payload.date}T${payload.time}:00-05:00`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Bogota' });
                const timeStr = new Date(`${payload.date}T${payload.time}:00-05:00`).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'America/Bogota' });

                const doctor = await db.query('SELECT full_name FROM doctors WHERE id = $1', [payload.doctor_id]);
                const docName = doctor.rows[0]?.full_name || '';

                const confirmMsg = `¡Todo listo para agendar!\n\n📅 Fecha: ${dateStr}\n⏰ Hora: ${timeStr}\n🏥 Especialidad: ${payload.specialty_name}\n👨‍⚕️ Dr. ${docName}\n👤 Paciente: ${payload.patient_name} (${payload.patient_id_number})\n\n¿Deseas confirmar la cita? Responde *SI* para agendar o *NO* para cancelar.`;

                // Prepare payload according to what CONFIRMING_BOOKING expects
                const pendingBooking = {
                    specialty_id: payload.specialty_id,
                    doctorId: payload.doctor_id,
                    date: payload.date,
                    time: payload.time,
                    patient_name: payload.patient_name,
                    patient_id: payload.patient_id_number
                };

                await db.query(
                    'UPDATE conversation_sessions SET payload_json = $1, state = $2 WHERE phone = $3',
                    [JSON.stringify({ pending_booking: pendingBooking }), 'CONFIRMING_BOOKING', phone]
                );

                await this.reply(msg, confirmMsg);
                return;
            }


            // Catch-all (if a weird state occurs)
            await this.reply(msg, 'No entendí tu solicitud. Empezaremos de nuevo.');
            await this.resetConversation(phone);

        } catch (err) {
            console.error('Bot Error:', err);
            const errorMsg = 'Lo siento, hubo un error técnico. Por favor intenta más tarde o escribe *REINICIAR*.';
            await this.sendMessage(client, phone, errorMsg);
        }
    },

    // Handle cancellation request
    async handleCancellationRequest(client, msg, phone, aiResponse) {
        const res = await db.query(`
            SELECT a.id, a.start_datetime, s.name as spec_name, d.full_name as doctor_name
            FROM appointments a
            JOIN patients p ON a.patient_id = p.id
            JOIN specialties s ON a.specialty_id = s.id
            JOIN doctors d ON a.doctor_id = d.id
            WHERE p.phone = $1 AND a.status = 'BOOKED' AND a.start_datetime > CURRENT_TIMESTAMP
            ORDER BY a.start_datetime ASC
        `, [phone]);

        if (res.rows.length === 0) {
            await this.reply(msg, 'No encontré citas activas agendadas para este número.');
            return;
        }

        if (res.rows.length === 1) {
            // Only one appointment, ask for confirmation
            const apt = res.rows[0];
            const dateStr = new Date(apt.start_datetime).toLocaleString('es-ES', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'America/Bogota'
            });

            const confirmMsg = `Tienes 1 cita agendada:\n\n📅 ${dateStr}\n🏥 ${apt.spec_name}\n👨‍⚕️ Dr. ${apt.doctor_name}\n\n¿Deseas cancelarla? Responde *SI* para confirmar o *NO* para mantenerla.`;

            // Store appointment ID in session
            await db.query(
                'UPDATE conversation_sessions SET payload_json = $1, state = $2 WHERE phone = $3',
                [JSON.stringify({ pending_cancellation_id: apt.id }), 'CONFIRMING_CANCELLATION', phone]
            );

            await this.reply(msg, confirmMsg);
        } else {
            // Multiple appointments, let user choose
            let listMsg = `Tienes ${res.rows.length} citas agendadas:\n\n`;
            res.rows.forEach((apt, i) => {
                const dateStr = new Date(apt.start_datetime).toLocaleString('es-ES', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: 'America/Bogota'
                });
                listMsg += `${i + 1}. ${dateStr} - ${apt.spec_name} (Dr. ${apt.doctor_name})\n`;
            });
            listMsg += `\n¿Cuál deseas cancelar? Responde con el número (1-${res.rows.length}) o escribe *NINGUNA* para no cancelar.`;

            // Store appointments in session
            await db.query(
                'UPDATE conversation_sessions SET payload_json = $1, state = $2 WHERE phone = $3',
                [JSON.stringify({ appointments_list: res.rows }), 'SELECTING_APPOINTMENT_TO_CANCEL', phone]
            );

            await this.reply(msg, listMsg);
        }
    },

    // Handle rescheduling request
    async handleReschedulingRequest(client, msg, phone, aiResponse) {
        await this.reply(msg, 'La función de reprogramación estará disponible pronto. Por ahora puedes cancelar y crear una nueva cita, o pedir un asesor humano.');
    },

    // Handle booking confirmation
    async handleBookingConfirmation(client, msg, phone, session, text) {
        const response = text.toLowerCase().trim();

        if (response === 'si' || response === 'sí' || response === 's') {
            const payload = typeof session.payload_json === 'string' ? JSON.parse(session.payload_json) : (session.payload_json || {});
            const data = payload.pending_booking;

            try {
                const specialties = await db.query('SELECT id, name FROM specialties WHERE is_active = TRUE');
                const doctors = await db.query('SELECT id, full_name, specialty_id, phone FROM doctors WHERE is_active = TRUE');

                // Book the appointment
                const appointment = await this.bookAppointment(phone, data, data.doctorId);

                const specName = specialties.rows.find(s => s.id === data.specialty_id)?.name;
                const doctor = doctors.rows.find(d => d.id === data.doctorId);
                const docName = doctor?.full_name;

                await this.sendBookingConfirmation(client, phone, appointment, specName, docName, data.patient_name);

                await this.resetConversation(phone);
            } catch (error) {
                console.error('Error confirming booking:', error);
                await this.reply(msg, 'Ocurrió un error al guardar la cita. Por favor intenta nuevamente.');
                await this.resetConversation(phone);
            }
        } else if (response === 'no' || response === 'n') {
            await this.reply(msg, 'Entendido, la cita no fue agendada. ¿En qué más te puedo ayudar?');
            await this.resetConversation(phone);
        } else {
            await this.reply(msg, 'Por favor responde *SI* para confirmar la cita o *NO* para cancelarla.');
        }
    },

    // Handle booking attempt
    async handleBookingAttempt(client, msg, phone, aiResponse, specialties, doctors) {
        const { validated, issues } = AIService.validateExtractedData(
            aiResponse.extracted_data,
            specialties,
            doctors
        );

        // Check if we have all required data
        const required = ['specialty_id', 'date', 'time', 'patient_name', 'document_id'];
        const missing = required.filter(field => !validated[field]);

        if (missing.length > 0 || issues.length > 0) {
            let response = aiResponse.message || 'Necesito más información para continuar.';
            if (issues.length > 0) {
                if (response) response += '\n\n';
                response += `⚠️ ${issues.join(', ')}`;
            }
            await this.reply(msg, response);
            return;
        }

        // We have all data, proceed to find available slots
        const doctorId = validated.doctor_id || await AvailabilityService.findDoctorForSpecialty(validated.specialty_id);

        if (!doctorId) {
            await this.reply(msg, 'No hay médicos disponibles para esta especialidad en este momento.');
            return;
        }

        // Get available slots for the date
        const slots = await AvailabilityService.getAvailableSlots(doctorId, validated.date);

        if (slots.length === 0) {
            await this.reply(msg, `No hay horarios disponibles para ${validated.date}. ¿Quieres probar otra fecha?`);
            return;
        }

        // Check if requested time is available
        // Normalize time to HH:MM format for comparison
        const requestedTime = validated.time ? validated.time.substring(0, 5) : null;

        const requestedSlot = requestedTime ? slots.find(s => s === requestedTime) : null;

        if (!requestedSlot) {
            let slotsMsg = `La hora ${validated.time || 'solicitada'} no está disponible para esa fecha. Horarios disponibles:\n\n`;
            slots.forEach((slot, i) => {
                slotsMsg += `${i + 1}. ${slot}\n`;
            });
            slotsMsg += '\n¿Cuál prefieres? (Escribe la hora o el número)';
            await this.reply(msg, slotsMsg);
            return;
        }

        // Ask for confirmation instead of booking immediately
        const appointmentData = {
            ...validated,
            doctorId
        };

        const specName = specialties.find(s => s.id === validated.specialty_id)?.name;
        const doctor = doctors.find(d => d.id === doctorId);
        const docName = doctor?.full_name;

        const dateStr = new Date(`${validated.date}T${validated.time}:00-05:00`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Bogota' });
        const timeStr = new Date(`${validated.date}T${validated.time}:00-05:00`).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'America/Bogota' });

        const confirmMsg = `¡Perfecto! Tengo disponibilidad para agendar tu cita:\n\n📅 Fecha: ${dateStr}\n⏰ Hora: ${timeStr}\n🏥 Especialidad: ${specName}\n👨‍⚕️ Dr. ${docName}\n👤 Paciente: ${validated.patient_name}\n\n¿Deseas confirmar la cita? Responde *SI* para agendar o *NO* para cancelar.`;

        await db.query(
            'UPDATE conversation_sessions SET payload_json = $1, state = $2 WHERE phone = $3',
            [JSON.stringify({ pending_booking: appointmentData }), 'CONFIRMING_BOOKING', phone]
        );

        await this.reply(msg, confirmMsg);
    },

    // Handle availability checking
    async handleCheckAvailability(client, msg, phone, aiResponse, specialties, doctors) {
        const { validated, issues } = AIService.validateExtractedData(
            aiResponse.extracted_data,
            specialties,
            doctors
        );

        if (!validated.specialty_id) {
            let response = aiResponse.message || 'Por favor, dime para qué especialidad o servicio necesitas la cita.';
            await this.reply(msg, response);
            return;
        }

        const doctorId = validated.doctor_id || await AvailabilityService.findDoctorForSpecialty(validated.specialty_id);

        if (!doctorId) {
            await this.reply(msg, 'No hay médicos disponibles para esta especialidad en este momento.');
            return;
        }

        // Feature: Ask for dates first, then hours
        if (!validated.date) {
            // Find next 5 days with at least one slot
            const availableDates = [];
            let checkDate = new Date();
            checkDate.setHours(0, 0, 0, 0);
            // Use current date as starting point

            for (let i = 0; i < 15 && availableDates.length < 5; i++) {
                const dateStr = checkDate.toISOString().split('T')[0];
                const slots = await AvailabilityService.getAvailableSlots(doctorId, dateStr);
                if (slots.length > 0) {
                    availableDates.push(dateStr);
                }
                checkDate.setDate(checkDate.getDate() + 1);
            }

            if (availableDates.length === 0) {
                const aiNoDates = await AIService.generateResponse(phone, 'INSTRUCCIÓN: Informa al usuario que no hay fechas disponibles próximas para esta especialidad. Pregúntale si desea intentar con otra especialidad. Responde amigablemente como el bot en formato JSON.');
                await this.reply(msg, aiNoDates.message);
                return;
            }

            const specName = specialties.find(s => s.id === validated.specialty_id)?.name || 'esa especialidad';
            let datesList = availableDates.map((d, i) => `${i + 1}. ${new Date(d + 'T00:00:00-05:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}`).join('\n');

            const prompt = `INSTRUCCIÓN DEL SISTEMA: El usuario busca disponibilidad para ${specName}. Encontraste estas opciones:\n${datesList}\nResponde amigablemente como el bot dándole estas opciones para que elija una (por número o fecha). OJO: NO pidas más datos (ni nombre ni hora) todavía, SOLO la fecha. Devuelve formato JSON con action="continue".`;
            const aiRepDates = await AIService.generateResponse(phone, prompt);

            await this.reply(msg, aiRepDates.message);
            return;
        }

        // If date provided, return available slots for that date
        const slots = await AvailabilityService.getAvailableSlots(doctorId, validated.date);

        if (slots.length === 0) {
            const aiNoSlots = await AIService.generateResponse(phone, `INSTRUCCIÓN: Infórmale al usuario que no hay horarios libres para la fecha ${validated.date}. Pregúntale si quiere intentar otro día. Responde en formato JSON.`);
            await this.reply(msg, aiNoSlots.message);
            return;
        }

        // If time is provided, just confirm the time works and say cool, now give me your info
        if (validated.time) {
            const requestedTime = validated.time.substring(0, 5);
            const requestedSlot = slots.find(s => s === requestedTime);
            if (requestedSlot) {
                const aiTimeConfirm = await AIService.generateResponse(phone, `INSTRUCCIÓN: El horario ${requestedTime} del ${validated.date} está libre. Confírmale esto al usuario de manera afirmativa y pídele amigablemente su nombre completo y número de cédula para poder finalizar el agendamiento. NO le preguntes nada más. Responde en formato JSON.`);
                await this.reply(msg, aiTimeConfirm.message);
                return;
            }
        }

        let slotsList = slots.map((s, i) => `${i + 1}. ${s}`).join('\n');
        const slotsPrompt = `INSTRUCCIÓN DEL SISTEMA: El usuario eligió el día ${validated.date}. Encontraste estos horarios libres:\n${slotsList}\nPídele amigablemente al usuario que elija uno de estos horarios (por hora o número). OJO: Aún NO pidas su nombre ni cédula. Formato JSON, action="continue".`;
        const aiRepSlots = await AIService.generateResponse(phone, slotsPrompt);

        await this.reply(msg, aiRepSlots.message);
    },

    // Book appointment (DB ONLY)
    async bookAppointment(phone, data, doctorId) {
        // Get or create patient
        let patient = await db.query('SELECT id FROM patients WHERE phone = $1', [phone]);
        let patientId;

        if (patient.rows.length === 0) {
            const newPatient = await db.query(
                'INSERT INTO patients (phone, full_name, document_id) VALUES ($1, $2, $3) RETURNING id',
                [phone, data.patient_name, data.document_id]
            );
            patientId = newPatient.rows[0].id;
        } else {
            patientId = patient.rows[0].id;
            // Update patient info
            await db.query(
                'UPDATE patients SET full_name = $1, document_id = $2 WHERE id = $3',
                [data.patient_name, data.document_id, patientId]
            );
        }

        // Create appointment
        const startStr = `${data.date}T${data.time}:00-05:00`;
        const endDatetime = new Date(new Date(startStr).getTime() + 30 * 60000).toISOString();
        const confCode = Math.random().toString(36).substring(2, 8).toUpperCase();

        const result = await db.query(`
            INSERT INTO appointments 
            (patient_id, doctor_id, specialty_id, start_datetime, end_datetime, duration_minutes, status, source, confirmation_code)
            VALUES ($1, $2, $3, $4, $5, $6, 'BOOKED', 'WHATSAPP', $7)
            RETURNING *
        `, [patientId, doctorId, data.specialty_id, startStr, endDatetime, 30, confCode]);

        return result.rows[0];
    },

    // Handle cancellation confirmation
    async handleCancellationConfirmation(client, msg, phone, session, text) {
        const response = text.toLowerCase();

        if (response === 'si' || response === 'sí') {
            const payload = JSON.parse(session.payload_json);
            const appointmentId = payload.pending_cancellation_id;

            await db.query(
                'UPDATE appointments SET status = $1 WHERE id = $2',
                ['CANCELLED', appointmentId]
            );

            await this.reply(msg, '✅ Tu cita ha sido cancelada exitosamente. ¿Deseas agendar una nueva cita?');
            await this.resetConversation(phone);
        } else if (response === 'no') {
            await this.reply(msg, 'Entendido, tu cita se mantiene. ¿En qué más puedo ayudarte?');
            await this.resetConversation(phone);
        } else {
            await this.reply(msg, 'Por favor responde *SI* para confirmar la cancelación o *NO* para mantener la cita.');
        }
    },

    // Handle appointment selection for cancellation
    async handleAppointmentSelection(client, msg, phone, session, text) {
        const response = text.toLowerCase();

        if (response === 'ninguna') {
            await this.reply(msg, 'Entendido, no se cancelará ninguna cita. ¿En qué más puedo ayudarte?');
            await this.resetConversation(phone);
            return;
        }

        const payload = JSON.parse(session.payload_json);
        const appointments = payload.appointments_list;
        const selection = parseInt(text);

        if (isNaN(selection) || selection < 1 || selection > appointments.length) {
            await this.reply(msg, `Por favor responde con un número del 1 al ${appointments.length}, o escribe *NINGUNA*.`);
            return;
        }

        const selectedApt = appointments[selection - 1];
        const dateStr = new Date(selectedApt.start_datetime).toLocaleString('es-ES', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'America/Bogota'
        });

        const confirmMsg = `Has seleccionado:\n\n📅 ${dateStr}\n🏥 ${selectedApt.spec_name}\n👨‍⚕️ Dr. ${selectedApt.doctor_name}\n\n¿Confirmas que deseas cancelarla? Responde *SI* o *NO*.`;

        // Update session to confirmation state
        await db.query(
            'UPDATE conversation_sessions SET payload_json = $1, state = $2 WHERE phone = $3',
            [JSON.stringify({ pending_cancellation_id: selectedApt.id }), 'CONFIRMING_CANCELLATION', phone]
        );

        await this.reply(msg, confirmMsg);
    }
};

module.exports = WhatsAppController;
