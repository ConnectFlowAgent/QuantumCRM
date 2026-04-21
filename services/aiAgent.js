const { OpenAI } = require('openai');
const db = require('../config/db');

/**
 * Consulta a OpenAI usando la memoria reciente del lead
 * @param {string} leadId ID del lead en BD para consultar historial
 * @param {string} newMessage Mensaje de texto entrante del usuario
 * @returns {string} Respuesta generada por OpenAI
 */
const generateResponse = async (leadId, newMessage) => {
    // 1. Traer credenciales y prompt del sistema de la DB
    const result = await db.query("SELECT key, value FROM settings WHERE key IN ('openai_api_key', 'openai_system_prompt')");
    const creds = {};
    result.rows.forEach(row => creds[row.key] = row.value);

    // Si no hay key, abortamos
    if (!creds.openai_api_key || creds.openai_api_key.trim() === '') {
        console.warn("OpenAI API Key no configurada.");
        return "Disculpa, en este momento no puedo procesar la solicitud (IA en mantenimiento).";
    }

    const openai = new OpenAI({ apiKey: creds.openai_api_key });

    // 2. Traer últimos 10 mensajes del historial (Memoria a corto plazo)
    // Orden ascendente temporal (los más viejos de los últimos 10 van primero)
    const historyRes = await db.query(`
        SELECT direction, content 
        FROM (
            SELECT direction, content, sent_at 
            FROM conversations 
            WHERE lead_id = $1 
            ORDER BY sent_at DESC LIMIT 10
        ) sub 
        ORDER BY sent_at ASC
    `, [leadId]);

    // 3. Ensamblar array de mensajes para el LLM
    let messages = [
        { role: 'system', content: creds.openai_system_prompt }
    ];

    historyRes.rows.forEach(row => {
        // En BD: INBOUND es lo que dijo el usuario, OUTBOUND lo que dijo nuestro bot (o el agente)
        const role = row.direction === 'INBOUND' ? 'user' : 'assistant';
        // Solo pusheamos si hay texto guardado
        if (row.content) {
            messages.push({ role: role, content: row.content });
        }
    });

    // 4. Llamar a OpenAI
    try {
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini', // Modelo rápido y económico. Se puede exponer en UI si se desea.
            messages: messages,
            temperature: 0.7,
            max_tokens: 250 // Respuestas breves al ser WhatsApp
        });

        return completion.choices[0].message.content;
    } catch (error) {
        console.error("OpenAI Error:", error);
        return "Lo lamento, hubo un error de conexión analizando tu mensaje.";
    }
};

module.exports = {
    generateResponse
};
