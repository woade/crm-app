import { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Linking } from 'react-native';
import { Link, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { ScheduledCall } from '@/types';

// Day/time are free text ("Thursday evening" is valid), so this just joins
// whichever of the two were given rather than trying to parse a real date.
function formatWhen(call: ScheduledCall) {
  const parts = [call.day, call.time].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'No day/time set';
}

export default function ScheduleListScreen() {
  const [calls, setCalls] = useState<ScheduledCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompleted, setShowCompleted] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('scheduled_calls')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setCalls(data as ScheduledCall[]);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const toggleComplete = async (call: ScheduledCall) => {
    const { error } = await supabase
      .from('scheduled_calls')
      .update({ completed: !call.completed })
      .eq('id', call.id);
    if (!error) load();
  };

  const visible = calls.filter((c) => showCompleted || !c.completed);

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.filterRow} onPress={() => setShowCompleted((v) => !v)}>
        <Text style={styles.filterText}>{showCompleted ? 'Hide completed' : 'Show completed'}</Text>
      </TouchableOpacity>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 100 }}
          ListEmptyComponent={
            <Text style={styles.empty}>
              No calls scheduled yet. Tap + to schedule a Zoom or phone call with a lead.
            </Text>
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <TouchableOpacity onPress={() => toggleComplete(item)} style={styles.checkbox}>
                <Text style={{ fontSize: 18 }}>{item.completed ? '✅' : '⬜️'}</Text>
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, item.completed && styles.nameDone]}>{item.contact_name}</Text>
                <Text style={styles.when}>{formatWhen(item)}</Text>
                {!!item.email && (
                  <Text style={styles.note} numberOfLines={1}>
                    {item.email}
                  </Text>
                )}
                {!!item.note && (
                  <Text style={styles.note} numberOfLines={2}>
                    {item.note}
                  </Text>
                )}
              </View>
              {!!item.phone && (
                <TouchableOpacity
                  style={styles.callButton}
                  onPress={() => Linking.openURL(`tel:${item.phone}`)}
                >
                  <Text style={styles.callButtonText}>📞</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        />
      )}

      {/* Cast: expo-router's generated route types haven't picked up this
          new folder yet in this build environment; the path is valid. */}
      <Link href={'/(tabs)/schedule/new' as any} asChild>
        <TouchableOpacity style={styles.fab}>
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  filterRow: { paddingHorizontal: 16, paddingVertical: 10 },
  filterText: { color: '#2f5bff', fontSize: 14, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  checkbox: { marginRight: 12 },
  name: { fontSize: 16, fontWeight: '600', color: '#1a1a2e' },
  nameDone: { textDecorationLine: 'line-through', color: '#999' },
  when: { fontSize: 13, color: '#2f5bff', marginTop: 2, fontWeight: '500' },
  overdue: { color: '#d64545' },
  note: { fontSize: 13, color: '#888', marginTop: 2 },
  empty: { textAlign: 'center', marginTop: 60, marginHorizontal: 30, color: '#999' },
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
