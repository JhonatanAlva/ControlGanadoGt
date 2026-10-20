/**
 * utils/propiedad.js
 * Verifica que los recursos referenciados en un request (finca_id, animal_id,
 * madre_id, padre_id...) pertenezcan al usuario autenticado.
 * Evita que un ganadero vincule sus registros a fincas o animales de otro.
 */

"use strict";

const { query } = require("../config/db");
const AppError = require("./AppError");

/**
 * Lanza 404 si la finca no existe, está inactiva o no es del usuario.
 * No hace nada si fincaId es vacío.
 */
const verificarFinca = async (fincaId, usuarioId) => {
  if (!fincaId) return;
  const result = await query(
    "SELECT id FROM fincas WHERE id = $1 AND usuario_id = $2 AND activa = true",
    [fincaId, usuarioId],
  );
  if (result.rows.length === 0) throw AppError.notFound("Finca no encontrada.");
};

/**
 * Lanza 404 si el animal no existe o no es del usuario.
 * Si se pasa `sexo`, también valida que coincida.
 * No hace nada si animalId es vacío.
 */
const verificarAnimal = async (animalId, usuarioId, { sexo, etiqueta = "Animal" } = {}) => {
  if (!animalId) return;
  const result = await query(
    "SELECT id, sexo FROM animales WHERE id = $1 AND usuario_id = $2",
    [animalId, usuarioId],
  );
  if (result.rows.length === 0) throw AppError.notFound(`${etiqueta} no encontrado.`);
  if (sexo && result.rows[0].sexo !== sexo) {
    throw AppError.badRequest(
      `El animal seleccionado como ${etiqueta.toLowerCase()} no es ${sexo === "Hembra" ? "hembra" : "macho"}.`,
    );
  }
};

module.exports = { verificarFinca, verificarAnimal };
