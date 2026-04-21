const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { JWT_SECRET } = require('../middlewares/authMiddleware');

// POST /api/auth/login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    
    try {
        const result = await db.query("SELECT key, value FROM settings WHERE key IN ('admin_user', 'admin_password')");
        const creds = {};
        result.rows.forEach(row => creds[row.key] = row.value);

        if (username === creds.admin_user) {
            // Verificar password plano contra hash en BBDD via crypt/bcrypt
            // NOTA: Como usamos crypt() de pgcrypto (Blowfish), es 100% compatible con bcryptjs de node
            const isMatch = await bcrypt.compare(password, creds.admin_password);
            
            if (isMatch) {
                const token = jwt.sign({ user: username }, JWT_SECRET, { expiresIn: '12h' });
                return res.json({ success: true, token });
            }
        }
        res.status(401).json({ success: false, message: 'Credenciales Inválidas' });
    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ success: false, message: 'Error de Servidor' });
    }
});

module.exports = router;
