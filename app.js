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

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para parsear JSON
app.use(express.json());

// Servir la Interfaz Gráfica Estática (pública, el frontend manejará redirect a login)
app.use(express.static('public'));

// Public Routes
app.use('/api/webhook',      webhookRoutes);
app.use('/api/ecommerce',    ecommerceRoutes);
app.use('/api/auth',         authRoutes);
app.use('/api/integrations', integrationRoutes);

// Protected Routes (UI dashboard calls — auth applied inside each router)
app.use('/api/analytics', analyticsRoutes);
app.use('/api', uiRoutes);

// Iniciar CRON Jobs
startFollowUpCron();
startDripCampaignEngine();

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
