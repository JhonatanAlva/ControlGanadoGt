/**
 * config/db.js
 * Pool de conexiones a PostgreSQL usando el paquete 'pg'.
 * Exporta una función query() y el pool para transacciones.
 */

'use strict';

const { Pool } = require('pg');
const env      = require('./env');
const logger   = require('../utils/logger');

const pool = new Pool({
  host:               env.db.host,
  port:               env.db.port,
  user:               env.db.user,
  password:           env.db.password,
  database:           env.db.name,
  ssl:                env.db.ssl ? { rejectUnauthorized: true } : false,
  max:                10,           // máximo de conexiones simultáneas
  idleTimeoutMillis:  30_000,       // cierra conexiones inactivas tras 30s
  connectionTimeoutMillis: 5_000,   // error si no conecta en 5s
});

// Log cuando una conexión nueva se abre
pool.on('connect', () => {
  if (env.isDev) logger.debug('  Nueva conexión al pool de PostgreSQL');
});

// Log de errores inesperados en conexiones inactivas
pool.on('error', (err) => {
  logger.error('  Error inesperado en el pool de PostgreSQL:', err.message);
});

/**
 * Ejecuta una query con parámetros opcionales.
 * @param {string} text   - SQL con placeholders ($1, $2, ...)
 * @param {Array}  params - Valores para los placeholders
 * @returns {Promise<import('pg').QueryResult>}
 */
const query = (text, params) => pool.query(text, params);

/**
 * Obtiene un cliente del pool para manejar transacciones manualmente.
 * Recuerda llamar client.release() al terminar.
 * @returns {Promise<import('pg').PoolClient>}
 */
const getClient = () => pool.connect();

/**
 * Verifica que la conexión a la base de datos funcione.
 * Se llama al arrancar el servidor.
 */
const testConnection = async () => {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT NOW() AS now');
    logger.info(` PostgreSQL conectado — ${result.rows[0].now}`);
  } finally {
    client.release();
  }
};

module.exports = { query, getClient, pool, testConnection };