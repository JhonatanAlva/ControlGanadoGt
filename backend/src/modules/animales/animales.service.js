/**
 * modules/animales/animales.service.js
 * Lógica de negocio del módulo de animales.
 */
"use strict";

const repo = require("./animales.repository");
const { toPublic } = require("./animales.model");
const AppError = require("../../utils/AppError");
const { calcularEdad, gananciaDiariaWeight } = require("../../utils/calculos");
const { LIMITES_FREE } = require("../../config/constants");
const cloudinary = require("../../config/cloudinary");
const { verificarFinca, verificarAnimal } = require("../../utils/propiedad");

// Solo caracteres seguros para el public_id de Cloudinary (evita "/" o "..")
const idArchivo = (texto) => String(texto).replace(/[^A-Za-z0-9_-]/g, "_");

// Las referencias a fincas y padres deben ser del mismo usuario
const verificarReferencias = async (usuarioId, datos) => {
  await verificarFinca(datos.finca_id, usuarioId);
  await verificarAnimal(datos.madre_id, usuarioId, { sexo: "Hembra", etiqueta: "Madre" });
  await verificarAnimal(datos.padre_id, usuarioId, { sexo: "Macho", etiqueta: "Padre" });
};

// ── Listar animales ──────────────────────────────────────────────────────────
const listar = async (usuarioId, filtros) => {
  const { rows, total, page, limit } = await repo.findAll(usuarioId, filtros);
  return {
    data: rows.map(toPublic),
    total,
    page,
    limit,
  };
};

// ── Obtener uno ──────────────────────────────────────────────────────────────
const obtener = async (id, usuarioId) => {
  const animal = await repo.findById(id, usuarioId);
  if (!animal) throw AppError.notFound("Animal no encontrado.");

  // Enriquecer con edad calculada
  const resultado = toPublic(animal);
  if (animal.fecha_nacimiento) {
    resultado.edad = calcularEdad(animal.fecha_nacimiento);
  }
  return resultado;
};

// ── Crear animal ─────────────────────────────────────────────────────────────
const crear = async (usuarioId, datos, plan, archivo) => {
  // Verificar límite plan free
  if (plan !== "pro") {
    const total = await repo.countActivos(usuarioId);
    if (total >= LIMITES_FREE.animales) {
      throw AppError.forbidden(
        `El plan gratuito permite máximo ${LIMITES_FREE.animales} animales activos.`,
      );
    }
  }

  // Verificar arete único por usuario
  const existe = await repo.findByArete(datos.numero_arete, usuarioId);
  if (existe)
    throw AppError.conflict(
      `El arete ${datos.numero_arete} ya está registrado.`,
    );

  await verificarReferencias(usuarioId, datos);

  // Subir foto a Cloudinary si viene archivo
  let foto_url = null;
  if (archivo) {
    foto_url = await cloudinary.upload(archivo.buffer, {
      folder: `ganaderia-gt/${usuarioId}/animales`,
      public_id: idArchivo(datos.numero_arete),
    });
  }

  const animal = await repo.create({
    ...datos,
    usuario_id: usuarioId,
    foto_url,
  });
  return toPublic(animal);
};

// ── Actualizar animal ────────────────────────────────────────────────────────
const actualizar = async (id, usuarioId, datos, archivo) => {
  const existe = await repo.findById(id, usuarioId);
  if (!existe) throw AppError.notFound("Animal no encontrado.");
  if (datos.madre_id === id || datos.padre_id === id) {
    throw AppError.badRequest("Un animal no puede ser su propio padre o madre.");
  }

  await verificarReferencias(usuarioId, datos);

  let foto_url = undefined;
  if (archivo) {
    foto_url = await cloudinary.upload(archivo.buffer, {
      folder: `ganaderia-gt/${usuarioId}/animales`,
      public_id: `${idArchivo(existe.numero_arete)}_${Date.now()}`,
    });
  }

  const actualizado = await repo.update(id, usuarioId, {
    ...datos,
    ...(foto_url && { foto_url }),
  });
  return toPublic(actualizado);
};

// ── Cambiar estado ────────────────────────────────────────────────────────────
const cambiarEstado = async (id, usuarioId, datos) => {
  const existe = await repo.findById(id, usuarioId);
  if (!existe) throw AppError.notFound("Animal no encontrado.");
  if (existe.estado === datos.estado) {
    throw AppError.conflict(`El animal ya tiene estado "${datos.estado}".`);
  }

  const actualizado = await repo.cambiarEstado(id, usuarioId, datos);
  return toPublic(actualizado);
};

// ── Eliminar ──────────────────────────────────────────────────────────────────
const eliminar = async (id, usuarioId) => {
  const existe = await repo.findById(id, usuarioId);
  if (!existe) throw AppError.notFound("Animal no encontrado.");

  await repo.remove(id, usuarioId);
};

// ── Registrar peso ────────────────────────────────────────────────────────────
const registrarPeso = async (id, usuarioId, datos) => {
  const animal = await repo.findById(id, usuarioId);
  if (!animal) throw AppError.notFound("Animal no encontrado.");

  const peso = await repo.addPeso(id, datos);
  return peso;
};

// ── Historial de pesos con GDP ────────────────────────────────────────────────
const historialPesos = async (id, usuarioId) => {
  const animal = await repo.findById(id, usuarioId);
  if (!animal) throw AppError.notFound("Animal no encontrado.");

  const pesos = await repo.getPesos(id);

  // Calcular GDP entre registros consecutivos
  const conGDP = pesos.map((p, i) => {
    if (i === pesos.length - 1) return { ...p, gdp: null };
    const siguiente = pesos[i + 1];
    const dias = Math.abs(
      Math.round((new Date(p.fecha) - new Date(siguiente.fecha)) / 86400000),
    );
    return {
      ...p,
      gdp: gananciaDiariaWeight(siguiente.peso, p.peso, dias),
    };
  });

  return conGDP;
};

module.exports = {
  listar,
  obtener,
  crear,
  actualizar,
  cambiarEstado,
  eliminar,
  registrarPeso,
  historialPesos,
};
