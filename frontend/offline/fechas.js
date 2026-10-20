// offline/fechas.js
// Fechas como texto 'YYYY-MM-DD' para cálculos sin conexión (sin problemas de zona horaria).

const pad = (n) => String(n).padStart(2, '0');

// Hoy en la zona horaria del teléfono
export const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// Recorta '2026-10-01T06:00:00.000Z' → '2026-10-01'
export const dia = (fecha) => (fecha ? String(fecha).slice(0, 10) : null);

export const sumarDias = (fechaISO, dias) => {
  const [y, m, d] = fechaISO.split('-').map(Number);
  const f = new Date(Date.UTC(y, m - 1, d + dias));
  return `${f.getUTCFullYear()}-${pad(f.getUTCMonth() + 1)}-${pad(f.getUTCDate())}`;
};

export const diasEntre = (desdeISO, hastaISO) =>
  Math.round((Date.parse(`${hastaISO}T00:00:00Z`) - Date.parse(`${desdeISO}T00:00:00Z`)) / 86400000);
