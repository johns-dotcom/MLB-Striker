import { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, ApiError } from '../api';
import { theme } from '../theme';
import { usd } from '../format';
import { useBasket } from '../store';
import type { BasketLeg, StrikeResult } from '../types';

function Stepper({
  label,
  value,
  onDec,
  onInc,
  suffix,
}: {
  label: string;
  value: string;
  onDec: () => void;
  onInc: () => void;
  suffix?: string;
}) {
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperControls}>
        <TouchableOpacity style={styles.stepBtn} onPress={onDec}>
          <Text style={styles.stepBtnText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.stepValue}>
          {value}
          {suffix}
        </Text>
        <TouchableOpacity style={styles.stepBtn} onPress={onInc}>
          <Text style={styles.stepBtnText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function LegCard({ leg }: { leg: BasketLeg }) {
  const { updateLeg, removeLeg } = useBasket();
  const perContract = leg.action === 'buy' ? leg.price : 100 - leg.price;
  const risk = (perContract * leg.count) / 100;

  return (
    <View style={styles.leg}>
      <View style={styles.legHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.legLabel}>{leg.label}</Text>
          <Text style={styles.legTicker}>{leg.ticker}</Text>
        </View>
        <TouchableOpacity onPress={() => removeLeg(leg.id)}>
          <Text style={styles.remove}>Remove</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.actionToggle}>
        {(['buy', 'sell'] as const).map((a) => (
          <TouchableOpacity
            key={a}
            style={[styles.toggleBtn, leg.action === a && styles.toggleActive]}
            onPress={() => updateLeg(leg.id, { action: a })}
          >
            <Text style={[styles.toggleText, leg.action === a && styles.toggleTextActive]}>
              {a.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
        {(['yes', 'no'] as const).map((s) => (
          <TouchableOpacity
            key={s}
            style={[
              styles.toggleBtn,
              leg.side === s && {
                backgroundColor: s === 'yes' ? theme.colors.yes : theme.colors.no,
              },
            ]}
            onPress={() => updateLeg(leg.id, { side: s })}
          >
            <Text style={[styles.toggleText, leg.side === s && styles.toggleTextActive]}>
              {s.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Stepper
        label="Contracts"
        value={String(leg.count)}
        onDec={() => updateLeg(leg.id, { count: Math.max(1, leg.count - 1) })}
        onInc={() => updateLeg(leg.id, { count: leg.count + 1 })}
      />
      <Stepper
        label="Limit price"
        value={String(leg.price)}
        suffix="¢"
        onDec={() => updateLeg(leg.id, { price: Math.max(1, leg.price - 1) })}
        onInc={() => updateLeg(leg.id, { price: Math.min(99, leg.price + 1) })}
      />
      <Text style={styles.legRisk}>Risk: {usd(risk)}</Text>
    </View>
  );
}

export default function BasketScreen() {
  const { legs, clear, totalRiskUsd } = useBasket();
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<StrikeResult | null>(null);

  async function doStrike() {
    setSubmitting(true);
    setResult(null);
    try {
      // Ask the backend which env it's on, so the confirmation is truthful.
      const h = await api.health();
      const res = await api.strike(legs, h.env);
      setResult(res);
      if (res.status === 'submitted') clear();
    } catch (e) {
      Alert.alert('Strike failed', e instanceof ApiError ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  function confirmStrike() {
    if (legs.length === 0) return;
    Alert.alert(
      'Strike basket?',
      `Submit ${legs.length} order${legs.length > 1 ? 's' : ''} — total risk ${usd(totalRiskUsd())}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Strike', style: 'destructive', onPress: doStrike },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: theme.space(3), gap: theme.space(3) }}>
        {legs.length === 0 && !result && (
          <Text style={styles.empty}>
            Your basket is empty. Add YES/NO positions from the Games tab, then strike
            them all at once here.
          </Text>
        )}

        {legs.map((leg) => (
          <LegCard key={leg.id} leg={leg} />
        ))}

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
              {result.acceptedCount}/{result.totalCount} accepted · risk{' '}
              {usd(result.totalRiskUsd)} · {result.env}
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
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  empty: { color: theme.colors.textDim, fontSize: 14, lineHeight: 20 },
  leg: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.space(3),
    gap: theme.space(2),
  },
  legHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  legLabel: { color: theme.colors.text, fontSize: 15, fontWeight: '700' },
  legTicker: { color: theme.colors.textDim, fontSize: 11, marginTop: 2 },
  remove: { color: theme.colors.danger, fontSize: 13, fontWeight: '600' },
  actionToggle: { flexDirection: 'row', gap: theme.space(1), flexWrap: 'wrap' },
  toggleBtn: {
    paddingHorizontal: theme.space(3),
    paddingVertical: theme.space(1),
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceAlt,
  },
  toggleActive: { backgroundColor: theme.colors.accent },
  toggleText: { color: theme.colors.textDim, fontWeight: '700', fontSize: 12 },
  toggleTextActive: { color: '#fff' },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepperLabel: { color: theme.colors.textDim, fontSize: 13 },
  stepperControls: { flexDirection: 'row', alignItems: 'center', gap: theme.space(3) },
  stepBtn: {
    width: 34,
    height: 34,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: { color: theme.colors.text, fontSize: 20, fontWeight: '700' },
  stepValue: { color: theme.colors.text, fontSize: 16, fontWeight: '700', minWidth: 44, textAlign: 'center' },
  legRisk: { color: theme.colors.textDim, fontSize: 13, textAlign: 'right' },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.space(3),
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  footerLabel: { color: theme.colors.textDim, fontSize: 12 },
  footerRisk: { color: theme.colors.text, fontSize: 20, fontWeight: '800' },
  clearBtn: {
    paddingHorizontal: theme.space(4),
    paddingVertical: theme.space(3),
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceAlt,
  },
  clearText: { color: theme.colors.textDim, fontWeight: '700' },
  strikeBtn: {
    paddingHorizontal: theme.space(6),
    paddingVertical: theme.space(3),
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.accent,
  },
  strikeText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  resultCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.space(3),
    gap: theme.space(1),
  },
  resultTitle: { color: theme.colors.text, fontSize: 16, fontWeight: '700' },
  resultMeta: { color: theme.colors.textDim, fontSize: 13, marginBottom: theme.space(1) },
  resultLine: { fontSize: 13 },
});
