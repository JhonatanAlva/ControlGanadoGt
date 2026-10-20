// app/(app)/gastos/index.jsx
import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, RefreshControl, Alert,
  TouchableOpacity, ActivityIndicator, StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { gastosService } from '../../../services/gastosService';
import useAuthStore from '../../../stores/authStore';
import { COLORS } from '../../../constants/colors';
import { formatQ, formatFecha } from '../../../utils/format';
import { exportarPDF, htmlReporteGastos } from '../../../utils/exportPdf';
import ScreenHeader from '../../../components/ScreenHeader';
import useFincaStore from '../../../stores/fincaStore';
import FincaActivaBar from '../../../components/FincaActivaBar';
import ChipPicker from '../../../components/ChipPicker';
import BarList from '../../../components/BarList';
import PrimaryButton from '../../../components/PrimaryButton';
import { CATEGORIAS_GASTO, TIPOS_MOVIMIENTO } from '../../../constants/enums';

const MES_LABEL = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export default function GastosScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { usuario } = useAuthStore();

  const [anio, setAnio] = useState(new Date().getFullYear());
  const [tipo, setTipo] = useState('');
  const [categoria, setCategoria] = useState('');
  const [exportando, setExportando] = useState(false);
  const fincaActivaId = useFincaStore((s) => s.fincaActivaId);
  const filtroFinca = fincaActivaId ? { finca_id: fincaActivaId } : {};

  const resumenQuery = useQuery({
    queryKey: ['gastos', 'resumen-mensual', anio, fincaActivaId],
    queryFn: () => gastosService.resumenMensual(anio, fincaActivaId),
    select: (res) => res.data.data,
  });

  const categoriaQuery = useQuery({
    queryKey: ['gastos', 'resumen-categoria', anio, fincaActivaId],
    queryFn: () => gastosService.resumenCategoria({ fecha_desde: `${anio}-01-01`, ...filtroFinca }),
    select: (res) => res.data.data.categorias,
  });

  const listQuery = useQuery({
    queryKey: ['gastos', 'lista', { tipo, categoria, fincaActivaId }],
    queryFn: () => gastosService.listar({
      ...filtroFinca,
      ...(tipo && { tipo }),
      ...(categoria && { categoria }),
      limit: 100,
    }),
    select: (res) => res.data.data,
  });

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['gastos'] });
    setRefreshing(false);
  }, [queryClient]);

  const movimientos = listQuery.data || [];
  const meses = resumenQuery.data?.meses || [];
  const totales = resumenQuery.data?.totales;

  const barsMensual = meses.map((m) => ({
    label: MES_LABEL[parseInt(m.mes.split('-')[1], 10) - 1],
    value: parseFloat(m.balance),
    valueLabel: formatQ(m.balance),
    color: parseFloat(m.balance) >= 0 ? COLORS.success : COLORS.danger,
  }));

  const barsCategoria = (categoriaQuery.data || [])
    .filter((c) => c.tipo === 'Gasto')
    .map((c) => ({ label: c.categoria, value: parseFloat(c.total), valueLabel: formatQ(c.total) }));

  const handleExportar = async () => {
    if (!totales) return;
    setExportando(true);
    try {
      const html = htmlReporteGastos({
        usuarioNombre: usuario?.nombre || '',
        anio,
        meses,
        totales,
        movimientos,
      });
      await exportarPDF(html, `Gastos_${anio}`);
    } catch {
      Alert.alert('Error', 'No se pudo generar el PDF.');
    } finally {
      setExportando(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Gastos"
        rightLabel="+ Nuevo"
        onRightPress={() => router.push('/(app)/gastos/nuevo')}
      />
      <FincaActivaBar />

      <ScrollView
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
      >
        <View style={styles.section}>
          <View style={styles.anioSelector}>
            <TouchableOpacity onPress={() => setAnio((a) => a - 1)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.anioArrow}>←</Text>
            </TouchableOpacity>
            <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Balance {anio}</Text>
            <TouchableOpacity onPress={() => setAnio((a) => a + 1)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.anioArrow}>→</Text>
            </TouchableOpacity>
          </View>
          {resumenQuery.isLoading && <ActivityIndicator color={COLORS.primary} />}
          {totales && (
            <View style={styles.totalesRow}>
              <TotalCard label="Ingresos" value={formatQ(totales.total_ingresos)} color={COLORS.success} />
              <TotalCard label="Gastos" value={formatQ(totales.total_gastos)} color={COLORS.danger} />
              <TotalCard
                label="Balance"
                value={formatQ(totales.balance)}
                color={totales.balance >= 0 ? COLORS.success : COLORS.danger}
              />
            </View>
          )}
          {barsMensual.length > 0 && <BarList items={barsMensual} />}
          {totales && (
            <PrimaryButton
              label="Exportar PDF"
              variant="outlinePrimary"
              loading={exportando}
              onPress={handleExportar}
            />
          )}
        </View>

        {barsCategoria.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Gastos por categoría ({anio})</Text>
            <BarList items={barsCategoria} />
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Movimientos</Text>
          <ChipPicker
            options={TIPOS_MOVIMIENTO}
            value={tipo}
            onChange={setTipo}
          />
          <ChipPicker
            options={CATEGORIAS_GASTO}
            value={categoria}
            onChange={setCategoria}
          />

          {listQuery.isLoading && <ActivityIndicator color={COLORS.primary} />}
          {listQuery.isError && <Text style={styles.errorText}>No se pudieron cargar los movimientos.</Text>}
          {!listQuery.isLoading && movimientos.length === 0 && (
            <Text style={styles.emptyText}>No hay movimientos con este filtro.</Text>
          )}

          {movimientos.map((g) => (
            <TouchableOpacity
              key={g.id}
              style={styles.card}
              onPress={() => router.push(`/(app)/gastos/${g.id}`)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{g.categoria}</Text>
                <Text style={styles.cardSub}>{formatFecha(g.fecha)}{g.descripcion ? ` · ${g.descripcion}` : ''}</Text>
              </View>
              <Text style={[styles.monto, { color: g.tipo === 'Ingreso' ? COLORS.success : COLORS.danger }]}>
                {g.tipo === 'Ingreso' ? '+' : '-'}{formatQ(g.monto)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

function TotalCard({ label, value, color }) {
  return (
    <View style={styles.totalCard}>
      <Text style={[styles.totalValue, { color }]}>{value}</Text>
      <Text style={styles.totalLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.gray50 },
  section: { padding: 20, borderBottomWidth: 8, borderBottomColor: COLORS.gray50, backgroundColor: '#fff' },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', color: COLORS.black, marginBottom: 12 },
  anioSelector: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 20, marginBottom: 12,
  },
  anioArrow: { fontSize: 20, color: COLORS.primary, fontWeight: 'bold', paddingHorizontal: 8 },
  totalesRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  totalCard: { flex: 1, backgroundColor: COLORS.gray50, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: COLORS.gray200 },
  totalValue: { fontSize: 14, fontWeight: 'bold' },
  totalLabel: { fontSize: 10, color: COLORS.gray600, marginTop: 2 },
  errorText: { color: COLORS.danger, fontSize: 13, marginTop: 8 },
  emptyText: { color: COLORS.gray500, fontSize: 13, fontStyle: 'italic', marginTop: 8 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.gray50,
    borderRadius: 12,
    padding: 14,
    marginTop: 10,
    borderWidth: 1,
    borderColor: COLORS.gray200,
  },
  cardTitle: { fontSize: 14, fontWeight: '600', color: COLORS.black },
  cardSub: { fontSize: 12, color: COLORS.gray600, marginTop: 2 },
  monto: { fontSize: 14, fontWeight: 'bold' },
});
