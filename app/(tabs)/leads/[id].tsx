import { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Linking,
  Alert,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useFocusEffect, useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Lead, LEAD_STATUSES, LEAD_STATUS_LABELS, LeadStatus } from '@/types';

export default function LeadDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [lead, setLead] = useState<Lead | null>(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logging, setLogging] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('leads').select('*').eq('id', id).single();
    if (!error && data) {
      setLead(data as Lead);
      setNotes((data as Lead).notes ?? '');
    }
    setLoading(false);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const updateLead = async (patch: Partial<Lead>) => {
    const { error } = await supabase.from('leads').update(patch).eq('id', id);
    if (error) {
      Alert.alert('Error', error.message);
      return false;
    }
    return true;
  };

  const handleStatusChange = async (status: LeadStatus) => {
    if (!lead) return;
    setLead({ ...lead, status });
    await updateLead({ status });
  };

  const handleSaveNotes = async () => {
    setSaving(true);
    const ok = await updateLead({ notes });
    setSaving(false);
    if (ok) load();
  };

  const handleLogCall = async () => {
    if (!lead) return;
    setLogging(true);
    const now = new Date();
    const entry =
      now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
      ' ' +
      now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const newLog = [...(lead.call_log ?? []), entry];
    const newStatus: LeadStatus = lead.status === 'new' ? 'contacted' : lead.status;
    const ok = await updateLead({ call_log: newLog, status: newStatus });
    setLogging(false);
    if (ok) load();
  };

  if (loading || !lead) return <ActivityIndicator style={{ marginTop: 60 }} />;

  return (
    <>
      <Stack.Screen options={{ title: lead.name }} />
      <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
        <Text style={styles.name}>{lead.name}</Text>
        <Text style={styles.sub}>
          {lead.industry ? `${lead.industry} · ` : ''}
          {lead.city ?? ''}
        </Text>
        {!!lead.address && <Text style={styles.address}>{lead.address}</Text>}

        {lead.rating != null && (
          <Text style={styles.rating}>
            {'★'.repeat(Math.round(lead.rating))} {lead.rating} ({lead.reviews ?? 0} reviews)
          </Text>
        )}

        <View style={styles.actionsRow}>
          {!!lead.phone && (
            <TouchableOpacity style={styles.actionBtn} onPress={() => Linking.openURL(`tel:${lead.phone}`)}>
              <Text style={styles.actionBtnText}>📞 Call</Text>
            </TouchableOpacity>
          )}
          {!!lead.search_url && (
            <TouchableOpacity style={styles.actionBtn} onPress={() => Linking.openURL(lead.search_url!)}>
              <Text style={styles.actionBtnText}>🔎 Google</Text>
            </TouchableOpacity>
          )}
          {!!lead.maps_url && (
            <TouchableOpacity style={styles.actionBtn} onPress={() => Linking.openURL(lead.maps_url!)}>
              <Text style={styles.actionBtnText}>📍 Maps</Text>
            </TouchableOpacity>
          )}
          {!!lead.website && (
            <TouchableOpacity style={styles.actionBtn} onPress={() => Linking.openURL(lead.website!)}>
              <Text style={styles.actionBtnText}>🌐 Website</Text>
            </TouchableOpacity>
          )}
        </View>

        {!lead.website && !lead.manual_has_site && (
          <View style={styles.noWebsiteBadge}>
            <Text style={styles.noWebsiteText}>No website found — good candidate</Text>
          </View>
        )}

        <Text style={styles.label}>Status</Text>
        <View style={styles.statusPickerWrap}>
          <Picker selectedValue={lead.status} onValueChange={(s) => handleStatusChange(s as LeadStatus)}>
            {/* "Contacted" is no longer offered as a choice going forward,
                but a lead already sitting in that status keeps showing it
                here so the dropdown doesn't display a blank/invalid value. */}
            {LEAD_STATUSES.filter((s) => s !== 'contacted' || lead.status === 'contacted').map((s) => (
              <Picker.Item key={s} label={LEAD_STATUS_LABELS[s]} value={s} />
            ))}
          </Picker>
        </View>

        <TouchableOpacity style={styles.logCallButton} onPress={handleLogCall} disabled={logging}>
          <Text style={styles.logCallButtonText}>{logging ? 'Logging…' : '📞 Log a Call'}</Text>
        </TouchableOpacity>

        <Text style={styles.label}>Notes</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={notes}
          onChangeText={setNotes}
          multiline
          placeholder="What did they say? Anything to remember before the next call."
        />
        <TouchableOpacity style={styles.saveButton} onPress={handleSaveNotes} disabled={saving}>
          <Text style={styles.saveButtonText}>{saving ? 'Saving…' : 'Save Notes'}</Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Call History ({(lead.call_log ?? []).length})</Text>
        {(lead.call_log ?? []).length === 0 ? (
          <Text style={styles.emptySection}>No calls logged yet.</Text>
        ) : (
          [...(lead.call_log ?? [])].reverse().map((entry, i) => (
            <View key={i} style={styles.callEntry}>
              <Text style={styles.callEntryText}>📞 {entry}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  name: { fontSize: 22, fontWeight: '700', color: '#1a1a2e' },
  sub: { fontSize: 14, color: '#666', marginTop: 4 },
  address: { fontSize: 13, color: '#888', marginTop: 4 },
  rating: { fontSize: 13, color: '#b8860b', marginTop: 8 },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 16, flexWrap: 'wrap' },
  actionBtn: {
    backgroundColor: '#eaf0ff',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  actionBtnText: { color: '#2f5bff', fontWeight: '600', fontSize: 13 },
  noWebsiteBadge: {
    marginTop: 14,
    backgroundColor: '#fff4e5',
    borderRadius: 8,
    padding: 10,
  },
  noWebsiteText: { color: '#a15c00', fontSize: 13, fontWeight: '600' },
  label: { fontSize: 13, color: '#666', marginBottom: 6, marginTop: 22, fontWeight: '600' },
  statusPickerWrap: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    backgroundColor: '#fafafa',
    overflow: 'hidden',
  },
  logCallButton: {
    backgroundColor: '#22a35e',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 14,
  },
  logCallButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    backgroundColor: '#fafafa',
  },
  multiline: { height: 100, textAlignVertical: 'top' },
  saveButton: {
    backgroundColor: '#2f5bff',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  saveButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1a1a2e', marginTop: 26, marginBottom: 8 },
  emptySection: { color: '#999', fontSize: 14 },
  callEntry: { paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eee' },
  callEntryText: { fontSize: 14, color: '#333' },
});
