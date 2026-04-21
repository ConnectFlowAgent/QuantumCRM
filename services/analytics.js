const db = require('../config/db');

/**
 * Obtener el TFR General Expuesto vía API para Dashboards
 */
const getSystemAverageTFR = async () => {
    try {
        const query = `
            WITH FirstInbound AS (
                SELECT lead_id, MIN(sent_at) as first_inbound_time
                FROM conversations
                WHERE direction = 'INBOUND'
                GROUP BY lead_id
            ),
            FirstOutbound AS (
                SELECT lead_id, MIN(sent_at) as first_outbound_time
                FROM conversations
                WHERE direction = 'OUTBOUND'
                GROUP BY lead_id
            )
            SELECT 
                COUNT(I.lead_id) AS total_handled,
                AVG(EXTRACT(EPOCH FROM (O.first_outbound_time - I.first_inbound_time))) AS tfr_seconds
            FROM FirstInbound I
            JOIN FirstOutbound O ON I.lead_id = O.lead_id
            WHERE O.first_outbound_time >= I.first_inbound_time;
        `;
        const result = await db.query(query);
        return result.rows[0];
    } catch (error) {
        console.error("Error calculando TFR:", error);
        throw error;
    }
};

/**
 * Obtener la Tasa de Conversión Global
 */
const getConversionRate = async () => {
    try {
        const query = `
            WITH TotalLeads AS (SELECT COUNT(*) AS total_count FROM leads),
            WonLeads AS (SELECT COUNT(*) AS won_count FROM leads WHERE funnel_status = 'CLOSED_WON')
            SELECT 
                T.total_count AS leads_created,
                W.won_count AS closed_won,
                CASE WHEN T.total_count = 0 THEN 0 ELSE ROUND((W.won_count::numeric / T.total_count::numeric) * 100, 2) END AS conversion_rate_percent
            FROM TotalLeads T, WonLeads W;
        `;
        const result = await db.query(query);
        return result.rows[0]; // { leads_created, closed_won, conversion_rate_percent }
    } catch (error) {
        console.error("Error calculando Tasa de Conversión:", error);
        throw error;
    }
};

module.exports = {
    getSystemAverageTFR,
    getConversionRate
};
