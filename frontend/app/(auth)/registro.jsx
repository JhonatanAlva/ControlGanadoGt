// app/(auth)/registro.jsx
import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView, Alert, StyleSheet,
} from 'react-native';
import { Link } from 'expo-router';
import useAuthStore from '../../stores/authStore';
import { COLORS } from '../../constants/colors';
import { REGIONES_GUATEMALA as REGIONES } from '../../constants/enums';
import { validarPassword } from '../../utils/password';

export default function RegistroScreen() {
  const [form, setForm] = useState({
    nombre: '', email: '', password: '', telefono: '', region: 'Jutiapa',
  });
  const [loading, setLoading] = useState(false);
  const { registro, error, limpiarError } = useAuthStore();

  const set = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));

  const handleRegistro = async () => {
    if (!form.nombre || !form.email || !form.password) {
      Alert.alert('Campos requeridos', 'Nombre, email y contraseña son obligatorios.');
      return;
    }
    const errorPassword = validarPassword(form.password);
    if (errorPassword) {
      Alert.alert('Contraseña insegura', errorPassword);
      return;
    }
    setLoading(true);
    limpiarError();
    const ok = await registro(form);
    setLoading(false);
    if (!ok) Alert.alert('Error', useAuthStore.getState().error || 'No se pudo crear la cuenta.');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">

        <View style={styles.header}>
          <Text style={styles.emoji}>🐄</Text>
          <Text style={styles.appName}>Crear cuenta</Text>
          <Text style={styles.appSub}>GanaderíaGT</Text>
        </View>

        <View style={styles.form}>
          {[
            { label: 'Nombre completo', campo: 'nombre',   placeholder: 'Juan Pérez',   keyboard: 'default' },
            { label: 'Email',           campo: 'email',    placeholder: 'tu@email.com', keyboard: 'email-address' },
            { label: 'Contraseña',      campo: 'password', placeholder: '••••••',       keyboard: 'default', secure: true },
            { label: 'Teléfono',        campo: 'telefono', placeholder: '502...',        keyboard: 'phone-pad' },
          ].map(({ label, campo, placeholder, keyboard, secure }) => (
            <View key={campo}>
              <Text style={styles.label}>{label}</Text>
              <TextInput
                style={styles.input}
                placeholder={placeholder}
                placeholderTextColor={COLORS.gray500}
                value={form[campo]}
                onChangeText={(v) => set(campo, v)}
                keyboardType={keyboard}
                autoCapitalize={campo === 'email' ? 'none' : 'sentences'}
                secureTextEntry={!!secure}
              />
            </View>
          ))}

          <Text style={styles.label}>Departamento</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 24 }}>
            {REGIONES.map((r) => (
              <TouchableOpacity
                key={r}
                onPress={() => set('region', r)}
                style={[styles.chip, form.region === r && styles.chipActive]}
              >
                <Text style={[styles.chipText, form.region === r && styles.chipTextActive]}>
                  {r}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity
            style={[styles.btn, loading && { opacity: 0.7 }]}
            onPress={handleRegistro}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>Crear cuenta</Text>
            }
          </TouchableOpacity>

          <View style={styles.row}>
            <Text style={styles.grayText}>¿Ya tienes cuenta? </Text>
            <Link href="/(auth)/login">
              <Text style={styles.link}>Inicia sesión</Text>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingTop: 64,
    paddingBottom: 32,
  },
  emoji:   { fontSize: 40, marginBottom: 4 },
  appName: { color: '#fff', fontSize: 26, fontWeight: 'bold' },
  appSub:  { color: '#a7d7b0', fontSize: 14, marginTop: 2 },
  form:    { flex: 1, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 32 },
  label:   { fontSize: 13, color: COLORS.gray600, fontWeight: '500', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.gray300,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.black,
    backgroundColor: COLORS.gray50,
    marginBottom: 16,
  },
  chip: {
    borderWidth: 1,
    borderColor: COLORS.gray300,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    backgroundColor: '#fff',
  },
  chipActive:     { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText:       { fontSize: 12, color: COLORS.gray600 },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  btn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnText:  { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  row:      { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  grayText: { color: COLORS.gray500, fontSize: 14 },
  link:     { color: COLORS.primary, fontWeight: '600', fontSize: 14 },
});