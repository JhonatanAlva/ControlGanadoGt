/**
 * middlewares/auth.middleware.js
 * Verifica que el request tenga un JWT válido en el header Authorization.
 * Si es válido, adjunta el usuario decodificado a req.user.
 */

"use strict";

const { verifyToken, huellaPassword } = require("../config/jwt");
const AppError = require("../utils/AppError");
const { query } = require("../config/db");

const authMiddleware = async (req, res, next) => {
  try {
    // 1. Extraer token del header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw AppError.unauthorized("Token no proporcionado.");
    }

    const token = authHeader.split(" ")[1];

    // 2. Verificar firma y expiración
    const decoded = verifyToken(token);

    // 3. Confirmar que el usuario aún existe en la DB
    const result = await query(
      "SELECT id, nombre, email, plan, activo, password_hash FROM usuarios WHERE id = $1",
      [decoded.id],
    );

    if (result.rows.length === 0) {
      throw AppError.unauthorized("El usuario ya no existe.");
    }

    const { password_hash, ...usuario } = result.rows[0];

    if (!usuario.activo) {
      throw AppError.unauthorized("Tu cuenta ha sido desactivada.");
    }

    // Token emitido antes del último cambio de contraseña
    if (decoded.pv !== huellaPassword(password_hash)) {
      throw AppError.unauthorized("Tu sesión ya no es válida. Inicia sesión nuevamente.");
    }

    // 4. Adjuntar usuario al request
    req.user = usuario;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = authMiddleware;
