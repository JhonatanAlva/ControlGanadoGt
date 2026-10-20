// app/(auth)/login.jsx
import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView, Alert, StyleSheet,
} from 'react-native';
import { Link } from 'expo-router';
import useAuthStore from '../../stores/authStore';
import { COLORS } from '../../constants/colors';

export default function LoginScreen() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const { login, limpiarError } = useAuthStore();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Campos requeridos', 'Ingresa tu email y contraseña.');
      return;
    }
    setLoading(true);
    limpiarError();
    const ok = await login(email.trim().toLowerCase(), password);
    setLoading(false);
    if (!ok) Alert.alert('Error', useAuthStore.getState().error || 'No se pudo iniciar sesión.');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">

        {/* Header verde */}
        <View style={styles.header}>
          <Text style={styles.emoji}>🐄</Text>
          <Text style={styles.appName}>GanaderíaGT</Text>
          <Text style={styles.appSub}>Control Ganadero</Text>
        </View>

        {/* Formulario */}
        <View style={styles.form}>
          <Text style={styles.title}>¡Bienvenido de vuelta!</Text>

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="tu@email.com"
            placeholderTextColor={COLORS.gray500}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.label}>Contraseña</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••"
            placeholderTextColor={COLORS.gray500}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <Link href="/(auth)/recuperar" style={styles.olvide}>
            <Text style={styles.link}>¿Olvidaste tu contraseña?</Text>
          </Link>

          <TouchableOpacity
            style={[styles.btn, loading && { opacity: 0.7 }]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>Ingresar</Text>
            }
          </TouchableOpacity>

          <View style={styles.row}>
            <Text style={styles.grayText}>¿No tienes cuenta? </Text>
            <Link href="/(auth)/registro">
              <Text style={styles.link}>Regístrate</Text>
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
    paddingBottom: 40,
  },
  emoji:   { fontSize: 40, marginBottom: 4 },
  appName: { color: '#fff', fontSize: 26, fontWeight: 'bold' },
  appSub:  { color: '#a7d7b0', fontSize: 14, marginTop: 2 },
  form:    { flex: 1, paddingHorizontal: 24, paddingTop: 32 },
  title:   { fontSize: 20, fontWeight: 'bold', color: COLORS.black, marginBottom: 24 },
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
  btn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  btnText:  { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  row:      { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  grayText: { color: COLORS.gray500, fontSize: 14 },
  link:     { color: COLORS.primary, fontWeight: '600', fontSize: 14 },
  olvide:   { alignSelf: 'flex-end', marginTop: -6, marginBottom: 8 },
});