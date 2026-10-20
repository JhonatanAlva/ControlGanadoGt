// services/multipart.js
// Arma el cuerpo de un POST/PUT: JSON normal, o multipart/form-data si viene una foto
// (el backend la recibe con multer en el campo "foto").
const aFormData = (datos, foto) => {
  const form = new FormData();
  Object.entries(datos).forEach(([key, value]) => {
    if (value !== undefined && value !== null) form.append(key, String(value));
  });
  form.append('foto', {
    uri: foto.uri,
    name: foto.fileName || `foto_${Date.now()}.jpg`,
    type: foto.mimeType || 'image/jpeg',
  });
  return form;
};

/**
 * @returns {[body, config]} argumentos para api.post/api.put después de la URL
 */
export const cuerpoConFoto = (datos, foto) => (foto
  ? [aFormData(datos, foto), { headers: { 'Content-Type': 'multipart/form-data' } }]
  : [datos]);
