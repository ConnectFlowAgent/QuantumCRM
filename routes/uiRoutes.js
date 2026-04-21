const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/authMiddleware');
const db = require('../config/db');
const https = require('https');

router.use(verifyToken);

// GET /api/leads - Trae todos los contactos con su status
router.get('/leads', async (req, res) => {
    try {
        const query = `
            SELECT id, phone_number, name, funnel_status, is_paused, updated_at 
            FROM leads 
            ORDER BY updated_at DESC
        `;
        const result = await db.query(query);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching leads', error: error.message });
    }
});

// GET /api/conversations/:leadId - Trae el historial para poblar el inbox
router.get('/conversations/:leadId', async (req, res) => {
    const { leadId } = req.params;
    try {
        const query = `
            SELECT direction, message_type, content, sent_at 
            FROM conversations 
            WHERE lead_id = $1 
            ORDER BY sent_at ASC
        `;
        const result = await db.query(query, [leadId]);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching history', error: error.message });
    }
});

// GET /api/settings - Trae toda la configuración
router.get('/settings', async (req, res) => {
    try {
        const result = await db.query("SELECT key, value FROM settings");
        const settingsMap = {};
        result.rows.forEach(row => {
            settingsMap[row.key] = row.value;
        });
        res.json({ success: true, data: settingsMap });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching settings', error: error.message });
    }
});

// POST /api/settings - Actualiza la configuración
router.post('/settings', async (req, res) => {
    const { 
        whatsapp_verify_token, whatsapp_access_token, phone_number_id, 
        smtp_host, smtp_user, smtp_pass,
        openai_api_key, openai_system_prompt,
        cost_per_inbound, cost_per_bot_outbound, cost_per_template_outbound
    } = req.body;
    try {
        const query = `
            INSERT INTO settings (key, value) VALUES
            ('whatsapp_verify_token', $1),
            ('whatsapp_access_token', $2),
            ('phone_number_id', $3),
            ('smtp_host', $4),
            ('smtp_user', $5),
            ('smtp_pass', $6),
            ('openai_api_key', $7),
            ('openai_system_prompt', $8),
            ('cost_per_inbound', $9),
            ('cost_per_bot_outbound', $10),
            ('cost_per_template_outbound', $11)
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
        `;
        await db.query(query, [
            whatsapp_verify_token, 
            whatsapp_access_token, 
            phone_number_id,
            smtp_host,
            smtp_user,
            smtp_pass,
            openai_api_key,
            openai_system_prompt,
            cost_per_inbound || '0',
            cost_per_bot_outbound || '0.005',
            cost_per_template_outbound || '0.04'
        ]);
        res.json({ success: true, message: 'Settings updated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error updating settings', error: error.message });
    }
});

// GET /api/templates - Trae todas las plantillas
router.get('/templates', async (req, res) => {
    try {
        const result = await db.query("SELECT id, node_name, content, updated_at FROM templates ORDER BY node_name ASC");
        res.json({ success: true, data: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching templates', error: error.message });
    }
});

// PUT /api/templates/:node_name - Actualiza una sola plantilla
router.put('/templates/:node_name', async (req, res) => {
    const { node_name } = req.params;
    const { content } = req.body;
    try {
        await db.query("UPDATE templates SET content = $1, updated_at = NOW() WHERE node_name = $2", [content, node_name]);
        res.json({ success: true, message: 'Plantilla actualizada.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error updating template', error: error.message });
    }
});

// GET /api/logs - Trae historial de la terminal en Vivo
router.get('/logs', async (req, res) => {
    try {
        const redisClient = require('../config/redisClient');
        // Traer de indice 0 al -1 (todos los elementos del array)
        const logsArr = await redisClient.lRange('app:system_logs', 0, -1);
        
        const parsedLogs = logsArr.map(l => JSON.parse(l));
        res.json({ success: true, data: parsedLogs });
    } catch (err) {
        console.error("Error obteniendo logs de redis:", err);
        res.status(500).json({ success: false, error: 'Database fail' });
    }
});

// POST /api/whatsapp/test-connection - Prueba las credenciales contra la Graph API de Meta
router.post('/whatsapp/test-connection', async (req, res) => {
    const { phone_number_id, access_token } = req.body;

    if (!phone_number_id || !access_token) {
        return res.status(400).json({
            success: false,
            status: 'error',
            message: 'Se requiere Phone Number ID y Access Token para verificar.'
        });
    }

    try {
        // Llamar a la Graph API de Meta para verificar el Phone Number ID
        const apiUrl = `https://graph.facebook.com/v19.0/${phone_number_id}?fields=display_phone_number,verified_name,quality_rating&access_token=${access_token}`;
        
        const response = await fetch(apiUrl);
        const data = await response.json();

        if (response.ok && data.display_phone_number) {
            res.json({
                success: true,
                status: 'connected',
                message: `✅ Conectado correctamente`,
                details: {
                    phone: data.display_phone_number,
                    name: data.verified_name || 'N/A',
                    quality: data.quality_rating || 'N/A'
                }
            });
        } else {
            const errMsg = data.error ? data.error.message : 'Credenciales inválidas o sin permisos.';
            res.json({
                success: false,
                status: 'failed',
                message: `❌ Error: ${errMsg}`
            });
        }
    } catch (error) {
        console.error('[WhatsApp] Error verificando conexión:', error);
        res.status(500).json({
            success: false,
            status: 'error',
            message: 'No se pudo contactar a la API de Meta. Revisa tu conexión a internet.'
        });
    }
});

module.exports = router;
