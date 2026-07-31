import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, ApiError } from '../api';
import { theme } from '../theme';
import { centsToUsd } from '../format';
import EnvBanner from '../components/EnvBanner';

interface Position {
  ticker: string;
  position: number;
  realized_pnl: number;
}

export default function PortfolioScreen() {
  const [env, setEnv] = useState('');
  const [balanceCents, setBalanceCents] = useState<number | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [bal, pos] = await Promise.all([api.balance(), api.positions()]);
      setBalanceCents(bal.balanceCents);
      setEnv(bal.env);
      setPositions(pos.positions.filter((p) => p.position !== 0));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <SafeAreaView style={styles.center} edges={['bottom']}>
        <ActivityIndicator color={theme.colors.accent} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <EnvBanner env={env} />
      <ScrollView
        contentContainerStyle={{ padding: theme.space(3), gap: theme.space(3) }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={theme.colors.textDim} />}
      >
        {error && <Text style={styles.error}>{error}</Text>}

        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Available balance</Text>
          <Text style={styles.balanceValue}>{centsToUsd(balanceCents)}</Text>
        </View>

        <Text style={styles.sectionTitle}>Open positions</Text>
        {positions.length === 0 && <Text style={styles.empty}>No open positions.</Text>}
        {positions.map((p) => (
          <View key={p.ticker} style={styles.posRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.posTicker}>{p.ticker}</Text>
              <Text style={styles.posMeta}>
                {p.position > 0 ? `${p.position} contracts` : `${Math.abs(p.position)} short`}
              </Text>
            </View>
            <Text
              style={[
                styles.posPnl,
                { color: p.realized_pnl >= 0 ? theme.colors.yes : theme.colors.danger },
              ]}
            >
              {centsToUsd(p.realized_pnl)}
            </Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.bg },
  error: { color: theme.colors.danger, fontSize: 14 },
  balanceCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.space(4),
    alignItems: 'center',
  },
  balanceLabel: { color: theme.colors.textDim, fontSize: 13 },
  balanceValue: { color: theme.colors.text, fontSize: 34, fontWeight: '800', marginTop: theme.space(1) },
  sectionTitle: { color: theme.colors.text, fontSize: 15, fontWeight: '700' },
  empty: { color: theme.colors.textDim, fontSize: 14 },
  posRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.space(3),
  },
  posTicker: { color: theme.colors.text, fontSize: 14, fontWeight: '600' },
  posMeta: { color: theme.colors.textDim, fontSize: 12, marginTop: 2 },
  posPnl: { fontSize: 15, fontWeight: '700' },
});
