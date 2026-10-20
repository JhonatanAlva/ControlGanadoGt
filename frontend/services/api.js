// services/api.js
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_URL } from '../constants/colors';

// authStore registra aquí su logout; así api.js no importa el store (evita import circular)
let alExpirarSesion = null;
export const registrarAlExpirarSesion = (fn) => { alExpirarSesion = fn; };

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// Agrega el token JWT a cada request automáticamente
api.interceptors.request.use(
  async (config) => {
    const token = await SecureStore.getItemAsync('auth_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// Maneja errores globales
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Token inválido, expirado o revocado (p. ej. cambio de contraseña en otro dispositivo):
    // se cierra la sesión completa para que la app regrese al login.
    // Un 401 sin token (login con contraseña incorrecta) no es una sesión vencida.
    const teniaToken = Boolean(error.config?.headers?.Authorization);
    if (error.response?.status === 401 && teniaToken) {
      await alExpirarSesion?.();
    }
    const mensaje = error.response?.data?.message
      || (error.response ? 'Ocurrió un error en el servidor. Intenta de nuevo.'
        : 'Sin conexión a internet. Esta acción necesita señal para completarse.');
    return Promise.reject({ ...error, mensaje });
  }
);

export default api;
