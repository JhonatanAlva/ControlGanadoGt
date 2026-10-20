// app/(app)/vacunas/nueva.jsx
import { useState } from 'react';
import { ScrollView, View, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { vacunasRepo } from '../../../offline/vacunasRepo';
import * as animalesRepo from '../../../offline/animalesRepo';
import { TIPOS_VACUNA, VIAS_APLICACION } from '../../../constants/enums';
import ScreenHeader from '../../../components/ScreenHeader';
import FormInput from '../../../components/FormInput';
import ChipPicker from '../../../components/ChipPicker';
import AnimalPicker from '../../../components/AnimalPicker';
import PrimaryButton from '../../../components/PrimaryButton';

export default function NuevaVacunaScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: animales } = useQuery({
    queryKey: ['animales', { estado: 'Activo', search: '' }],
    queryFn: () => animalesRepo.listar({ estado: 'Activo', limit: 100 }),
  });

  const [form, setForm] = useState({
    animal_id: '', tipo_vacuna: '', nombre_producto: '', lote: '',
    fecha_aplicacion: '', proxima_dosis: '', dosis: '', via_aplicacion: '',
    veterinario: '', costo: '', notas: '',
  });
  const set = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));

  const mutation = useMutation({
    mutationFn: () => vacunasRepo.crear({
      animal_id: form.animal_id,
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
      await queryClient.invalidateQueries({ queryKey: ['vacunas'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      Alert.alert('Listo', vacuna._local ? 'Guardado sin conexión. Se enviará al servidor cuando vuelva la señal.' : 'Vacuna registrada.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    onError: (err) => Alert.alert('Error', err.mensaje || 'No se pudo registrar la vacuna.'),
  });

  const handleGuardar = () => {
    if (!form.animal_id) return Alert.alert('Campo requerido', 'Selecciona el animal.');
    if (!form.tipo_vacuna) return Alert.alert('Campo requerido', 'Selecciona el tipo de vacuna.');
    if (!form.fecha_aplicacion) return Alert.alert('Campo requerido', 'Ingresa la fecha de aplicación.');
    mutation.mutate();
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#fff' }} contentContainerStyle={{ paddingBottom: 40 }}>
      <ScreenHeader title="Nueva Vacuna" />

      <View style={{ padding: 24 }}>
        {animales?.length > 0 ? (
          <AnimalPicker
            label="Animal *"
            animales={animales}
            value={form.animal_id}
            onChange={(id) => set('animal_id', id)}
          />
        ) : (
          <FormInput label="Animal" editable={false} value="No tienes animales activos registrados" />
        )}

        <ChipPicker label="Tipo de vacuna *" options={TIPOS_VACUNA} value={form.tipo_vacuna} onChange={(v) => set('tipo_vacuna', v)} />

        <FormInput label="Producto" placeholder="Aftogan" value={form.nombre_producto} onChangeText={(v) => set('nombre_producto', v)} />
        <FormInput label="Lote" value={form.lote} onChangeText={(v) => set('lote', v)} />
        <FormInput
          label="Fecha de aplicación (YYYY-MM-DD) *"
          placeholder="2026-07-16"
          value={form.fecha_aplicacion}
          onChangeText={(v) => set('fecha_aplicacion', v)}
        />
        <FormInput
          label="Próxima dosis (YYYY-MM-DD)"
          placeholder="2026-10-16"
          value={form.proxima_dosis}
          onChangeText={(v) => set('proxima_dosis', v)}
        />
        <FormInput label="Dosis" placeholder="2ml" value={form.dosis} onChangeText={(v) => set('dosis', v)} />

        <ChipPicker label="Vía de aplicación" options={VIAS_APLICACION} value={form.via_aplicacion} onChange={(v) => set('via_aplicacion', v)} />

        <FormInput label="Veterinario" value={form.veterinario} onChangeText={(v) => set('veterinario', v)} />
        <FormInput
          label="Costo (Q)"
          keyboardType="decimal-pad"
          value={form.costo}
          onChangeText={(v) => set('costo', v.replace(/[^0-9.]/g, ''))}
        />
        <FormInput label="Notas" multiline value={form.notas} onChangeText={(v) => set('notas', v)} />

        <PrimaryButton label="Guardar vacuna" onPress={handleGuardar} loading={mutation.isPending} />
      </View>
    </ScrollView>
  );
}
