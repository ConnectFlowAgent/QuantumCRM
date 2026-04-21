const redisClient = require('../config/redisClient');

const MAX_LOGS = 200;
const REDIS_LOG_KEY = 'app:system_logs';

/**
 * Da formato de texto seguro a objetos grandes
 */
const formatArgs = (args) => {
    return args.map(arg => {
        if (typeof arg === 'object') {
            try {
                // Previene error de circular stringify
                return JSON.stringify(arg, null, 2);
            } catch (e) {
                return '[Complex Object]';
            }
        }
        return String(arg);
    }).join(' ');
};

/**
 * Guarda en memoria caché (FIFO 200) y mantiene el output standard
 */
const saveToRedis = async (level, msg) => {
    try {
        const payload = JSON.stringify({
            level: level,
            message: msg,
            timestamp: new Date().toISOString()
        });

        // Metemos al inicio de la lista
        await redisClient.lPush(REDIS_LOG_KEY, payload);
        // Cortamos lo que sobra pasado el MAX_LOGS
        await redisClient.lTrim(REDIS_LOG_KEY, 0, MAX_LOGS - 1);
    } catch (err) {
        // Fallback silencioso si redis esta apagado para no causar un loop
        const originalError = console._originalError || console.error;
        originalError("[Logger Error] No se pudo guardar el log en Redis", err);
    }
};

/**
 * Inyecta el interceptor global
 */
const initializeLogger = () => {
    // Salvamos los orígenes
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    console._originalError = originalError;

    console.log = function(...args) {
        originalLog.apply(console, args);
        saveToRedis('INFO', formatArgs(args));
    };

    console.error = function(...args) {
        originalError.apply(console, args);
        saveToRedis('ERROR', formatArgs(args));
    };

    console.warn = function(...args) {
        originalWarn.apply(console, args);
        saveToRedis('WARN', formatArgs(args));
    };
    
    // Test Injection
    console.log('[System] Logger Intercept Mode Inicializado. Monitor activo.');
};

module.exports = {
    initializeLogger
};
