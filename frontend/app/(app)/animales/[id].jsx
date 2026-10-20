// app/(app)/animales/[id].jsx
import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image,
  ActivityIndicator, Alert, StyleSheet,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as animalesRepo from '../../../offline/animalesRepo';
import { COLORS } from '../../../constants/colors';
import { formatQ, formatFecha } from '../../../utils/format';
import ScreenHeader from '../../../components/ScreenHeader';
import FormInput from '../../../components/FormInput';
import ChipPicker from '../../../components/ChipPicker';
import PrimaryButton from '../../../components/PrimaryButton';
import Badge from '../../../components/Badge';

const ESTADO_COLOR = {
  Activo: COLORS.success,
  Vendido: COLORS.secondary,
  Muerto: COLORS.gray500,
  Robado: COLORS.danger,
};

export default function DetalleAnimalScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const queryClient = useQueryClient();

  const { data: animal, isLoading } = useQuery({
    queryKey: ['animales', id],
    queryFn: () => animalesRepo.obtener(id),
  });

  const { data: pesos } = useQuery({
    queryKey: ['animales', id, 'pesos'],
    queryFn: () => animalesRepo.historialPesos(id),
  });

  const invalidarTodo = async () => {
    await queryClient.invalidateQueries({ queryKey: ['animales'] });
    await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  // ── Cambiar estado ──────────────────────────────────────────────────────────
  const [cambiandoEstado, setCambiandoEstado] = useState(false);
  const [nuevoEstado, setNuevoEstado] = useState('');
  const [fechaVenta, setFechaVenta] = useState('');
  const [precioVenta, setPrecioVenta] = useState('');

  const estadoMutation = useMutation({
    mutationFn: () => animalesRepo.cambiarEstado(id, {
      estado: nuevoEstado,
      ...(nuevoEstado === 'Vendido' && {
        fecha_venta: fechaVenta,
        precio_venta: parseFloat(precioVenta),
      }),
    }),
    onSuccess: async () => {
      await invalidarTodo();
      setCambiandoEstado(false);
      setNuevoEstado('');
    },
    onError: (err) => Alert.alert('Error', err.mensaje || 'No se pudo cambiar el estado.'),
  });

  const confirmarCambioEstado = () => {
    if (!nuevoEstado) return;
    if (nuevoEstado === 'Vendido' && (!fechaVenta || !precioVenta)) {
      Alert.alert('Campos requeridos', 'Para marcar como Vendido, ingresa fecha y precio de venta.');
      return;
    }
    estadoMutation.mutate();
  };

  // ── Registrar peso ───────────────────────────────────────────────────────────
  const [nuevoPeso, setNuevoPeso] = useState('');
  const [fechaPeso, setFechaPeso] = useState('');

  const pesoMutation = useMutation({
    mutationFn: () => animalesRepo.registrarPeso(id, {
      peso: parseFloat(nuevoPeso),
      fecha: fechaPeso,
    }),
    onSuccess: async () => {
      setNuevoPeso('');
      setFechaPeso('');
      await queryClient.invalidateQueries({ queryKey: ['animales', id] });
      await queryClient.invalidateQueries({ queryKey: ['animales', id, 'pesos'] });
    },
    onError: (err) => Alert.alert('Error', err.mensaje || 'No se pudo registrar el peso.'),
  });

  const handleRegistrarPeso = () => {
    if (!nuevoPeso || !fechaPeso) {
      Alert.alert('Campos requeridos', 'Ingresa el peso y la fecha.');
      return;
    }
    pesoMutation.mutate();
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!animal) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
        <Text style={{ color: COLORS.gray500, textAlign: 'center' }}>
          No se encontró este animal en la caché local. Conéctate a internet e intenta de nuevo.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <ScreenHeader
        title={animal.nombre || animal.numero_arete}
        rightLabel="Editar"
        onRightPress={() => router.push(`/(app)/animales/${id}/editar`)}
      />

      <View style={styles.section}>
        {animal.foto_url && (
          <Image source={{ uri: animal.foto_url }} style={styles.foto} />
        )}
        <View style={styles.rowBetween}>
          <Text style={styles.h1}>{animal.nombre || animal.numero_arete}</Text>
          <Badge text={animal.estado} color={ESTADO_COLOR[animal.estado] || COLORS.gray500} />
        </View>
        <Text style={styles.sub}>
          {animal.numero_arete} · {animal.raza} · {animal.tipo} · {animal.sexo}
        </Text>
        {animal.edad?.texto && <Text style={styles.sub}>Edad: {animal.edad.texto}</Text>}
        {animal.finca_nombre && <Text style={styles.sub}>Finca: {animal.finca_nombre}</Text>}
        {animal.proposito && <Text style={styles.sub}>Propósito: {animal.proposito}</Text>}

        <View style={styles.grid}>
          <InfoCard label="Peso actual" value={animal.peso_actual ? `${animal.peso_actual} lb` : '—'} />
          <InfoCard label="Peso compra" value={animal.peso_compra ? `${animal.peso_compra} lb` : '—'} />
          <InfoCard label="Precio compra" value={animal.precio_compra ? formatQ(animal.precio_compra) : '—'} />
          <InfoCard label="Precio venta" value={animal.precio_venta ? formatQ(animal.precio_venta) : '—'} />
        </View>

        {(animal.madre_arete_ref || animal.madre_arete) && (
          <Text style={styles.sub}>Madre: {animal.madre_arete_ref || animal.madre_arete}</Text>
        )}
        {(animal.padre_arete_ref || animal.padre_arete) && (
          <Text style={styles.sub}>Padre: {animal.padre_arete_ref || animal.padre_arete}</Text>
        )}
        {animal.procedencia && <Text style={styles.sub}>Procedencia: {animal.procedencia}</Text>}
        {animal.notas && <Text style={styles.sub}>Notas: {animal.notas}</Text>}
      </View>

      {/* ── Cambiar estado ── */}
      {animal.estado === 'Activo' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cambiar estado</Text>
          {!cambiandoEstado ? (
            <PrimaryButton
              label="Marcar como Vendido / Muerto / Robado"
              variant="outline"
              onPress={() => setCambiandoEstado(true)}
            />
          ) : (
            <>
              <ChipPicker
                options={['Vendido', 'Muerto', 'Robado']}
                value={nuevoEstado}
                onChange={setNuevoEstado}
              />
              {nuevoEstado === 'Vendido' && (
                <>
                  <FormInput
                    label="Fecha de venta (YYYY-MM-DD)"
                    placeholder="2026-07-16"
                    value={fechaVenta}
                    onChangeText={setFechaVenta}
                  />
                  <FormInput
                    label="Precio de venta (Q)"
                    keyboardType="decimal-pad"
                    value={precioVenta}
                    onChangeText={(v) => setPrecioVenta(v.replace(/[^0-9.]/g, ''))}
                  />
                </>
              )}
              <PrimaryButton
                label="Confirmar cambio"
                variant="danger"
                loading={estadoMutation.isPending}
                onPress={confirmarCambioEstado}
              />
            </>
          )}
        </View>
      )}

      {/* ── Historial de pesos ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Historial de pesos</Text>

        <View style={styles.rowInputs}>
          <FormInput
            label="Peso (lb)"
            keyboardType="decimal-pad"
            value={nuevoPeso}
            onChangeText={(v) => setNuevoPeso(v.replace(/[^0-9.]/g, ''))}
            style={{ width: 110 }}
          />
          <FormInput
            label="Fecha"
            placeholder="YYYY-MM-DD"
            value={fechaPeso}
            onChangeText={setFechaPeso}
            style={{ width: 140 }}
          />
        </View>
        <PrimaryButton label="Registrar peso" loading={pesoMutation.isPending} onPress={handleRegistrarPeso} />

        {pesos?.length > 0 ? pesos.map((p) => (
          <View key={p.id} style={styles.pesoRow}>
            <Text style={styles.pesoValue}>{p.peso} lb{p._local ? ' ⏳' : ''}</Text>
            <Text style={styles.sub}>{formatFecha(p.fecha)}</Text>
            {p.gdp != null && (
              <Text style={[styles.sub, { color: p.gdp >= 0 ? COLORS.success : COLORS.danger }]}>
                GDP: {p.gdp} lb/día
              </Text>
            )}
          </View>
        )) : (
          <Text style={styles.emptyText}>Sin pesajes registrados.</Text>
        )}
      </View>
    </ScrollView>
  );
}

function InfoCard({ label, value }) {
  return (
    <View style={styles.infoCard}>
      <Text style={styles.infoValue}>{value}</Text>
      <Text style={styles.infoLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.gray50 },
  section: { padding: 20, borderBottomWidth: 8, borderBottomColor: COLORS.gray50, backgroundColor: '#fff' },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', color: COLORS.black, marginBottom: 12 },
  foto: { width: '100%', height: 200, borderRadius: 14, marginBottom: 16, backgroundColor: COLORS.gray100 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  h1: { fontSize: 20, fontWeight: 'bold', color: COLORS.black },
  sub: { fontSize: 13, color: COLORS.gray600, marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  infoCard: {
    backgroundColor: COLORS.gray50,
    borderRadius: 10,
    padding: 12,
    width: '47%',
    borderWidth: 1,
    borderColor: COLORS.gray200,
  },
  infoValue: { fontSize: 16, fontWeight: 'bold', color: COLORS.black },
  infoLabel: { fontSize: 11, color: COLORS.gray600, marginTop: 2 },
  rowInputs: { flexDirection: 'row', gap: 12 },
  pesoRow: {
    borderTopWidth: 1, borderTopColor: COLORS.gray200,
    paddingVertical: 10, marginTop: 8,
  },
  pesoValue: { fontSize: 14, fontWeight: '600', color: COLORS.black },
  emptyText: { color: COLORS.gray500, fontSize: 13, fontStyle: 'italic', marginTop: 8 },
});
