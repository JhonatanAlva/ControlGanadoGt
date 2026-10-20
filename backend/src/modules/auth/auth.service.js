/**
 * modules/auth/auth.service.js
 */
"use strict";

const bcrypt = require("bcryptjs");
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

module.exports = {
  registro,
  login,
  getMe,
  actualizarPerfil,
  cambiarPassword,
};
