// app/(app)/perfil.jsx
import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Alert, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { authService } from '../../services/authService';
import useAuthStore from '../../stores/authStore';
import { COLORS } from '../../constants/colors';
import { REGIONES_GUATEMALA } from '../../constants/enums';
import { validarPassword } from '../../utils/password';
import ScreenHeader from '../../components/ScreenHeader';
import FormInput from '../../components/FormInput';
import ChipPicker from '../../components/ChipPicker';
import PrimaryButton from '../../components/PrimaryButton';
import Badge from '../../components/Badge';

export default function PerfilScreen() {
  const router = useRouter();
  const { usuario, actualizarUsuario, guardarToken, logout } = useAuthStore();

  const [form, setForm] = useState(null);
  useEffect(() => {
    if (usuario && !form) {
      setForm({
        nombre: usuario.nombre || '',
        telefono: usuario.telefono || '',
        whatsapp: usuario.whatsapp || '',
        region: usuario.region || '',
      });
    }
  }, [usuario]);
  const set = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));

  const perfilMutation = useMutation({
    mutationFn: () => authService.actualizarPerfil({
      nombre: form.nombre.trim() || undefined,
      telefono: form.telefono.trim() || undefined,
      whatsapp: form.whatsapp.trim() || undefined,
      region: form.region || undefined,
    }),
    onSuccess: (res) => {
      actualizarUsuario(res.data.data.usuario);
      Alert.alert('Listo', 'Perfil actualizado.');
    },
    onError: (err) => Alert.alert('Error', err.mensaje || 'No se pudo actualizar el perfil.'),
  });

  const [passwordForm, setPasswordForm] = useState({ actual: '', nueva: '', confirmar: '' });
  const setPassword = (campo, valor) => setPasswordForm((f) => ({ ...f, [campo]: valor }));

  const passwordMutation = useMutation({
    mutationFn: () => authService.cambiarPassword({
      passwordActual: passwordForm.actual,
      passwordNueva: passwordForm.nueva,
    }),
    onSuccess: async (res) => {
      // El backend invalida los tokens anteriores y entrega uno nuevo para este dispositivo
      await guardarToken(res.data.data.token);
      setPasswordForm({ actual: '', nueva: '', confirmar: '' });
      Alert.alert('Listo', 'Contraseña actualizada. Se cerró la sesión en tus otros dispositivos.');
    },
    onError: (err) => Alert.alert('Error', err.mensaje || 'No se pudo cambiar la contraseña.'),
  });

  const handleCambiarPassword = () => {
    if (!passwordForm.actual || !passwordForm.nueva) {
      Alert.alert('Campos requeridos', 'Ingresa tu contraseña actual y la nueva.');
      return;
    }
    const errorPassword = validarPassword(passwordForm.nueva);
    if (errorPassword) {
      Alert.alert('Contraseña insegura', errorPassword);
      return;
    }
    if (passwordForm.nueva !== passwordForm.confirmar) {
      Alert.alert('No coinciden', 'La confirmación no coincide con la nueva contraseña.');
      return;
    }
    passwordMutation.mutate();
  };

  const confirmarLogout = () => {
    Alert.alert('Cerrar sesión', '¿Seguro que quieres salir?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: logout },
    ]);
  };

  if (!form) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <ScreenHeader title="Mi Perfil" />

      <View style={styles.section}>
        <View style={styles.rowBetween}>
          <Text style={styles.h1}>{usuario.nombre}</Text>
          <Badge text={usuario.plan === 'pro' ? 'PRO' : 'FREE'} color={usuario.plan === 'pro' ? COLORS.secondary : COLORS.gray500} />
        </View>
        <Text style={styles.sub}>{usuario.email}</Text>
        <PrimaryButton
          label={usuario.plan === 'pro' ? 'Ver planes' : 'Actualizar a Pro'}
          variant="outlinePrimary"
          onPress={() => router.push('/(app)/planes')}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Editar datos</Text>
        <FormInput label="Nombre" value={form.nombre} onChangeText={(v) => set('nombre', v)} />
        <FormInput label="Teléfono" keyboardType="phone-pad" value={form.telefono} onChangeText={(v) => set('telefono', v)} />
        <FormInput label="WhatsApp" keyboardType="phone-pad" value={form.whatsapp} onChangeText={(v) => set('whatsapp', v)} />
        <ChipPicker label="Departamento" options={REGIONES_GUATEMALA} value={form.region} onChange={(v) => set('region', v)} />
        <PrimaryButton label="Guardar cambios" onPress={() => perfilMutation.mutate()} loading={perfilMutation.isPending} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Cambiar contraseña</Text>
        <FormInput
          label="Contraseña actual"
          secureTextEntry
          value={passwordForm.actual}
          onChangeText={(v) => setPassword('actual', v)}
        />
        <FormInput
          label="Nueva contraseña"
          secureTextEntry
          value={passwordForm.nueva}
          onChangeText={(v) => setPassword('nueva', v)}
        />
        <FormInput
          label="Confirmar nueva contraseña"
          secureTextEntry
          value={passwordForm.confirmar}
          onChangeText={(v) => setPassword('confirmar', v)}
        />
        <PrimaryButton label="Cambiar contraseña" onPress={handleCambiarPassword} loading={passwordMutation.isPending} />
      </View>

      <View style={styles.section}>
        <PrimaryButton label="Ver tour de la app" variant="outlinePrimary" onPress={() => router.push('/(app)/onboarding')} />
      </View>

      <View style={[styles.section, { borderBottomWidth: 0 }]}>
        <PrimaryButton label="Cerrar sesión" variant="outline" onPress={confirmarLogout} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.gray50 },
  section: { padding: 20, borderBottomWidth: 8, borderBottomColor: COLORS.gray50, backgroundColor: '#fff' },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', color: COLORS.black, marginBottom: 12 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  h1: { fontSize: 20, fontWeight: 'bold', color: COLORS.black },
  sub: { fontSize: 13, color: COLORS.gray600, marginTop: 4 },
});
