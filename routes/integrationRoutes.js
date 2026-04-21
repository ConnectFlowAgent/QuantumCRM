const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { sendMetaTemplate } = require('../services/whatsappApi');

// POST /api/integrations/user-created
// Usado por Zapier, N8N, Typeform o ERP externo para gatillar un alta vía WhatsApp
router.post('/user-created', async (req, res) => {
    const { name, phone_number, email, password } = req.body;

    if (!phone_number) {
        return res.status(400).json({ success: false, message: 'phone_number es obligatorio' });
    }

    try {
        // 1. Revisar / Crear Lead en PostgreSQL
        let leadRes = await db.query("SELECT id FROM leads WHERE phone_number = $1", [phone_number]);
        let leadId;
        
        if (leadRes.rows.length === 0) {
            let newLead = await db.query(
                "INSERT INTO leads (phone_number, name) VALUES ($1, $2) RETURNING id",
                [phone_number, name || 'Usuario Nuevo']
            );
            leadId = newLead.rows[0].id;
        } else {
            leadId = leadRes.rows[0].id;
        }

        // 2. Disparo de WhatsApp oficial usando Meta Templates (Outbound en frío)
        // Asumimos que la plantilla en Meta Manager se llama "user_onboarding"
        // Y recibe 3 variables posicionales: {{1}} nombre, {{2}} email, {{3}} password
        const variables = [name, email, password];
        
        // Puedes cambiar "user_onboarding" por el nombre de tu plantilla oficial real y su idioma
        await sendMetaTemplate(phone_number, 'user_onboarding', 'es', variables);

        res.json({ success: true, message: 'Usuario registrado e invitación de WhatsApp (Meta Template) enviada.' });

    } catch (error) {
        console.error('[Integrations] Error en webhook externo:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
