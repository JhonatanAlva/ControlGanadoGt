// app/(app)/gastos/[id].jsx
import { useState, useEffect } from 'react';
import { ScrollView, View, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { gastosRepo } from '../../../offline/gastosRepo';
import { CATEGORIAS_GASTO, TIPOS_MOVIMIENTO } from '../../../constants/enums';
import { COLORS } from '../../../constants/colors';
import ScreenHeader from '../../../components/ScreenHeader';
import FormInput from '../../../components/FormInput';
import ChipPicker from '../../../components/ChipPicker';
import PrimaryButton from '../../../components/PrimaryButton';

export default function DetalleGastoScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const queryClient = useQueryClient();

  const { data: gasto, isLoading } = useQuery({
    queryKey: ['gastos', id],
    queryFn: () => gastosRepo.obtener(id),
  });

  const [form, setForm] = useState(null);
  useEffect(() => {
    if (gasto && !form) {
      setForm({
        tipo: gasto.tipo || 'Gasto',
        categoria: gasto.categoria || '',
        descripcion: gasto.descripcion || '',
        monto: gasto.monto ? String(gasto.monto) : '',
        fecha: gasto.fecha ? gasto.fecha.slice(0, 10) : '',
        proveedor: gasto.proveedor || '',
        factura: gasto.factura || '',
        notas: gasto.notas || '',
      });
    }
  }, [gasto]);

  const set = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));

  const invalidar = async () => {
    await queryClient.invalidateQueries({ queryKey: ['gastos'] });
    await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const actualizarMutation = useMutation({
    mutationFn: () => gastosRepo.actualizar(id, {
      tipo: form.tipo,
      categoria: form.categoria,
      descripcion: form.descripcion.trim() || undefined,
      monto: parseFloat(form.monto),
      fecha: form.fecha,
      proveedor: form.proveedor.trim() || undefined,
      factura: form.factura.trim() || undefined,
      notas: form.notas.trim() || undefined,
    }),
    onSuccess: async (gasto) => {
      await invalidar();
      Alert.alert('Listo', gasto._local ? 'Guardado sin conexión. Se enviará al servidor cuando vuelva la señal.' : 'Movimiento actualizado.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    onError: (err) => Alert.alert('Error', err.mensaje || 'No se pudo actualizar el movimiento.'),
  });

  const eliminarMutation = useMutation({
    mutationFn: () => gastosRepo.eliminar(id),
    onSuccess: async () => {
      await invalidar();
      router.back();
    },
    onError: (err) => Alert.alert('Error', err.mensaje || 'No se pudo eliminar el movimiento.'),
  });

  const confirmarEliminar = () => {
    Alert.alert('Eliminar movimiento', '¿Seguro que quieres eliminarlo?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => eliminarMutation.mutate() },
    ]);
  };

  if (isLoading || !form) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <ScreenHeader title="Editar Movimiento" />

      <View style={{ padding: 24 }}>
        <ChipPicker label="Tipo" options={TIPOS_MOVIMIENTO} value={form.tipo} onChange={(v) => set('tipo', v || 'Gasto')} allowDeselect={false} />
        <ChipPicker label="Categoría" options={CATEGORIAS_GASTO} value={form.categoria} onChange={(v) => set('categoria', v)} />
        <FormInput
          label="Monto (Q)"
          keyboardType="decimal-pad"
          value={form.monto}
          onChangeText={(v) => set('monto', v.replace(/[^0-9.]/g, ''))}
        />
        <FormInput label="Fecha (YYYY-MM-DD)" value={form.fecha} onChangeText={(v) => set('fecha', v)} />
        <FormInput label="Descripción" value={form.descripcion} onChangeText={(v) => set('descripcion', v)} />
        <FormInput label="Proveedor" value={form.proveedor} onChangeText={(v) => set('proveedor', v)} />
        <FormInput label="No. de factura" value={form.factura} onChangeText={(v) => set('factura', v)} />
        <FormInput label="Notas" multiline value={form.notas} onChangeText={(v) => set('notas', v)} />

        <PrimaryButton label="Guardar cambios" onPress={() => actualizarMutation.mutate()} loading={actualizarMutation.isPending} />
        <PrimaryButton label="Eliminar movimiento" variant="outline" onPress={confirmarEliminar} loading={eliminarMutation.isPending} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
});
