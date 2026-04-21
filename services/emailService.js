const nodemailer = require('nodemailer');
const db = require('../config/db');

const sendEmail = async (to, subject, htmlContent) => {
    try {
        const result = await db.query("SELECT key, value FROM settings WHERE key IN ('smtp_host', 'smtp_user', 'smtp_pass')");
        const config = {};
        result.rows.forEach(row => { config[row.key] = row.value; });

        if (!config.smtp_host || !config.smtp_user || !config.smtp_pass) {
            console.error('Faltan configuraciones SMTP en BD para enviar correo.');
            return false;
        }

        let transporter = nodemailer.createTransport({
            host: config.smtp_host,
            port: 465,
            secure: true, // true for 465, false for other ports
            auth: {
                user: config.smtp_user,
                pass: config.smtp_pass
            }
        });

        // Enviar mail
        let info = await transporter.sendMail({
            from: `"Quantum CRM" <${config.smtp_user}>`,
            to: to,
            subject: subject,
            html: htmlContent
        });

        console.log("Mensaje enviado: %s", info.messageId);
        return true;
    } catch (error) {
        console.error("Error enviando correo SMTP:", error);
        return false;
    }
}

module.exports = {
    sendEmail
};
