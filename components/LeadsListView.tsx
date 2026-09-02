import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { getNoWebsiteOnly } from '@/lib/settings';
import { Lead, LEAD_STATUS_LABELS, LEAD_STATUS_COLORS, LeadStatus } from '@/types';

const hasWebsite = (l: Lead) => !!l.website || l.manual_has_site;

// Supabase's REST API caps a single response at 1000 rows by default, so a
// lead list larger than that (e.g. after a big LeadScout scan) needs to be
// paged through rather than fetched in one call.
async function fetchAllLeads(status?: LeadStatus): Promise<Lead[]> {
  const PAGE_SIZE = 1000;
  const seen = new Set<string>();
  const all: Lead[] = [];
  let from = 0;
  while (true) {
    // updated_at alone isn't unique (bulk syncs stamp many rows at once),
    // so id is added as a tiebreaker to keep offset pagination stable.
    let q = supabase
      .from('leads')
      .select('*')
      .order('updated_at', { ascending: false })
      .order('id', { ascending: true });
    if (status) q = q.eq('status', status);
    const { data, error } = await q.range(from, from + PAGE_SIZE - 1);
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

interface Props {
  // When set, this view is locked to one status (used by the Contacted /
  // Interested tabs) and skips the status filter row entirely.
  fixedStatus?: LeadStatus;
  emptyText?: string;
}

export default function LeadsListView({ fixedStatus, emptyText }: Props) {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [noWebsiteOnly, setNoWebsiteOnlyState] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [all, onlyPref] = await Promise.all([fetchAllLeads(fixedStatus), getNoWebsiteOnly()]);
    setLeads(all);
    setNoWebsiteOnlyState(onlyPref);
    setLoading(false);
  }, [fixedStatus]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    const qDigits = q.replace(/\D/g, '');
    return leads.filter((l) => {
      if (noWebsiteOnly && hasWebsite(l)) return false;
      if (!q) return true;
      const nameMatch =
        l.name.toLowerCase().includes(q) || (l.industry ?? '').toLowerCase().includes(q);
      const phoneMatch = qDigits.length >= 3 && (l.phone ?? '').replace(/\D/g, '').includes(qDigits);
      return nameMatch || phoneMatch;
    });
  }, [leads, query, noWebsiteOnly]);

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.search}
        placeholder="Search name or phone"
        value={query}
        onChangeText={setQuery}
      />

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 100 }}
          ListEmptyComponent={
            <Text style={styles.empty}>{emptyText ?? 'No leads here yet.'}</Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.row, { borderLeftColor: LEAD_STATUS_COLORS[item.status] }]}
              onPress={() => router.push(`/(tabs)/leads/${item.id}`)}
            >
              <View style={{ flex: 1 }}>
                <View style={styles.nameRow}>
                  <Text style={styles.name}>{item.name}</Text>
                  {!hasWebsite(item) && (
                    <View style={styles.noWebBadge}>
                      <Text style={styles.noWebBadgeText}>No Website</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.sub}>
                  {item.industry ? `${item.industry} · ` : ''}
                  {item.city ?? ''}
                </Text>
                {!!item.phone && <Text style={styles.phone}>{item.phone}</Text>}
                {!fixedStatus && <Text style={styles.status}>{LEAD_STATUS_LABELS[item.status]}</Text>}
              </View>
              {!!item.phone && (
                <TouchableOpacity
                  style={styles.callButton}
                  onPress={() => Linking.openURL(`tel:${item.phone}`)}
                >
                  <Text style={styles.callButtonText}>📞</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  search: {
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#f1f2f6',
    fontSize: 17,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
    borderLeftWidth: 3,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  name: { fontSize: 16, fontWeight: '600', color: '#1a1a2e' },
  phone: { fontSize: 13, color: '#2f5bff', marginTop: 2, fontWeight: '500' },
  noWebBadge: {
    backgroundColor: '#fdeceb',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  noWebBadgeText: { fontSize: 10, color: '#c94a4a', fontWeight: '700' },
  sub: { fontSize: 13, color: '#888', marginTop: 2 },
  status: { fontSize: 12, color: '#555', marginTop: 4 },
  callButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#eaf0ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  callButtonText: { fontSize: 18 },
  empty: { textAlign: 'center', marginTop: 60, marginHorizontal: 30, color: '#999' },
});
