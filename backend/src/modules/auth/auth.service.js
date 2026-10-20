/**
 * modules/auth/auth.service.js
 */
"use strict";

const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const env = require("../../config/env");
const logger = require("../../utils/logger");
const { sendMail } = require("../../config/mailer");
const { signToken, huellaPassword } = require("../../config/jwt");
const AppError = require("../../utils/AppError");
const repo = require("./auth.repository");
const { toPublic } = require("./auth.model");

const SALT_ROUNDS = 12;

// Hash de relleno: si el email no existe igual se ejecuta bcrypt, así el tiempo
// de respuesta no revela qué correos están registrados.
const HASH_RELLENO = bcrypt.hashSync("relleno-no-es-una-cuenta", SALT_ROUNDS);

const emitirToken = (usuario) =>
  signToken({ id: usuario.id, pv: huellaPassword(usuario.password_hash) });

const registro = async (datos) => {
  // Verificar email único
  const existe = await repo.findByEmail(datos.email);
  if (existe) throw AppError.conflict("Ya existe una cuenta con ese email.");

  const passwordHash = await bcrypt.hash(datos.password, SALT_ROUNDS);
  const usuarioRaw = await repo.create({ ...datos, passwordHash });
  const token = emitirToken({ id: usuarioRaw.id, password_hash: passwordHash });

  return { usuario: toPublic(usuarioRaw), token };
};

const login = async ({ email, password }) => {
  const usuarioRaw = await repo.findByEmail(email);

  const passwordValida = await bcrypt.compare(
    password,
    usuarioRaw?.password_hash || HASH_RELLENO,
  );
  if (!usuarioRaw || !passwordValida)
    throw AppError.unauthorized("Email o contraseña incorrectos.");
  // Solo se informa la desactivación a quien demostró conocer la contraseña
  if (!usuarioRaw.activo)
    throw AppError.unauthorized("Tu cuenta ha sido desactivada.");

  const token = emitirToken(usuarioRaw);

  return { usuario: toPublic(usuarioRaw), token };
};

const getMe = async (id) => {
  const usuario = await repo.findById(id);
  if (!usuario) throw AppError.notFound("Usuario no encontrado.");
  return usuario;
};

const actualizarPerfil = async (id, datos) => {
  const actualizado = await repo.update(id, datos);
  if (!actualizado) throw AppError.notFound("Usuario no encontrado.");
  return toPublic(actualizado);
};

const cambiarPassword = async (id, { passwordActual, passwordNueva }) => {
  const usuario = await repo.findByIdConPassword(id);
  if (!usuario) throw AppError.notFound("Usuario no encontrado.");

  const passwordValida = await bcrypt.compare(
    passwordActual,
    usuario.password_hash,
  );
  if (!passwordValida)
    throw AppError.unauthorized("La contraseña actual es incorrecta.");

  const nuevoHash = await bcrypt.hash(passwordNueva, SALT_ROUNDS);
  await repo.updatePassword(id, nuevoHash);

  // Los tokens anteriores quedan invalidados; se entrega uno nuevo a este dispositivo
  return { token: emitirToken({ id, password_hash: nuevoHash }) };
};

// ── Recuperación de contraseña ───────────────────────────────────────────────

const RESET_MINUTOS = 15;
const RESET_MAX_INTENTOS = 5;
const RESET_MAX_POR_HORA = 3;

// HMAC con el secreto del servidor: aunque se filtre la base de datos,
// no se pueden probar los 1,000,000 de códigos posibles sin el secreto.
const hashCodigo = (codigo) =>
  crypto.createHmac("sha256", env.jwt.secret).update(codigo).digest("hex");

const codigosIguales = (a, b) =>
  crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));

const enviarCorreoCodigo = (usuario, codigo) =>
  sendMail({
    to: usuario.email,
    subject: "GanaderíaGT — Código para restablecer tu contraseña",
    text: `Tu código es ${codigo}. Vence en ${RESET_MINUTOS} minutos. Si no lo pediste, ignora este correo.`,
    html: `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
      <h2 style="color:#2d7a3a">🐄 GanaderíaGT</h2>
      <p>Hola <strong>${usuario.nombre}</strong>,</p>
      <p>Tu código para restablecer la contraseña es:</p>
      <p style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#2d7a3a">${codigo}</p>
      <p>Vence en ${RESET_MINUTOS} minutos.</p>
      <p style="color:#718096;font-size:13px">Si no pediste este código, ignora este correo: tu contraseña sigue igual.</p>
    </div>`,
  });

/**
 * Siempre responde igual, exista o no el email, para no revelar qué cuentas existen.
 */
const solicitarRecuperacion = async ({ email }) => {
  const usuario = await repo.findByEmail(email);
  if (!usuario || !usuario.activo) return;

  // Evita usar la función para inundar el correo de alguien
  if ((await repo.countResetsRecientes(usuario.id)) >= RESET_MAX_POR_HORA) return;

  const codigo = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
  await repo.createReset(usuario.id, hashCodigo(codigo), RESET_MINUTOS);

  // Sin await: el tiempo de envío del correo no debe delatar que la cuenta existe
  enviarCorreoCodigo(usuario, codigo).catch((err) =>
    logger.error(`No se pudo enviar el código de recuperación: ${err.message}`),
  );
};

const restablecerPassword = async ({ email, codigo, passwordNueva }) => {
  const invalido = AppError.badRequest("El código es inválido o ya expiró.");

  const usuario = await repo.findByEmail(email);
  if (!usuario || !usuario.activo) throw invalido;

  const reset = await repo.findResetVigente(usuario.id);
  if (!reset) throw invalido;

  if (reset.intentos >= RESET_MAX_INTENTOS) {
    await repo.marcarResetUsado(reset.id);
    throw invalido;
  }

  if (!codigosIguales(hashCodigo(codigo), reset.codigo_hash)) {
    await repo.sumarIntentoReset(reset.id);
    throw invalido;
  }

  await repo.marcarResetUsado(reset.id);
  // La huella del token cambia con el hash: se cierran todas las sesiones abiertas
  await repo.updatePassword(usuario.id, await bcrypt.hash(passwordNueva, SALT_ROUNDS));
};

module.exports = {
  registro,
  login,
  getMe,
  actualizarPerfil,
  cambiarPassword,
  solicitarRecuperacion,
  restablecerPassword,
};
