require('dotenv').config();
const { initializeLogger } = require('./services/logger');

// Capturar Logs lo antes posible
initializeLogger();

const express = require('express');
const webhookRoutes = require('./routes/webhook');
const { startFollowUpCron } = require('./services/cronJobs');

const analyticsRoutes = require('./routes/analyticsRoutes');
const uiRoutes = require('./routes/uiRoutes');
const ecommerceRoutes = require('./routes/ecommerceRoutes');
const authRoutes = require('./routes/authRoutes');
const integrationRoutes = require('./routes/integrationRoutes');
const { startDripCampaignEngine } = require('./services/sequenceEngine');
const { verifyToken } = require('./middlewares/authMiddleware');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para parsear JSON
app.use(express.json());

// Servir la Interfaz Gráfica Estática (pública, el frontend manejará redirect a login)
app.use(express.static('public'));

// ── Guard: verificar que todos los handlers son funciones antes de registrar ──
const _assertHandler = (name, handler) => {
    if (typeof handler !== 'function') {
        console.error(`[app.js] ❌ ERROR: "${name}" no es una función (es ${typeof handler}). Revisa el export del módulo.`);
        process.exit(1);
    }
};
_assertHandler('webhookRoutes',       webhookRoutes);
_assertHandler('ecommerceRoutes',     ecommerceRoutes);
_assertHandler('authRoutes',          authRoutes);
_assertHandler('integrationRoutes',   integrationRoutes);
_assertHandler('analyticsRoutes',     analyticsRoutes);
_assertHandler('uiRoutes',            uiRoutes);
_assertHandler('verifyToken',         verifyToken);

// Public Routes
app.use('/api/webhook',      webhookRoutes);
app.use('/api/ecommerce',    ecommerceRoutes);
app.use('/api/auth',         authRoutes);
app.use('/api/integrations', integrationRoutes);

// Protected Routes (UI dashboard calls)
app.use('/api/analytics', verifyToken, analyticsRoutes);
app.use('/api',           verifyToken, uiRoutes);

// Iniciar CRON Jobs
startFollowUpCron();
startDripCampaignEngine();

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
