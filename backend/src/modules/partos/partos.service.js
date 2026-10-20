/**
 * modules/partos/partos.service.js
 */
'use strict';

const repo = require('./partos.repository');
const { toPublic } = require('./partos.model');
const AppError = require('../../utils/AppError');
const { query } = require('../../config/db');
const { verificarFinca, verificarAnimal } = require('../../utils/propiedad');
const { LIMITES_FREE } = require('../../config/constants');

const listar = async (usuarioId, filtros) => {
    const { rows, total, page, limit } = await repo.findAll(usuarioId, filtros);
    return { data: rows.map(toPublic), total, page, limit };
};

const obtener = async (id, usuarioId) => {
    const parto = await repo.findById(id, usuarioId);
    if (!parto) throw AppError.notFound('Parto no encontrado.');
    return toPublic(parto);
};

const historialMadre = async (madreId, usuarioId) => {
    const animal = await query(
        'SELECT id FROM animales WHERE id = $1 AND usuario_id = $2',
        [madreId, usuarioId]
    );
    if (animal.rows.length === 0) throw AppError.notFound('Animal no encontrado.');

    const rows = await repo.findByMadre(madreId, usuarioId);
    return rows.map(toPublic);
};

// ── Registrar servicio/inseminación ──────────────────────────────────────────
const registrarServicio = async (usuarioId, datos) => {
    // Verificar que la madre pertenece al usuario y es hembra
    await verificarAnimal(datos.madre_id, usuarioId, { sexo: 'Hembra', etiqueta: 'Madre' });

    // Verificar que no tenga ya un parto en curso (sin fecha_parto)
    const enCurso = await query(
        `SELECT id FROM partos
     WHERE madre_id = $1 AND fecha_parto IS NULL`,
        [datos.madre_id]
    );
    if (enCurso.rows.length > 0) {
        throw AppError.conflict('Esta vaca ya tiene un servicio/gestación en curso sin resolver.');
    }

    // Padre y finca (si se envían) deben pertenecer al usuario
    await verificarAnimal(datos.padre_id, usuarioId, { sexo: 'Macho', etiqueta: 'Padre' });
    await verificarFinca(datos.finca_id, usuarioId);

    const parto = await repo.createServicio({ ...datos });
    return toPublic(parto);
};

// ── Registrar resultado del parto ────────────────────────────────────────────
const registrarResultado = async (id, usuarioId, datos, plan) => {
    const parto = await repo.findById(id, usuarioId);
    if (!parto) throw AppError.notFound('Registro de parto no encontrado.');

    if (parto.fecha_parto) {
        throw AppError.conflict('Este parto ya tiene resultado registrado.');
    }

    // Verificar que el arete de la cría no exista ya
    if (datos.cria_arete) {
        const areteExiste = await query(
            'SELECT id FROM animales WHERE numero_arete = $1 AND usuario_id = $2',
            [datos.cria_arete, usuarioId]
        );
        if (areteExiste.rows.length > 0) {
            throw AppError.conflict(`El arete ${datos.cria_arete} ya está registrado en otro animal.`);
        }

        // La cría cuenta como un animal activo más: respetar el límite del plan free
        if (plan !== 'pro') {
            const activos = await query(
                "SELECT COUNT(*) AS total FROM animales WHERE usuario_id = $1 AND estado = 'Activo'",
                [usuarioId]
            );
            if (parseInt(activos.rows[0].total, 10) >= LIMITES_FREE.animales) {
                throw AppError.forbidden(
                    `El plan gratuito permite máximo ${LIMITES_FREE.animales} animales activos. Registra el parto sin arete de cría o actualiza a Pro.`
                );
            }
        }
    }

    const { parto: partoActualizado, cria_id } = await repo.registrarResultado(id, usuarioId, datos);
    return {
        parto: toPublic(partoActualizado),
        cria_creada: cria_id ? true : false,
        cria_id,
    };
};

const actualizar = async (id, usuarioId, datos) => {
    const existe = await repo.findById(id, usuarioId);
    if (!existe) throw AppError.notFound('Parto no encontrado.');
    await verificarAnimal(datos.padre_id, usuarioId, { sexo: 'Macho', etiqueta: 'Padre' });
    await verificarFinca(datos.finca_id, usuarioId);

    const actualizado = await repo.update(id, usuarioId, datos);
    return toPublic(actualizado);
};

const eliminar = async (id, usuarioId) => {
    const existe = await repo.findById(id, usuarioId);
    if (!existe) throw AppError.notFound('Parto no encontrado.');
    await repo.remove(id, usuarioId);
};

module.exports = {
    listar, obtener, historialMadre,
    registrarServicio, registrarResultado,
    actualizar, eliminar,
};