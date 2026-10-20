// stores/authStore.js
import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { authService } from '../services/authService';
import { registrarAlExpirarSesion } from '../services/api';
import { queryClient } from '../services/queryClient';

// Copia del usuario en almacenamiento cifrado, para poder abrir la app sin señal
const USUARIO_KEY = 'auth_usuario';

const guardarUsuario = (usuario) =>
  SecureStore.setItemAsync(USUARIO_KEY, JSON.stringify(usuario)).catch(() => {});

const leerUsuarioGuardado = async () => {
  try {
    const raw = await SecureStore.getItemAsync(USUARIO_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const useAuthStore = create((set, get) => ({
  usuario:  null,
  token:    null,
  cargando: true,
  error:    null,

  inicializar: async () => {
    const token = await SecureStore.getItemAsync('auth_token');
    if (!token) {
      set({ cargando: false });
      return;
    }
    try {
      const res = await authService.me();
      const usuario = res.data.data.usuario;
      await guardarUsuario(usuario);
      set({ usuario, token, cargando: false });
    } catch (err) {
      // 401 → el interceptor de api.js ya cerró la sesión.
      // Sin respuesta (sin señal en el campo) → se mantiene la sesión con el usuario guardado.
      if (err?.response) {
        set({ cargando: false });
        return;
      }
      const usuario = await leerUsuarioGuardado();
      set({ usuario, token: usuario ? token : null, cargando: false });
    }
  },

  login: async (email, password) => {
    set({ error: null });
    try {
      const res = await authService.login({ email, password });
      const { usuario, token } = res.data.data;
      await SecureStore.setItemAsync('auth_token', token);
      await guardarUsuario(usuario);
      set({ usuario, token, error: null });
      return true;
    } catch (err) {
      set({ error: err.mensaje || 'Error al iniciar sesión' });
      return false;
    }
  },

  registro: async (datos) => {
    set({ error: null });
    try {
      const res = await authService.registro(datos);
      const { usuario, token } = res.data.data;
      await SecureStore.setItemAsync('auth_token', token);
      await guardarUsuario(usuario);
      set({ usuario, token, error: null });
      return true;
    } catch (err) {
      set({ error: err.mensaje || 'Error al registrarse' });
      return false;
    }
  },

  // Reemplaza el token actual (p. ej. tras cambiar la contraseña)
  guardarToken: async (token) => {
    await SecureStore.setItemAsync('auth_token', token);
    set({ token });
  },

  logout: async () => {
    await SecureStore.deleteItemAsync('auth_token');
    await SecureStore.deleteItemAsync(USUARIO_KEY);
    await SecureStore.deleteItemAsync('finca_activa_id');
    queryClient.clear(); // evita que el caché de un usuario se filtre al siguiente
    set({ usuario: null, token: null });
  },

  actualizarUsuario: (datos) => {
    const usuario = { ...get().usuario, ...datos };
    guardarUsuario(usuario);
    set({ usuario });
  },

  limpiarError: () => set({ error: null }),
}));

// Cualquier 401 con token (expirado o revocado) cierra la sesión
registrarAlExpirarSesion(() => useAuthStore.getState().logout());

export default useAuthStore;
