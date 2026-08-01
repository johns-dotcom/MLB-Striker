import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { usePins } from '../pinsStore';
import type { BetCategory, Game, GameDetail, Market, Side } from '../types';
import EnvBanner from '../components/EnvBanner';

// Build a descriptive basket label, e.g. "St. Louis vs Toronto · Over 4.5 runs · YES".
function legLabel(gameTitle: string, market: Market, side: Side): string {
  const bet = (side === 'yes' ? market.yesSubTitle : market.noSubTitle) ?? market.title;
  return `${gameTitle} · ${bet} · ${side.toUpperCase()}`;
}

function priceFor(market: Market, side: Side): number {
  const ask = side === 'yes' ? market.yesAsk : market.noAsk;
  return ask && ask >= 1 && ask <= 99 ? ask : 50;
}

/** A YES/NO pair of add buttons for one market. */
function SideButtons({
  market,
  onAdd,
}: {
  market: Market;
  onAdd: (side: Side) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: theme.space(2) }}>
      <TouchableOpacity
        style={[styles.sideBtn, { backgroundColor: theme.colors.yes }]}
        onPress={() => onAdd('yes')}
      >
        <Text style={styles.sideBtnLabel}>YES {priceToPct(market.yesAsk)}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.sideBtn, { backgroundColor: theme.colors.no }]}
        onPress={() => onAdd('no')}
      >
        <Text style={styles.sideBtnLabel}>NO {priceToPct(market.noAsk)}</Text>
      </TouchableOpacity>
    </View>
  );
}

function CategoryBlock({
  category,
  gameTitle,
  onAdd,
}: {
  category: BetCategory;
  gameTitle: string;
  onAdd: (market: Market, side: Side) => void;
}) {
  return (
    <View style={styles.category}>
      <Text style={styles.categoryLabel}>{category.label}</Text>
      {category.markets.map((m) => (
        <View key={m.ticker} style={styles.betRow}>
          <Text style={styles.betLabel} numberOfLines={2}>
            {m.yesSubTitle ?? m.title}
          </Text>
          <SideButtons market={m} onAdd={(side) => onAdd(m, side)} />
        </View>
      ))}
    </View>
  );
}

function GameCard({ game }: { game: Game }) {
  const addLeg = useBasket((s) => s.addLeg);
  const { isPinned, toggle } = usePins();
  const pinned = isPinned(game.gameCode);

  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<GameDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function add(market: Market, side: Side) {
    addLeg({
      ticker: market.ticker,
      label: legLabel(game.title, market, side),
      action: 'buy',
      side,
      count: 1,
      price: priceFor(market, side),
    });
  }

  async function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next && !detail) {
      setLoading(true);
      setError(null);
      try {
        setDetail(await api.gameDetail(game.gameCode));
      } catch (e) {
        setError(e instanceof ApiError ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    }
  }

  // In the expanded view, skip "winner" — it's already the moneyline row up top.
  const extraCategories = detail?.categories.filter((c) => c.key !== 'winner') ?? [];

  return (
    <View style={[styles.card, pinned && styles.cardPinned]}>
      <View style={styles.cardHeader}>
        <TouchableOpacity onPress={() => toggle(game.gameCode)} hitSlop={10}>
          <Text style={[styles.pin, pinned && styles.pinActive]}>{pinned ? '📌' : '📍'}</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.gameTitle}>{game.title}</Text>
          {game.subtitle ? <Text style={styles.gameSub}>{game.subtitle}</Text> : null}
        </View>
      </View>

      {/* Moneyline quick row */}
      {game.markets.map((m) => (
        <View key={m.ticker} style={styles.betRow}>
          <Text style={styles.betLabel} numberOfLines={1}>
            {m.yesSubTitle ?? m.title}
          </Text>
          <SideButtons market={m} onAdd={(side) => add(m, side)} />
        </View>
      ))}

      <TouchableOpacity style={styles.moreBtn} onPress={toggleOpen}>
        <Text style={styles.moreBtnText}>
          {open ? 'Hide bets ▲' : 'All bets (totals, YRFI, spread…) ▼'}
        </Text>
      </TouchableOpacity>

      {open && (
        <View style={{ gap: theme.space(2) }}>
          {loading && <ActivityIndicator color={theme.colors.accent} />}
          {error && <Text style={styles.error}>{error}</Text>}
          {!loading && !error && extraCategories.length === 0 && detail && (
            <Text style={styles.dim}>No additional bet types open for this game yet.</Text>
          )}
          {extraCategories.map((c) => (
            <CategoryBlock key={c.key} category={c} gameTitle={game.title} onAdd={add} />
          ))}
        </View>
      )}
    </View>
  );
}

export default function GamesScreen() {
  const [games, setGames] = useState<Game[]>([]);
  const [env, setEnv] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pinned = usePins((s) => s.pinned);

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

  // Pinned games first (in pin order), then the rest in feed order.
  const ordered = useMemo(() => {
    const pinnedGames = pinned
      .map((code) => games.find((g) => g.gameCode === code))
      .filter((g): g is Game => !!g);
    const rest = games.filter((g) => !pinned.includes(g.gameCode));
    return [...pinnedGames, ...rest];
  }, [games, pinned]);

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
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={load} tintColor={theme.colors.textDim} />
        }
      >
        {error && <Text style={styles.error}>{error}</Text>}
        {!error && ordered.length === 0 && (
          <Text style={styles.dim}>
            No open MLB games right now. Pull to refresh.
          </Text>
        )}
        {ordered.map((game) => (
          <GameCard key={game.eventTicker} game={game} />
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
  cardPinned: { borderColor: theme.colors.accent },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.space(2) },
  pin: { fontSize: 20, opacity: 0.5 },
  pinActive: { opacity: 1 },
  gameTitle: { color: theme.colors.text, fontSize: 16, fontWeight: '700' },
  gameSub: { color: theme.colors.textDim, fontSize: 13 },
  betRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space(2),
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.space(2),
  },
  betLabel: { color: theme.colors.text, fontSize: 13, fontWeight: '600', flex: 1 },
  sideBtn: {
    paddingHorizontal: theme.space(3),
    paddingVertical: theme.space(2),
    borderRadius: theme.radius.md,
    minWidth: 72,
    alignItems: 'center',
  },
  sideBtnLabel: { color: '#fff', fontWeight: '700', fontSize: 12 },
  moreBtn: {
    marginTop: theme.space(1),
    paddingVertical: theme.space(2),
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.md,
  },
  moreBtnText: { color: theme.colors.textDim, fontWeight: '700', fontSize: 13 },
  category: { gap: theme.space(1), marginTop: theme.space(1) },
  categoryLabel: {
    color: theme.colors.accent,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  error: { color: theme.colors.danger, fontSize: 14 },
  dim: { color: theme.colors.textDim, fontSize: 14, lineHeight: 20 },
});
