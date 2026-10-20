/**
 * modules/partos/partos.repository.js
 */
'use strict';

const { query, getClient } = require('../../config/db');
const paginate = require('../../utils/paginate');

// ── Listar con filtros ────────────────────────────────────────────────────────
const findAll = async (usuarioId, filtros = {}) => {
    const { page, limit, offset } = paginate(filtros);
    const values = [usuarioId];
    const where = ['a.usuario_id = $1'];
    let idx = 2;

    if (filtros.madre_id) { where.push(`p.madre_id = $${idx++}`); values.push(filtros.madre_id); }
    // La finca del registro, o si no tiene, la finca donde está la madre
    if (filtros.finca_id) { where.push(`COALESCE(p.finca_id, a.finca_id) = $${idx++}`); values.push(filtros.finca_id); }
    if (filtros.resultado) { where.push(`p.resultado = $${idx++}`); values.push(filtros.resultado); }

    // Solo partos esperados en los próximos 30 días (sin fecha_parto registrada aún)
    if (filtros.proximos === 'true') {
        where.push(
            `p.fecha_parto IS NULL
       AND p.fecha_parto_esperada IS NOT NULL
       AND p.fecha_parto_esperada <= CURRENT_DATE + 30`
        );
    }

    const whereClause = where.join(' AND ');

    const countResult = await query(
        `SELECT COUNT(*) AS total
     FROM partos p
     JOIN animales a ON a.id = p.madre_id
     WHERE ${whereClause}`,
        values
    );
    const total = parseInt(countResult.rows[0].total, 10);

    const rows = await query(
        `SELECT
        p.*,
        a.numero_arete  AS madre_arete,
        a.nombre        AS madre_nombre,
        pa.numero_arete AS padre_arete_ref,
        c.numero_arete  AS cria_arete_ref,
        f.nombre        AS finca_nombre,
        CASE
          WHEN p.fecha_parto IS NOT NULL THEN 'Completado'
          WHEN p.fecha_parto_esperada < CURRENT_DATE THEN 'Atrasado'
          WHEN p.fecha_parto_esperada <= CURRENT_DATE + 7 THEN 'Esta semana'
          WHEN p.fecha_parto_esperada <= CURRENT_DATE + 30 THEN 'Próximo'
          ELSE 'Programado'
        END AS estado_parto,
        (p.fecha_parto_esperada - CURRENT_DATE) AS dias_restantes
     FROM partos p
     JOIN animales  a  ON a.id  = p.madre_id
     LEFT JOIN animales  pa ON pa.id = p.padre_id
     LEFT JOIN animales  c  ON c.id  = p.cria_id
     LEFT JOIN fincas    f  ON f.id  = p.finca_id
     WHERE ${whereClause}
     ORDER BY p.fecha_parto_esperada ASC NULLS LAST, p.creado_en DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
        [...values, limit, offset]
    );

    return { rows: rows.rows, total, page, limit };
};

const findById = async (id, usuarioId) => {
    const result = await query(
        `SELECT
        p.*,
        a.numero_arete  AS madre_arete,
        a.nombre        AS madre_nombre,
        pa.numero_arete AS padre_arete_ref,
        c.numero_arete  AS cria_arete_ref,
        f.nombre        AS finca_nombre,
        (p.fecha_parto_esperada - CURRENT_DATE) AS dias_restantes
     FROM partos p
     JOIN animales  a  ON a.id  = p.madre_id
     LEFT JOIN animales  pa ON pa.id = p.padre_id
     LEFT JOIN animales  c  ON c.id  = p.cria_id
     LEFT JOIN fincas    f  ON f.id  = p.finca_id
     WHERE p.id = $1 AND a.usuario_id = $2`,
        [id, usuarioId]
    );
    return result.rows[0] || null;
};

const findByMadre = async (madreId, usuarioId) => {
    const result = await query(
        `SELECT p.*,
        (p.fecha_parto_esperada - CURRENT_DATE) AS dias_restantes
     FROM partos p
     JOIN animales a ON a.id = p.madre_id
     WHERE p.madre_id = $1 AND a.usuario_id = $2
     ORDER BY p.fecha_servicio DESC`,
        [madreId, usuarioId]
    );
    return result.rows;
};

// ── Crear servicio (sin fecha_parto aún) ─────────────────────────────────────
const createServicio = async (datos) => {
    const {
        madre_id, padre_id, padre_arete, finca_id,
        tipo_reproduccion, fecha_servicio, notas,
    } = datos;

    const result = await query(
        `INSERT INTO partos (
        madre_id, padre_id, padre_arete, finca_id,
        tipo_reproduccion, fecha_servicio, notas
     ) VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING *`,
        [
            madre_id, padre_id || null, padre_arete || null, finca_id || null,
            tipo_reproduccion, fecha_servicio, notas || null,
        ]
    );
    return result.rows[0];
};

// ── Registrar resultado del parto + crear cría si nace viva ─────────────────
const registrarResultado = async (id, usuarioId, datos) => {
    const {
        fecha_parto, tipo_parto, resultado,
        cria_arete, cria_sexo, peso_nacimiento,
        asistencia_veterinaria, costo_veterinario, notas,
    } = datos;

    const client = await getClient();
    try {
        await client.query('BEGIN');

        // Obtener datos de la madre para heredar raza y finca
        const madreResult = await client.query(
            `SELECT a.*, p.finca_id AS parto_finca_id
       FROM partos p JOIN animales a ON a.id = p.madre_id
       WHERE p.id = $1`,
            [id]
        );
        const madre = madreResult.rows[0];

        // Crear animal cría si nació viva
        let cria_id = null;
        if (cria_arete && resultado !== 'Aborto' && resultado !== 'Muerto') {
            const criaResult = await client.query(
                `INSERT INTO animales (
            usuario_id, finca_id, numero_arete, raza, sexo, tipo,
            fecha_nacimiento, peso_actual, madre_id
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING id`,
                [
                    madre.usuario_id,
                    madre.finca_id || madre.parto_finca_id || null,
                    cria_arete,
                    madre.raza,
                    cria_sexo || null,
                    cria_sexo === 'Macho' ? 'Ternero' : 'Ternera',
                    fecha_parto,
                    peso_nacimiento || null,
                    madre.id,
                ]
            );
            cria_id = criaResult.rows[0].id;
        }

        // Actualizar el registro del parto
        const partoResult = await client.query(
            `UPDATE partos SET
          fecha_parto = $3, tipo_parto = $4, resultado = $5,
          cria_id = $6, cria_arete = $7, cria_sexo = $8,
          peso_nacimiento = $9, asistencia_veterinaria = $10,
          costo_veterinario = $11, notas = COALESCE($12, notas)
       WHERE id = $1
         AND madre_id IN (SELECT id FROM animales WHERE usuario_id = $2)
       RETURNING *`,
            [
                id, usuarioId,
                fecha_parto, tipo_parto, resultado,
                cria_id, cria_arete || null, cria_sexo || null,
                peso_nacimiento || null, asistencia_veterinaria || false,
                costo_veterinario || null, notas || null,
            ]
        );

        await client.query('COMMIT');
        return { parto: partoResult.rows[0], cria_id };
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

const update = async (id, usuarioId, campos) => {
    const keys = Object.keys(campos).filter((k) => campos[k] !== undefined);
    if (keys.length === 0) return findById(id, usuarioId);

    const sets = keys.map((k, i) => `${k} = $${i + 3}`);
    const values = keys.map((k) => campos[k]);

    const result = await query(
        `UPDATE partos SET ${sets.join(', ')}
     WHERE id = $1
       AND madre_id IN (SELECT id FROM animales WHERE usuario_id = $2)
     RETURNING *`,
        [id, usuarioId, ...values]
    );
    return result.rows[0] || null;
};

const remove = async (id, usuarioId) => {
    const result = await query(
        `DELETE FROM partos
     WHERE id = $1
       AND madre_id IN (SELECT id FROM animales WHERE usuario_id = $2)
     RETURNING id`,
        [id, usuarioId]
    );
    return result.rows[0] || null;
};

// ── Para el job de alertas de partos ─────────────────────────────────────────
const findProximosParaAlertar = async () => {
    const result = await query(
        `SELECT
        p.id, p.fecha_parto_esperada,
        a.numero_arete AS madre_arete, a.nombre AS madre_nombre,
        u.id AS usuario_id, u.nombre AS usuario_nombre, u.email,
        (p.fecha_parto_esperada - CURRENT_DATE) AS dias_restantes
     FROM partos p
     JOIN animales a ON a.id = p.madre_id
     JOIN usuarios u ON u.id = a.usuario_id
     WHERE p.fecha_parto IS NULL
       AND p.fecha_parto_esperada IS NOT NULL
       AND p.fecha_parto_esperada BETWEEN CURRENT_DATE AND CURRENT_DATE + 7
       AND u.activo = TRUE`
    );
    return result.rows;
};

module.exports = {
    findAll, findById, findByMadre,
    createServicio, registrarResultado,
    update, remove, findProximosParaAlertar,
};