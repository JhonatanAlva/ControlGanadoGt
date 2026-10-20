// utils/password.js
// Mismas reglas que el backend (auth.schema.js). Devuelve el mensaje de error o null.
export const validarPassword = (password) => {
  if (password.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
  if (password.length > 72) return 'La contraseña no puede superar 72 caracteres.';
  if (!/[A-Za-z]/.test(password)) return 'La contraseña debe incluir al menos una letra.';
  if (!/[0-9]/.test(password)) return 'La contraseña debe incluir al menos un número.';
  return null;
};
