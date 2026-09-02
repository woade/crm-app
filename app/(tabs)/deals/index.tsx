import { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Link, useFocusEffect, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Deal, DEAL_STAGES, STAGE_LABELS, DealStage } from '@/types';

const STAGE_COLORS: Record<DealStage, string> = {
  lead: '#8a8fa3',
  contacted: '#3d84f5',
  proposal: '#e0a531',
  negotiation: '#e0722f',
  won: '#22a35e',
  lost: '#c94a4a',
};

export default function DealsListScreen() {
  const router = useRouter();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('deals')
      .select('*, contacts(full_name)')
      .order('created_at', { ascending: false });
    if (!error && data) setDeals(data as unknown as Deal[]);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const grouped = DEAL_STAGES.map((stage) => ({
    stage,
    items: deals.filter((d) => d.stage === stage),
  })).filter((g) => g.items.length > 0);

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={grouped}
          keyExtractor={(g) => g.stage}
          contentContainerStyle={{ padding: 12, paddingBottom: 100 }}
          ListEmptyComponent={<Text style={styles.empty}>No deals yet. Tap + to add one.</Text>}
          renderItem={({ item: group }) => (
            <View style={{ marginBottom: 18 }}>
              <View style={styles.stageHeader}>
                <View style={[styles.dot, { backgroundColor: STAGE_COLORS[group.stage] }]} />
                <Text style={styles.stageTitle}>{STAGE_LABELS[group.stage]}</Text>
                <Text style={styles.stageCount}>{group.items.length}</Text>
              </View>
              {group.items.map((d) => (
                <TouchableOpacity
                  key={d.id}
                  style={styles.card}
                  onPress={() => router.push(`/(tabs)/deals/${d.id}`)}
                >
                  <Text style={styles.cardTitle}>{d.title}</Text>
                  <Text style={styles.cardSub}>
                    {d.contacts?.full_name ?? 'No contact'}
                    {d.value ? ` · $${d.value.toLocaleString()}` : ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        />
      )}

      <Link href="/(tabs)/deals/new" asChild>
        <TouchableOpacity style={styles.fab}>
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  stageHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, paddingHorizontal: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  stageTitle: { fontSize: 15, fontWeight: '700', color: '#1a1a2e', flex: 1 },
  stageCount: { fontSize: 13, color: '#999' },
  card: {
    backgroundColor: '#f7f8fb',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
  },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#1a1a2e' },
  cardSub: { fontSize: 13, color: '#777', marginTop: 3 },
  empty: { textAlign: 'center', marginTop: 60, color: '#999' },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2f5bff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  fabText: { color: '#fff', fontSize: 28, marginTop: -2 },
});
