/**
 * utils/logger.js
 * Logger centralizado con Winston.
 * - En desarrollo: colorido en consola con timestamps.
 * - En producción: JSON en consola (Railway/Render lo captura) + archivo de errores.
 */

"use strict";

const { createLogger, format, transports } = require("winston");
const path = require("path");

const { combine, timestamp, colorize, printf, json, errors } = format;

// Formato legible para desarrollo
const devFormat = combine(
  colorize({ all: true }),
  timestamp({ format: "HH:mm:ss" }),
  errors({ stack: true }),
  printf(({ level, message, timestamp: ts, stack }) =>
    stack
      ? `[${ts}] ${level}: ${message}\n${stack}`
      : `[${ts}] ${level}: ${message}`,
  ),
);

// Formato JSON para producción
const prodFormat = combine(timestamp(), errors({ stack: true }), json());

const isDev = process.env.NODE_ENV !== "production";

const logger = createLogger({
  level: isDev ? "debug" : "info",
  silent: process.env.NODE_ENV === "test",
  format: isDev ? devFormat : prodFormat,
  transports: [
    new transports.Console(),
    // En producción también guarda errores en archivo
    ...(isDev
      ? []
      : [
          new transports.File({
            filename: path.join("logs", "error.log"),
            level: "error",
          }),
        ]),
  ],
  // No termina el proceso en excepciones no capturadas (lo maneja server.js)
  exitOnError: false,
});

module.exports = logger;
