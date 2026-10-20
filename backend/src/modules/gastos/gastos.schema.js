'use strict';

const { z } = require('zod');
const { CATEGORIAS_GASTO, TIPOS_MOVIMIENTO } = require('../../config/constants');

const crearGastoSchema = z.object({
    finca_id: z.string().uuid().optional(),
    animal_id: z.string().uuid().optional(),
    tipo: z.enum(TIPOS_MOVIMIENTO).default('Gasto'),
    categoria: z.enum(CATEGORIAS_GASTO),
    descripcion: z.string().max(500).optional(),
    monto: z.coerce.number().positive('El monto debe ser mayor a 0'),
    fecha: z.string().date('Formato inválido (YYYY-MM-DD)'),
    proveedor: z.string().max(200).optional(),
    factura: z.string().max(100).optional(),
    notas: z.string().optional(),
});

const actualizarGastoSchema = crearGastoSchema.partial();

const filtrosGastoSchema = z.object({
    finca_id: z.string().uuid().optional(),
    animal_id: z.string().uuid().optional(),
    tipo: z.enum(TIPOS_MOVIMIENTO).optional(),
    categoria: z.enum(CATEGORIAS_GASTO).optional(),
    fecha_desde: z.string().date().optional(),
    fecha_hasta: z.string().date().optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
}).optional();

const filtrosResumenSchema = z.object({
    anio: z.coerce.number().int().min(2000).max(2100).optional(),
    finca_id: z.string().uuid().optional(),
    fecha_desde: z.string().date().optional(),
    fecha_hasta: z.string().date().optional(),
}).optional();

module.exports = { crearGastoSchema, actualizarGastoSchema, filtrosGastoSchema, filtrosResumenSchema };