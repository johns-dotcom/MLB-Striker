import { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, ApiError, apiEnvBase } from '../api';
import { useAuth } from '../authStore';
import { theme } from '../theme';

export default function SettingsScreen() {
  const logout = useAuth((s) => s.logout);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit() {
    setMsg(null);
    if (next !== confirm) {
      setMsg({ ok: false, text: 'New passwords do not match.' });
      return;
    }
    if (next.trim().length < 6) {
      setMsg({ ok: false, text: 'New password must be at least 6 characters.' });
      return;
    }
    setBusy(true);
    try {
      await api.changePassword(current.trim(), next.trim());
      setMsg({ ok: true, text: 'Password changed. Use it next time you log in.' });
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (e) {
      setMsg({ ok: false, text: e instanceof ApiError ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: theme.space(4), gap: theme.space(3) }}>
        <Text style={styles.section}>Change login password</Text>

        <TextInput
          style={styles.input}
          placeholder="Current password"
          placeholderTextColor={theme.colors.textDim}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          value={current}
          onChangeText={setCurrent}
        />
        <TextInput
          style={styles.input}
          placeholder="New password (min 6 chars)"
          placeholderTextColor={theme.colors.textDim}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          value={next}
          onChangeText={setNext}
        />
        <TextInput
          style={styles.input}
          placeholder="Confirm new password"
          placeholderTextColor={theme.colors.textDim}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          value={confirm}
          onChangeText={setConfirm}
          onSubmitEditing={submit}
          returnKeyType="go"
        />

        {msg && (
          <Text style={[styles.msg, { color: msg.ok ? theme.colors.yes : theme.colors.danger }]}>
            {msg.text}
          </Text>
        )}

        <TouchableOpacity
          style={[styles.button, busy && { opacity: 0.5 }]}
          onPress={submit}
          disabled={busy}
        >
          <Text style={styles.buttonText}>{busy ? 'Saving…' : 'Change password'}</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity style={styles.logout} onPress={logout}>
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>

        <Text style={styles.meta}>Backend: {apiEnvBase}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  section: { color: theme.colors.text, fontSize: 18, fontWeight: '800' },
  input: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    color: theme.colors.text,
    paddingHorizontal: theme.space(4),
    paddingVertical: theme.space(3),
    fontSize: 16,
  },
  msg: { fontSize: 14 },
  button: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.md,
    paddingVertical: theme.space(4),
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  divider: { height: 1, backgroundColor: theme.colors.border, marginVertical: theme.space(2) },
  logout: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingVertical: theme.space(3),
    alignItems: 'center',
  },
  logoutText: { color: theme.colors.textDim, fontWeight: '700', fontSize: 15 },
  meta: { color: theme.colors.textDim, fontSize: 11, textAlign: 'center', marginTop: theme.space(2) },
});
