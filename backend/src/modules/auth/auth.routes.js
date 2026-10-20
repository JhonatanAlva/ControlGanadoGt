/**
 * modules/auth/auth.routes.js
 */
'use strict';

const { Router }  = require('express');
const controller  = require('./auth.controller');
const validate    = require('../../middlewares/validate.middleware');
const auth        = require('../../middlewares/auth.middleware');
const {
  registroSchema, loginSchema,
  actualizarPerfilSchema, cambiarPasswordSchema,
  solicitarRecuperacionSchema, restablecerPasswordSchema,
} = require('./auth.schema');

const router = Router();

router.post('/registro', validate(registroSchema), controller.registro);
router.post('/login',    validate(loginSchema),    controller.login);
router.get( '/me',       auth,                     controller.me);
router.put( '/me',       auth, validate(actualizarPerfilSchema), controller.actualizarPerfil);
router.put( '/password', auth, validate(cambiarPasswordSchema),  controller.cambiarPassword);
router.post('/logout',   auth,                     controller.logout);

// Recuperación de contraseña (protegida por el rate limit de /auth en app.js)
router.post('/recuperar',   validate(solicitarRecuperacionSchema), controller.solicitarRecuperacion);
router.post('/restablecer', validate(restablecerPasswordSchema),   controller.restablecerPassword);

module.exports = router;