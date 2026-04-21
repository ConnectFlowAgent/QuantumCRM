const redis = require('redis');
require('dotenv').config();

const client = redis.createClient({
  url: process.env.REDIS_URL || 'redis://redis:6379'
});

client.on('error', (err) => {
    // Log sin romper el proceso — el logger usa Redis, así que usamos console directamente
    console._originalError
        ? console._originalError('[Redis] Error de conexión:', err.message)
        : console.error('[Redis] Error de conexión:', err.message);
});

client.on('connect',   () => console.log('[Redis] Conectado.'));
client.on('reconnecting', () => console.log('[Redis] Reconectando...'));

// Conexión lazy: se conecta una sola vez al primer uso, no al importar el módulo.
// Esto evita que un Redis lento/caído bloquee la carga de módulos de Node.js.
let _connectPromise = null;
const ensureConnected = () => {
    if (!_connectPromise) {
        _connectPromise = client.connect().catch((err) => {
            _connectPromise = null; // permitir reintento en el siguiente uso
            console.error('[Redis] Fallo al conectar:', err.message);
        });
    }
    return _connectPromise;
};

// Proxy: intercepta cada llamada y garantiza que la conexión esté lista
const clientProxy = new Proxy(client, {
    get(target, prop) {
        const value = target[prop];
        if (typeof value === 'function' && !['on', 'off', 'emit', 'connect', 'quit', 'disconnect'].includes(prop)) {
            return async (...args) => {
                await ensureConnected();
                return value.apply(target, args);
            };
        }
        return value;
    }
});

module.exports = clientProxy;
