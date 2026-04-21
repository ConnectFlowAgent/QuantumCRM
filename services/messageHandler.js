const db = require('../config/db');
const redisClient = require('../config/redisClient');
const { sendWhatsAppMessage } = require('./whatsappApi');

/**
 * Proceso principal: califica el mensaje y ejecuta el paso del embudo
 */
const processIncomingMessage = async (messagePayload, phoneNumber, contactName, waMessageId) => {
    // 1. Extraer el texto del mensaje
    let userText = '';
    if (messagePayload.type === 'text') {
        userText = messagePayload.text.body;
    } else if (messagePayload.type === 'interactive') {
        // En caso de que se utilicen botones
        userText = messagePayload.interactive.button_reply?.title || messagePayload.interactive.list_reply?.title;
    }
    
    if (!userText) return; // Ignoramos media por simplicidad o lo manejamos después

    const redisKey = `wa_state:${phoneNumber}`;
    
    // 2. Buscar estado en Redis (Cerebro Rápido)
    let stateStr = await redisClient.get(redisKey);
    let state = null;
    let leadId = null;

    if (!stateStr) {
        // Caso A: Nuevo Usuario o TTL expirado
        // Verificar si existe en Postgres
        const leadRes = await db.query(
            "SELECT id, funnel_status, is_paused FROM leads WHERE phone_number = $1", 
            [phoneNumber]
        );
        
        if (leadRes.rows.length === 0) {
            // Es un Lead completamente nuevo
            const newLead = await db.query(
                "INSERT INTO leads (phone_number, name, funnel_status) VALUES ($1, $2, 'NEW') RETURNING id",
                [phoneNumber, contactName]
            );
            leadId = newLead.rows[0].id;
            
            state = {
                lead_id: leadId,
                status: 'NEW',
                current_node: 'welcome_msg',
                unrecognized_intent_count: 0
            };
        } else {
            // Ya existía en PG, lo subimos a Redis de nuevo
            const leadData = leadRes.rows[0];
            leadId = leadData.id;
            state = {
                lead_id: leadId,
                status: leadData.is_paused ? 'HANDOFF' : leadData.funnel_status,
                current_node: 'qualify_q1', // O la lógica para reanudar donde se quedó
                unrecognized_intent_count: 0
            };
        }
    } else {
        // Caso B: Está en memoria
        state = JSON.parse(stateStr);
        leadId = state.lead_id;
    }

    // 3. Registrar Conversación INBOUND (Métrica TFR e Historial)
    await db.query(
        `INSERT INTO conversations (lead_id, wa_message_id, direction, message_type, content) 
         VALUES ($1, $2, 'INBOUND', $3, $4) ON CONFLICT DO NOTHING`,
        [leadId, waMessageId, messagePayload.type, userText]
    );

    // 4. Actualizar el updated_at del Lead (usado por el CRON de Postgres)
    await db.query("UPDATE leads SET updated_at = NOW() WHERE id = $1", [leadId]);

    // 5. Validar HANDOFF (Pausa)
    if (state.status === 'HANDOFF' || isHandoffTrigger(userText)) {
        if (state.status !== 'HANDOFF') { // Pasando a humano ahora mismo
            state.status = 'HANDOFF';
            await db.query("UPDATE leads SET is_paused = TRUE WHERE id = $1", [leadId]);
            await sendTemplate(phoneNumber, 'handoff_msg', contactName);
            // Salvar estado y detener bot
            await redisClient.set(redisKey, JSON.stringify(state), { EX: 172800 });
        }
        return; // Bot pausado, no procesar más
    }

    // 6. Motor del Embudo (Enrutamiento e Intención)
    await advanceFunnel(state, phoneNumber, userText, contactName, redisKey);
};

// Logica simple para detectar objeciones (Módulo 3)
const detectObjection = (text) => {
    const lowerText = text.toLowerCase();
    if (lowerText.includes('caro') || lowerText.includes('precio') || lowerText.includes('costo')) {
        return 'objection_price';
    }
    return null;
};

// Trigger manual a humano
const isHandoffTrigger = (text) => {
    const lowerText = text.toLowerCase();
    return lowerText.includes('humano') || lowerText.includes('asesor') || lowerText.includes('persona');
};

const { generateResponse } = require('./aiAgent');

// Avanzar en el árbol/guión o delegar a OpenAI
const advanceFunnel = async (state, phoneNumber, userText, contactName, redisKey) => {
    let nextNode = state.current_node;

    // 1. Detectar comandos rígidos de la empresa primero (Híbrido)
    const objectionNode = detectObjection(userText);
    
    if (objectionNode) {
        // Enviar plantilla de objeción estática
        nextNode = objectionNode;
        state.current_node = nextNode;
        await sendTemplate(phoneNumber, nextNode, contactName);
    } else {
        // 2. Comportamiento Libre de Agente Cognitivo (OpenAI)
        state.status = 'AI_HANDLING'; 
        state.current_node = 'ai_chat';
        
        // Llamar a OpenAI con la memoria
        const aiResponse = await generateResponse(state.lead_id, userText);
        
        // Enviar respuesta al cliente
        await sendWhatsAppMessage(phoneNumber, aiResponse);
        
        // Registrar en SQL (El envío se registra en whatsappApi si loggearamos ahí,
        // pero messageHandler requiere el log de respuestas en variables estaticas.
        // Lo haremos manualmente aquí para que OpenAI recuerde su última charla:
        await db.query(
            `INSERT INTO conversations (lead_id, direction, message_type, content) 
             VALUES ($1, 'OUTBOUND', 'text', $2) ON CONFLICT DO NOTHING`,
            [state.lead_id, aiResponse]
        );
    }

    // Actualizar el Funnel Status en PG
    await db.query("UPDATE leads SET funnel_status = $1 WHERE phone_number = $2", [state.status, phoneNumber]);

    // Guardar el nuevo Estado en Redis (TTL 48h)
    await redisClient.set(redisKey, JSON.stringify(state), { EX: 172800 });
};

// Helpers de BD (Extraer Copy)
const sendTemplate = async (to, nodeName, contactName) => {
    try {
        const query = await db.query("SELECT content FROM templates WHERE node_name = $1", [nodeName]);
        if (query.rows.length > 0) {
            let copy = query.rows[0].content;
            copy = copy.replace('{{name}}', contactName || '');
            await sendWhatsAppMessage(to, copy);
        } else {
            console.warn(`Template no encontrado: ${nodeName}`);
        }
    } catch (err) {
        console.error(err);
    }
};

module.exports = {
    processIncomingMessage
};
