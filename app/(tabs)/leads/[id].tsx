import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Linking,
} from 'react-native';
import { crossAlert } from '@/lib/alert';
import { Picker } from '@react-native-picker/picker';
import { useFocusEffect, useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useCopyToClipboard } from '@/lib/clipboard';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useAuth } from '@/context/AuthContext';
import { Lead, LEAD_STATUSES, LEAD_STATUS_LABELS, LeadStatus } from '@/types';

export default function LeadDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [lead, setLead] = useState<Lead | null>(null);
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const { copied, copy } = useCopyToClipboard();
  const { initials } = useWorkspace();
  const { session } = useAuth();
  const hydrated = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    // Re-arm the autosave guard: loading a lead populates the fields, and
    // that must not count as an edit or every lead you merely open would be
    // rewritten (bumping its sync timestamp and edit stamp for no reason).
    hydrated.current = false;
    const { data, error } = await supabase.from('leads').select('*').eq('id', id).single();
    if (!error && data) {
      setLead(data as Lead);
      setContactName((data as Lead).contact_name ?? '');
      setContactEmail((data as Lead).contact_email ?? '');
      setNotes((data as Lead).notes ?? '');
    }
    setLoading(false);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Every write stamps who did it, so the list can show a badge for the rep
  // who last touched a lead. Done here rather than at each call site so no
  // edit path can quietly skip attribution.
  const updateLead = async (patch: Partial<Lead>) => {
    const stamped = {
      ...patch,
      last_edited_by: session?.user?.id ?? null,
      last_edited_initials: initials,
      last_edited_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('leads').update(stamped).eq('id', id);
    if (error) {
      crossAlert('Error', error.message);
      return false;
    }
    return true;
  };

  // Changing the status IS logging a call now — there's no separate "Log a
  // Call" action anymore, so every status change writes a timestamped
  // Call History entry noting what it was changed to.
  const handleStatusChange = async (status: LeadStatus) => {
    if (!lead) return;
    const now = new Date();
    const entry =
      now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
      ' ' +
      now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) +
      ' → ' +
      LEAD_STATUS_LABELS[status];
    const newLog = [...(lead.call_log ?? []), entry];
    setLead({ ...lead, status, call_log: newLog });
    await updateLead({ status, call_log: newLog });
  };

  // Autosave: nobody should have to remember a Save button mid-call. Waits
  // for a short pause in typing so it isn't firing a write per keystroke.
  // The ref guard skips the save that would otherwise fire immediately after
  // loading a lead, when state is being populated rather than edited.
  useEffect(() => {
    if (!lead) return;
    if (!hydrated.current) { hydrated.current = true; return; }

    const t = setTimeout(async () => {
      setSaving(true);
      await updateLead({
        contact_name: contactName.trim() || null,
        contact_email: contactEmail.trim() || null,
        notes,
      });
      setSaving(false);
      setSavedAt(Date.now());
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactName, contactEmail, notes]);

  if (loading || !lead) return <ActivityIndicator style={{ marginTop: 60 }} />;

  return (
    <>
      <Stack.Screen options={{ title: lead.name }} />
      <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{lead.name}</Text>
          {!!lead.last_edited_initials && (
            <View style={styles.editedBadge}>
              <Text style={styles.editedBadgeText}>{lead.last_edited_initials}</Text>
            </View>
          )}
        </View>
        <Text style={styles.sub}>
          {lead.industry ? `${lead.industry} · ` : ''}
          {lead.city ?? ''}
        </Text>
        {!!lead.address && <Text style={styles.address}>{lead.address}</Text>}

        {!!lead.phone && (
          <TouchableOpacity onPress={() => copy(lead.phone!)} hitSlop={{ top: 8, bottom: 8, left: 0, right: 40 }}>
            <Text style={styles.phoneBig}>{copied === lead.phone ? '✓ Copied to clipboard' : lead.phone}</Text>
          </TouchableOpacity>
        )}

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

        <Text style={styles.sectionTitle}>Contact Person</Text>

        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.input}
          value={contactName}
          onChangeText={setContactName}
          autoCapitalize="words"
          autoCorrect={false}
        />

        <Text style={styles.label}>Email</Text>
        <View style={styles.emailRow}>
          <TextInput
            style={[styles.input, styles.emailInput]}
            value={contactEmail}
            onChangeText={setContactEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            inputMode="email"
          />
          {!!contactEmail.trim() && (
            <TouchableOpacity
              style={styles.emailBtn}
              onPress={() => Linking.openURL(`mailto:${contactEmail.trim()}`)}
            >
              <Text style={styles.actionBtnText}>✉️</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.label}>Notes</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={notes}
          onChangeText={setNotes}
          multiline
        />
        <Text style={styles.autosaveHint}>
          {saving ? 'Saving…' : savedAt ? '✓ Saved automatically' : 'Changes save automatically'}
        </Text>

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
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 22, fontWeight: '700', color: '#1a1a2e', flexShrink: 1 },
  editedBadge: {
    backgroundColor: '#eef0ff',
    borderWidth: 1,
    borderColor: '#c9cfff',
    borderRadius: 999,
    minWidth: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  editedBadgeText: { fontSize: 12, fontWeight: '800', color: '#4650c4' },
  sub: { fontSize: 14, color: '#666', marginTop: 4 },
  address: { fontSize: 13, color: '#888', marginTop: 4 },
  phoneBig: { fontSize: 20, fontWeight: '700', color: '#2f5bff', marginTop: 8 },
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
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    backgroundColor: '#fafafa',
  },
  multiline: { height: 100, textAlignVertical: 'top' },
  emailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  emailInput: { flex: 1 },
  emailBtn: {
    backgroundColor: '#eaf0ff',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  saveButton: {
    backgroundColor: '#2f5bff',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  autosaveHint: { fontSize: 12, color: '#8a8f9a', marginTop: 8, textAlign: 'right' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1a1a2e', marginTop: 26, marginBottom: 8 },
  emptySection: { color: '#999', fontSize: 14 },
  callEntry: { paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eee' },
  callEntryText: { fontSize: 14, color: '#333' },
});
