const db = require('../config/db');
const redisClient = require('../config/redisClient');
const axios = require('axios');
const cron = require('node-cron');
const { sendWhatsAppMessage } = require('./whatsappApi'); // Haremos un helper

// CRON Job: Se ejecuta cada hora para buscar "Psicología de Seguimiento" (24h)
const startFollowUpCron = () => {
    // '0 * * * *' = Al minuto 0 de cada hora
    cron.schedule('0 * * * *', async () => {
        console.log('[CRON] Iniciando verificación de seguimiento 24h...');
        
        try {
            // Buscamos a los usuarios que llevan inactivos más de 24 horas y no han cerrado/perdido
            // Tampoco les queremos responder si ya están en pausa (HANDOFF)
            const query = `
                SELECT phone_number, name 
                FROM leads 
                WHERE updated_at < NOW() - INTERVAL '24 HOURS' 
                  AND funnel_status NOT IN ('CLOSED_WON', 'CLOSED_LOST', 'HANDOFF')
                  AND is_paused = FALSE
                  AND last_read_at >= last_outbound_at
            `;
            
            const result = await db.query(query);
            const activeLeads = result.rows;
            
            if (activeLeads.length === 0) {
                console.log('[CRON] No hay prospectos para re-engage.');
                return;
            }

            console.log(`[CRON] Se encontraron ${activeLeads.length} leads inactivos para seguimiento.`);
            
            // Obtener el template de follow_up_24h de la DB
            const templateRes = await db.query("SELECT content FROM templates WHERE node_name = 'followup_24h'");
            const followupText = templateRes.rows[0]?.content || "Hola, ¿aún sigues ahí?";

            // Enviar mensaje a cada lead
            for (const lead of activeLeads) {
                const message = followupText.replace('{{name}}', lead.name || 'amigo');
                
                await sendWhatsAppMessage(lead.phone_number, message);
                
                // Opcional: Actualizar updated_at en Postgres para no re-enviarle en la próxima hora
                await db.query("UPDATE leads SET updated_at = NOW() WHERE phone_number = $1", [lead.phone_number]);
                
                console.log(`[CRON] Seguimiento enviado a ${lead.phone_number}`);
            }

        } catch (error) {
            console.error('[CRON] Error ejecutando la Psicología de Seguimiento:', error);
        }
    });
};

module.exports = { startFollowUpCron };
