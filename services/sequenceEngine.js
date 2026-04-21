const cron = require('node-cron');
const db = require('../config/db');
const { sendWhatsAppMessage } = require('./whatsappApi');

const startDripCampaignEngine = () => {
    // Correr diario a las 10:00 AM ('0 10 * * *')
    // Para entornos dev/pruebas, lo ponemos cada hora o al minuto, usaremos cada hora '0 * * * *' temporalmente para que veas q funcione rápido.
    cron.schedule('0 10 * * *', async () => {
        console.log('[DRIP ENGINE] Evaluando ventanas de campaña Post-Venta...');

        try {
            // Evaluador DÍA 3-4 (Seguimiento, Activación, Acompañamiento)
            let day3Query = await db.query(`
                SELECT o.id, o.lead_id, l.phone_number, l.name 
                FROM orders o JOIN leads l ON o.lead_id = l.id
                WHERE EXTRACT(DAY FROM (NOW() - o.paid_at)) BETWEEN 3 AND 4
                AND o.status != 'DELIVERED' 
                AND l.last_read_at >= l.last_outbound_at -- SEGURO ANTI-SPAM
            `);

            for (const order of day3Query.rows) {
                // Combinar los mensajes en uno o dispararlos secuencial con delay.
                const msg = `Hola ${order.name} 🤩 ¿Ya recibiste tu pedido? 📦 Queremos asegurarnos de que todo haya llegado. Además, te recuerdo que la mayoría ve mejores resultados con la guía inicial 💡.`;
                await sendWhatsAppMessage(order.phone_number, msg);
            }

            // Evaluador DÍA 4-5 (Comunidad)
            let day4Query = await db.query(`
                SELECT o.id, o.lead_id, l.phone_number, l.name 
                FROM orders o JOIN leads l ON o.lead_id = l.id
                WHERE EXTRACT(DAY FROM (NOW() - o.paid_at)) = 5
                AND l.last_read_at >= l.last_outbound_at -- SEGURO ANTI-SPAM
            `);
            
            for (const order of day4Query.rows) {
                const msg = `Tenemos un grupo con tips, resultados y acompañamiento 🙌 ¿Te gustaría que te agregue, ${order.name}?`;
                await sendWhatsAppMessage(order.phone_number, msg);
            }

            // Evaluador DÍA 6-7 (Feedback)
            let day7Query = await db.query(`
                SELECT o.id, o.lead_id, l.phone_number, l.name 
                FROM orders o JOIN leads l ON o.lead_id = l.id
                WHERE EXTRACT(DAY FROM (NOW() - o.paid_at)) BETWEEN 6 AND 7
                AND l.last_read_at >= l.last_outbound_at -- SEGURO ANTI-SPAM
            `);
            
            for (const order of day7Query.rows) {
                const msg = `¿Cómo ha sido tu experiencia hasta ahora? 🤩 tu opinión es muy importante 🙌`;
                await sendWhatsAppMessage(order.phone_number, msg);
            }

        } catch (error) {
            console.error('[DRIP ENGINE] Error:', error);
        }
    });
};

module.exports = { startDripCampaignEngine };
