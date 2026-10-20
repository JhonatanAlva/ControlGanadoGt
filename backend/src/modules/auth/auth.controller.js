/**
 * modules/auth/auth.controller.js
 */
"use strict";

const service = require("./auth.service");
const { created, ok } = require("../../utils/response");

const registro = async (req, res, next) => {
  try {
    const { usuario, token } = await service.registro(req.body);
    created(res, { usuario, token }, "Cuenta creada exitosamente.");
  } catch (err) {
    next(err);
  }
};

const login = async (req, res, next) => {
  try {
    const { usuario, token } = await service.login(req.body);
    ok(res, { usuario, token }, "Sesión iniciada.");
  } catch (err) {
    next(err);
  }
};

const me = async (req, res, next) => {
  try {
    const usuario = await service.getMe(req.user.id);
    ok(res, { usuario });
  } catch (err) {
    next(err);
  }
};

// El logout en JWT es stateless — el cliente descarta el token.
// Aquí se puede blacklistear en Redis si se necesita en el futuro.
const logout = (req, res) => {
  ok(res, null, "Sesión cerrada. Descarta el token en el cliente.");
};

const actualizarPerfil = async (req, res, next) => {
  try {
    const usuario = await service.actualizarPerfil(req.user.id, req.body);
    ok(res, { usuario }, "Perfil actualizado.");
  } catch (err) {
    next(err);
  }
};

const cambiarPassword = async (req, res, next) => {
  try {
    const { token } = await service.cambiarPassword(req.user.id, req.body);
    ok(res, { token }, "Contraseña actualizada. Se cerró la sesión en tus otros dispositivos.");
  } catch (err) {
    next(err);
  }
};

module.exports = {
  registro,
  login,
  me,
  logout,
  actualizarPerfil,
  cambiarPassword,
};
