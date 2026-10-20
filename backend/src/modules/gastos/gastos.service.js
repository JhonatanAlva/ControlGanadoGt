/**
 * modules/gastos/gastos.service.js
 */
'use strict';

const repo = require('./gastos.repository');
const { toPublic } = require('./gastos.model');
const AppError = require('../../utils/AppError');
const { verificarFinca, verificarAnimal } = require('../../utils/propiedad');

const listar = async (usuarioId, filtros) => {
    const { rows, total, page, limit } = await repo.findAll(usuarioId, filtros);
    return { data: rows.map(toPublic), total, page, limit };
};

const obtener = async (id, usuarioId) => {
    const gasto = await repo.findById(id, usuarioId);
    if (!gasto) throw AppError.notFound('Movimiento no encontrado.');
    return toPublic(gasto);
};

const crear = async (usuarioId, datos) => {
    // La finca y el animal (si se envían) deben pertenecer al usuario
    await verificarFinca(datos.finca_id, usuarioId);
    await verificarAnimal(datos.animal_id, usuarioId);

    const gasto = await repo.create({ ...datos, usuario_id: usuarioId });
    return toPublic(gasto);
};

const actualizar = async (id, usuarioId, datos) => {
    const existe = await repo.findById(id, usuarioId);
    if (!existe) throw AppError.notFound('Movimiento no encontrado.');
    await verificarFinca(datos.finca_id, usuarioId);
    await verificarAnimal(datos.animal_id, usuarioId);

    const actualizado = await repo.update(id, usuarioId, datos);
    return toPublic(actualizado);
};

const eliminar = async (id, usuarioId) => {
    const existe = await repo.findById(id, usuarioId);
    if (!existe) throw AppError.notFound('Movimiento no encontrado.');
    await repo.remove(id, usuarioId);
};

// ── Resumen mensual del año ──────────────────────────────────────────────────
const resumenMensual = async (usuarioId, query_params) => {
    const anio = parseInt(query_params.anio, 10) || new Date().getFullYear();
    const meses = await repo.getResumenMensual(usuarioId, anio);

    // Calcular totales anuales
    const totales = meses.reduce(
        (acc, m) => {
            acc.total_ingresos += parseFloat(m.total_ingresos);
            acc.total_gastos += parseFloat(m.total_gastos);
            acc.balance += parseFloat(m.balance);
            return acc;
        },
        { total_ingresos: 0, total_gastos: 0, balance: 0 }
    );

    return { anio, meses, totales };
};

// ── Resumen por categoría ─────────────────────────────────────────────────────
const resumenCategoria = async (usuarioId, { fecha_desde, fecha_hasta }) => {
    const hoy = new Date().toISOString().split('T')[0];
    const inicio = fecha_desde || `${new Date().getFullYear()}-01-01`;
    const fin = fecha_hasta || hoy;

    const categorias = await repo.getResumenPorCategoria(usuarioId, inicio, fin);
    return { fecha_desde: inicio, fecha_hasta: fin, categorias };
};

module.exports = {
    listar, obtener, crear, actualizar, eliminar,
    resumenMensual, resumenCategoria,
};