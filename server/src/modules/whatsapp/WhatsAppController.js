const db = require('../../db');
const AIService = require('../../services/AIService');
const AvailabilityService = require('../../services/AvailabilityService');
const fs = require('fs');
const path = require('path');

const catalogPath1 = path.join(__dirname, '../../../../catalogos.json');
const catalogPath2 = path.join(__dirname, '../../../catalogos.json');
let catalogData = { Ecografias: [], Radiografias: [] };
try {
    if (fs.existsSync(catalogPath1)) {
        catalogData = JSON.parse(fs.readFileSync(catalogPath1, 'utf8'));
    } else if (fs.existsSync(catalogPath2)) {
        catalogData = JSON.parse(fs.readFileSync(catalogPath2, 'utf8'));
    }
} catch (e) {
    console.error("Error loading catalog in WhatsAppController:", e);
}

let socketIo = null;
const testPhones = new Set(); // Stores phones that can talk to Fátima even if globally disabled

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
                // To avoid "Cannot read properties of undefined (reading 'getChat')" errors
                // We should ensure the number is valid and the client is ready
                const numberDetails = await client.getNumberId(chatId);
                if (numberDetails) {
                    await client.sendMessage(numberDetails._serialized, text);
                } else {
                    console.log(`[AI-BOT] Number not registered for ${cleanPhone}, falling back to @lid`);
                    await client.sendMessage(`${cleanPhone}@lid`, text);
                }
            } catch (err) {
                console.log(`[AI-BOT] Error sending to @c.us, falling back to @lid for phone ${cleanPhone}. Error:`, err.message);
                chatId = `${cleanPhone}@lid`;
                try {
                    await client.sendMessage(chatId, text);
                } catch (lidErr) {
                    console.error(`[AI-BOT] Failed completely to send message to ${cleanPhone}:`, lidErr.message);
                }
            }
            await this.logMessage(cleanPhone, text, true);
        } catch (error) {
            console.error('Error sending message:', error);
        }
    },

    // Send Booking Confirmation
    async sendBookingConfirmation(client, phone, appointment, specialtyName, doctorName, patientName, recommendation) {
        const dateStr = new Date(appointment.start_datetime).toLocaleDateString('es-ES', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Bogota'
        });
        const timeStr = new Date(appointment.start_datetime).toLocaleTimeString('es-ES', {
            hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'America/Bogota'
        });

        let message = `✅ *¡Cita Confirmada!*\n\n📅 ${dateStr}\n⏰ ${timeStr}\n🏥 ${specialtyName || ''}\n👨‍⚕️ Dr. ${doctorName || ''}\n👤 ${patientName}\n🔑 Código: *${appointment.confirmation_code}*\n\n`;

        if (recommendation) {
            message += `*Preparación / Recomendaciones:*\n_${recommendation}_\n\n`;
        }

        message += `Por favor llega 10 minutos antes.`;

        await this.sendMessage(client, phone, message);
    },

    async getOrCreateSession(phone) {
        try {
            let res = await db.query('SELECT * FROM conversation_sessions WHERE phone = $1', [phone]);
            if (res.rows.length === 0) {
                try {
                    await db.query(
                        'INSERT INTO conversation_sessions (phone, state, is_bot_active) VALUES ($1, $2, $3)',
                        [phone, 'ACTIVE', true]
                    );
                } catch (insertErr) {
                    if (insertErr.code === '23505') {
                        // Unique violation - row was likely inserted between our SELECT and INSERT
                        res = await db.query('SELECT * FROM conversation_sessions WHERE phone = $1', [phone]);
                    } else {
                        throw insertErr;
                    }
                }
                res = await db.query('SELECT * FROM conversation_sessions WHERE phone = $1', [phone]);
            }
            return res.rows[0];
        } catch (err) {
            console.error('Bot Error in getOrCreateSession:', err);
            // Fallback: return a basic session object to avoid crashing
            return { phone, state: 'ACTIVE', is_bot_active: true };
        }
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
    async handleMessage(client, msg, isBotEnabledGlobal = true) {
        const phone = msg.from.split('@')[0]; // Clean @c.us or @lid
        const text = msg.body.trim();
        console.log(`[AI-BOT] Received from ${msg.from} (clean: ${phone}): "${text}"`);

        // Test mode commands
        if (text.toLowerCase() === 'activar modo pruebas') {
            testPhones.add(phone);
            await this.reply(msg, '🛠️ Fátima te ha añadido a la lista de pruebas. Responderé tus mensajes aunque el bot esté apagado globalmente.');
            return;
        }

        if (text.toLowerCase() === 'desactivar modo pruebas') {
            testPhones.delete(phone);
            await this.reply(msg, '🛑 Has sido removido de la lista de pruebas. Ya no recibirás respuestas si el bot global está desactivado.');
            return;
        }

        // If the bot is disabled globally and the user is not in the test list, ignore the message completely
        if (!isBotEnabledGlobal && !testPhones.has(phone)) {
            console.log(`[BOT-DEBUG] Bot is globally off. Phone ${phone} is NOT in testPhones. Ignoring.`);
            return;
        }

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

                let txt = '¡Gracias! ¿A qué entidad perteneces? Responde con el número correspondiente:\n\n';
                txt += '1. Particular\n';
                txt += '2. ARL\n';
                txt += '3. SOAT\n';
                txt += '4. EPS Alianza Salud\n';
                txt += '5. EPS Compensar\n';
                txt += '6. Medicina Prepagada';

                await this.reply(msg, txt);

                await db.query(
                    'UPDATE conversation_sessions SET state = $1, payload_json = $2 WHERE phone = $3',
                    ['AWAITING_ENTIDAD', JSON.stringify(payload), phone]
                );
                return;
            }
            if (session.state === 'AWAITING_ENTIDAD') {
                const payload = typeof session.payload_json === 'string' ? JSON.parse(session.payload_json) : (session.payload_json || {});
                const index = parseInt(text);

                if (isNaN(index) || index < 1 || index > 6) {
                    await this.reply(msg, 'Por favor, responde con un número válido del 1 al 6.');
                    return;
                }

                const entidades = ['PARTICULAR', 'ARL', 'SOAT', 'ALIANZA SALUD', 'COMPENSAR', 'MEDICINA PREPAGADA'];
                const entidadStr = entidades[index - 1];
                payload.entidad = entidadStr;

                const getMenuText = async (payloadObj) => {
                    const services = await db.query('SELECT id, name FROM services WHERE is_active = TRUE ORDER BY name');
                    payloadObj.services = services.rows;

                    let txtStr = '';
                    services.rows.forEach((s, idx) => {
                        txtStr += `${idx + 1}. ${s.name}\n`;
                    });
                    return txtStr;
                };

                if (entidadStr === 'ARL' || entidadStr === 'SOAT') {
                    let alertTxt = `⚠️ *IMPORTANTE*: Para agendar citas por ${entidadStr}, debes presentar en ventanilla:\n\n`;
                    alertTxt += `- Historia Clínica\n- ARL Vigente (si aplica)\n- Certificado laboral (si aplica)\n- Exámenes autorizados\n\n`;
                    alertTxt += `_Si no presentas esta documentación completa a la hora de llegar, no podrás tomar tu cita._\n\n`;
                    alertTxt += 'Continuemos. ¿Para qué *Servicio* deseas agendar cita? Responde con el número correspondiente:\n\n';

                    alertTxt += await getMenuText(payload);
                    await this.reply(msg, alertTxt);

                    await db.query(
                        'UPDATE conversation_sessions SET state = $1, payload_json = $2 WHERE phone = $3',
                        ['AWAITING_SERVICE', JSON.stringify(payload), phone]
                    );
                    return;
                } else if (entidadStr === 'ALIANZA SALUD' || entidadStr === 'COMPENSAR') {
                    const txt = `¿A qué régimen perteneces en ${entidadStr}?\n\n1. Contributivo\n2. Subsidiado`;
                    await this.reply(msg, txt);

                    await db.query(
                        'UPDATE conversation_sessions SET state = $1, payload_json = $2 WHERE phone = $3',
                        ['AWAITING_REGIMEN', JSON.stringify(payload), phone]
                    );
                    return;
                } else if (entidadStr === 'MEDICINA PREPAGADA') {
                    const txt = `Entendido. Por favor ingresa el *Número de Autorización* de tu servicio.\n\n_Si no lo tienes, será obligatorio presentarlo en ventanilla._`;
                    await this.reply(msg, txt);

                    await db.query(
                        'UPDATE conversation_sessions SET state = $1, payload_json = $2 WHERE phone = $3',
                        ['AWAITING_AUTORIZACION', JSON.stringify(payload), phone]
                    );
                    return;
                } else if (entidadStr === 'PARTICULAR') {
                    let txt = `Has seleccionado Particular.\n\n¿Para qué *Servicio* deseas agendar cita? Responde con el número correspondiente:\n\n`;
                    txt += await getMenuText(payload);

                    await this.reply(msg, txt);
                    await db.query(
                        'UPDATE conversation_sessions SET state = $1, payload_json = $2 WHERE phone = $3',
                        ['AWAITING_SERVICE', JSON.stringify(payload), phone]
                    );
                    return;
                }
            }

            if (session.state === 'AWAITING_REGIMEN') {
                const payload = typeof session.payload_json === 'string' ? JSON.parse(session.payload_json) : (session.payload_json || {});
                const resp = text.trim();

                if (resp === '1' || resp.toLowerCase() === 'contributivo') {
                    payload.regimen = 'CONTRIBUTIVO';
                } else if (resp === '2' || resp.toLowerCase() === 'subsidiado') {
                    payload.regimen = 'SUBSIDIADO';
                } else {
                    await this.reply(msg, 'Por favor responde con 1 (Contributivo) o 2 (Subsidiado).');
                    return;
                }

                const txt = `Entendido (${payload.regimen}). Por favor ingresa el *Número de Autorización* de tu servicio.\n\n_Si no lo tienes, será obligatorio presentarlo en ventanilla._`;
                await this.reply(msg, txt);

                await db.query(
                    'UPDATE conversation_sessions SET state = $1, payload_json = $2 WHERE phone = $3',
                    ['AWAITING_AUTORIZACION', JSON.stringify(payload), phone]
                );
                return;
            }

            if (session.state === 'AWAITING_AUTORIZACION') {
                const payload = typeof session.payload_json === 'string' ? JSON.parse(session.payload_json) : (session.payload_json || {});

                const authCode = text.trim();
                const isAllSame = /^(.)\1+$/.test(authCode);
                const isSequentialAsc = '01234567890123456789'.includes(authCode);
                const isSequentialDesc = '98765432109876543210'.includes(authCode);

                if (authCode.length < 5 || isAllSame || (isSequentialAsc && authCode.length > 3) || (isSequentialDesc && authCode.length > 3)) {
                    await this.reply(msg, 'Por favor, ingresa un número de autorización válido. No se permiten números secuenciales o repetidos (ej. 123456 o 1111).');
                    return;
                }

                payload.autorizacion = authCode;

                const services = await db.query('SELECT id, name FROM services WHERE is_active = TRUE ORDER BY name');
                payload.services = services.rows;

                let txt = '¡Perfecto! ¿Para qué *Servicio* deseas agendar cita? Responde con el número:\n\n';
                services.rows.forEach((s, idx) => {
                    txt += `${idx + 1}. ${s.name}\n`;
                });

                await this.reply(msg, txt);
                await db.query(
                    'UPDATE conversation_sessions SET state = $1, payload_json = $2 WHERE phone = $3',
                    ['AWAITING_SERVICE', JSON.stringify(payload), phone]
                );
                return;
            }

            if (session.state === 'AWAITING_SERVICE') {
                const payload = typeof session.payload_json === 'string' ? JSON.parse(session.payload_json) : (session.payload_json || {});
                const index = parseInt(text) - 1;

                if (isNaN(index) || index < 0 || index >= (payload.services || []).length) {
                    await this.reply(msg, 'Por favor, responde con un número válido de la lista.');
                    return;
                }

                const service = payload.services[index];
                payload.service_id = service.id;
                payload.service_name = service.name;

                const normService = service.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

                if (normService.includes('medicina especializada') || normService.includes('general')) {
                    const specialties = await db.query('SELECT id, name FROM specialties WHERE service_id = $1 AND is_active = TRUE', [service.id]);
                    payload.specialties = specialties.rows;

                    if (specialties.rows.length === 0) {
                        await this.reply(msg, `Lo siento, no hay especialidades activas para ${service.name} en este momento.`);
                        return;
                    }

                    if (specialties.rows.length === 1) {
                        const spec = specialties.rows[0];
                        payload.specialty_id = spec.id;
                        payload.specialty_name = spec.name;
                        let txt = `Elegiste ${service.name} (${spec.name}).\n\n¿Qué tipo de consulta es?\n1. Primera vez\n2. Control`;
                        await this.reply(msg, txt);
                        await db.query('UPDATE conversation_sessions SET state = $1, payload_json = $2 WHERE phone = $3', ['AWAITING_CONSULTATION_TYPE', JSON.stringify(payload), phone]);
                        return;
                    }

                    let txt = `Elegiste ${service.name}. ¿Para qué especialidad deseas agendar? Responde con el número:\n\n`;
                    specialties.rows.forEach((s, idx) => {
                        txt += `${idx + 1}. ${s.name}\n`;
                    });
                    await this.reply(msg, txt);
                    await db.query('UPDATE conversation_sessions SET state = $1, payload_json = $2 WHERE phone = $3', ['AWAITING_SPECIALTY', JSON.stringify(payload), phone]);
                    return;

                } else if (normService.includes('ecografia') || normService.includes('radiografia')) {
                    const catalogKey = normService.includes('ecografia') ? 'Ecografias' : 'Radiografias';
                    payload.catalog_type = catalogKey;

                    let txt = `Has seleccionado ${service.name}.\n\nPor favor escribe el nombre del examen que necesitas (ej. "Obstétrica", "Tórax") o algunas palabras clave.`;
                    await this.reply(msg, txt);
                    await db.query('UPDATE conversation_sessions SET state = $1, payload_json = $2 WHERE phone = $3', ['AWAITING_CATALOG_SEARCH', JSON.stringify(payload), phone]);
                    return;

                } else if (normService.includes('fisioterapia')) {
                    let txt = `Elegiste ${service.name}.\n\n¿Qué tipo de atención necesitas?\n1. Consulta\n2. Terapia Física`;
                    await this.reply(msg, txt);
                    await db.query('UPDATE conversation_sessions SET state = $1, payload_json = $2 WHERE phone = $3', ['AWAITING_FISIO_TYPE', JSON.stringify(payload), phone]);
                    return;

                } else if (normService.includes('odontologia')) {
                    let txt = `Elegiste ${service.name}.\n\n¿Qué tipo de atención necesitas?\n1. Odontología General\n2. Ortodoncia`;
                    await this.reply(msg, txt);
                    await db.query('UPDATE conversation_sessions SET state = $1, payload_json = $2 WHERE phone = $3', ['AWAITING_ODONTO_TYPE', JSON.stringify(payload), phone]);
                    return;

                } else if (normService.includes('enfermeria')) {
                    let txt = `Elegiste ${service.name}.\n\n¿Qué tipo de atención necesitas?\n1. Consultas\n2. Procedimientos`;
                    await this.reply(msg, txt);
                    await db.query('UPDATE conversation_sessions SET state = $1, payload_json = $2 WHERE phone = $3', ['AWAITING_ENFERM_TYPE', JSON.stringify(payload), phone]);
                    return;

                } else if (normService.includes('laboratorio')) {
                    let txt = `*${service.name}*\n\n⚠️ Solo se pueden tomar exámenes de 7:00 AM a 9:00 AM. Algunos exámenes específicos solo se toman de 7:00 AM a 7:30 AM.\n\nPara agendar laboratorios, debes dirigirte a nuestra plataforma web, o bien, responder a este mensaje adjuntando una sola *imagen clara de tu orden médica*.\n\nUn asesor la revisará y se comunicará contigo hoy mismo. (Escribe *NO* si deseas cancelar).`;
                    await this.reply(msg, txt);
                    await db.query('UPDATE conversation_sessions SET state = $1, payload_json = $2 WHERE phone = $3', ['AWAITING_LAB_PHOTO', JSON.stringify(payload), phone]);
                    return;
                } else {
                    // Fallback
                    const specialties = await db.query('SELECT id, name FROM specialties WHERE service_id = $1 AND is_active = TRUE', [service.id]);
                    payload.specialties = specialties.rows;
                    let txt = `Elegiste ${service.name}. ¿Para qué especialidad deseas agendar? Responde con el número:\n\n`;
                    specialties.rows.forEach((s, idx) => {
                        txt += `${idx + 1}. ${s.name}\n`;
                    });
                    await this.reply(msg, txt);
                    await db.query('UPDATE conversation_sessions SET state = $1, payload_json = $2 WHERE phone = $3', ['AWAITING_SPECIALTY', JSON.stringify(payload), phone]);
                    return;
                }
            }

            if (session.state === 'AWAITING_SPECIALTY') {
                const payload = typeof session.payload_json === 'string' ? JSON.parse(session.payload_json) : (session.payload_json || {});
                const index = parseInt(text) - 1;

                if (isNaN(index) || index < 0 || index >= (payload.specialties || []).length) {
                    await this.reply(msg, 'Por favor, responde con un número válido de la lista.');
                    return;
                }

                const specialty = payload.specialties[index];
                payload.specialty_id = specialty.id;
                payload.specialty_name = specialty.name;

                let txt = `Elegiste ${specialty.name}.\n\nPara continuar, ¿Qué tipo de consulta es?\n1. Primera vez\n2. Control`;

                await this.reply(msg, txt);

                await db.query(
                    'UPDATE conversation_sessions SET state = $1, payload_json = $2 WHERE phone = $3',
                    ['AWAITING_CONSULTATION_TYPE', JSON.stringify(payload), phone]
                );
                return;
            }

            if (session.state === 'AWAITING_CATALOG_SEARCH') {
                const payload = typeof session.payload_json === 'string' ? JSON.parse(session.payload_json) : (session.payload_json || {});

                // Helper to remove accents and make lowercase
                const normalizeString = (str) => {
                    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
                };

                const searchTerm = normalizeString(text);

                const catalogItems = catalogData[payload.catalog_type] || [];
                const matches = catalogItems.filter(item => normalizeString(item.name).includes(searchTerm));

                if (matches.length === 0) {
                    await this.reply(msg, `No encontré ningún examen que coincida con "${text}". Por favor intenta con otra palabra clave o nombre.`);
                    return;
                }

                if (matches.length > 8) {
                    await this.reply(msg, `Encontré demasiados exámenes que coinciden con "${text}" (${matches.length}). Por favor sé más específico.`);
                    return;
                }

                if (matches.length === 1) {
                    const item = matches[0];
                    payload.catalog_item = item;

                    let txt = `Encontré este examen: *${item.name}*.\n\n`;
                    if (payload.entidad === 'PARTICULAR') {
                        txt += `El costo parcial estimado es de *$${item.price}*.\n\n`;
                    }
                    txt += `¿Deseas agendar este examen? Responde *SI* para continuar o *NO* para buscar otro.`;

                    await this.reply(msg, txt);
                    await db.query(
                        'UPDATE conversation_sessions SET state = $1, payload_json = $2 WHERE phone = $3',
                        ['AWAITING_CATALOG_CONFIRM', JSON.stringify(payload), phone]
                    );
                    return;
                }

                // Multiple
                payload.catalog_matches = matches;
                let txt = `Encontré estas opciones. Responde con el número de tu examen:\n\n`;
                matches.forEach((m, idx) => {
                    txt += `${idx + 1}. ${m.name}\n`;
                });

                await this.reply(msg, txt);
                await db.query(
                    'UPDATE conversation_sessions SET state = $1, payload_json = $2 WHERE phone = $3',
                    ['AWAITING_CATALOG_SELECTION', JSON.stringify(payload), phone]
                );
                return;
            }

            if (session.state === 'AWAITING_CATALOG_SELECTION') {
                const payload = typeof session.payload_json === 'string' ? JSON.parse(session.payload_json) : (session.payload_json || {});
                const idx = parseInt(text) - 1;

                if (isNaN(idx) || idx < 0 || idx >= payload.catalog_matches.length) {
                    await this.reply(msg, 'Por favor, responde con un número válido de la lista.');
                    return;
                }

                const item = payload.catalog_matches[idx];
                payload.catalog_item = item;

                let txt = `Perfecto. Seleccionaste: *${item.name}*.\n\n`;
                if (payload.entidad === 'PARTICULAR') {
                    txt += `El costo estimado para este examen es de *$${item.price}*.\n\n`;
                }
                txt += `¿Deseas confirmar la agendación para este examen? Responde *SI* o *NO*.`;

                await this.reply(msg, txt);
                await db.query(
                    'UPDATE conversation_sessions SET state = $1, payload_json = $2 WHERE phone = $3',
                    ['AWAITING_CATALOG_CONFIRM', JSON.stringify(payload), phone]
                );
                return;
            }

            // Reusable function to fetch doctors and send to AWAITING_DOCTOR
            const transitionToDoctorSelection = async (payloadObj, phoneNum, msgObj) => {
                let q = `
                    SELECT DISTINCT d.id, d.full_name 
                    FROM doctors d
                    JOIN doctor_specialties ds ON d.id = ds.doctor_id
                    JOIN specialties s ON ds.specialty_id = s.id
                    WHERE d.is_active = TRUE
                `;
                let params = [];
                if (payloadObj.specialty_id) {
                    q += ' AND s.id = $1';
                    params.push(payloadObj.specialty_id);
                } else if (payloadObj.service_id) {
                    q += ' AND s.service_id = $1';
                    params.push(payloadObj.service_id);
                }

                const docs = await db.query(q, params);
                if (docs.rows.length === 0) {
                    await this.reply(msgObj, 'Lo siento, no hay médicos asignados para este servicio en este momento. Escribe "HOLA" para empezar de nuevo.');
                    await this.resetConversation(phoneNum);
                    return;
                }

                payloadObj.doctors = docs.rows;
                let textMsg = '¿Con qué profesional deseas agendar?\n\n';
                docs.rows.forEach((doc, idx) => {
                    textMsg += `${idx + 1}. Dr. ${doc.full_name}\n`;
                });

                await this.reply(msgObj, textMsg);
                await db.query(
                    'UPDATE conversation_sessions SET state = $1, payload_json = $2 WHERE phone = $3',
                    ['AWAITING_DOCTOR', JSON.stringify(payloadObj), phoneNum]
                );
            };

            if (session.state === 'AWAITING_LAB_PHOTO') {
                const resp = text.toLowerCase().trim();
                if (resp === 'no' || resp === 'n') {
                    await this.reply(msg, `Entendido. Cita de laboratorio cancelada. ¿En qué más te puedo ayudar?`);
                    await this.resetConversation(phone);
                    return;
                }

                if (msg.hasMedia) {
                    try {
                        const media = await msg.downloadMedia();

                        // Find or create patient
                        let patient = await db.query('SELECT id FROM patients WHERE phone = $1', [phone]);
                        let patientId;

                        if (patient.rows.length === 0) {
                            const newPatient = await db.query(
                                'INSERT INTO patients (phone, full_name, document_id) VALUES ($1, $2, $3) RETURNING id',
                                [phone, 'Paciente WhatsApp', null]
                            );
                            patientId = newPatient.rows[0].id;
                        } else {
                            patientId = patient.rows[0].id;
                        }

                        // Generate a generic filename
                        const extension = media.mimetype.split('/')[1] || 'jpeg';
                        const fileName = `Orden_Laboratorio_WP_${Date.now()}.${extension}`;

                        // Save image base64 data to patient_results table
                        const base64Data = `data:${media.mimetype};base64,${media.data}`;

                        await db.query(
                            'INSERT INTO patient_results (patient_id, file_name, file_data, mime_type, uploaded_by) VALUES ($1, $2, $3, $4, NULL)',
                            [patientId, fileName, base64Data, media.mimetype]
                        );

                        await this.reply(msg, `¡Fotografía recibida y guardada con éxito!\n\nUn asesor de laboratorio revisará tu orden y se pondrá en contacto contigo en breve para proceder con tu agendamiento de laboratorio.\n\n¡Gracias por preferir a la IPS Nuestra Señora de Fátima!`);
                    } catch (err) {
                        console.error('Error saving lab photo from WhatsApp:', err);
                        await this.reply(msg, 'Hubo un error al guardar tu fotografía. Por favor, intenta enviarla de nuevo.');
                    }
                    await this.resetConversation(phone);
                    return;
                } else {
                    await this.reply(msg, `Por favor, asegúrate de adjuntar una fotografía clara de tu orden médica usando el ícono de 📎 o +, o escribe *NO* para cancelar el proceso.`);
                    return;
                }
            }

            if (session.state === 'AWAITING_CATALOG_CONFIRM') {
                const payload = typeof session.payload_json === 'string' ? JSON.parse(session.payload_json) : (session.payload_json || {});
                const resp = text.toLowerCase().trim();

                if (resp === 'no' || resp === 'n') {
                    await this.reply(msg, `Entendido. Escribe el nombre del examen que buscas de nuevo, o escribe "HOLA" para reiniciar.`);
                    await db.query('UPDATE conversation_sessions SET state = $1 WHERE phone = $2', ['AWAITING_CATALOG_SEARCH', phone]);
                    return;
                } else if (resp !== 'si' && resp !== 'sí' && resp !== 's') {
                    await this.reply(msg, `Por favor responde con *SI* o *NO* para confirmar.`);
                    return;
                }

                if (payload.catalog_item && payload.catalog_item.recommendation) {
                    await this.reply(msg, `Te hemos enviado las recomendaciones previas. Por favor, revísalas atentamente antes del examen.\n\n📋 *Recomendaciones:*\n${payload.catalog_item.recommendation}`);
                }

                const isEco = payload.catalog_type === 'Ecografias';
                const specDb = await db.query('SELECT id FROM specialties WHERE name ILIKE $1 LIMIT 1', [isEco ? '%Ecograf%' : 'Radio%']);

                if (specDb.rows.length > 0) payload.specialty_id = specDb.rows[0].id;
                payload.specialty_name = payload.catalog_item.name;
                payload.consultation_type = 'EXAMEN';

                await transitionToDoctorSelection(payload, phone, msg);
                return;
            }

            if (session.state === 'AWAITING_CONSULTATION_TYPE') {
                const payload = typeof session.payload_json === 'string' ? JSON.parse(session.payload_json) : (session.payload_json || {});
                const resp = text.trim();

                if (resp === '1' || resp.toLowerCase() === 'primera vez') {
                    payload.consultation_type = 'Primera Vez';
                } else if (resp === '2' || resp.toLowerCase() === 'control') {
                    payload.consultation_type = 'Control';
                } else {
                    await this.reply(msg, `Por favor responde con 1 (Primera Vez) o 2 (Control).`);
                    return;
                }

                await transitionToDoctorSelection(payload, phone, msg);
                return;
            }

            // NEW BRANCH HANDLERS

            if (session.state === 'AWAITING_FISIO_TYPE') {
                const payload = typeof session.payload_json === 'string' ? JSON.parse(session.payload_json) : (session.payload_json || {});
                if (text === '1') payload.consultation_type = 'Consulta';
                else if (text === '2') payload.consultation_type = 'Terapia Fisica';
                else { await this.reply(msg, 'Responde con 1 o 2.'); return; }

                await transitionToDoctorSelection(payload, phone, msg);
                return;
            }

            if (session.state === 'AWAITING_ODONTO_TYPE') {
                const payload = typeof session.payload_json === 'string' ? JSON.parse(session.payload_json) : (session.payload_json || {});
                if (text === '1') payload.specialty_name = 'Odontología General';
                else if (text === '2') payload.specialty_name = 'Ortodoncia';
                else { await this.reply(msg, 'Responde con 1 o 2.'); return; }

                await transitionToDoctorSelection(payload, phone, msg);
                return;
            }

            if (session.state === 'AWAITING_ENFERM_TYPE') {
                const payload = typeof session.payload_json === 'string' ? JSON.parse(session.payload_json) : (session.payload_json || {});
                if (text === '1') {
                    await this.reply(msg, '¿Qué tipo de consulta?\n1. Primera vez\n2. Control\n3. Crecimiento y Desarrollo\n4. Planificación');
                    await db.query('UPDATE conversation_sessions SET state = $1, payload_json = $2 WHERE phone = $3', ['AWAITING_ENFERM_CONSULTA', JSON.stringify(payload), phone]);
                } else if (text === '2') {
                    await this.reply(msg, '¿Qué procedimiento necesitas?\n1. Citología (25-29 años)\n2. ADN VPH (30-65 años)\n3. Electrocardiograma\n4. Prueba de Esfuerzo\n5. Curaciones\n6. Toma de Tensión / Glucometría\n7. Ecocardiograma');
                    await db.query('UPDATE conversation_sessions SET state = $1, payload_json = $2 WHERE phone = $3', ['AWAITING_ENFERM_PROC', JSON.stringify(payload), phone]);
                } else {
                    await this.reply(msg, 'Responde con 1 o 2.');
                }
                return;
            }

            if (session.state === 'AWAITING_ENFERM_CONSULTA') {
                const payload = typeof session.payload_json === 'string' ? JSON.parse(session.payload_json) : (session.payload_json || {});
                const types = ['Primera vez', 'Control', 'Crecimiento y Desarrollo', 'Planificacion'];
                const idx = parseInt(text) - 1;
                if (isNaN(idx) || idx < 0 || idx >= types.length) { await this.reply(msg, 'Responde del 1 al 4.'); return; }
                payload.consultation_type = types[idx];
                await transitionToDoctorSelection(payload, phone, msg);
                return;
            }

            if (session.state === 'AWAITING_ENFERM_PROC') {
                const payload = typeof session.payload_json === 'string' ? JSON.parse(session.payload_json) : (session.payload_json || {});
                const procs = ['Citología', 'ADN VPH', 'Electrocardiograma', 'Prueba de Esfuerzo', 'Curaciones', 'Toma de Tensión / Glucometría', 'Ecocardiograma'];
                const idx = parseInt(text) - 1;
                if (isNaN(idx) || idx < 0 || idx >= procs.length) { await this.reply(msg, 'Responde del 1 al 7.'); return; }

                payload.consultation_type = 'PROCEDIMIENTO: ' + procs[idx];

                if (idx === 0 || idx === 1) await this.reply(msg, '⚠️ No olvides prepararte: No tener relaciones sexuales, ni usar óvulos ni duchas vaginales 3 días antes de la toma. No ir en el periodo. Asistir en horas de la mañana.');
                else if (idx === 2 || idx === 3 || idx === 6) await this.reply(msg, '⚠️ No olvides prepararte: Asistir con ropa cómoda y no consumir metoprolol o bloqueadores 24h previas al examen.');

                await transitionToDoctorSelection(payload, phone, msg);
                return;
            }

            if (session.state === 'AWAITING_DOCTOR') {
                const payload = typeof session.payload_json === 'string' ? JSON.parse(session.payload_json) : (session.payload_json || {});
                const index = parseInt(text) - 1;

                if (isNaN(index) || index < 0 || index >= (payload.doctors || []).length) {
                    await this.reply(msg, 'Por favor, responde con un número válido de la lista.');
                    return;
                }

                const doctorId = payload.doctors[index].id;
                payload.doctor_id = doctorId;

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
                    await this.reply(msg, 'Lo siento, no hay fechas próximas para este médico o servicio. Escribe "HOLA" para reiniciar.');
                    await this.resetConversation(phone);
                    return;
                }

                let txt = '¿Qué fecha prefieres? Responde con el número:\n\n';
                availableDates.forEach((d, idx) => {
                    const dStr = new Date(d + 'T00:00:00-05:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
                    txt += `${idx + 1}. ${dStr}\n`;
                });

                await this.reply(msg, txt);

                payload.available_dates = availableDates;

                await db.query('UPDATE conversation_sessions SET state = $1, payload_json = $2 WHERE phone = $3', ['AWAITING_DATE', JSON.stringify(payload), phone]);
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

                const pendingBooking = {
                    specialty_id: payload.specialty_id,
                    doctorId: payload.doctor_id,
                    date: payload.date,
                    time: payload.time,
                    patient_name: payload.patient_name,
                    patient_id: payload.patient_id_number,
                    notes: JSON.stringify({ entidad: payload.entidad, regimen: payload.regimen, autorizacion: payload.autorizacion, consultation_type: payload.consultation_type }),
                    total_price: payload.catalog_item && payload.entidad === 'PARTICULAR' ? payload.catalog_item.price : null
                };

                if (payload.regimen === 'SUBSIDIADO') {
                    try {
                        const appointment = await this.bookAppointment(phone, pendingBooking, pendingBooking.doctorId);
                        let recommendation = payload.catalog_item?.recommendation || null;

                        let confirmTxt = `¡Hola ${payload.patient_name}! Tu cita ha sido agendada con éxito.\n\n`;
                        confirmTxt += `📅 Fecha: ${dateStr}\n⏰ Hora: ${timeStr}\n🏥 Especialidad: ${payload.specialty_name}\n👨‍⚕️ Dr. ${docName}\n\n`;
                        confirmTxt += `Al ser régimen Subsidiado, tu atención no tiene costo de cuota moderadora en ventanilla.\n\n¡Te esperamos! Recuerda llegar 15 minutos antes.`;

                        await this.reply(msg, confirmTxt);
                        if (recommendation) {
                            await this.reply(msg, `📋 *Recomendaciones para tu examen:*\n${recommendation}`);
                        }
                        await this.resetConversation(phone);
                        return;
                    } catch (err) {
                        console.error('Error auto-booking subsidiado:', err);
                        await this.reply(msg, 'Ocurrió un error al guardar la cita. Por favor intenta más tarde o escribe *REINICIAR*.');
                        await this.resetConversation(phone);
                        return;
                    }
                } else {
                    let confirmMsg = `¡Todo listo para agendar!\n\n📅 Fecha: ${dateStr}\n⏰ Hora: ${timeStr}\n🏥 Especialidad: ${payload.specialty_name}\n👨‍⚕️ Dr. ${docName}\n👤 Paciente: ${payload.patient_name} (${payload.patient_id_number})\n\n`;

                    if (payload.entidad === 'PARTICULAR') {
                        let finalPrice = pendingBooking.total_price ? `$${pendingBooking.total_price}` : 'determinado según servicio';
                        confirmMsg += `⚠️ *Atención Particular*: El costo de tu atención será ${finalPrice}. El pago debe realizarse en ventanilla el día de la cita.\n\n`;
                    }

                    confirmMsg += `¿Deseas confirmar la cita? Responde *SI* para agendar o *NO* para cancelar.`;

                    await db.query(
                        'UPDATE conversation_sessions SET payload_json = $1, state = $2 WHERE phone = $3',
                        [JSON.stringify({ pending_booking: pendingBooking }), 'CONFIRMING_BOOKING', phone]
                    );

                    await this.reply(msg, confirmMsg);
                    return;
                }
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

    async handleCancellationRequest(client, msg, phone, aiResponse) {
        const res = await db.query(`
            SELECT a.id, a.start_datetime, s.name as spec_name, d.full_name as doctor_name,
                   (a.start_datetime > CURRENT_TIMESTAMP + interval '3 hours') as can_cancel
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

        const cancelable = res.rows.filter(r => r.can_cancel);

        if (cancelable.length === 0) {
            await this.reply(msg, 'Tienes citas agendadas, pero no pueden ser canceladas por este medio. Recuerda que para poder cancelar una cita debes hacerlo con un mínimo de 3 horas de anticipación.');
            return;
        }

        if (cancelable.length === 1) {
            // Only one appointment, ask for confirmation
            const apt = cancelable[0];
            const dateStr = new Date(apt.start_datetime).toLocaleString('es-ES', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'America/Bogota'
            });

            const confirmMsg = `Tienes 1 cita agendada que puedes cancelar:\n\n📅 ${dateStr}\n🏥 ${apt.spec_name}\n👨‍⚕️ Dr. ${apt.doctor_name}\n\n¿Deseas cancelarla? Responde *SI* para confirmar o *NO* para mantenerla.`;

            // Store appointment ID in session
            await db.query(
                'UPDATE conversation_sessions SET payload_json = $1, state = $2 WHERE phone = $3',
                [JSON.stringify({ pending_cancellation_id: apt.id }), 'CONFIRMING_CANCELLATION', phone]
            );

            await this.reply(msg, confirmMsg);
        } else {
            // Multiple appointments, let user choose
            let listMsg = `Tienes ${cancelable.length} cita(s) cancelable(s):\n\n`;
            cancelable.forEach((apt, i) => {
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
            listMsg += `\n¿Cuál deseas cancelar? Responde con el número (1-${cancelable.length}) o escribe *NINGUNA* para no cancelar.`;

            // Store appointments in session
            await db.query(
                'UPDATE conversation_sessions SET payload_json = $1, state = $2 WHERE phone = $3',
                [JSON.stringify({ appointments_list: cancelable }), 'SELECTING_APPOINTMENT_TO_CANCEL', phone]
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

                let recommendation = null;
                if (payload.catalog_item && payload.catalog_item.recommendation) {
                    recommendation = payload.catalog_item.recommendation;
                }

                await this.sendBookingConfirmation(client, phone, appointment, specName, docName, data.patient_name, recommendation);

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
            doctorId,
            total_price: aiResponse.extracted_data.total_price || null
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

        let notes = null;
        if (data.consultation_type) {
            notes = `Tipo de Consulta: ${data.consultation_type}`;
        }

        const result = await db.query(
            `INSERT INTO appointments 
             (patient_id, doctor_id, specialty_id, start_datetime, end_datetime, duration_minutes, source, confirmation_code, status, total_price, notes) 
             VALUES ($1, $2, $3, $4, $5, $6, 'WHATSAPP', $7, 'BOOKED', $8, $9) 
             RETURNING *`,
            [patientId, doctorId, data.specialty_id, startStr, endDatetime, 30, confCode, data.total_price || null, notes]
        );
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
