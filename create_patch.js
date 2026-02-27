const fs = require('fs');

const whatsappControllerPath = 'server/src/modules/whatsapp/WhatsAppController.js';
let content = fs.readFileSync(whatsappControllerPath, 'utf8');

// We need to inject the `AWAITING_DOCTOR` logic and the transition from different branches.
const oldBlock = `
            if (session.state === 'AWAITING_CATALOG_CONFIRM') {
                const payload = typeof session.payload_json === 'string' ? JSON.parse(session.payload_json) : (session.payload_json || {});
                const resp = text.toLowerCase().trim();

                if (resp === 'no' || resp === 'n') {
                    await this.reply(msg, \`Entendido. Escribe el nombre del examen que buscas de nuevo, o escribe "HOLA" para reiniciar.\`);
                    await db.query(
                        'UPDATE conversation_sessions SET state = $1 WHERE phone = $2',
                        ['AWAITING_CATALOG_SEARCH', phone]
                    );
                    return;
                } else if (resp !== 'si' && resp !== 'sí' && resp !== 's') {
                    await this.reply(msg, \`Por favor responde con *SI* o *NO* para confirmar.\`);
                    return;
                }

                // Confirmed! Now find availability. As it's generic eco/rad we need to fallback query the DB specialty
                const isEco = payload.catalog_type === 'Ecografias';
                const likeQ = isEco ? '%Ecograf%' : 'Radio%'; // fallback
                const specDb = await db.query('SELECT id FROM specialties WHERE name ILIKE $1 LIMIT 1', [likeQ]);

                let actualSpecId = null;

                if (specDb.rows.length > 0) {
                    actualSpecId = specDb.rows[0].id;
                }

                const newPayload = {
                    ...payload,
                    specialty_id: actualSpecId,
                    specialty_name: payload.catalog_item.name
                };

                let txt = \`Excelente.\\n\\nPara continuar, ¿Qué tipo de consulta es?\\n1. Primera vez\\n2. Control\`;

                await this.reply(msg, txt);

                await db.query(
                    'UPDATE conversation_sessions SET state = $1, payload_json = $2 WHERE phone = $3',
                    ['AWAITING_CONSULTATION_TYPE', JSON.stringify(newPayload), phone]
                );
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
                    await this.reply(msg, \`Por favor responde con 1 (Primera Vez) o 2 (Control).\`);
                    return;
                }

                // Now find availability
                const doctorId = await AvailabilityService.findDoctorForSpecialty(payload.specialty_id);

                if (!doctorId) {
                    await this.reply(msg, \`Lo siento, no hay agenda habilitada para \${payload.specialty_name || 'este servicio'} en este momento. Escribe "HOLA" para empezar de nuevo.\`);
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
                    await this.reply(msg, \`Lo siento, no hay fechas próximas para \${payload.specialty_name || 'este servicio'}. Escribe "HOLA" para empezar de nuevo.\`);
                    await this.resetConversation(phone);
                    return;
                }

                let txt = \`¿Qué fecha prefieres? Responde con el número:\\n\\n\`;
                availableDates.forEach((d, idx) => {
                    const dStr = new Date(d + 'T00:00:00-05:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
                    txt += \`\${idx + 1}. \${dStr}\\n\`;
                });

                await this.reply(msg, txt);

                payload.doctor_id = doctorId;
                payload.available_dates = availableDates;

                await db.query(
                    'UPDATE conversation_sessions SET state = $1, payload_json = $2 WHERE phone = $3',
                    ['AWAITING_DATE', JSON.stringify(payload), phone]
                );
                return;
            }
`;

const newBlock = `
            // Reusable function to fetch doctors and send to AWAITING_DOCTOR
            const transitionToDoctorSelection = async (payloadObj, phoneNum, msg) => {
                let q = \`
                    SELECT DISTINCT d.id, d.full_name 
                    FROM doctors d
                    JOIN doctor_specialties ds ON d.id = ds.doctor_id
                    JOIN specialties s ON ds.specialty_id = s.id
                    WHERE d.is_active = TRUE
                \`;
                let params = [];
                if (payloadObj.specialty_id) {
                    q += ' AND s.id = $1';
                    params.push(payloadObj.specialty_id);
                } else if (payloadObj.service_id) {
                    // Fallback to doctors under the whole service (e.g., Fisioterapia without sub-specialties)
                    q += ' AND s.service_id = $1';
                    params.push(payloadObj.service_id);
                }

                const docs = await db.query(q, params);
                if (docs.rows.length === 0) {
                    await this.reply(msg, 'Lo siento, no hay médicos asignados para este servicio en este momento. Escribe "HOLA" para empezar de nuevo.');
                    await this.resetConversation(phoneNum);
                    return;
                }

                payloadObj.doctors = docs.rows;
                let textMsg = '¿Con qué profesional deseas agendar?\\n\\n';
                docs.rows.forEach((doc, idx) => {
                    textMsg += \`\${idx + 1}. Dr. \${doc.full_name}\\n\`;
                });

                await this.reply(msg, textMsg);
                await db.query(
                    'UPDATE conversation_sessions SET state = $1, payload_json = $2 WHERE phone = $3',
                    ['AWAITING_DOCTOR', JSON.stringify(payloadObj), phoneNum]
                );
            };

            if (session.state === 'AWAITING_CATALOG_CONFIRM') {
                const payload = typeof session.payload_json === 'string' ? JSON.parse(session.payload_json) : (session.payload_json || {});
                const resp = text.toLowerCase().trim();

                if (resp === 'no' || resp === 'n') {
                    await this.reply(msg, \`Entendido. Escribe el nombre del examen que buscas de nuevo, o escribe "HOLA" para reiniciar.\`);
                    await db.query('UPDATE conversation_sessions SET state = $1 WHERE phone = $2', ['AWAITING_CATALOG_SEARCH', phone]);
                    return;
                } else if (resp !== 'si' && resp !== 'sí' && resp !== 's') {
                    await this.reply(msg, \`Por favor responde con *SI* o *NO* para confirmar.\`);
                    return;
                }

                // Send PDF instructions to the user depending on the test name... (TODO maybe inject exact instructions logic)
                await this.reply(msg, \`Te hemos enviado las recomendaciones previas. Por favor, revísalas atentamente antes del examen.\`);

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
                    await this.reply(msg, \`Por favor responde con 1 (Primera Vez) o 2 (Control).\`);
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
                if (text === '1') payload.specialty_name = 'Odontologia General';
                else if (text === '2') payload.specialty_name = 'Ortodoncia';
                else { await this.reply(msg, 'Responde con 1 o 2.'); return; }

                await this.reply(msg, '¿Para qué tipo de consulta?\\n1. Primera vez\\n2. Control');
                await db.query('UPDATE conversation_sessions SET state = $1, payload_json = $2 WHERE phone = $3', ['AWAITING_CONSULTATION_TYPE', JSON.stringify(payload), phone]);
                return;
            }

            if (session.state === 'AWAITING_ENFERM_TYPE') {
                const payload = typeof session.payload_json === 'string' ? JSON.parse(session.payload_json) : (session.payload_json || {});
                if (text === '1') {
                    await this.reply(msg, '¿Qué tipo de consulta requerida?\\n1. Primera vez\\n2. Control\\n3. Crecimiento y Desarrollo\\n4. Planificación');
                    await db.query('UPDATE conversation_sessions SET state = $1, payload_json = $2 WHERE phone = $3', ['AWAITING_ENFERM_CONSULTA', JSON.stringify(payload), phone]);
                } else if (text === '2') {
                    await this.reply(msg, '¿Qué procedimiento necesitas?\\n1. Citología (25-29 años)\\n2. ADN VPH (30-65 años)\\n3. Electrocardiograma\\n4. Prueba de Esfuerzo\\n5. Curaciones\\n6. Toma de Tensión o Glucometría\\n7. Ecocardiograma');
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
                const procs = ['Citologia', 'ADN VPH', 'Electrocardiograma', 'Prueba de Esfuerzo', 'Curaciones', 'Toma de Tension / Glucometria', 'Ecocardiograma'];
                const idx = parseInt(text) - 1;
                if (isNaN(idx) || idx < 0 || idx >= procs.length) { await this.reply(msg, 'Responde del 1 al 7.'); return; }
                
                payload.consultation_type = 'PROCEDIMIENTO: ' + procs[idx];
                
                // Show recommendations depending on selection (Basic mapping based on instructions)
                if (idx === 0 || idx === 1) await this.reply(msg, 'Recuerda: No relaciones, ni óvulos ni duchas vaginales 3 días antes de la toma. No ir en el periodo. Se asiste en horas de la mañana.');
                else if (idx === 2 || idx === 3 || idx === 6) await this.reply(msg, 'Recuerda: Asistir con ropa deportiva, no consumir metoprolol o bloqueadores 24h previas al examen.');

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

                let txt = '¿Qué fecha prefieres? Responde con el número:\\n\\n';
                availableDates.forEach((d, idx) => {
                    const dStr = new Date(d + 'T00:00:00-05:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
                    txt += \`\${idx + 1}. \${dStr}\\n\`;
                });

                await this.reply(msg, txt);

                payload.available_dates = availableDates;

                await db.query('UPDATE conversation_sessions SET state = $1, payload_json = $2 WHERE phone = $3', ['AWAITING_DATE', JSON.stringify(payload), phone]);
                return;
            }
`;

content = content.replace(oldBlock, newBlock);
fs.writeFileSync(whatsappControllerPath, content);
console.log('Successfully updated WhatsAppController.js');
