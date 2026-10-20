/**
 * config/mailer.js
 * Configuración del transporter de Nodemailer.
 * Para desarrollo usa Mailtrap o ethereal.email (no envía correos reales).
 * Para producción cambia a SendGrid / SMTP real.
 */

'use strict';

const nodemailer = require('nodemailer');
const env        = require('./env');
const logger     = require('../utils/logger');

let transporter;

if (env.isDev) {
  // En desarrollo: usa Mailtrap o ethereal (configura en .env)
  transporter = nodemailer.createTransport({
    host:   process.env.MAIL_HOST || 'sandbox.smtp.mailtrap.io',
    port:   parseInt(process.env.MAIL_PORT, 10) || 2525,
    auth: {
      user: process.env.MAIL_USER || '',
      pass: process.env.MAIL_PASS || '',
    },
  });
} else {
  // En producción: SMTP real
  transporter = nodemailer.createTransport({
    host:   process.env.MAIL_HOST,
    port:   parseInt(process.env.MAIL_PORT, 10) || 587,
    secure: process.env.MAIL_SECURE === 'true',
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
  });
}

/**
 * Envía un correo electrónico.
 * @param {object} options
 * @param {string} options.to      - Destinatario
 * @param {string} options.subject - Asunto
 * @param {string} options.html    - Cuerpo HTML
 * @param {string} [options.text]  - Cuerpo texto plano (fallback)
 */
const sendMail = async ({ to, subject, html, text }) => {
  // Solo en desarrollo y sin credenciales SMTP: el correo se muestra en la consola
  if (env.isDev && !process.env.MAIL_USER) {
    logger.warn(`📧  [DEV, sin SMTP] Para: ${to} | ${subject}\n${text || '(solo HTML)'}`);
    return { messageId: 'dev-consola' };
  }

  try {
    const info = await transporter.sendMail({
      from:    process.env.MAIL_FROM || '"GanaderíaGT" <noreply@ganaderiagt.com>',
      to,
      subject,
      html,
      text,
    });
    logger.info(`📧  Correo enviado a ${to} — ID: ${info.messageId}`);
    return info;
  } catch (err) {
    logger.error(`❌  Error enviando correo a ${to}:`, err.message);
    throw err;
  }
};

module.exports = { sendMail, transporter };