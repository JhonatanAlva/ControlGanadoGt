/**
 * middlewares/error.middleware.js
 * Middleware global que atrapa TODOS los errores de la app.
 * Debe registrarse en app.js como el ÚLTIMO middleware.
 */

"use strict";

const logger = require("../utils/logger");
const AppError = require("../utils/AppError");
const env = require("../config/env");

// ── Errores conocidos de PostgreSQL ─────────────────────────────────────────
const handlePgError = (err) => {
  // Violación de constraint UNIQUE
  if (err.code === "23505") {
    const field = err.detail?.match(/Key \((.+?)\)/)?.[1] || "campo";
    return new AppError(`Ya existe un registro con ese ${field}.`, 409);
  }
  // Violación de FK
  if (err.code === "23503") {
    return new AppError("El recurso referenciado no existe.", 400);
  }
  // Valor fuera de enum
  if (err.code === "22P02") {
    return new AppError("Valor inválido para el tipo de dato.", 400);
  }
  return null;
};

// ── Errores de JWT ───────────────────────────────────────────────────────────
const handleJwtError = () =>
  AppError.unauthorized("Token inválido. Inicia sesión nuevamente.");
const handleJwtExpired = () =>
  AppError.unauthorized("Tu sesión expiró. Inicia sesión nuevamente.");

// ── Respuesta de error en desarrollo (incluye stack) ────────────────────────
const sendDevError = (err, res) => {
  res.status(err.statusCode).json({
    success: false,
    status: err.status,
    message: err.message,
    errors: err.errors || null,
    stack: err.stack,
  });
};

// ── Respuesta de error en producción (sin stack) ─────────────────────────────
const sendProdError = (err, res) => {
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      status: err.status,
      message: err.message,
      errors: err.errors || null,
    });
  }
  // Error de programación: no exponer detalles
  logger.error("💥  ERROR NO OPERACIONAL:", err);
  return res.status(500).json({
    success: false,
    status: "error",
    message: "Algo salió mal. Intenta de nuevo más tarde.",
    errors: null,
  });
};

// ── Handler principal ────────────────────────────────────────────────────────
const errorMiddleware = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";

  logger.error(
    `[${req.method}] ${req.originalUrl} — ${err.statusCode}: ${err.message}`,
  );

  // Normalizar errores externos
  let error = err;

  if (err.code && err.code.startsWith("2")) error = handlePgError(err) || err;
  if (err.name === "JsonWebTokenError") error = handleJwtError();
  if (err.name === "TokenExpiredError") error = handleJwtExpired();
  if (err.name === "MulterError")
    error = new AppError(`Error en carga de archivo: ${err.message}`, 400);
  if (err.type === "entity.too.large")
    error = new AppError("El cuerpo de la solicitud es demasiado grande.", 413);

  if (env.isDev) {
    sendDevError(error, res);
  } else {
    sendProdError(error, res);
  }
};

module.exports = errorMiddleware;
