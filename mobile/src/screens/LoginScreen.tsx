import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { login as apiLogin, ApiError } from '../api';
import { useAuth } from '../authStore';
import { theme } from '../theme';

export default function LoginScreen() {
  const setToken = useAuth((s) => s.setToken);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!password || busy) return;
    setBusy(true);
    setError(null);
    try {
      // Trim — mobile keyboards/autofill often add a trailing space.
      const token = await apiLogin(password.trim());
      setToken(token);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.center}
      >
        <Text style={styles.logo}>⚾ MLB Striker</Text>
        <Text style={styles.sub}>Enter the access password to continue</Text>

        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={theme.colors.textDim}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={submit}
          returnKeyType="go"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.button, (!password || busy) && { opacity: 0.5 }]}
          onPress={submit}
          disabled={!password || busy}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Log in</Text>
          )}
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.space(6),
    gap: theme.space(3),
  },
  logo: { color: theme.colors.text, fontSize: 28, fontWeight: '800' },
  sub: { color: theme.colors.textDim, fontSize: 14, marginBottom: theme.space(2) },
  input: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    color: theme.colors.text,
    paddingHorizontal: theme.space(4),
    paddingVertical: theme.space(3),
    fontSize: 16,
  },
  button: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.md,
    paddingVertical: theme.space(4),
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  error: { color: theme.colors.danger, fontSize: 14 },
});
