import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, ApiError } from '../api';
import { theme } from '../theme';
import { priceToPct } from '../format';
import { useBasket } from '../store';
import type { Game, Market, Side } from '../types';
import EnvBanner from '../components/EnvBanner';

export default function GamesScreen() {
  const [games, setGames] = useState<Game[]>([]);
  const [env, setEnv] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const addLeg = useBasket((s) => s.addLeg);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await api.games();
      setGames(data.games);
      setEnv(data.env);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function addToBasket(game: Game, market: Market, side: Side) {
    // Default to buying at the current ask; the user can tune price/count in the basket.
    const price = side === 'yes' ? market.yesAsk : market.noAsk;
    const subtitle = side === 'yes' ? market.yesSubTitle : market.noSubTitle;
    addLeg({
      ticker: market.ticker,
      label: `${subtitle ?? market.title} — ${side.toUpperCase()}`,
      action: 'buy',
      side,
      count: 1,
      price: price && price >= 1 && price <= 99 ? price : 50,
    });
  }

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
        {!error && games.length === 0 && (
          <Text style={styles.empty}>
            No open MLB games right now. Pull to refresh, or check the series ticker
            (KALSHI_MLB_SERIES_TICKER) on the backend.
          </Text>
        )}
        {games.map((game) => (
          <View key={game.eventTicker} style={styles.card}>
            <Text style={styles.gameTitle}>{game.title}</Text>
            {game.subtitle ? <Text style={styles.gameSub}>{game.subtitle}</Text> : null}
            {game.markets.map((m) => (
              <View key={m.ticker} style={styles.marketRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.marketTitle}>{m.title}</Text>
                  <Text style={styles.marketMeta}>
                    Vol {m.volume ?? 0} · last {priceToPct(m.lastPrice)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.sideBtn, { backgroundColor: theme.colors.yes }]}
                  onPress={() => addToBasket(game, m, 'yes')}
                >
                  <Text style={styles.sideBtnLabel}>YES {priceToPct(m.yesAsk)}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sideBtn, { backgroundColor: theme.colors.no }]}
                  onPress={() => addToBasket(game, m, 'no')}
                >
                  <Text style={styles.sideBtnLabel}>NO {priceToPct(m.noAsk)}</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.bg },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.space(3),
    gap: theme.space(2),
  },
  gameTitle: { color: theme.colors.text, fontSize: 16, fontWeight: '700' },
  gameSub: { color: theme.colors.textDim, fontSize: 13 },
  marketRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space(2),
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.space(2),
  },
  marketTitle: { color: theme.colors.text, fontSize: 14, fontWeight: '600' },
  marketMeta: { color: theme.colors.textDim, fontSize: 12, marginTop: 2 },
  sideBtn: {
    paddingHorizontal: theme.space(3),
    paddingVertical: theme.space(2),
    borderRadius: theme.radius.md,
    minWidth: 74,
    alignItems: 'center',
  },
  sideBtnLabel: { color: '#fff', fontWeight: '700', fontSize: 12 },
  error: { color: theme.colors.danger, fontSize: 14 },
  empty: { color: theme.colors.textDim, fontSize: 14, lineHeight: 20 },
});
