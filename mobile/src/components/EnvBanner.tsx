import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme';

/** Loud, persistent reminder of which Kalshi environment orders will hit. */
export default function EnvBanner({ env }: { env: string }) {
  if (!env) return null;
  const live = env === 'prod';
  return (
    <View style={[styles.banner, { backgroundColor: live ? theme.colors.danger : theme.colors.accent }]}>
      <Text style={styles.text}>
        {live ? '🔴 LIVE — REAL MONEY' : '🟢 DEMO — sandbox money'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { paddingVertical: 6, alignItems: 'center' },
  text: { color: '#fff', fontWeight: '800', fontSize: 12, letterSpacing: 0.5 },
});
