/**
 * modules/gastos/gastos.repository.js
 */
'use strict';

const { query } = require('../../config/db');
const paginate = require('../../utils/paginate');

// Un movimiento es de una finca si se registró en ella, o si es de un animal que está en ella
const FILTRO_FINCA = `COALESCE(g.finca_id, (SELECT finca_id FROM animales WHERE id = g.animal_id))`;

const findAll = async (usuarioId, filtros = {}) => {
    const { page, limit, offset } = paginate(filtros);
    const values = [usuarioId];
    const where = ['g.usuario_id = $1'];
    let idx = 2;

    if (filtros.finca_id) { where.push(`${FILTRO_FINCA} = $${idx++}`); values.push(filtros.finca_id); }
    if (filtros.animal_id) { where.push(`g.animal_id = $${idx++}`); values.push(filtros.animal_id); }
    if (filtros.tipo) { where.push(`g.tipo = $${idx++}`); values.push(filtros.tipo); }
    if (filtros.categoria) { where.push(`g.categoria = $${idx++}`); values.push(filtros.categoria); }
    if (filtros.fecha_desde) { where.push(`g.fecha >= $${idx++}`); values.push(filtros.fecha_desde); }
    if (filtros.fecha_hasta) { where.push(`g.fecha <= $${idx++}`); values.push(filtros.fecha_hasta); }

    const whereClause = where.join(' AND ');

    const countResult = await query(
        `SELECT COUNT(*) AS total FROM gastos g WHERE ${whereClause}`,
        values
    );
    const total = parseInt(countResult.rows[0].total, 10);

    const rows = await query(
        `SELECT
        g.*,
        f.nombre AS finca_nombre,
        a.numero_arete, a.nombre AS animal_nombre
     FROM gastos g
     LEFT JOIN fincas   f ON f.id = g.finca_id
     LEFT JOIN animales a ON a.id = g.animal_id
     WHERE ${whereClause}
     ORDER BY g.fecha DESC, g.creado_en DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
        [...values, limit, offset]
    );

    return { rows: rows.rows, total, page, limit };
};

const findById = async (id, usuarioId) => {
    const result = await query(
        `SELECT
        g.*,
        f.nombre AS finca_nombre,
        a.numero_arete, a.nombre AS animal_nombre
     FROM gastos g
     LEFT JOIN fincas   f ON f.id = g.finca_id
     LEFT JOIN animales a ON a.id = g.animal_id
     WHERE g.id = $1 AND g.usuario_id = $2`,
        [id, usuarioId]
    );
    return result.rows[0] || null;
};

const create = async (datos) => {
    const {
        usuario_id, finca_id, animal_id, tipo, categoria,
        descripcion, monto, fecha, proveedor, factura, notas,
    } = datos;

    const result = await query(
        `INSERT INTO gastos (
        usuario_id, finca_id, animal_id, tipo, categoria,
        descripcion, monto, fecha, proveedor, factura, notas
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING *`,
        [
            usuario_id, finca_id || null, animal_id || null, tipo || 'Gasto', categoria,
            descripcion || null, monto, fecha, proveedor || null, factura || null, notas || null,
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
        `UPDATE gastos SET ${sets.join(', ')}
     WHERE id = $1 AND usuario_id = $2
     RETURNING *`,
        [id, usuarioId, ...values]
    );
    return result.rows[0] || null;
};

const remove = async (id, usuarioId) => {
    const result = await query(
        'DELETE FROM gastos WHERE id = $1 AND usuario_id = $2 RETURNING id',
        [id, usuarioId]
    );
    return result.rows[0] || null;
};

// ── Resumen financiero por mes ────────────────────────────────────────────────
const getResumenMensual = async (usuarioId, anio, fincaId) => {
    const result = await query(
        `SELECT
        TO_CHAR(DATE_TRUNC('month', fecha), 'YYYY-MM') AS mes,
        SUM(CASE WHEN tipo = 'Ingreso' THEN monto ELSE 0 END)  AS total_ingresos,
        SUM(CASE WHEN tipo = 'Gasto'   THEN monto ELSE 0 END)  AS total_gastos,
        SUM(CASE WHEN tipo = 'Ingreso' THEN monto ELSE -monto END) AS balance,
        COUNT(*) AS total_movimientos
     FROM gastos g
     WHERE usuario_id = $1
       AND EXTRACT(YEAR FROM fecha) = $2
       AND ($3::uuid IS NULL OR ${FILTRO_FINCA} = $3)
     GROUP BY DATE_TRUNC('month', fecha)
     ORDER BY mes ASC`,
        [usuarioId, anio, fincaId || null]
    );
    return result.rows;
};

// ── Resumen por categoría ────────────────────────────────────────────────────
const getResumenPorCategoria = async (usuarioId, fechaDesde, fechaHasta, fincaId) => {
    const result = await query(
        `SELECT
        categoria,
        tipo,
        SUM(monto)  AS total,
        COUNT(*)    AS cantidad
     FROM gastos g
     WHERE usuario_id = $1
       AND fecha BETWEEN $2 AND $3
       AND ($4::uuid IS NULL OR ${FILTRO_FINCA} = $4)
     GROUP BY categoria, tipo
     ORDER BY total DESC`,
        [usuarioId, fechaDesde, fechaHasta, fincaId || null]
    );
    return result.rows;
};

module.exports = {
    findAll, findById, create, update, remove,
    getResumenMensual, getResumenPorCategoria,
};