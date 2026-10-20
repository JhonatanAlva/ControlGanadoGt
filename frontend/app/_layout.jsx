// app/_layout.jsx
import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { ActivityIndicator, View } from 'react-native';
import useAuthStore from '../stores/authStore';
import useOnboardingStore from '../stores/onboardingStore';
import { queryClient } from '../services/queryClient';
import { initDb } from '../db/database';
import { iniciarSyncAutomatico, procesarCola, suscribirseASync } from '../offline/syncManager';
import '../offline'; // registra la sincronización de vacunas, partos, gastos y fincas
import { COLORS } from '../constants/colors';

function AuthGuard() {
  const { usuario, cargando, inicializar } = useAuthStore();
  const { visto: onboardingVisto, cargando: onboardingCargando, inicializar: inicializarOnboarding } = useOnboardingStore();
  const router   = useRouter();
  const segments = useSegments();

  useEffect(() => {
    inicializar();
    inicializarOnboarding();
    initDb().then(() => {
      iniciarSyncAutomatico();
      procesarCola(); // por si quedaron cambios pendientes de una sesión anterior
    });
    // Al terminar de sincronizar, recargar pantallas para ver ids y datos reales del servidor
    return suscribirseASync((evento) => {
      if (evento.tipo === 'terminado' && evento.procesadas > 0) queryClient.invalidateQueries();
    });
  }, []);

  useEffect(() => {
    if (cargando || onboardingCargando) return;
    const enAuth = segments[0] === '(auth)';
    if (!usuario && !enAuth) {
      router.replace('/(auth)/login');
    } else if (usuario && enAuth) {
      router.replace(onboardingVisto ? '/(app)' : '/(app)/onboarding');
    }
  }, [usuario, cargando, onboardingVisto, onboardingCargando, segments]);

  if (cargando || onboardingCargando) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(app)" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthGuard />
    </QueryClientProvider>
  );
}
