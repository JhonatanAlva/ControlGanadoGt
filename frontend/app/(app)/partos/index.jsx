// app/(app)/partos/index.jsx
import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, RefreshControl,
  TouchableOpacity, ActivityIndicator, StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { partosRepo } from '../../../offline/partosRepo';
import { COLORS } from '../../../constants/colors';
import { formatFecha } from '../../../utils/format';
import ScreenHeader from '../../../components/ScreenHeader';
import useFincaStore from '../../../stores/fincaStore';
import FincaActivaBar from '../../../components/FincaActivaBar';
import SyncBanner from '../../../components/SyncBanner';
import Badge from '../../../components/Badge';

const ESTADO_COLOR = {
  Completado: COLORS.success,
  Atrasado: COLORS.danger,
  'Esta semana': COLORS.warning,
  Próximo: COLORS.secondary,
  Programado: COLORS.gray500,
};

export default function PartosScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [soloProximos, setSoloProximos] = useState(false);
  const fincaActivaId = useFincaStore((s) => s.fincaActivaId);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['partos', { soloProximos, fincaActivaId }],
    queryFn: () => partosRepo.listar({
      ...(soloProximos && { proximos: 'true' }),
      ...(fincaActivaId && { finca_id: fincaActivaId }),
      limit: 100,
    }),
  });

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['partos'] });
    setRefreshing(false);
  }, [queryClient]);

  const partos = data || [];

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Partos"
        rightLabel="+ Nuevo"
        onRightPress={() => router.push('/(app)/partos/nuevo')}
      />
      <FincaActivaBar />
      <SyncBanner />

      <View style={styles.filtros}>
        <TouchableOpacity
          style={[styles.toggle, soloProximos && styles.toggleActive]}
          onPress={() => setSoloProximos((v) => !v)}
        >
          <Text style={[styles.toggleText, soloProximos && styles.toggleTextActive]}>
            Solo próximos (30 días)
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
      >
        {isLoading && <ActivityIndicator style={{ marginTop: 32 }} color={COLORS.primary} />}
        {isError && <Text style={styles.errorText}>No se pudieron cargar los partos.</Text>}
        {!isLoading && partos.length === 0 && (
          <Text style={styles.emptyText}>No hay partos que coincidan con el filtro.</Text>
        )}

        {partos.map((p) => (
          <TouchableOpacity
            key={p.id}
            style={styles.card}
            onPress={() => router.push(`/(app)/partos/${p.id}`)}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{p.madre_nombre || p.madre_arete}</Text>
              <Text style={styles.cardSub}>{p.tipo_reproduccion}</Text>
              <Text style={styles.cardSub}>
                {p.fecha_parto ? `Parto: ${formatFecha(p.fecha_parto)}` : `Esperado: ${formatFecha(p.fecha_parto_esperada)}`}
              </Text>
            </View>
            {p.estado_parto && <Badge text={p.estado_parto} color={ESTADO_COLOR[p.estado_parto] || COLORS.gray500} />}
          </TouchableOpacity>
        ))}

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.gray50 },
  filtros: { padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: COLORS.gray200 },
  toggle: {
    borderWidth: 1, borderColor: COLORS.gray300, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8, alignSelf: 'flex-start',
  },
  toggleActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  toggleText: { fontSize: 12, color: COLORS.gray600 },
  toggleTextActive: { color: '#fff', fontWeight: '600' },
  errorText: { color: COLORS.danger, textAlign: 'center', marginTop: 24, paddingHorizontal: 24 },
  emptyText: { color: COLORS.gray500, textAlign: 'center', marginTop: 32, paddingHorizontal: 32, fontSize: 14 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: COLORS.gray200,
  },
  cardTitle: { fontSize: 15, fontWeight: 'bold', color: COLORS.black },
  cardSub: { fontSize: 12, color: COLORS.gray600, marginTop: 2 },
});
