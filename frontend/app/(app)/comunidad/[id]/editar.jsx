// app/(app)/comunidad/[id]/editar.jsx
import { View, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { comunidadRepo } from '../../../../offline/comunidadRepo';
import { COLORS } from '../../../../constants/colors';
import ScreenHeader from '../../../../components/ScreenHeader';
import FormPublicacion from '../../../../components/FormPublicacion';

export default function EditarPublicacionScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const queryClient = useQueryClient();

  const { data: post, isLoading } = useQuery({
    queryKey: ['comunidad', id],
    queryFn: () => comunidadRepo.obtener(id),
  });

  const mutation = useMutation({
    mutationFn: ({ datos, foto }) => comunidadRepo.actualizar(id, datos, foto),
    onSuccess: async (actualizado) => {
      await queryClient.invalidateQueries({ queryKey: ['comunidad'] });
      Alert.alert(
        'Listo',
        actualizado._local
          ? 'Guardado sin conexión. Se enviará al servidor cuando vuelva la señal.'
          : 'Publicación actualizada.',
        [{ text: 'OK', onPress: () => router.back() }],
      );
    },
    onError: (err) => Alert.alert('Error', err.mensaje || 'No se pudo actualizar la publicación.'),
  });

  if (isLoading || !post) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#fff' }} contentContainerStyle={{ paddingBottom: 40 }}>
      <ScreenHeader title="Editar Publicación" />
      <FormPublicacion
        inicial={post}
        boton="Guardar cambios"
        guardando={mutation.isPending}
        onGuardar={(datos, foto) => mutation.mutate({ datos, foto })}
      />
    </ScrollView>
  );
}
