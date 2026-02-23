const axios = require('axios');

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = process.env.OPENROUTER_MODEL || 'stepfun/step-3.5-flash:free';

// System prompt for the AI assistant
const SYSTEM_PROMPT = `Eres un asistente virtual para agendar citas médicas por WhatsApp. Tu trabajo es ayudar a los pacientes a:
1. Agendar citas médicas (necesitas: especialidad, médico preferido, fecha, hora, nombre completo, cédula)
2. Cancelar citas existentes
3. Reprogramar citas
4. Conectarlos con un asesor humano si lo solicitan

REGLAS CRÍTICAS DE COMPORTAMIENTO:
1. FLUJO PASO A PASO: Para agendar, pide la información paso a paso. NUNCA pidas todos los datos de una vez.
      - Paso 1: Pregunta qué especialidad o servicio busca.
      - Paso 2: Usa la acción "check_availability" para ver los días disponibles. Muestra los días y pregúntale cuál prefiere.
      - Paso 3: Una vez que elija el día, usa "check_availability" con la fecha para obtener las horas. Muestra las horas y pregúntale cuál.
      - Paso 4: Luego de elegir la hora, pide su nombre completo y número de documento.
      - Paso 5: Usa "book_appointment" para confirmar la cita.
2. NO INVENTES DISPONIBILIDAD: Nunca confirmes que un horario específico está disponible sin antes intentar agendarlo o verificarlo.
3. NO PROMETAS: Usa frases como "Déjame revisar los horarios libres" en lugar de "Tengo disponibilidad".
4. FORMATO 24H: Procesa las horas en formato 24h (14:00 por 2pm).
5. SÓLO USA LA ACCIÓN "book_appointment" cuando ya tengas TODO (especialidad, fecha, hora, nombre, cédula).

RESPONDE SIEMPRE EN FORMATO JSON:
{
  "message": "Tu respuesta natural al usuario",
  "action": "continue|check_availability|book_appointment|list_appointments_for_cancellation|list_appointments_for_rescheduling|request_advisor",
  "extracted_data": {
    "specialty_name": "nombre de la especialidad o null",
    "doctor_preference": "nombre del médico o null",
    "date": "YYYY-MM-DD o null",
    "time": "HH:MM o null",
    "patient_name": "nombre completo o null",
    "document_id": "cédula o null"
  },
  "confidence": "high|medium|low"
}

EJEMPLOS:
Usuario: "Hola, necesito una cita"
Respuesta: {
  "message": "¡Hola! Con gusto te ayudo. ¿Para qué especialidad necesitas la cita?",
  "action": "continue",
  "extracted_data": {},
  "confidence": "high"
}

Usuario: "Quiero cancelar mi cita"
Respuesta: {
  "message": "Entendido. Déjame buscar tus citas agendadas.",
  "action": "list_appointments_for_cancellation",
  "extracted_data": {},
  "confidence": "high"
}

Usuario: "Necesito cardiología para mañana a las 3pm, soy Juan Pérez"
Respuesta: {
  "message": "Gracias Juan. Voy a verificar la disponibilidad para Cardiología mañana a las 15:00. Un momento por favor.",
  "action": "book_appointment",
  "extracted_data": {
    "specialty_name": "cardiología",
    "date": "MAÑANA (el sistema lo convertirá)",
    "time": "15:00",
    "patient_name": "Juan Pérez"
  },
  "confidence": "high"
}
`;

class AIService {
    constructor() {
        this.conversationContexts = new Map(); // phone -> messages array
    }

    // Get or initialize conversation context
    getContext(phone) {
        if (!this.conversationContexts.has(phone)) {
            this.conversationContexts.set(phone, [
                { role: 'system', content: SYSTEM_PROMPT }
            ]);
        }
        return this.conversationContexts.get(phone);
    }

    // Add message to context
    addMessage(phone, role, content) {
        const context = this.getContext(phone);
        context.push({ role, content });

        // Keep only last 20 messages to avoid token limits
        if (context.length > 21) { // 1 system + 20 messages
            context.splice(1, context.length - 21);
        }
    }

    // Reset conversation context
    resetContext(phone) {
        this.conversationContexts.delete(phone);
    }

    // Call OpenRouter API
    async chat(phone, userMessage, availableData = {}) {
        try {
            // Add user message to context
            this.addMessage(phone, 'user', userMessage);

            // Build context with available data
            const context = this.getContext(phone);

            // Add available data as context if provided
            let enrichedContext = [...context];
            if (Object.keys(availableData).length > 0) {
                const dataContext = `DATOS DISPONIBLES DEL SISTEMA:\n${JSON.stringify(availableData, null, 2)}`;
                enrichedContext.push({ role: 'system', content: dataContext });
            }

            const response = await axios.post(
                OPENROUTER_API_URL,
                {
                    model: MODEL,
                    messages: enrichedContext,
                    temperature: 0.7,
                    max_tokens: 500
                },
                {
                    headers: {
                        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                        'Content-Type': 'application/json',
                        'HTTP-Referer': 'http://localhost:3001',
                        'X-Title': 'Medical Appointment Bot'
                    },
                    timeout: 8000
                }
            );

            const aiMessage = response.data.choices[0].message.content;

            // Try to parse as JSON
            let parsedResponse;
            try {
                parsedResponse = JSON.parse(aiMessage);
            } catch (e) {
                // If not JSON, wrap in default structure
                parsedResponse = {
                    message: aiMessage,
                    action: 'continue',
                    extracted_data: {},
                    confidence: 'low'
                };
            }

            // Add assistant message to context
            this.addMessage(phone, 'assistant', parsedResponse.message);

            return parsedResponse;

        } catch (error) {
            console.error('OpenRouter API Error:', error.response?.data || error.message);

            // Fallback response
            return {
                message: 'Disculpa, tuve un problema técnico. ¿Podrías repetir tu mensaje?',
                action: 'continue',
                extracted_data: {},
                confidence: 'low',
                error: true
            };
        }
    }

    // Call OpenRouter API with a system prompt to dynamically generate text
    async generateResponse(phone, systemInstruction) {
        try {
            const context = this.getContext(phone);
            let enrichedContext = [...context, { role: 'system', content: systemInstruction }];

            const response = await axios.post(
                OPENROUTER_API_URL,
                {
                    model: MODEL,
                    messages: enrichedContext,
                    temperature: 0.8,
                    max_tokens: 500
                },
                {
                    headers: {
                        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                        'Content-Type': 'application/json',
                        'HTTP-Referer': 'http://localhost:3001',
                        'X-Title': 'Medical Appointment Bot'
                    },
                    timeout: 8000
                }
            );

            const aiMessage = response.data.choices[0].message.content;

            let parsedResponse;
            try {
                parsedResponse = JSON.parse(aiMessage);
            } catch (e) {
                parsedResponse = {
                    message: aiMessage,
                    action: 'continue',
                    extracted_data: {},
                    confidence: 'low'
                };
            }

            this.addMessage(phone, 'assistant', parsedResponse.message);
            return parsedResponse;

        } catch (error) {
            console.error('OpenRouter API Error:', error.response?.data || error.message);
            return {
                message: 'Disculpa, tuve un problema técnico al buscar los datos.',
                action: 'continue',
                extracted_data: {},
                confidence: 'low',
                error: true
            };
        }
    }

    // Extract and validate appointment data
    validateExtractedData(extractedData, specialties = [], doctors = []) {
        const validated = { ...extractedData };
        const issues = [];

        // Validate specialty
        if (validated.specialty_name) {
            const match = specialties.find(s =>
                s.name.toLowerCase().includes(validated.specialty_name.toLowerCase()) ||
                validated.specialty_name.toLowerCase().includes(s.name.toLowerCase())
            );
            if (match) {
                validated.specialty_id = match.id;
                validated.specialty_name = match.name;
            } else {
                issues.push(`No encontré la especialidad "${validated.specialty_name}"`);
            }
        }

        // Validate doctor
        if (validated.doctor_preference) {
            const match = doctors.find(d =>
                d.full_name.toLowerCase().includes(validated.doctor_preference.toLowerCase()) ||
                validated.doctor_preference.toLowerCase().includes(d.full_name.toLowerCase())
            );
            if (match) {
                validated.doctor_id = match.id;
                validated.doctor_name = match.full_name;
            } else {
                issues.push(`No encontré al doctor "${validated.doctor_preference}"`);
            }
        }

        // Validate date (must be future, format YYYY-MM-DD)
        if (validated.date) {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(validated.date)) {
                issues.push('La fecha debe estar en formato YYYY-MM-DD');
                validated.date = null;
            } else {
                const appointmentDate = new Date(validated.date + 'T00:00:00-05:00'); // set timezone
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                if (isNaN(appointmentDate.getTime())) {
                    issues.push('La fecha proporcionada no es válida');
                    validated.date = null;
                } else if (appointmentDate < today) {
                    issues.push('La fecha debe ser futura');
                    validated.date = null;
                }
            }
        }

        // Validate time format
        if (validated.time && !/^\d{2}:\d{2}$/.test(validated.time)) {
            issues.push('Formato de hora inválido');
            validated.time = null;
        }

        return { validated, issues };
    }
}

module.exports = new AIService();
