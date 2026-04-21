-- Módulo 5 al 8: Métricas Principales (Consultas Analíticas)

-- =======================================================================
-- 1. TFR (Time to First Response) Promedio del Sistema
-- =======================================================================
-- El TFR se calcula como la diferencia de tiempo entre el primer mensaje INBOUND
-- de un Lead y la primera respuesta OUTBOUND de nuestra IA.
-- Para tener un valor representativo del sistema en la última semana o general.

WITH FirstInbound AS (
    -- Obtener la hora del primer mensaje enviado por el usuario
    SELECT lead_id, MIN(sent_at) as first_inbound_time
    FROM conversations
    WHERE direction = 'INBOUND'
    GROUP BY lead_id
),
FirstOutbound AS (
    -- Obtener la hora del primer mensaje enviado por el bot/humano hacia el usuario
    SELECT lead_id, MIN(sent_at) as first_outbound_time
    FROM conversations
    WHERE direction = 'OUTBOUND'
    GROUP BY lead_id
)
SELECT 
    COUNT(I.lead_id) AS leads_atendidos,
    -- Extraer el promedio en segundos (o intervalo) del tiempo de respuesta
    AVG(EXTRACT(EPOCH FROM (O.first_outbound_time - I.first_inbound_time))) AS avg_tfr_seconds,
    -- Formateado amigablemente como intervalo
    justify_interval(AVG(O.first_outbound_time - I.first_inbound_time)) AS avg_tfr_formatted
FROM FirstInbound I
JOIN FirstOutbound O ON I.lead_id = O.lead_id
-- Opcional: Filtrar casos atípicos donde la respuesta fue ANTES que el primer Inbound (Campañas de Outbound puro)
WHERE O.first_outbound_time >= I.first_inbound_time;


-- =======================================================================
-- 2. Tasa de Conversión General (Embudo)
-- =======================================================================
-- Mide cuántos usuarios llegaron y cuántos están marcados como 'CLOSED_WON'.

WITH TotalLeads AS (
    SELECT COUNT(*) AS total_count
    FROM leads
),
WonLeads AS (
    SELECT COUNT(*) AS won_count
    FROM leads
    WHERE funnel_status = 'CLOSED_WON'  -- Tu estatus de éxito
)
SELECT 
    T.total_count AS leads_creados,
    W.won_count AS leads_cerrados_exito,
    CASE 
        WHEN T.total_count = 0 THEN 0 
        ELSE ROUND((W.won_count::numeric / T.total_count::numeric) * 100, 2) 
    END AS tasa_conversion_porcentaje
FROM TotalLeads T, WonLeads W;


-- =======================================================================
-- EXTRA: Tasa de Conversión Específica por Etapa del Embudo (Opcional, muy útil)
-- =======================================================================
-- Determinar cuantas personas se encuentran atoradas en cada status actualmente.

SELECT 
    funnel_status,
    COUNT(*) AS cantidad,
    ROUND((COUNT(*)::numeric / (SELECT COUNT(*) FROM leads NULLIF((SELECT COUNT(*) FROM leads), 0)) * 100), 2) AS porcentaje_del_total
FROM leads
GROUP BY funnel_status
ORDER BY cantidad DESC;
