const express = require('express');
const router = express.Router();
const analyticsService = require('../services/analytics');

// GET /api/analytics/tfr
router.get('/tfr', async (req, res) => {
    try {
        const tfr = await analyticsService.getSystemAverageTFR();
        res.json({ success: true, data: tfr });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching TFR', error: error.message });
    }
});

// GET /api/analytics/conversion
router.get('/conversion', async (req, res) => {
    try {
        const conversion = await analyticsService.getConversionRate();
        res.json({ success: true, data: conversion });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching Conversion Rate', error: error.message });
    }
});

// GET /api/analytics/billing - Estima el costo del mes en curso
router.get('/billing', async (req, res) => {
    const db = require('../config/db');
    try {
        // 1. Obtener tarifas de la DB
        const settingsRes = await db.query("SELECT key, value FROM settings WHERE key IN ('cost_per_inbound', 'cost_per_bot_outbound', 'cost_per_template_outbound')");
        const rates = {
            inbound: 0,
            bot: 0.005,
            template: 0.04
        };
        settingsRes.rows.forEach(r => {
            if (r.key === 'cost_per_inbound') rates.inbound = parseFloat(r.value) || 0;
            if (r.key === 'cost_per_bot_outbound') rates.bot = parseFloat(r.value) || 0;
            if (r.key === 'cost_per_template_outbound') rates.template = parseFloat(r.value) || 0;
        });

        // 2. Extraer volumen del mes en curso
        const volumeRes = await db.query(`
            SELECT direction, message_type, COUNT(*) as qty 
            FROM conversations 
            WHERE EXTRACT(MONTH FROM sent_at) = EXTRACT(MONTH FROM CURRENT_DATE) 
              AND EXTRACT(YEAR FROM sent_at) = EXTRACT(YEAR FROM CURRENT_DATE)
            GROUP BY direction, message_type
        `);

        let countInbound = 0;
        let countBot = 0;
        let countTemplate = 0;

        volumeRes.rows.forEach(row => {
            if (row.direction === 'INBOUND') {
                countInbound += parseInt(row.qty, 10);
            } else if (row.direction === 'OUTBOUND') {
                if (row.message_type === 'template') {
                    countTemplate += parseInt(row.qty, 10);
                } else {
                    countBot += parseInt(row.qty, 10);
                }
            }
        });

        // 3. Matemáticas
        const costInbound = countInbound * rates.inbound;
        const costBot = countBot * rates.bot;
        const costTemplate = countTemplate * rates.template;
        const total = costInbound + costBot + costTemplate;

        // Multiplicamos a Fixed para evitar redondeos extraños js
        res.json({ 
            success: true, 
            data: {
                total_cost: total.toFixed(4),
                breakdown: {
                    inbound_qty: countInbound,
                    inbound_cost: costInbound.toFixed(4),
                    bot_qty: countBot,
                    bot_cost: costBot.toFixed(4),
                    template_qty: countTemplate,
                    template_cost: costTemplate.toFixed(4)
                }
            } 
        });
    } catch (error) {
        console.error("Error calculando Facturación:", error);
        res.status(500).json({ success: false, message: 'Error fetching billing', error: error.message });
    }
});

module.exports = router;
