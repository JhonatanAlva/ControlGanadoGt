/**
 * config/jwt.js
 * Helpers para generar y verificar JSON Web Tokens.
 */

'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const env = require('./env');

const ALGORITMO = 'HS256';

/**
 * Genera un JWT con el payload dado.
 * @param {object} payload  - Datos a incluir (ej: { id, email, plan })
 * @returns {string}        - Token firmado
 */
const signToken = (payload) =>
  jwt.sign(payload, env.jwt.secret, { expiresIn: env.jwt.expiresIn, algorithm: ALGORITMO });

/**
 * Verifica y decodifica un JWT.
 * Lanza error si el token es inválido o expiró.
 * @param {string} token
 * @returns {object} - Payload decodificado
 */
const verifyToken = (token) => jwt.verify(token, env.jwt.secret, { algorithms: [ALGORITMO] });

/**
 * Huella corta del hash de contraseña. Va dentro del token: si la contraseña
 * cambia, la huella deja de coincidir y todos los tokens anteriores quedan inválidos.
 * @param {string} passwordHash
 * @returns {string}
 */
const huellaPassword = (passwordHash) =>
  crypto.createHash('sha256').update(String(passwordHash)).digest('base64url').slice(0, 16);

module.exports = { signToken, verifyToken, huellaPassword };