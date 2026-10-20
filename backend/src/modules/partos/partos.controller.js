'use strict';

const service                            = require('./partos.service');
const { ok, created, paginated, noContent } = require('../../utils/response');

const listar = async (req, res, next) => {
  try {
    const filtros = req.validatedQuery || req.query;
    const { data, total, page, limit } = await service.listar(req.user.id, filtros);
    paginated(res, { data, total, page, limit, message: 'Partos obtenidos.' });
  } catch (err) { next(err); }
};

const obtener = async (req, res, next) => {
  try {
    const parto = await service.obtener(req.params.id, req.user.id);
    ok(res, { parto });
  } catch (err) { next(err); }
};

const historialMadre = async (req, res, next) => {
  try {
    const partos = await service.historialMadre(req.params.madreId, req.user.id);
    ok(res, { partos });
  } catch (err) { next(err); }
};

const registrarServicio = async (req, res, next) => {
  try {
    const parto = await service.registrarServicio(req.user.id, req.body);
    created(res, { parto }, 'Servicio registrado. Fecha de parto esperada calculada.');
  } catch (err) { next(err); }
};

const registrarResultado = async (req, res, next) => {
  try {
    const resultado = await service.registrarResultado(req.params.id, req.user.id, req.body, req.user.plan);
    created(res, resultado,
      resultado.cria_creada
        ? 'Parto registrado. La cría fue creada automáticamente como nuevo animal.'
        : 'Parto registrado.'
    );
  } catch (err) { next(err); }
};

const actualizar = async (req, res, next) => {
  try {
    const parto = await service.actualizar(req.params.id, req.user.id, req.body);
    ok(res, { parto }, 'Parto actualizado.');
  } catch (err) { next(err); }
};

const eliminar = async (req, res, next) => {
  try {
    await service.eliminar(req.params.id, req.user.id);
    noContent(res);
  } catch (err) { next(err); }
};

module.exports = {
  listar, obtener, historialMadre,
  registrarServicio, registrarResultado,
  actualizar, eliminar,
};