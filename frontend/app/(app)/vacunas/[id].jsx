// app/(app)/vacunas/[id].jsx
import { useState, useEffect } from 'react';
import { ScrollView, View, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { vacunasRepo } from '../../../offline/vacunasRepo';
import { TIPOS_VACUNA, VIAS_APLICACION } from '../../../constants/enums';
import { COLORS } from '../../../constants/colors';
import ScreenHeader from '../../../components/ScreenHeader';
import FormInput from '../../../components/FormInput';
import ChipPicker from '../../../components/ChipPicker';
import PrimaryButton from '../../../components/PrimaryButton';

export default function DetalleVacunaScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const queryClient = useQueryClient();

  const { data: vacuna, isLoading } = useQuery({
    queryKey: ['vacunas', id],
    queryFn: () => vacunasRepo.obtener(id),
  });

  const [form, setForm] = useState(null);
  useEffect(() => {
    if (vacuna && !form) {
      setForm({
        tipo_vacuna: vacuna.tipo_vacuna || '',
        nombre_producto: vacuna.nombre_producto || '',
        lote: vacuna.lote || '',
        fecha_aplicacion: vacuna.fecha_aplicacion ? vacuna.fecha_aplicacion.slice(0, 10) : '',
        proxima_dosis: vacuna.proxima_dosis ? vacuna.proxima_dosis.slice(0, 10) : '',
        dosis: vacuna.dosis || '',
        via_aplicacion: vacuna.via_aplicacion || '',
        veterinario: vacuna.veterinario || '',
        costo: vacuna.costo ? String(vacuna.costo) : '',
        notas: vacuna.notas || '',
      });
    }
  }, [vacuna]);

  const set = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));

  const invalidar = async () => {
    await queryClient.invalidateQueries({ queryKey: ['vacunas'] });
    await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const actualizarMutation = useMutation({
    mutationFn: () => vacunasRepo.actualizar(id, {
      tipo_vacuna: form.tipo_vacuna,
      nombre_producto: form.nombre_producto.trim() || undefined,
      lote: form.lote.trim() || undefined,
      fecha_aplicacion: form.fecha_aplicacion,
      proxima_dosis: form.proxima_dosis || undefined,
      dosis: form.dosis.trim() || undefined,
      via_aplicacion: form.via_aplicacion || undefined,
      veterinario: form.veterinario.trim() || undefined,
      costo: form.costo ? parseFloat(form.costo) : undefined,
      notas: form.notas.trim() || undefined,
    }),
    onSuccess: async (vacuna) => {
      await invalidar();
      Alert.alert('Listo', vacuna._local ? 'Guardado sin conexión. Se enviará al servidor cuando vuelva la señal.' : 'Vacuna actualizada.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    onError: (err) => Alert.alert('Error', err.mensaje || 'No se pudo actualizar la vacuna.'),
  });

  const eliminarMutation = useMutation({
    mutationFn: () => vacunasRepo.eliminar(id),
    onSuccess: async () => {
      await invalidar();
      router.back();
    },
    onError: (err) => Alert.alert('Error', err.mensaje || 'No se pudo eliminar la vacuna.'),
  });

  const confirmarEliminar = () => {
    Alert.alert('Eliminar vacuna', '¿Seguro que quieres eliminar este registro?', [
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
      <ScreenHeader title={`${vacuna.animal_nombre || vacuna.numero_arete}`} />

      <View style={{ padding: 24 }}>
        <ChipPicker label="Tipo de vacuna" options={TIPOS_VACUNA} value={form.tipo_vacuna} onChange={(v) => set('tipo_vacuna', v)} />
        <FormInput label="Producto" value={form.nombre_producto} onChangeText={(v) => set('nombre_producto', v)} />
        <FormInput label="Lote" value={form.lote} onChangeText={(v) => set('lote', v)} />
        <FormInput label="Fecha de aplicación (YYYY-MM-DD)" value={form.fecha_aplicacion} onChangeText={(v) => set('fecha_aplicacion', v)} />
        <FormInput label="Próxima dosis (YYYY-MM-DD)" value={form.proxima_dosis} onChangeText={(v) => set('proxima_dosis', v)} />
        <FormInput label="Dosis" value={form.dosis} onChangeText={(v) => set('dosis', v)} />
        <ChipPicker label="Vía de aplicación" options={VIAS_APLICACION} value={form.via_aplicacion} onChange={(v) => set('via_aplicacion', v)} />
        <FormInput label="Veterinario" value={form.veterinario} onChangeText={(v) => set('veterinario', v)} />
        <FormInput
          label="Costo (Q)"
          keyboardType="decimal-pad"
          value={form.costo}
          onChangeText={(v) => set('costo', v.replace(/[^0-9.]/g, ''))}
        />
        <FormInput label="Notas" multiline value={form.notas} onChangeText={(v) => set('notas', v)} />

        <PrimaryButton label="Guardar cambios" onPress={() => actualizarMutation.mutate()} loading={actualizarMutation.isPending} />
        <PrimaryButton label="Eliminar vacuna" variant="outline" onPress={confirmarEliminar} loading={eliminarMutation.isPending} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
});
