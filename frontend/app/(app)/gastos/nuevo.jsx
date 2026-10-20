// app/(app)/gastos/nuevo.jsx
import { useState } from 'react';
import { ScrollView, View, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { gastosRepo } from '../../../offline/gastosRepo';
import { fincasRepo } from '../../../offline/fincasRepo';
import * as animalesRepo from '../../../offline/animalesRepo';
import { CATEGORIAS_GASTO, TIPOS_MOVIMIENTO } from '../../../constants/enums';
import useFincaStore from '../../../stores/fincaStore';
import ScreenHeader from '../../../components/ScreenHeader';
import FormInput from '../../../components/FormInput';
import ChipPicker from '../../../components/ChipPicker';
import AnimalPicker from '../../../components/AnimalPicker';
import PrimaryButton from '../../../components/PrimaryButton';

export default function NuevoGastoScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { fincaActivaId } = useFincaStore();

  const { data: fincas } = useQuery({
    queryKey: ['fincas'],
    queryFn: () => fincasRepo.listar(),
  });

  const { data: animales } = useQuery({
    queryKey: ['animales', { estado: 'Activo' }],
    queryFn: () => animalesRepo.listar({ estado: 'Activo', limit: 100 }),
  });

  const [form, setForm] = useState({
    tipo: 'Gasto', categoria: '', descripcion: '', monto: '',
    fecha: '', finca_id: fincaActivaId || '', animal_id: '',
    proveedor: '', factura: '', notas: '',
  });
  const set = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));

  const mutation = useMutation({
    mutationFn: () => gastosRepo.crear({
      tipo: form.tipo,
      categoria: form.categoria,
      descripcion: form.descripcion.trim() || undefined,
      monto: parseFloat(form.monto),
      fecha: form.fecha,
      finca_id: form.finca_id || undefined,
      animal_id: form.animal_id || undefined,
      proveedor: form.proveedor.trim() || undefined,
      factura: form.factura.trim() || undefined,
      notas: form.notas.trim() || undefined,
    }),
    onSuccess: async (gasto) => {
      await queryClient.invalidateQueries({ queryKey: ['gastos'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      Alert.alert('Listo', gasto._local ? 'Guardado sin conexión. Se enviará al servidor cuando vuelva la señal.' : 'Movimiento registrado.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    onError: (err) => Alert.alert('Error', err.mensaje || 'No se pudo registrar el movimiento.'),
  });

  const handleGuardar = () => {
    if (!form.categoria) return Alert.alert('Campo requerido', 'Selecciona la categoría.');
    if (!form.monto || parseFloat(form.monto) <= 0) return Alert.alert('Campo requerido', 'Ingresa un monto válido.');
    if (!form.fecha) return Alert.alert('Campo requerido', 'Ingresa la fecha.');
    mutation.mutate();
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#fff' }} contentContainerStyle={{ paddingBottom: 40 }}>
      <ScreenHeader title="Nuevo Movimiento" />

      <View style={{ padding: 24 }}>
        <ChipPicker label="Tipo *" options={TIPOS_MOVIMIENTO} value={form.tipo} onChange={(v) => set('tipo', v || 'Gasto')} allowDeselect={false} />
        <ChipPicker label="Categoría *" options={CATEGORIAS_GASTO} value={form.categoria} onChange={(v) => set('categoria', v)} />

        <FormInput
          label="Monto (Q) *"
          keyboardType="decimal-pad"
          value={form.monto}
          onChangeText={(v) => set('monto', v.replace(/[^0-9.]/g, ''))}
        />
        <FormInput
          label="Fecha (YYYY-MM-DD) *"
          placeholder="2026-07-17"
          value={form.fecha}
          onChangeText={(v) => set('fecha', v)}
        />
        <FormInput
          label="Descripción"
          value={form.descripcion}
          onChangeText={(v) => set('descripcion', v)}
        />

        {fincas?.length > 0 && (
          <ChipPicker
            label="Finca"
            options={fincas.map((f) => f.nombre)}
            value={fincas.find((f) => f.id === form.finca_id)?.nombre || ''}
            onChange={(nombre) => {
              const f = fincas.find((x) => x.nombre === nombre);
              set('finca_id', f ? f.id : '');
            }}
          />
        )}

        {animales?.length > 0 && (
          <AnimalPicker
            label="Animal (opcional)"
            animales={animales}
            value={form.animal_id}
            onChange={(id) => set('animal_id', id)}
          />
        )}

        <FormInput label="Proveedor" value={form.proveedor} onChangeText={(v) => set('proveedor', v)} />
        <FormInput label="No. de factura" value={form.factura} onChangeText={(v) => set('factura', v)} />
        <FormInput label="Notas" multiline value={form.notas} onChangeText={(v) => set('notas', v)} />

        <PrimaryButton label="Guardar movimiento" onPress={handleGuardar} loading={mutation.isPending} />
      </View>
    </ScrollView>
  );
}
