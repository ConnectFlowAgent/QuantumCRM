const express = require('express');
const router = express.Router();
const { processIncomingMessage } = require('../services/messageHandler');
const db = require('../config/db');
// 1. Verificación (GET) - Requerido por Meta para dar de alta el Webhook
router.get('/', async (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  try {
      const dbRes = await db.query("SELECT value FROM settings WHERE key = 'whatsapp_verify_token'");
      const VERIFY_TOKEN = dbRes.rows.length > 0 ? dbRes.rows[0].value : 'my_secure_token_123';

      if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('Webhook verified');
        res.status(200).send(challenge);
      } else {
        res.sendStatus(403);
      }
  } catch (error) {
      console.error(error);
      res.sendStatus(500);
  }
});

// 2. Recepción de mensajes (POST) - API de WhatsApp Cloud
router.post('/', async (req, res) => {
  const body = req.body;

  if (body.object === 'whatsapp_business_account') {
    // Es posible recibir múltiples "entradas" o múltiples "cambios"
    for (const entry of body.entry) {
      const changes = entry.changes;
      
      for (const change of changes) {
        if (change.value && change.value.messages) {
          const messages = change.value.messages;
          const contacts = change.value.contacts;
          
          for (const message of messages) {
            const phoneNumber = message.from;
            const waMessageId = message.id;
            const contactName = contacts ? contacts[0].profile.name : null;
            
            // Asincrónico: no bloqueamos el retorno 200 OK a WhatsApp
            processIncomingMessage(message, phoneNumber, contactName, waMessageId).catch(console.error);
          }
        }

        // --- SISTEMA DE CONFIRMACIÓN DE LECTURA (ANTI-SPAM) ---
        if (change.value && change.value.statuses) {
          const statuses = change.value.statuses;
          for (const status of statuses) {
             if (status.status === 'read') {
                 const recipientPhone = status.recipient_id; 
                 // Actualizar la última vez que leyó un mensaje nuestro
                 db.query("UPDATE leads SET last_read_at = NOW() WHERE phone_number = $1", [recipientPhone])
                   .catch(console.error);
             }
          }
        }
      }
    }
    // Meta requiere un 200 OK inmediatamente o reintentará
    res.sendStatus(200);
  } else {
    res.sendStatus(404);
  }
});

module.exports = router;
