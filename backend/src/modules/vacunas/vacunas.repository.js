/**
 * modules/vacunas/vacunas.repository.js
 */
'use strict';

const { query } = require('../../config/db');
const paginate = require('../../utils/paginate');

// ── Listar con filtros ────────────────────────────────────────────────────────
const findAll = async (usuarioId, filtros = {}) => {
    const { page, limit, offset } = paginate(filtros);
    const values = [usuarioId];
    const where = ['a.usuario_id = $1'];
    let idx = 2;

    if (filtros.animal_id) { where.push(`v.animal_id = $${idx++}`); values.push(filtros.animal_id); }
    // La finca del registro, o si no tiene, la finca donde está el animal
    if (filtros.finca_id) { where.push(`COALESCE(v.finca_id, a.finca_id) = $${idx++}`); values.push(filtros.finca_id); }
    if (filtros.tipo_vacuna) { where.push(`v.tipo_vacuna = $${idx++}`); values.push(filtros.tipo_vacuna); }

    // Solo vacunas con próxima dosis pendiente (vencidas o próximas 30 días)
    if (filtros.pendientes === 'true') {
        where.push(`v.proxima_dosis IS NOT NULL AND v.proxima_dosis <= CURRENT_DATE + 30`);
    }

    const whereClause = where.join(' AND ');

    const countResult = await query(
        `SELECT COUNT(*) AS total
     FROM vacunas v
     JOIN animales a ON a.id = v.animal_id
     WHERE ${whereClause}`,
        values
    );
    const total = parseInt(countResult.rows[0].total, 10);

    const rows = await query(
        `SELECT
        v.*,
        a.numero_arete,
        a.nombre AS animal_nombre,
        f.nombre AS finca_nombre,
        CASE
          WHEN v.proxima_dosis < CURRENT_DATE        THEN 'Vencida'
          WHEN v.proxima_dosis <= CURRENT_DATE + 7   THEN 'Esta semana'
          WHEN v.proxima_dosis <= CURRENT_DATE + 30  THEN 'Próxima'
          ELSE 'Al día'
        END AS urgencia
     FROM vacunas v
     JOIN animales a ON a.id = v.animal_id
     LEFT JOIN fincas f ON f.id = v.finca_id
     WHERE ${whereClause}
     ORDER BY v.fecha_aplicacion DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
        [...values, limit, offset]
    );

    return { rows: rows.rows, total, page, limit };
};

// ── Buscar por ID verificando que el animal pertenezca al usuario ─────────────
const findById = async (id, usuarioId) => {
    const result = await query(
        `SELECT
        v.*,
        a.numero_arete,
        a.nombre AS animal_nombre,
        f.nombre AS finca_nombre
     FROM vacunas v
     JOIN animales a ON a.id = v.animal_id
     LEFT JOIN fincas f ON f.id = v.finca_id
     WHERE v.id = $1 AND a.usuario_id = $2`,
        [id, usuarioId]
    );
    return result.rows[0] || null;
};

// ── Historial de un animal específico ────────────────────────────────────────
const findByAnimal = async (animalId, usuarioId) => {
    const result = await query(
        `SELECT v.*,
        CASE
          WHEN v.proxima_dosis < CURRENT_DATE        THEN 'Vencida'
          WHEN v.proxima_dosis <= CURRENT_DATE + 7   THEN 'Esta semana'
          WHEN v.proxima_dosis <= CURRENT_DATE + 30  THEN 'Próxima'
          ELSE 'Al día'
        END AS urgencia
     FROM vacunas v
     JOIN animales a ON a.id = v.animal_id
     WHERE v.animal_id = $1 AND a.usuario_id = $2
     ORDER BY v.fecha_aplicacion DESC`,
        [animalId, usuarioId]
    );
    return result.rows;
};

const create = async (datos) => {
    const {
        animal_id, finca_id, tipo_vacuna, nombre_producto, lote,
        fecha_aplicacion, proxima_dosis, dosis, via_aplicacion,
        veterinario, costo, notas,
    } = datos;

    const result = await query(
        `INSERT INTO vacunas (
        animal_id, finca_id, tipo_vacuna, nombre_producto, lote,
        fecha_aplicacion, proxima_dosis, dosis, via_aplicacion,
        veterinario, costo, notas
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING *`,
        [
            animal_id, finca_id || null, tipo_vacuna, nombre_producto || null, lote || null,
            fecha_aplicacion, proxima_dosis || null, dosis || null, via_aplicacion || null,
            veterinario || null, costo || null, notas || null,
        ]
    );
    return result.rows[0];
};

const update = async (id, usuarioId, campos) => {
    const keys = Object.keys(campos).filter((k) => campos[k] !== undefined);
    if (keys.length === 0) return findById(id, usuarioId);

    const sets = keys.map((k, i) => `${k} = $${i + 3}`);
    const values = keys.map((k) => campos[k]);

    const result = await query(
        `UPDATE vacunas SET ${sets.join(', ')}
     WHERE id = $1
       AND animal_id IN (SELECT id FROM animales WHERE usuario_id = $2)
     RETURNING *`,
        [id, usuarioId, ...values]
    );
    return result.rows[0] || null;
};

const remove = async (id, usuarioId) => {
    const result = await query(
        `DELETE FROM vacunas
     WHERE id = $1
       AND animal_id IN (SELECT id FROM animales WHERE usuario_id = $2)
     RETURNING id`,
        [id, usuarioId]
    );
    return result.rows[0] || null;
};

// ── Para el job de alertas ────────────────────────────────────────────────────
const findPendientesParaAlertar = async () => {
    const result = await query(
        `SELECT
        v.id, v.animal_id, v.tipo_vacuna, v.proxima_dosis,
        a.numero_arete, a.nombre AS animal_nombre,
        u.id AS usuario_id, u.nombre AS usuario_nombre, u.email,
        CASE
          WHEN v.proxima_dosis < CURRENT_DATE      THEN 'Vencida'
          WHEN v.proxima_dosis = CURRENT_DATE      THEN 'Hoy'
          WHEN v.proxima_dosis = CURRENT_DATE + 7  THEN 'En 7 días'
          ELSE 'Próxima'
        END AS urgencia
     FROM vacunas v
     JOIN animales a ON a.id = v.animal_id
     JOIN usuarios u ON u.id = a.usuario_id
     WHERE v.proxima_dosis IS NOT NULL
       AND v.alerta_enviada = FALSE
       AND v.proxima_dosis <= CURRENT_DATE + 7
       AND u.activo = TRUE`,
    );
    return result.rows;
};

const marcarAlertaEnviada = async (id) => {
    await query(
        'UPDATE vacunas SET alerta_enviada = TRUE WHERE id = $1',
        [id]
    );
};

module.exports = {
    findAll, findById, findByAnimal, create, update, remove,
    findPendientesParaAlertar, marcarAlertaEnviada,
};