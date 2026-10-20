// app/(app)/index.jsx
import { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, RefreshControl,
  ActivityIndicator, TouchableOpacity, StyleSheet,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import useAuthStore from '../../stores/authStore';
import useFincaStore from '../../stores/fincaStore';
import FincaActivaBar from '../../components/FincaActivaBar';
import { COLORS } from '../../constants/colors';
import * as animalesRepo from '../../offline/animalesRepo';
import { vacunasRepo } from '../../offline/vacunasRepo';
import { partosRepo } from '../../offline/partosRepo';
import { gastosRepo } from '../../offline/gastosRepo';
import SyncBanner from '../../components/SyncBanner';
import { formatQ, formatFecha } from '../../utils/format';

const MODULOS = [
  { label: 'Fincas', icon: '🏡', href: '/(app)/fincas' },
  { label: 'Animales', icon: '🐄', href: '/(app)/animales' },
  { label: 'Vacunas', icon: '💉', href: '/(app)/vacunas' },
  { label: 'Partos', icon: '🐣', href: '/(app)/partos' },
  { label: 'Gastos', icon: '💰', href: '/(app)/gastos' },
  { label: 'Comunidad', icon: '💬', href: '/(app)/comunidad' },
  { label: 'Perfil', icon: '👤', href: '/(app)/perfil' },
];

const URGENCIA_COLOR = {
  Vencida: COLORS.danger,
  'Esta semana': COLORS.warning,
  Próxima: COLORS.secondary,
};

const ESTADO_PARTO_COLOR = {
  Atrasado: COLORS.danger,
  'Esta semana': COLORS.warning,
  Próximo: COLORS.secondary,
  Programado: COLORS.gray500,
};

export default function DashboardScreen() {
  const { usuario, logout } = useAuthStore();
  const router = useRouter();
  const queryClient = useQueryClient();
  const anio = new Date().getFullYear();
  const fincaActivaId = useFincaStore((s) => s.fincaActivaId);
  const filtroFinca = fincaActivaId ? { finca_id: fincaActivaId } : {};

  const animalesActivos = useQuery({
    queryKey: ['dashboard', 'animales-activos', fincaActivaId],
    queryFn: () => animalesRepo.listarConTotal({ estado: 'Activo', limit: 1, ...filtroFinca }),
    select: (r) => r.total,
  });

  const vacunasPendientes = useQuery({
    queryKey: ['dashboard', 'vacunas-pendientes', fincaActivaId],
    queryFn: () => vacunasRepo.listarConTotal({ pendientes: 'true', limit: 5, ...filtroFinca }),
  });

  const partosProximos = useQuery({
    queryKey: ['dashboard', 'partos-proximos', fincaActivaId],
    queryFn: () => partosRepo.listarConTotal({ proximos: 'true', limit: 5, ...filtroFinca }),
  });

  const balanceMensual = useQuery({
    queryKey: ['dashboard', 'balance-mensual', anio, fincaActivaId],
    queryFn: () => gastosRepo.resumenMensual(anio, fincaActivaId),
    select: (data) => data.totales,
  });

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    setRefreshing(false);
  }, [queryClient]);

  const hayError = animalesActivos.isError || vacunasPendientes.isError
    || partosProximos.isError || balanceMensual.isError;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
    >
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>Hola, {usuario?.nombre?.split(' ')[0]} 🐄</Text>
          <Text style={styles.sub}>Resumen de tu operación</Text>
        </View>
        <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Salir</Text>
        </TouchableOpacity>
      </View>

      <FincaActivaBar />
      <SyncBanner />

      {hayError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>
            No se pudo cargar parte del resumen. Desliza hacia abajo para reintentar.
          </Text>
        </View>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.modulosRow}>
        {MODULOS.map((m) => (
          <TouchableOpacity key={m.href} style={styles.moduloBtn} onPress={() => router.push(m.href)}>
            <Text style={styles.moduloIcon}>{m.icon}</Text>
            <Text style={styles.moduloLabel}>{m.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.grid}>
        <StatCard
          label="Animales activos"
          value={animalesActivos.data}
          loading={animalesActivos.isLoading}
          color={COLORS.primary}
        />
        <StatCard
          label="Vacunas pendientes"
          value={vacunasPendientes.data?.total}
          loading={vacunasPendientes.isLoading}
          color={COLORS.warning}
        />
        <StatCard
          label="Próximos partos"
          value={partosProximos.data?.total}
          loading={partosProximos.isLoading}
          color={COLORS.secondary}
        />
        <StatCard
          label={`Balance ${anio}`}
          value={balanceMensual.data ? formatQ(balanceMensual.data.balance) : undefined}
          loading={balanceMensual.isLoading}
          color={(balanceMensual.data?.balance ?? 0) >= 0 ? COLORS.success : COLORS.danger}
          small
        />
      </View>

      <Section title="Vacunas próximas o vencidas">
        {vacunasPendientes.isLoading && <ActivityIndicator color={COLORS.primary} />}
        {!vacunasPendientes.isLoading && (vacunasPendientes.data?.items?.length ?? 0) === 0 && (
          <EmptyText>No hay vacunas pendientes en los próximos 30 días.</EmptyText>
        )}
        {vacunasPendientes.data?.items?.map((v) => (
          <ListRow
            key={v.id}
            title={`${v.tipo_vacuna} — ${v.animal_nombre || v.numero_arete}`}
            subtitle={`Próxima dosis: ${formatFecha(v.proxima_dosis)}`}
            badge={v.urgencia}
            badgeColor={URGENCIA_COLOR[v.urgencia] || COLORS.gray500}
          />
        ))}
      </Section>

      <Section title="Próximos partos">
        {partosProximos.isLoading && <ActivityIndicator color={COLORS.primary} />}
        {!partosProximos.isLoading && (partosProximos.data?.items?.length ?? 0) === 0 && (
          <EmptyText>No hay partos esperados en los próximos 30 días.</EmptyText>
        )}
        {partosProximos.data?.items?.map((p) => (
          <ListRow
            key={p.id}
            title={p.madre_nombre || p.madre_arete}
            subtitle={`Esperado: ${formatFecha(p.fecha_parto_esperada)} (${p.dias_restantes} días)`}
            badge={p.estado_parto}
            badgeColor={ESTADO_PARTO_COLOR[p.estado_parto] || COLORS.gray500}
          />
        ))}
      </Section>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

function StatCard({ label, value, loading, color, small }) {
  return (
    <View style={styles.card}>
      {loading ? (
        <ActivityIndicator color={color} />
      ) : (
        <Text style={[styles.cardValue, small && { fontSize: 20 }, { color }]}>
          {value ?? '—'}
        </Text>
      )}
      <Text style={styles.cardLabel}>{label}</Text>
    </View>
  );
}

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function ListRow({ title, subtitle, badge, badgeColor }) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSubtitle}>{subtitle}</Text>
      </View>
      <View style={[styles.badge, { backgroundColor: badgeColor }]}>
        <Text style={styles.badgeText}>{badge}</Text>
      </View>
    </View>
  );
}

function EmptyText({ children }) {
  return <Text style={styles.emptyText}>{children}</Text>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.gray50 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 24,
  },
  greeting: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  sub: { color: '#a7d7b0', fontSize: 13, marginTop: 2 },
  logoutBtn: {
    borderWidth: 1,
    borderColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  logoutText: { color: '#fff', fontWeight: '600', fontSize: 13 },

  modulosRow: { marginTop: 16, paddingLeft: 16 },
  moduloBtn: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginRight: 10,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    minWidth: 78,
  },
  moduloIcon: { fontSize: 22 },
  moduloLabel: { fontSize: 11, color: COLORS.gray600, marginTop: 4, fontWeight: '600' },

  errorBanner: {
    backgroundColor: '#fdecea',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 12,
    borderRadius: 10,
  },
  errorText: { color: COLORS.danger, fontSize: 12 },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    marginTop: 16,
    gap: 12,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    width: '47%',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: COLORS.gray200,
  },
  cardValue: { fontSize: 28, fontWeight: 'bold' },
  cardLabel: { fontSize: 12, color: COLORS.gray600, marginTop: 4 },

  section: { marginTop: 24, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', color: COLORS.black, marginBottom: 10 },
  emptyText: { fontSize: 13, color: COLORS.gray500, fontStyle: 'italic' },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.gray200,
  },
  rowTitle: { fontSize: 14, fontWeight: '600', color: COLORS.black },
  rowSubtitle: { fontSize: 12, color: COLORS.gray500, marginTop: 2 },
  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
});
