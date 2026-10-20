/**
 * modules/auth/auth.schema.js
 */
"use strict";

const { z } = require("zod");
const { REGIONES_GUATEMALA } = require("../../config/constants");

// bcrypt solo usa los primeros 72 bytes, por eso el máximo
const passwordSegura = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres")
  .max(72, "La contraseña no puede superar 72 caracteres")
  .regex(/[A-Za-z]/, "La contraseña debe incluir al menos una letra")
  .regex(/[0-9]/, "La contraseña debe incluir al menos un número");

const registroSchema = z.object({
  nombre: z
    .string()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(150),
  email: z.string().email("Email inválido").toLowerCase(),
  password: passwordSegura,
  telefono: z.string().max(20).optional(),
  region: z.enum(REGIONES_GUATEMALA).optional(),
  whatsapp: z.string().max(20).optional(),
});

const loginSchema = z.object({
  email: z.string().email("Email inválido").toLowerCase(),
  password: z.string().min(1, "La contraseña es requerida").max(200),
});

const actualizarPerfilSchema = z.object({
  nombre: z.string().min(2, "El nombre debe tener al menos 2 caracteres").max(150).optional(),
  telefono: z.string().max(20).optional(),
  region: z.enum(REGIONES_GUATEMALA).optional(),
  whatsapp: z.string().max(20).optional(),
});

const cambiarPasswordSchema = z.object({
  passwordActual: z.string().min(1, "La contraseña actual es requerida"),
  passwordNueva: passwordSegura,
});

const solicitarRecuperacionSchema = z.object({
  email: z.string().email("Email inválido").toLowerCase(),
});

const restablecerPasswordSchema = z.object({
  email: z.string().email("Email inválido").toLowerCase(),
  codigo: z.string().regex(/^\d{6}$/, "El código debe tener 6 dígitos"),
  passwordNueva: passwordSegura,
});

module.exports = {
  registroSchema,
  loginSchema,
  actualizarPerfilSchema,
  cambiarPasswordSchema,
  solicitarRecuperacionSchema,
  restablecerPasswordSchema,
};
