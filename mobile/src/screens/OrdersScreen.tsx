import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
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
import type { Order } from '../types';
import EnvBanner from '../components/EnvBanner';

const MAXW = 780;

function OrderRow({ order, onCancelled }: { order: Order; onCancelled: () => void }) {
  const [busy, setBusy] = useState(false);

  async function doCancel() {
    setBusy(true);
    try {
      await api.cancelOrder(order.orderId);
      onCancelled();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : String(e);
      if (Platform.OS === 'web') window.alert(`Cancel failed: ${msg}`);
      else Alert.alert('Cancel failed', msg);
      setBusy(false);
    }
  }

  function confirmCancel() {
    const message = `Cancel ${order.remaining ?? ''} contract(s) on ${order.ticker} (${order.side.toUpperCase()} @ ${order.priceCents ?? '—'}¢)?`;
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(message)) doCancel();
      return;
    }
    Alert.alert('Cancel order?', message, [
      { text: 'Keep', style: 'cancel' },
      { text: 'Cancel order', style: 'destructive', onPress: doCancel },
    ]);
  }

  return (
    <View style={styles.order}>
      <View style={{ flex: 1 }}>
        <Text style={styles.ticker} numberOfLines={1}>
          {order.ticker}
        </Text>
        <View style={styles.metaRow}>
          <View style={[styles.sideTag, { backgroundColor: order.side === 'yes' ? theme.colors.yes : theme.colors.no }]}>
            <Text style={styles.sideTagText}>{order.side.toUpperCase()}</Text>
          </View>
          <Text style={styles.meta}>
            {order.priceCents ?? '—'}¢ · {order.remaining ?? '—'} left
            {order.initial != null && order.remaining != null && order.initial !== order.remaining
              ? ` of ${order.initial}`
              : ''}
          </Text>
        </View>
      </View>
      <TouchableOpacity
        style={[styles.cancelBtn, busy && { opacity: 0.5 }]}
        onPress={confirmCancel}
        disabled={busy}
      >
        <Text style={styles.cancelText}>{busy ? '…' : 'Cancel'}</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function OrdersScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [env, setEnv] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await api.orders();
      setOrders(data.orders);
      setEnv(data.env);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  // Load on mount, then poll every 15s so fills/cancels reflect quickly.
  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <EnvBanner env={env} />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.accent} size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={load} tintColor={theme.colors.textDim} />
          }
        >
          <Text style={styles.heading}>Resting orders</Text>
          {error && <Text style={styles.error}>{error}</Text>}
          {!error && orders.length === 0 && (
            <Text style={styles.dim}>
              No resting orders. Orders that fill immediately won't appear here — this shows limit
              orders still waiting on the book.
            </Text>
          )}
          {orders.map((o) => (
            <OrderRow key={o.orderId} order={o} onCancelled={load} />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: {
    width: '100%',
    maxWidth: MAXW,
    alignSelf: 'center',
    padding: theme.space(4),
    gap: theme.space(3),
  },
  heading: { color: theme.colors.text, fontSize: 18, fontWeight: '800' },
  order: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space(3),
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.space(3),
  },
  ticker: { color: theme.colors.text, fontSize: 13, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: theme.space(2), marginTop: 4 },
  sideTag: { paddingHorizontal: theme.space(2), paddingVertical: 2, borderRadius: 6 },
  sideTagText: { color: '#fff', fontWeight: '800', fontSize: 11 },
  meta: { color: theme.colors.textDim, fontSize: 13 },
  cancelBtn: {
    paddingHorizontal: theme.space(4),
    paddingVertical: theme.space(2),
    borderRadius: 9,
    borderWidth: 1,
    borderColor: theme.colors.danger,
  },
  cancelText: { color: theme.colors.danger, fontWeight: '800', fontSize: 13 },
  error: { color: theme.colors.danger, fontSize: 14 },
  dim: { color: theme.colors.textDim, fontSize: 14, lineHeight: 20 },
});
