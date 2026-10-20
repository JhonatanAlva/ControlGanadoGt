/**
 * modules/gastos/gastos.routes.js
 *
 * GET    /api/v1/gastos                  → listar (filtros: tipo, categoria, fecha_desde, fecha_hasta)
 * POST   /api/v1/gastos                  → crear gasto o ingreso
 * GET    /api/v1/gastos/resumen/mensual  → resumen por mes del año (?anio=2025)
 * GET    /api/v1/gastos/resumen/categoria → resumen por categoría (?fecha_desde&fecha_hasta)
 * GET    /api/v1/gastos/:id              → obtener uno
 * PUT    /api/v1/gastos/:id              → actualizar
 * DELETE /api/v1/gastos/:id              → eliminar
 */
'use strict';

const { Router } = require('express');
const controller = require('./gastos.controller');
const auth = require('../../middlewares/auth.middleware');
const validate = require('../../middlewares/validate.middleware');
const {
    crearGastoSchema,
    actualizarGastoSchema,
    filtrosGastoSchema,
    filtrosResumenSchema,
} = require('./gastos.schema');

const router = Router();

router.use(auth);

// Resúmenes primero para que no los atrape /:id
router.get('/resumen/mensual', validate(filtrosResumenSchema, 'query'), controller.resumenMensual);
router.get('/resumen/categoria', validate(filtrosResumenSchema, 'query'), controller.resumenCategoria);

router.get('/', validate(filtrosGastoSchema, 'query'), controller.listar);
router.post('/', validate(crearGastoSchema), controller.crear);
router.get('/:id', controller.obtener);
router.put('/:id', validate(actualizarGastoSchema), controller.actualizar);
router.delete('/:id', controller.eliminar);

module.exports = router;