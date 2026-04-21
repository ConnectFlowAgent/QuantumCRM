const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { sendWhatsAppMessage } = require('../services/whatsappApi');
const { sendEmail } = require('../services/emailService');

// POST /api/ecommerce/order-created -> Gatilla el DÍA 0 de la Matriz (WhatsApp + Correo)
router.post('/order-created', async (req, res) => {
    const { order_id, phone_number, name, email } = req.body;
    try {
        // Asegurar que exista el lead
        let leadRes = await db.query("SELECT id FROM leads WHERE phone_number = $1", [phone_number]);
        let leadId;
        if (leadRes.rows.length === 0) {
            let newLead = await db.query(
                "INSERT INTO leads (phone_number, name) VALUES ($1, $2) RETURNING id",
                [phone_number, name]
            );
            leadId = newLead.rows[0].id;
        } else {
            leadId = leadRes.rows[0].id;
        }

        // Crear Órden (Marcando paid_at AHORA, inicio del reloj de los Días Clave)
        await db.query(
            "INSERT INTO orders (lead_id, external_order_id, email, paid_at) VALUES ($1, $2, $3, NOW())",
            [leadId, order_id, email]
        );

        // --- GATILLOS CERO (DAY 0) INMEDIATOS ---
        const waText = `¡Hola ${name}! 🥳 Gracias por tu compra. Estaremos acompañándote para que tengas la mejor experiencia 🚀 ¿Cualquier duda aquí estoy?`;
        await sendWhatsAppMessage(phone_number, waText);

        if (email) {
            const emailHtml = `<h3>Gracias por confiar en nosotros, ${name}.</h3><p>Estaremos en contacto para acompañarte, confirmar entrega e integrarte a nuestra comunidad.</p>`;
            await sendEmail(email, "¡Bienvenido a la familia!", emailHtml);
        }

        res.json({ success: true, message: 'Día 0 Inicializado. Secuencias armadas.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/ecommerce/order-delivered -> Actualiza para Gatillar Post-Entrega
router.post('/order-delivered', async (req, res) => {
    const { order_id, phone_number, name } = req.body;
    try {
        await db.query("UPDATE orders SET delivered_at = NOW(), status = 'DELIVERED' WHERE external_order_id = $1", [order_id]);
        
        // --- GATILLO INMEDIATO: POST-ENTREGA ---
        const waText = `¡Qué bueno que ya lo recibiste ${name}! 🥂 Te guío para empezar a ver resultados desde ya 🚀`;
        await sendWhatsAppMessage(phone_number, waText);

        res.json({ success: true, message: 'Status post-entrega actualizado y Gatillo de recepción enviado.' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
