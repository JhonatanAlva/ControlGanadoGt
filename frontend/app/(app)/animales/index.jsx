// app/(app)/animales/index.jsx
import { useState, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, ScrollView, RefreshControl, Image, Alert,
  TouchableOpacity, ActivityIndicator, StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as animalesRepo from '../../../offline/animalesRepo';
import { contarPendientes, suscribirseASync } from '../../../offline/syncManager';
import useNetworkStatus from '../../../hooks/useNetworkStatus';
import useAuthStore from '../../../stores/authStore';
import { COLORS } from '../../../constants/colors';
import { ESTADOS_ANIMAL } from '../../../constants/enums';
import { exportarPDF, htmlReporteAnimales } from '../../../utils/exportPdf';
import ScreenHeader from '../../../components/ScreenHeader';
import useFincaStore from '../../../stores/fincaStore';
import FincaActivaBar from '../../../components/FincaActivaBar';
import ChipPicker from '../../../components/ChipPicker';
import Badge from '../../../components/Badge';

const ESTADO_COLOR = {
  Activo: COLORS.success,
  Vendido: COLORS.secondary,
  Muerto: COLORS.gray500,
  Robado: COLORS.danger,
};

export default function AnimalesScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { usuario } = useAuthStore();
  const conectado = useNetworkStatus();
  const fincaActivaId = useFincaStore((s) => s.fincaActivaId);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [estado, setEstado] = useState('Activo');
  const [exportando, setExportando] = useState(false);
  const [pendientes, setPendientes] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    const cargarPendientes = () => contarPendientes().then(setPendientes);
    cargarPendientes();
    const unsub = suscribirseASync(cargarPendientes);
    return unsub;
  }, []);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['animales', { estado, search, fincaActivaId }],
    queryFn: () => animalesRepo.listar({
      ...(estado && { estado }),
      ...(fincaActivaId && { finca_id: fincaActivaId }),
      ...(search && { search }),
      limit: 100,
    }),
  });

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['animales'] });
    setRefreshing(false);
  }, [queryClient]);

  const animales = data || [];

  const handleExportar = async () => {
    if (animales.length === 0) return;
    setExportando(true);
    try {
      const html = htmlReporteAnimales({ usuarioNombre: usuario?.nombre || '', animales });
      await exportarPDF(html, 'Inventario_Animales');
    } catch {
      Alert.alert('Error', 'No se pudo generar el PDF.');
    } finally {
      setExportando(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Animales"
        rightLabel="+ Nuevo"
        onRightPress={() => router.push('/(app)/animales/nuevo')}
      />
      <FincaActivaBar />

      {!conectado && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>
            📡 Sin conexión — mostrando datos guardados{pendientes > 0 ? ` · ${pendientes} cambio(s) por sincronizar` : ''}
          </Text>
        </View>
      )}
      {conectado && pendientes > 0 && (
        <View style={styles.syncBanner}>
          <ActivityIndicator size="small" color={COLORS.secondary} />
          <Text style={styles.syncText}>Sincronizando {pendientes} cambio(s)...</Text>
        </View>
      )}

      <View style={styles.filtros}>
        <TextInput
          style={styles.search}
          placeholder="Buscar por arete o nombre..."
          placeholderTextColor={COLORS.gray500}
          value={searchInput}
          onChangeText={setSearchInput}
        />
        <ChipPicker
          options={ESTADOS_ANIMAL}
          value={estado}
          onChange={setEstado}
        />
        <TouchableOpacity onPress={handleExportar} disabled={exportando || animales.length === 0}>
          {exportando
            ? <ActivityIndicator color={COLORS.primary} />
            : <Text style={styles.exportLink}>📄 Exportar PDF ({animales.length})</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
      >
        {isLoading && <ActivityIndicator style={{ marginTop: 32 }} color={COLORS.primary} />}

        {isError && (
          <Text style={styles.errorText}>No se pudieron cargar los animales. Desliza para reintentar.</Text>
        )}

        {!isLoading && animales.length === 0 && (
          <Text style={styles.emptyText}>No hay animales que coincidan con el filtro.</Text>
        )}

        {animales.map((a) => (
          <TouchableOpacity
            key={a.id}
            style={styles.card}
            onPress={() => router.push(`/(app)/animales/${a.id}`)}
          >
            {a.foto_url ? (
              <Image source={{ uri: a.foto_url }} style={styles.thumb} />
            ) : (
              <View style={styles.thumbPlaceholder}><Text style={{ fontSize: 20 }}>🐄</Text></View>
            )}
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.cardTitle}>{a.nombre || a.numero_arete}</Text>
              <Text style={styles.cardSub}>
                {a.numero_arete} · {a.raza} · {a.tipo} · {a.sexo}
              </Text>
              {a.finca_nombre && <Text style={styles.cardSub}>{a.finca_nombre}</Text>}
            </View>
            <Badge text={a.estado} color={ESTADO_COLOR[a.estado] || COLORS.gray500} />
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
  search: {
    borderWidth: 1,
    borderColor: COLORS.gray300,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.black,
    backgroundColor: COLORS.gray50,
    marginBottom: 12,
  },
  exportLink: { color: COLORS.primary, fontWeight: '600', fontSize: 13, marginTop: 4 },
  offlineBanner: { backgroundColor: '#fdf2e0', paddingVertical: 8, paddingHorizontal: 16 },
  offlineText: { color: '#a06a12', fontSize: 12, textAlign: 'center' },
  syncBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primaryLight, paddingVertical: 8, paddingHorizontal: 16,
  },
  syncText: { color: COLORS.primaryDark, fontSize: 12 },
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
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.black },
  cardSub: { fontSize: 12, color: COLORS.gray600, marginTop: 2 },
  thumb: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.gray100 },
  thumbPlaceholder: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.gray100,
    alignItems: 'center', justifyContent: 'center',
  },
});
