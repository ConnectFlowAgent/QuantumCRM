-- Módulo 1 y 5: Tablas Fundacionales y de Métricas
-- NOTA: Compatible con PostgreSQL

CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- Para habilitar gen_random_uuid() si no está en versiones más nuevas por defecto

-- 1. Tabla de Leads
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number VARCHAR(20) UNIQUE NOT NULL, 
    name VARCHAR(100), 
    funnel_status VARCHAR(50) DEFAULT 'NEW', 
    is_paused BOOLEAN DEFAULT FALSE, 
    last_outbound_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_read_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices de optimización para CRON Jobs y Query de embudos
CREATE INDEX idx_leads_funnel_status ON leads(funnel_status);
CREATE INDEX idx_leads_updated_at ON leads(updated_at);

-- 2. Tabla de Historial (Conversations)
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    wa_message_id VARCHAR(100) UNIQUE, 
    direction VARCHAR(10) NOT NULL CHECK (direction IN ('INBOUND', 'OUTBOUND')),
    message_type VARCHAR(20) DEFAULT 'text', 
    content TEXT, 
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_conversations_lead_id ON conversations(lead_id);

-- 3. Tabla de Plantillas (Templates)
CREATE TABLE IF NOT EXISTS templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_name VARCHAR(50) UNIQUE NOT NULL, 
    content TEXT NOT NULL, 
    media_url VARCHAR(255), 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Inserciones de prueba para el script conversacional
INSERT INTO templates (node_name, content) VALUES
('welcome_msg', '¡Hola! Bienvenido. Para ayudarte mejor, ¿puedes decirme tu nombre?'),
('qualify_q1', 'Gracias {{name}}. ¿En qué servicio estás interesado?'),
('objection_price', 'Entiendo que el precio es un factor. Nuestros planes están diseñados para dar retorno de inversión rápido. ¿Te gustaría ver un caso de estudio?'),
('followup_24h', 'Hola {{name}}, ¿Aún sigues por ahí? Queríamos saber si tienes alguna otra duda.'),
('handoff_msg', 'Un asesor humano te responderá en breve. Mientras tanto, tu bot ha sido pausado.')
ON CONFLICT (node_name) DO NOTHING;

-- 4. Tabla de Configuración Global (Settings)
CREATE TABLE IF NOT EXISTS settings (
    key VARCHAR(50) PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO settings (key, value) VALUES
('whatsapp_verify_token', 'my_secure_token_123'),
('whatsapp_access_token', ''),
('phone_number_id', ''),
('smtp_host', 'smtp.gmail.com'),
('smtp_user', 'tucorreo@empresa.com'),
('smtp_pass', ''),
('admin_user', 'admin'),
('admin_password', crypt('123456', gen_salt('bf'))),
('openai_api_key', ''),
('openai_system_prompt', 'Eres el mejor equipo comercial de WhatsApp de nuestra empresa. Sé amigable, preciso y no hagas promesas de descuentos. Tu meta es resolver problemas y vender.')
ON CONFLICT DO NOTHING;

-- 5. Tabla de Órdenes E-Commerce (para Post_Venta)
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    external_order_id VARCHAR(100),
    email VARCHAR(100),
    status VARCHAR(50) DEFAULT 'PAID',
    paid_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_orders_paid_at ON orders(paid_at);
CREATE INDEX idx_orders_lead_id ON orders(lead_id);

