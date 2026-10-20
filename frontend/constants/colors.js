// constants/colors.js
export const COLORS = {
  primary:     '#2d7a3a',
  primaryDark: '#1e5228',
  primaryLight:'#e8f5e9',
  secondary:   '#f5a623',
  danger:      '#e53e3e',
  warning:     '#d69e2e',
  success:     '#38a169',
  white:       '#ffffff',
  black:       '#1a202c',
  gray50:      '#f7fafc',
  gray100:     '#edf2f7',
  gray200:     '#e2e8f0',
  gray300:     '#cbd5e0',
  gray500:     '#718096',
  gray600:     '#4a5568',
  gray700:     '#2d3748',
};

// Se configura con EXPO_PUBLIC_API_URL en frontend/.env (ver .env.example).
// Por defecto: 10.0.2.2 = localhost de tu PC visto desde el emulador Android.
export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:3000/api/v1';

// Sin HTTPS, el token y los datos de los ganaderos viajan legibles por la red
if (!__DEV__ && !API_URL.startsWith('https://')) {
  throw new Error('En producción EXPO_PUBLIC_API_URL debe usar https://');
}