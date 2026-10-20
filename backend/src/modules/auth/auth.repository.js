/**
 * modules/auth/auth.repository.js
 */
"use strict";

const { query } = require("../../config/db");

const findByEmail = async (email) => {
  const result = await query(
    "SELECT * FROM usuarios WHERE email = $1 LIMIT 1",
    [email],
  );
  return result.rows[0] || null;
};

const findById = async (id) => {
  const result = await query(
    "SELECT id, nombre, email, telefono, region, whatsapp, foto_url, plan, activo, creado_en FROM usuarios WHERE id = $1",
    [id],
  );
  return result.rows[0] || null;
};

const findByIdConPassword = async (id) => {
  const result = await query("SELECT * FROM usuarios WHERE id = $1", [id]);
  return result.rows[0] || null;
};

const create = async ({
  nombre,
  email,
  passwordHash,
  telefono,
  region,
  whatsapp,
}) => {
  const result = await query(
    `INSERT INTO usuarios (nombre, email, password_hash, telefono, region, whatsapp)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, nombre, email, telefono, region, whatsapp, plan, creado_en`,
    [
      nombre,
      email,
      passwordHash,
      telefono || null,
      region || null,
      whatsapp || null,
    ],
  );
  return result.rows[0];
};

const update = async (id, campos) => {
  const keys = Object.keys(campos).filter((k) => campos[k] !== undefined);
  if (keys.length === 0) return findById(id);

  const sets = keys.map((k, i) => `${k} = $${i + 2}`);
  const values = keys.map((k) => campos[k]);

  const result = await query(
    `UPDATE usuarios SET ${sets.join(", ")}
     WHERE id = $1
     RETURNING id, nombre, email, telefono, region, whatsapp, foto_url, plan, activo, creado_en, actualizado_en`,
    [id, ...values],
  );
  return result.rows[0] || null;
};

const updatePassword = async (id, passwordHash) => {
  await query("UPDATE usuarios SET password_hash = $2 WHERE id = $1", [
    id,
    passwordHash,
  ]);
};

// ── Recuperación de contraseña ───────────────────────────────────────────────

const countResetsRecientes = async (usuarioId) => {
  const result = await query(
    `SELECT COUNT(*) AS total FROM password_resets
     WHERE usuario_id = $1 AND creado_en > NOW() - INTERVAL '1 hour'`,
    [usuarioId],
  );
  return parseInt(result.rows[0].total, 10);
};

// Invalida códigos anteriores y crea uno nuevo
const createReset = async (usuarioId, codigoHash, minutos) => {
  await query(
    "UPDATE password_resets SET usado_en = NOW() WHERE usuario_id = $1 AND usado_en IS NULL",
    [usuarioId],
  );
  await query(
    `INSERT INTO password_resets (usuario_id, codigo_hash, expira_en)
     VALUES ($1, $2, NOW() + make_interval(mins => $3))`,
    [usuarioId, codigoHash, minutos],
  );
};

const findResetVigente = async (usuarioId) => {
  const result = await query(
    `SELECT id, codigo_hash, intentos FROM password_resets
     WHERE usuario_id = $1 AND usado_en IS NULL AND expira_en > NOW()
     ORDER BY creado_en DESC LIMIT 1`,
    [usuarioId],
  );
  return result.rows[0] || null;
};

const sumarIntentoReset = async (id) => {
  await query("UPDATE password_resets SET intentos = intentos + 1 WHERE id = $1", [id]);
};

const marcarResetUsado = async (id) => {
  await query("UPDATE password_resets SET usado_en = NOW() WHERE id = $1", [id]);
};

module.exports = {
  findByEmail,
  findById,
  findByIdConPassword,
  create,
  update,
  updatePassword,
  countResetsRecientes,
  createReset,
  findResetVigente,
  sumarIntentoReset,
  marcarResetUsado,
};
