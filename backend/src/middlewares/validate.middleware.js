/**
 * middlewares/validate.middleware.js
 * Compatible con Express 5 y multipart/form-data (multer).
 */

'use strict';

const AppError = require('../utils/AppError');

const validate = (schema, source = 'body') => (req, res, next) => {
  if (!schema) return next();

  // req.body puede ser undefined si multer aún no procesó — usar objeto vacío
  const data = req[source] ?? {};

  const result = schema.safeParse(data);

  if (!result.success) {
    // Zod 4 expone los errores en .issues (.errors ya no existe)
    const errors = result.error.issues.map((e) => ({
      field:   e.path.join('.'),
      message: e.message,
    }));
    return next(AppError.unprocessable('Error de validación.', errors));
  }

  // Express 5: req.query es read-only
  if (source === 'query') {
    req.validatedQuery = result.data;
  } else {
    req[source] = result.data;
  }

  next();
};

module.exports = validate;