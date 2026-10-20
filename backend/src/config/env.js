/**
 * config/env.js
 * Valida que todas las variables de entorno necesarias existan al arrancar.
 * Si falta alguna obligatoria, el proceso termina con un mensaje claro.
 */

'use strict';

require('dotenv').config({ quiet: true });

const required = [
  'NODE_ENV',
  'PORT',
  'DB_HOST',
  'DB_PORT',
  'DB_USER',
  'DB_PASSWORD',
  'DB_NAME',
  'JWT_SECRET',
];

const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error(`\n  Faltan variables de entorno obligatorias:\n   ${missing.join(', ')}\n`);
  console.error('   Revisa tu archivo backend/.env\n');
  process.exit(1);
}

// Un secreto corto permite falsificar tokens por fuerza bruta
if (process.env.JWT_SECRET.length < 32) {
  console.error('\n  JWT_SECRET debe tener al menos 32 caracteres.');
  console.error(`   Genera uno con: node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"\n`);
  process.exit(1);
}

if (process.env.NODE_ENV === 'production' && !process.env.CORS_ORIGIN) {
  console.warn('\n  CORS_ORIGIN no está definido: se bloquearán peticiones desde navegadores.\n');
}

const env = {
  // Servidor
  NODE_ENV:    process.env.NODE_ENV || 'development',
  PORT:        parseInt(process.env.PORT, 10) || 3000,
  isDev:       process.env.NODE_ENV === 'development',
  isProd:      process.env.NODE_ENV === 'production',

  // Base de datos
  db: {
    host:     process.env.DB_HOST,
    port:     parseInt(process.env.DB_PORT, 10) || 5432,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    name:     process.env.DB_NAME,
    // Activar en producción si la base de datos está en otro servidor
    ssl:      process.env.DB_SSL === 'true',
  },

  // Seguridad
  corsOrigin: process.env.CORS_ORIGIN || '',
  // Número de proxies delante del API (Nginx, Railway, etc.) para que el rate limit vea la IP real
  trustProxy: parseInt(process.env.TRUST_PROXY, 10) || 0,

  // JWT
  jwt: {
    secret:    process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  // Cloudinary
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey:    process.env.CLOUDINARY_API_KEY    || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
  },

  // Pagadito
  pagadito: {
    uid: process.env.PAGADITO_UID || '',
    wsk: process.env.PAGADITO_WSK || '',
  },
};

module.exports = env;