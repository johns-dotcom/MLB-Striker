import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Platform,
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
import { usd } from '../format';
import { useBasket } from '../store';
import type { BasketLeg, Side, StrikeResult } from '../types';

const MAXW = 780;
const DEFAULT_LIMIT = 99;

type PriceMap = Record<
  string,
  { yesBid?: number; yesAsk?: number; noBid?: number; noAsk?: number; lastPrice?: number }
>;

/** A numeric field with typed entry plus − / + steppers. */
function NumberField({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    setText(String(value));
  }, [value]);

  const clamp = (n: number) => Math.max(min, Math.min(max, n));

  return (
    <View style={styles.numField}>
      <TouchableOpacity style={styles.stepBtn} onPress={() => onChange(clamp(value - 1))}>
        <Text style={styles.stepBtnText}>−</Text>
      </TouchableOpacity>
      <TextInput
        style={styles.numInput}
        value={text}
        keyboardType="number-pad"
        selectTextOnFocus
        onChangeText={(t) => {
          const clean = t.replace(/[^0-9]/g, '');
          setText(clean);
          const n = parseInt(clean, 10);
          if (!Number.isNaN(n)) onChange(clamp(n));
        }}
        onBlur={() => setText(String(value))}
      />
      <TouchableOpacity style={styles.stepBtn} onPress={() => onChange(clamp(value + 1))}>
        <Text style={styles.stepBtnText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

function LegCard({ leg, prices }: { leg: BasketLeg; prices: PriceMap }) {
  const { updateLeg, removeLeg } = useBasket();
  const risk = (leg.price * leg.count) / 100;

  const p = prices[leg.ticker];
  const bid = leg.side === 'yes' ? p?.yesBid : p?.noBid;
  const ask = leg.side === 'yes' ? p?.yesAsk : p?.noAsk;
  const mkt =
    bid || ask ? `mkt ${bid ?? '—'}–${ask ?? '—'}¢` : 'mkt —'; // current bid–ask for this side

  function flip(side: Side) {
    if (side === leg.side) return;
    const base = leg.label.replace(/ · (YES|NO)$/, '');
    // Reset to the 99¢ default limit whenever the side flips.
    updateLeg(leg.id, { side, price: DEFAULT_LIMIT, label: `${base} · ${side.toUpperCase()}` });
  }

  return (
    <View style={styles.leg}>
      <View style={styles.legHeader}>
        <Text style={styles.legLabel}>{leg.label}</Text>
        <TouchableOpacity onPress={() => removeLeg(leg.id)} hitSlop={8}>
          <Text style={styles.remove}>✕</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.sideToggle}>
        {(['yes', 'no'] as const).map((s) => (
          <TouchableOpacity
            key={s}
            style={[
              styles.toggleBtn,
              leg.side === s && { backgroundColor: s === 'yes' ? theme.colors.yes : theme.colors.no },
            ]}
            onPress={() => flip(s)}
          >
            <Text style={[styles.toggleText, leg.side === s && styles.toggleTextActive]}>
              {s.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
        <Text style={styles.mkt}>{mkt}</Text>
      </View>

      <View style={styles.fieldRow}>
        <Text style={styles.fieldLabel}>Contracts</Text>
        <NumberField
          value={leg.count}
          min={1}
          max={1000000}
          onChange={(n) => updateLeg(leg.id, { count: n })}
        />
      </View>
      <View style={styles.fieldRow}>
        <Text style={styles.fieldLabel}>Limit price (¢)</Text>
        <NumberField
          value={leg.price}
          min={1}
          max={99}
          onChange={(n) => updateLeg(leg.id, { price: n })}
        />
      </View>

      <Text style={styles.legRisk}>Buy · limit · risk {usd(risk)}</Text>
    </View>
  );
}

export default function BasketScreen() {
  const { legs, clear, totalRiskUsd } = useBasket();
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<StrikeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prices, setPrices] = useState<PriceMap>({});

  const tickerKey = legs.map((l) => l.ticker).join(',');
  const refreshPrices = useCallback(async () => {
    const tickers = [...new Set(legs.map((l) => l.ticker))];
    if (tickers.length === 0) {
      setPrices({});
      return;
    }
    try {
      const { prices } = await api.prices(tickers);
      setPrices(prices);
    } catch {
      /* leave prices as-is on failure */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickerKey]);

  useEffect(() => {
    refreshPrices();
  }, [refreshPrices]);

  async function doStrike() {
    setSubmitting(true);
    setResult(null);
    setError(null);
    try {
      const h = await api.health();
      const res = await api.strike(legs, h.env);
      setResult(res);
      if (res.status === 'submitted') clear();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  function confirmStrike() {
    if (legs.length === 0) return;
    const message = `Submit ${legs.length} buy limit order${legs.length > 1 ? 's' : ''} — total risk ${usd(totalRiskUsd())}.`;
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(`Strike basket?\n\n${message}`)) doStrike();
      return;
    }
    Alert.alert('Strike basket?', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Strike', style: 'destructive', onPress: doStrike },
    ]);
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {legs.length > 0 && (
          <TouchableOpacity style={styles.refresh} onPress={refreshPrices}>
            <Text style={styles.refreshText}>↻ Refresh live prices</Text>
          </TouchableOpacity>
        )}

        {legs.length === 0 && !result && (
          <Text style={styles.empty}>
            Your basket is empty. Add YES/NO positions from the Games tab, then strike them all at
            once here. Every leg is a buy limit order, defaulting to a 99¢ limit.
          </Text>
        )}

        {legs.map((leg) => (
          <LegCard key={leg.id} leg={leg} prices={prices} />
        ))}

        {error && <Text style={styles.errorBox}>⚠️ {error}</Text>}

        {result && (
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>
              {result.status === 'submitted'
                ? '✅ All orders submitted'
                : result.status === 'partial'
                  ? '⚠️ Partially filled'
                  : '❌ Basket failed'}
            </Text>
            <Text style={styles.resultMeta}>
              {result.acceptedCount}/{result.totalCount} accepted · risk {usd(result.totalRiskUsd)} ·{' '}
              {result.env}
            </Text>
            {result.results.map((r) => (
              <Text
                key={r.clientOrderId}
                style={[
                  styles.resultLine,
                  { color: r.status === 'accepted' ? theme.colors.yes : theme.colors.danger },
                ]}
              >
                {r.status === 'accepted' ? '✓' : '✕'} {r.ticker}
                {r.error ? ` — ${r.error}` : ''}
              </Text>
            ))}
          </View>
        )}
      </ScrollView>

      {legs.length > 0 && (
        <View style={styles.footer}>
          <View style={styles.footerInner}>
            <View>
              <Text style={styles.footerLabel}>Total risk</Text>
              <Text style={styles.footerRisk}>{usd(totalRiskUsd())}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: theme.space(2) }}>
              <TouchableOpacity style={styles.clearBtn} onPress={clear} disabled={submitting}>
                <Text style={styles.clearText}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.strikeBtn, submitting && { opacity: 0.6 }]}
                onPress={confirmStrike}
                disabled={submitting}
              >
                <Text style={styles.strikeText}>
                  {submitting ? 'Striking…' : `Strike ${legs.length}`}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  scrollContent: {
    width: '100%',
    maxWidth: MAXW,
    alignSelf: 'center',
    padding: theme.space(4),
    gap: theme.space(3),
  },
  refresh: { alignSelf: 'flex-end' },
  refreshText: { color: theme.colors.accent, fontWeight: '700', fontSize: 13 },
  empty: { color: theme.colors.textDim, fontSize: 14, lineHeight: 20 },

  leg: {
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.space(4),
    gap: theme.space(3),
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
  },
  legHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.space(2) },
  legLabel: { color: theme.colors.text, fontSize: 15, fontWeight: '700', flex: 1 },
  remove: { color: theme.colors.textDim, fontSize: 16, fontWeight: '700' },

  sideToggle: { flexDirection: 'row', alignItems: 'center', gap: theme.space(2) },
  toggleBtn: {
    paddingHorizontal: theme.space(4),
    paddingVertical: theme.space(2),
    borderRadius: 8,
    backgroundColor: theme.colors.surfaceAlt,
  },
  toggleText: { color: theme.colors.textDim, fontWeight: '800', fontSize: 13 },
  toggleTextActive: { color: '#fff' },
  mkt: { color: theme.colors.textDim, fontSize: 12, marginLeft: 'auto', fontWeight: '600' },

  fieldRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fieldLabel: { color: theme.colors.textDim, fontSize: 14 },
  numField: { flexDirection: 'row', alignItems: 'center', gap: theme.space(2) },
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: { color: theme.colors.text, fontSize: 20, fontWeight: '700' },
  numInput: {
    width: 64,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg,
    color: theme.colors.text,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
  },
  legRisk: { color: theme.colors.textDim, fontSize: 12, textAlign: 'right' },

  footer: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  footerInner: {
    width: '100%',
    maxWidth: MAXW,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.space(4),
  },
  footerLabel: { color: theme.colors.textDim, fontSize: 12 },
  footerRisk: { color: theme.colors.text, fontSize: 20, fontWeight: '800' },
  clearBtn: {
    paddingHorizontal: theme.space(4),
    paddingVertical: theme.space(3),
    borderRadius: 10,
    backgroundColor: theme.colors.surfaceAlt,
  },
  clearText: { color: theme.colors.textDim, fontWeight: '700' },
  strikeBtn: {
    paddingHorizontal: theme.space(6),
    paddingVertical: theme.space(3),
    borderRadius: 10,
    backgroundColor: theme.colors.accent,
  },
  strikeText: { color: '#fff', fontWeight: '800', fontSize: 15 },

  errorBox: {
    color: theme.colors.danger,
    fontSize: 14,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.danger,
    borderRadius: 10,
    padding: theme.space(3),
  },
  resultCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.space(4),
    gap: theme.space(1),
  },
  resultTitle: { color: theme.colors.text, fontSize: 16, fontWeight: '700' },
  resultMeta: { color: theme.colors.textDim, fontSize: 13, marginBottom: theme.space(1) },
  resultLine: { fontSize: 13 },
});
