// ─── LoginScreen.tsx ──────────────────────────────────────────────────────────
// Pantalla de login del conductor. Usa Supabase Auth con MMKV como storage.
// Tras login exitoso el JWT queda en MMKV y RootNavigator redirige al tracking.

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '@lib/supabase';

export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Campos requeridos', 'Ingresa tu correo y contraseña.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    setLoading(false);

    if (error) {
      Alert.alert(
        'Error de acceso',
        error.message === 'Invalid login credentials'
          ? 'Correo o contraseña incorrectos.'
          : error.message,
      );
    }
    // Si no hay error, Supabase guarda la sesión en MMKV y
    // el listener onAuthStateChange en RootNavigator redirige automáticamente.
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="light" />

      {/* Logo / Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>⬡</Text>
        <Text style={styles.title}>ZonaZero</Text>
        <Text style={styles.subtitle}>Portal del Conductor</Text>
      </View>

      {/* Formulario */}
      <View style={styles.form}>
        <Text style={styles.label}>Correo electrónico</Text>
        <TextInput
          style={styles.input}
          placeholder="conductor@empresa.com"
          placeholderTextColor="#4A4A6A"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!loading}
          accessibilityLabel="Campo de correo electrónico"
        />

        <Text style={styles.label}>Contraseña</Text>
        <TextInput
          style={styles.input}
          placeholder="••••••••"
          placeholderTextColor="#4A4A6A"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          editable={!loading}
          accessibilityLabel="Campo de contraseña"
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
          accessibilityLabel="Botón iniciar sesión"
          accessibilityRole="button"
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Iniciar sesión</Text>
          )}
        </TouchableOpacity>
      </View>

      <Text style={styles.footer}>
        ¿Necesitas acceso? Contacta a tu supervisor.
      </Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logo: {
    fontSize: 64,
    color: '#6C63FF',
    marginBottom: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 14,
    color: '#8888AA',
    marginTop: 4,
    letterSpacing: 1,
  },
  form: {
    gap: 8,
  },
  label: {
    fontSize: 13,
    color: '#8888AA',
    marginBottom: 4,
    marginTop: 12,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#12121C',
    borderWidth: 1,
    borderColor: '#2A2A3F',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#FFFFFF',
  },
  button: {
    backgroundColor: '#6C63FF',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginTop: 24,
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  footer: {
    textAlign: 'center',
    color: '#4A4A6A',
    fontSize: 12,
    marginTop: 40,
    lineHeight: 18,
  },
});
