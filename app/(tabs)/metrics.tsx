import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Lead } from '@/types';

interface Stats {
  callsToday: number;
  callsThisWeek: number;
  callsAllTime: number;
  totalLeads: number;
  noWebsiteLeads: number;
  contacted: number;
  interested: number;
  proposal: number;
}

function parseCallEntry(entry: string): Date | null {
  // Call log entries are stored like "Aug 31 2:30 PM" (no year — the year
  // is implied as "whenever this was logged", which JS's Date parser fills
  // in as the current year).
  const d = new Date(entry);
  return isNaN(d.getTime()) ? null : d;
}

async function fetchAllLeadsRaw(): Promise<Lead[]> {
  const PAGE_SIZE = 1000;
  const seen = new Set<string>();
  const all: Lead[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .order('updated_at', { ascending: false })
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error || !data) break;
    for (const row of data as Lead[]) {
      if (!seen.has(row.id)) {
        seen.add(row.id);
        all.push(row);
      }
    }
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}

export default function MetricsScreen() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    const leads = await fetchAllLeadsRaw();

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    let callsToday = 0;
    let callsThisWeek = 0;
    let callsAllTime = 0;

    leads.forEach((lead) => {
      (lead.call_log ?? []).forEach((entry) => {
        callsAllTime += 1;
        const d = parseCallEntry(entry);
        if (!d) return;
        if (d >= sevenDaysAgo) callsThisWeek += 1;
        if (d >= startOfToday) callsToday += 1;
      });
    });

    const hasWebsite = (l: Lead) => !!l.website || l.manual_has_site;

    setStats({
      callsToday,
      callsThisWeek,
      callsAllTime,
      totalLeads: leads.length,
      noWebsiteLeads: leads.filter((l) => !hasWebsite(l)).length,
      contacted: leads.filter((l) => l.status === 'contacted').length,
      interested: leads.filter((l) => l.status === 'interested').length,
      proposal: leads.filter((l) => l.status === 'proposal').length,
    });
    isRefresh ? setRefreshing(false) : setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading || !stats) return <ActivityIndicator style={{ marginTop: 60 }} />;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 16, paddingTop: 24 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
    >
      <Text style={styles.sectionTitle}>Calls</Text>
      <View style={styles.cardRow}>
        <StatCard label="This Week" value={stats.callsThisWeek} highlight />
        <StatCard label="Today" value={stats.callsToday} />
        <StatCard label="All Time" value={stats.callsAllTime} />
      </View>

      <Text style={styles.sectionTitle}>Pipeline</Text>
      <View style={styles.cardRow}>
        <StatCard label="Contacted" value={stats.contacted} />
        <StatCard label="Interested" value={stats.interested} />
        <StatCard label="Proposal Sent" value={stats.proposal} />
      </View>

      <Text style={styles.sectionTitle}>Leads</Text>
      <View style={styles.cardRow}>
        <StatCard label="Total Leads" value={stats.totalLeads} />
        <StatCard label="No Website" value={stats.noWebsiteLeads} />
      </View>

      <Text style={styles.note}>
        "This Week" counts calls logged in the last 7 days. Pull down to refresh.
      </Text>
    </ScrollView>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <View style={[styles.card, highlight && styles.cardHighlight]}>
      <Text style={[styles.cardValue, highlight && styles.cardValueHighlight]}>{value}</Text>
      <Text style={[styles.cardLabel, highlight && styles.cardLabelHighlight]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  sectionTitle: {
    fontSize: 13,
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 20,
    marginBottom: 10,
  },
  cardRow: { flexDirection: 'row', gap: 10 },
  card: {
    flex: 1,
    backgroundColor: '#f7f8fb',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  cardHighlight: { backgroundColor: '#2f5bff' },
  cardValue: { fontSize: 26, fontWeight: '800', color: '#1a1a2e' },
  cardValueHighlight: { color: '#fff' },
  cardLabel: { fontSize: 12, color: '#666', marginTop: 4, textAlign: 'center' },
  cardLabelHighlight: { color: '#dbe4ff' },
  note: { fontSize: 12, color: '#999', marginTop: 24, textAlign: 'center' },
});
