import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, ApiError } from '../api';
import { theme } from '../theme';
import { useBasket } from '../store';
import { usePins } from '../pinsStore';
import type { BetCategory, Game, GameDetail, Market, Side } from '../types';
import EnvBanner from '../components/EnvBanner';

// Centered column width so the app doesn't sprawl across wide desktop screens.
const MAXW = 780;

function legLabel(gameTitle: string, market: Market, side: Side): string {
  const bet = (side === 'yes' ? market.yesSubTitle : market.noSubTitle) ?? market.title;
  return `${gameTitle} · ${bet} · ${side.toUpperCase()}`;
}

function priceFor(market: Market, side: Side): number {
  const ask = side === 'yes' ? market.yesAsk : market.noAsk;
  return ask && ask >= 1 && ask <= 99 ? ask : 50;
}

function priceChip(ask?: number | null): string {
  return ask && ask >= 1 && ask <= 99 ? `${ask}¢` : '—';
}

function SideButtons({ market, onAdd }: { market: Market; onAdd: (side: Side) => void }) {
  return (
    <View style={styles.sides}>
      <TouchableOpacity style={[styles.sideBtn, styles.yesBtn]} onPress={() => onAdd('yes')}>
        <Text style={styles.sideSide}>YES</Text>
        <Text style={styles.sidePrice}>{priceChip(market.yesAsk)}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.sideBtn, styles.noBtn]} onPress={() => onAdd('no')}>
        <Text style={styles.sideSide}>NO</Text>
        <Text style={styles.sidePrice}>{priceChip(market.noAsk)}</Text>
      </TouchableOpacity>
    </View>
  );
}

function BetRow({
  label,
  market,
  onAdd,
}: {
  label: string;
  market: Market;
  onAdd: (side: Side) => void;
}) {
  return (
    <View style={styles.betRow}>
      <Text style={styles.betLabel} numberOfLines={2}>
        {label}
      </Text>
      <SideButtons market={market} onAdd={onAdd} />
    </View>
  );
}

function CategoryBlock({
  category,
  onAdd,
}: {
  category: BetCategory;
  onAdd: (market: Market, side: Side) => void;
}) {
  return (
    <View style={styles.category}>
      <Text style={styles.categoryLabel}>{category.label}</Text>
      {category.markets.map((m) => (
        <BetRow
          key={m.ticker}
          label={m.yesSubTitle ?? m.title}
          market={m}
          onAdd={(side) => onAdd(m, side)}
        />
      ))}
    </View>
  );
}

function GameCard({ game, sport }: { game: Game; sport: string }) {
  const addLeg = useBasket((s) => s.addLeg);
  const { isPinned, toggle } = usePins();
  const pinned = isPinned(game.eventTicker);

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
        setDetail(await api.gameDetail(sport, game.gameCode));
      } catch (e) {
        setError(e instanceof ApiError ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    }
  }

  const extraCategories = detail?.categories.filter((c) => c.key !== 'winner') ?? [];

  return (
    <View style={[styles.card, pinned && styles.cardPinned]}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.gameTitle}>{game.title}</Text>
          {game.subtitle ? <Text style={styles.gameSub}>{game.subtitle}</Text> : null}
        </View>
        <TouchableOpacity onPress={() => toggle(game.eventTicker)} hitSlop={10} style={styles.pinBtn}>
          <Text style={[styles.pin, pinned && styles.pinActive]}>{pinned ? '★' : '☆'}</Text>
        </TouchableOpacity>
      </View>

      {game.markets.map((m) => (
        <BetRow
          key={m.ticker}
          label={m.yesSubTitle ?? m.title}
          market={m}
          onAdd={(side) => add(m, side)}
        />
      ))}

      <TouchableOpacity style={styles.moreBtn} onPress={toggleOpen} activeOpacity={0.7}>
        <Text style={styles.moreBtnText}>{open ? 'Hide bets  ▲' : 'All bets  ▼'}</Text>
      </TouchableOpacity>

      {open && (
        <View style={{ gap: theme.space(2) }}>
          {loading && <ActivityIndicator color={theme.colors.accent} />}
          {error && <Text style={styles.error}>{error}</Text>}
          {!loading && !error && extraCategories.length === 0 && detail && (
            <Text style={styles.dim}>No additional bet types open for this game yet.</Text>
          )}
          {extraCategories.map((c) => (
            <CategoryBlock key={c.key} category={c} onAdd={add} />
          ))}
        </View>
      )}
    </View>
  );
}

export default function GamesScreen() {
  const [sports, setSports] = useState<{ key: string; label: string }[]>([]);
  const [sport, setSport] = useState<string>('');
  const [games, setGames] = useState<Game[]>([]);
  const [env, setEnv] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const pinned = usePins((s) => s.pinned);

  useEffect(() => {
    api
      .sports()
      .then((d) => {
        setSports(d.sports);
        setSport((cur) => cur || d.sports[0]?.key || '');
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : String(e)));
  }, []);

  const load = useCallback(async () => {
    if (!sport) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.games(sport);
      setGames(data.games);
      setEnv(data.env);
    } catch (e) {
      setGames([]);
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [sport]);

  useEffect(() => {
    load();
  }, [load]);

  const ordered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? games.filter((g) => `${g.title} ${g.subtitle ?? ''}`.toLowerCase().includes(q))
      : games;
    const pins = filtered.filter((g) => pinned.includes(g.eventTicker));
    const rest = filtered.filter((g) => !pinned.includes(g.eventTicker));
    pins.sort((a, b) => pinned.indexOf(a.eventTicker) - pinned.indexOf(b.eventTicker));
    return [...pins, ...rest];
  }, [games, pinned, query]);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <EnvBanner env={env} />

      <View style={styles.controls}>
        <View style={styles.tabs}>
          {sports.map((s) => (
            <TouchableOpacity
              key={s.key}
              style={[styles.tab, sport === s.key && styles.tabActive]}
              onPress={() => setSport(s.key)}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, sport === s.key && styles.tabTextActive]}>
                {s.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TextInput
          style={styles.search}
          placeholder="Search teams…"
          placeholderTextColor={theme.colors.textDim}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.accent} size="large" />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={load} tintColor={theme.colors.textDim} />
          }
        >
          {error && <Text style={styles.error}>{error}</Text>}
          {!error && ordered.length === 0 && (
            <Text style={styles.dim}>
              {query
                ? 'No games match your search.'
                : 'No open games for this sport right now (it may be off-season). Pull to refresh.'}
            </Text>
          )}
          {ordered.map((game) => (
            <GameCard key={game.eventTicker} game={game} sport={sport} />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Centered control bar (tabs + search)
  controls: {
    width: '100%',
    maxWidth: MAXW,
    alignSelf: 'center',
    paddingHorizontal: theme.space(4),
    paddingTop: theme.space(4),
    gap: theme.space(3),
  },
  tabs: { flexDirection: 'row', gap: theme.space(2) },
  tab: {
    flex: 1,
    paddingVertical: theme.space(2),
    borderRadius: 10,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  tabActive: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  tabText: { color: theme.colors.textDim, fontWeight: '700', fontSize: 14, letterSpacing: 0.3 },
  tabTextActive: { color: '#fff' },
  search: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    color: theme.colors.text,
    paddingHorizontal: theme.space(4),
    paddingVertical: theme.space(3),
    fontSize: 15,
  },

  scrollContent: {
    width: '100%',
    maxWidth: MAXW,
    alignSelf: 'center',
    padding: theme.space(4),
    gap: theme.space(3),
  },

  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.space(4),
    gap: theme.space(1),
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
  },
  cardPinned: { borderColor: theme.colors.accent },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingBottom: theme.space(2),
  },
  pinBtn: { paddingLeft: theme.space(2) },
  pin: { fontSize: 20, color: theme.colors.textDim },
  pinActive: { color: theme.colors.warn },
  gameTitle: { color: theme.colors.text, fontSize: 16, fontWeight: '700' },
  gameSub: { color: theme.colors.textDim, fontSize: 12, marginTop: 2 },

  betRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space(3),
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingVertical: theme.space(2),
  },
  betLabel: { color: theme.colors.text, fontSize: 14, fontWeight: '500', flex: 1 },

  sides: { flexDirection: 'row', gap: theme.space(2) },
  sideBtn: {
    width: 66,
    paddingVertical: theme.space(1),
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yesBtn: { backgroundColor: theme.colors.yes },
  noBtn: { backgroundColor: theme.colors.no },
  sideSide: { color: '#fff', fontWeight: '800', fontSize: 12, letterSpacing: 0.5 },
  sidePrice: { color: 'rgba(255,255,255,0.9)', fontWeight: '600', fontSize: 12, marginTop: 1 },

  moreBtn: {
    marginTop: theme.space(2),
    paddingVertical: theme.space(2),
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  moreBtnText: { color: theme.colors.accent, fontWeight: '700', fontSize: 13, letterSpacing: 0.3 },

  category: { gap: theme.space(1), marginTop: theme.space(2) },
  categoryLabel: {
    color: theme.colors.textDim,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  error: { color: theme.colors.danger, fontSize: 14 },
  dim: { color: theme.colors.textDim, fontSize: 14, lineHeight: 20 },
});
