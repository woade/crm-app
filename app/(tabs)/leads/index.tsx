import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Linking,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Link, useFocusEffect, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { getNoWebsiteOnly } from '@/lib/settings';
import { useCopyToClipboard } from '@/lib/clipboard';
import { Lead, LEAD_STATUSES, LEAD_STATUS_LABELS, LEAD_STATUS_COLORS, LeadStatus } from '@/types';

// "Contacted" is dropped from this filter row — those leads still show up
// under "All", there's just no dedicated tab for the status anymore. "All"
// sits at the far right since "New" is the default, most-used view.
const FILTER_TABS: Array<LeadStatus | 'all'> = [...LEAD_STATUSES.filter((s) => s !== 'contacted'), 'all'];
const ALL_CITIES = '';
const cityKey = (l: Lead) => (l.city ?? '').trim() || 'Unknown';

export default function LeadsListScreen() {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<LeadStatus | 'all'>('new');
  const [city, setCity] = useState(ALL_CITIES);
  const [noWebsiteOnly, setNoWebsiteOnly] = useState(true);
  const { copied, copy } = useCopyToClipboard();

  const load = useCallback(async () => {
    setLoading(true);
    // Supabase's REST API caps a single response at 1000 rows by default,
    // so a lead list larger than that (e.g. after a big LeadScout scan)
    // needs to be paged through rather than fetched in one call.
    const PAGE_SIZE = 1000;
    const seen = new Set<string>();
    let all: Lead[] = [];
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        // Many rows share an identical updated_at from bulk syncs, so
        // ordering by that alone makes offset pagination unstable (ties
        // can land on either page, causing dupes/gaps). id is unique, so
        // it's added as a tiebreaker to keep paging deterministic.
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
    const onlyPref = await getNoWebsiteOnly();
    setLeads(all);
    setNoWebsiteOnly(onlyPref);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const hasWebsite = (l: Lead) => !!l.website || l.manual_has_site;

  const websiteScoped = useMemo(
    () => (noWebsiteOnly ? leads.filter((l) => !hasWebsite(l)) : leads),
    [leads, noWebsiteOnly]
  );

  // Cities present in the current lead list, each paired with how many of
  // its leads are still "new" — an easy way to jump to one city at a time.
  const cityOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const l of websiteScoped) {
      const c = cityKey(l);
      if (l.status === 'new') counts.set(c, (counts.get(c) ?? 0) + 1);
      else if (!counts.has(c)) counts.set(c, 0);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [websiteScoped]);

  const cityScoped = useMemo(
    () => (city ? websiteScoped.filter((l) => cityKey(l) === city) : websiteScoped),
    [websiteScoped, city]
  );

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    const qDigits = q.replace(/\D/g, '');
    return cityScoped.filter((l) => {
      if (tab !== 'all' && l.status !== tab) return false;
      if (!q) return true;
      const nameMatch =
        l.name.toLowerCase().includes(q) || (l.industry ?? '').toLowerCase().includes(q);
      const phoneMatch = qDigits.length >= 3 && (l.phone ?? '').replace(/\D/g, '').includes(qDigits);
      return nameMatch || phoneMatch;
    });
  }, [cityScoped, query, tab]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: cityScoped.length };
    LEAD_STATUSES.forEach((s) => (c[s] = cityScoped.filter((l) => l.status === s).length));
    return c;
  }, [cityScoped]);

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.search}
        placeholder="Search name, phone, or city"
        value={query}
        onChangeText={setQuery}
      />

      <View style={styles.filterBar}>
        <View style={styles.cityPickerWrap}>
          <Picker selectedValue={city} onValueChange={(v) => setCity(v)} style={styles.cityPicker}>
            <Picker.Item label="All Cities" value={ALL_CITIES} />
            {cityOptions.map(([c, count]) => (
              <Picker.Item key={c} label={`${c} (${count})`} value={c} />
            ))}
          </Picker>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabsRow}
          contentContainerStyle={styles.tabsRowContent}
        >
          {FILTER_TABS.map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.tabChip, tab === t && styles.tabChipActive]}
              onPress={() => setTab(t)}
            >
              <Text style={[styles.tabChipText, tab === t && styles.tabChipTextActive]} numberOfLines={1}>
                {t === 'all' ? 'All' : LEAD_STATUS_LABELS[t]} {counts[t] ? `(${counts[t]})` : ''}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 100 }}
          ListEmptyComponent={
            <Text style={styles.empty}>
              No leads yet. Scan for leads in LeadScout on your Mac, or tap + to add one manually.
            </Text>
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
                {!!item.phone && (
                  <TouchableOpacity onPress={() => copy(item.phone!)} hitSlop={{ top: 6, bottom: 6, left: 0, right: 40 }}>
                    <Text style={styles.phone}>{copied === item.phone ? '✓ Copied' : item.phone}</Text>
                  </TouchableOpacity>
                )}
                <Text style={styles.status}>{LEAD_STATUS_LABELS[item.status]}</Text>
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

      <Link href="/(tabs)/leads/new" asChild>
        <TouchableOpacity style={styles.fab}>
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  search: {
    marginHorizontal: 12,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#f1f2f6',
    fontSize: 17,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  noWebBadge: {
    backgroundColor: '#fdeceb',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  noWebBadgeText: { fontSize: 10, color: '#c94a4a', fontWeight: '700' },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 4,
    height: 44,
  },
  cityPickerWrap: {
    width: 132,
    height: 40,
    marginLeft: 12,
    borderRadius: 10,
    backgroundColor: '#f1f2f6',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cityPicker: { width: 132 },
  // Fixed height (rather than relying on the ScrollView sizing to its
  // content) because react-native-web can otherwise collapse a horizontal
  // ScrollView to near-zero height in some flex layouts.
  tabsRow: { flex: 1, height: 44, flexGrow: 1, flexShrink: 1 },
  tabsRowContent: { paddingHorizontal: 12, paddingRight: 32, alignItems: 'center' },
  tabChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
    backgroundColor: '#f1f2f6',
    marginRight: 8,
  },
  tabChipActive: { backgroundColor: '#2f5bff' },
  tabChipText: { fontSize: 13, color: '#555', fontWeight: '600' },
  tabChipTextActive: { color: '#fff' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
    borderLeftWidth: 3,
  },
  name: { fontSize: 16, fontWeight: '600', color: '#1a1a2e' },
  sub: { fontSize: 13, color: '#888', marginTop: 2 },
  phone: { fontSize: 13, color: '#2f5bff', marginTop: 2, fontWeight: '500' },
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
