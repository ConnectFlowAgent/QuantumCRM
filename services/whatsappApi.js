const axios = require('axios');
const db = require('../config/db');

const GRAPH_API_VERSION = 'v19.0';

/**
 * Enviar mensaje de texto usando la API Oficial de WhatsApp Cloud
 */
const sendWhatsAppMessage = async (to, text) => {
    try {
        // Leer credenciales dinámicos
        const phoneRes = await db.query("SELECT value FROM settings WHERE key = 'phone_number_id'");
        const tokenRes = await db.query("SELECT value FROM settings WHERE key = 'whatsapp_access_token'");
        
        const PHONE_NUMBER_ID = phoneRes.rows.length > 0 ? phoneRes.rows[0].value : process.env.PHONE_NUMBER_ID;
        const ACCESS_TOKEN = tokenRes.rows.length > 0 ? tokenRes.rows[0].value : process.env.WHATSAPP_ACCESS_TOKEN;
        
        const WHATSAPP_API_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}/${PHONE_NUMBER_ID}/messages`;

        const response = await axios.post(
            WHATSAPP_API_URL,
            {
                messaging_product: 'whatsapp',
                to: to,
                type: 'text',
                text: { body: text }
            },
            {
                headers: {
                    'Authorization': `Bearer ${ACCESS_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        // Guardar copia del mensaje enviado en PostgreSQL
        const waMessageId = response.data?.messages?.[0]?.id;
        if (waMessageId) {
            // Buscamos el ID interno del lead para guardarlo en conversations
            const leadRes = await db.query("SELECT id FROM leads WHERE phone_number = $1", [to]);
            if (leadRes.rows.length > 0) {
                const leadId = leadRes.rows[0].id;
                await db.query(
                    `INSERT INTO conversations (lead_id, wa_message_id, direction, message_type, content) 
                     VALUES ($1, $2, 'OUTBOUND', 'text', $3)`,
                    [leadId, waMessageId, text]
                );
                // Reloj Anti Spam
                await db.query("UPDATE leads SET last_outbound_at = NOW() WHERE id = $1", [leadId]);
            }
        }
        
        return response.data;
    } catch (error) {
        console.error('Error enviando mensaje WhatsApp:', error.response ? error.response.data : error.message);
        if (error.response) {
            throw new Error(`WhatsApp API Error: ${error.response.statusText}`);
        }
        throw error;
    }
};

// --- ENVÍO DE PLANTILLAS OFICIALES (OUTBOUND) ---
// Utilizado para Contactos en Frío / Onboarding Webhooks. 
// Estas plantillas deben ser creadas y aprobadas en Meta Business Manager.
const sendMetaTemplate = async (to, templateName, languageCode = "es", bodyVariables = []) => {
    try {
        const result = await db.query("SELECT key, value FROM settings WHERE key IN ('whatsapp_access_token', 'phone_number_id')");
        const creds = {};
        result.rows.forEach(row => creds[row.key] = row.value);

        if (!creds.whatsapp_access_token || !creds.phone_number_id) {
            console.error('Meta Credentials missing from Database Settings for Template.');
            return;
        }

        const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${creds.phone_number_id}/messages`;
        
        // Mapeo dinámico de las variables del array as componentes de texto
        const parameters = bodyVariables.map(val => ({
            type: "text",
            text: val
        }));

        const data = {
            messaging_product: "whatsapp",
            to: to,
            type: "template",
            template: {
                name: templateName,
                language: {
                    code: languageCode
                },
                components: parameters.length > 0 ? [
                    {
                        type: "body",
                        parameters: parameters
                    }
                ] : []
            }
        };

        const response = await axios.post(url, data, {
            headers: {
                'Authorization': `Bearer ${creds.whatsapp_access_token}`,
                'Content-Type': 'application/json'
            }
        });

        // Registrar en historial para analítica
        const waMessageId = response.data?.messages?.[0]?.id;
        if (waMessageId) {
            const leadRes = await db.query("SELECT id FROM leads WHERE phone_number = $1", [to]);
            if (leadRes.rows.length > 0) {
                const leadId = leadRes.rows[0].id;
                await db.query(
                    `INSERT INTO conversations (lead_id, wa_message_id, direction, message_type, content) 
                     VALUES ($1, $2, 'OUTBOUND', 'template', $3)`,
                    [leadId, waMessageId, `[Meta Template: ${templateName}]`]
                );
                // Reloj Anti Spam
                await db.query("UPDATE leads SET last_outbound_at = NOW() WHERE id = $1", [leadId]);
            }
        }

        return response.data;
    } catch (error) {
        console.error("Error sending Meta Template:");
        if (error.response) {
            console.error(error.response.data);
            throw new Error(`WhatsApp API Error: ${error.response.statusText}`);
        }
        throw error;
    }
};

module.exports = {
    sendWhatsAppMessage,
    sendMetaTemplate
};
