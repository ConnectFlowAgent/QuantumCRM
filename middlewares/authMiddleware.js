const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'quantum_secure_jwt_key_2026';

const verifyToken = (req, res, next) => {
    const bearerHeader = req.headers['authorization'];
    
    if (typeof bearerHeader !== 'undefined') {
        const bearerToken = bearerHeader.split(' ')[1];
        jwt.verify(bearerToken, JWT_SECRET, (err, authData) => {
            if (err) {
                res.status(401).json({ success: false, message: 'Acceso Denegado: Token Inválido o Expirado' });
            } else {
                req.user = authData;
                next();
            }
        });
    } else {
        res.status(401).json({ success: false, message: 'Acceso Denegado: Se requiere Token de Autenticación' });
    }
};

module.exports = {
    verifyToken,
    JWT_SECRET
};
