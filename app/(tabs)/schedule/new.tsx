import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';

interface LeadSuggestion {
  id: string;
  name: string;
  phone: string | null;
}

// Supabase's REST API caps a single response at 1000 rows, so this pages
// through the same way the Leads screens do. Only the columns needed for
// the suggestion list are selected.
async function fetchLeadSuggestions(): Promise<LeadSuggestion[]> {
  const PAGE_SIZE = 1000;
  const seen = new Set<string>();
  const all: LeadSuggestion[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('leads')
      .select('id, name, phone')
      .order('name', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error || !data) break;
    for (const row of data as LeadSuggestion[]) {
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

export default function ScheduleFormScreen() {
  const router = useRouter();

  const [leads, setLeads] = useState<LeadSuggestion[]>([]);
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [day, setDay] = useState('');
  const [time, setTime] = useState('');
  const [note, setNote] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    fetchLeadSuggestions().then(setLeads);
  }, []);

  // Matches an existing lead by name or phone number as the contact name
  // field is typed, so it can be tapped to auto-fill instead of retyped.
  const suggestions = useMemo(() => {
    const q = contactName.trim().toLowerCase();
    if (q.length < 2) return [];
    const qDigits = q.replace(/\D/g, '');
    return leads
      .filter((l) => {
        const nameMatch = l.name.toLowerCase().includes(q);
        const phoneMatch = qDigits.length >= 3 && (l.phone ?? '').replace(/\D/g, '').includes(qDigits);
        return nameMatch || phoneMatch;
      })
      .slice(0, 6);
  }, [leads, contactName]);

  const selectSuggestion = (lead: LeadSuggestion) => {
    setContactName(lead.name);
    setPhone(lead.phone ?? '');
    setShowSuggestions(false);
  };

  const handleSave = async () => {
    setErrorMsg('');
    if (!contactName.trim()) {
      setErrorMsg('Enter a business or contact name.');
      return;
    }

    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      setErrorMsg('Your session expired — please sign out and back in.');
      return;
    }

    const { error } = await supabase.from('scheduled_calls').insert({
      user_id: user.id,
      contact_name: contactName.trim(),
      phone: phone.trim() || null,
      email: email.trim() || null,
      day: day.trim() || null,
      time: time.trim() || null,
      note: note.trim() || null,
    });

    setSaving(false);
    if (error) {
      setErrorMsg(error.message);
      return;
    }
    router.back();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
      {!!errorMsg && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      )}

      <Text style={styles.label}>Business / Contact Name *</Text>
      <TextInput
        style={styles.input}
        value={contactName}
        onChangeText={(v) => {
          setContactName(v);
          setShowSuggestions(true);
        }}
        onFocus={() => setShowSuggestions(true)}
        placeholder="Jane's Bakery"
      />
      {showSuggestions && suggestions.length > 0 && (
        <View style={styles.suggestBox}>
          {suggestions.map((l) => (
            <TouchableOpacity key={l.id} style={styles.suggestRow} onPress={() => selectSuggestion(l)}>
              <Text style={styles.suggestName}>{l.name}</Text>
              {!!l.phone && <Text style={styles.suggestPhone}>{l.phone}</Text>}
            </TouchableOpacity>
          ))}
        </View>
      )}

      <Text style={styles.label}>Phone</Text>
      <TextInput
        style={styles.input}
        value={phone}
        onChangeText={setPhone}
        placeholder="Phone number"
        keyboardType="phone-pad"
      />

      <Text style={styles.label}>Email (if applicable)</Text>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder="name@business.com"
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <View style={styles.row}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={styles.label}>Day</Text>
          <TextInput
            style={styles.input}
            value={day}
            onChangeText={setDay}
            placeholder="Thursday, 9/18…"
          />
        </View>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={styles.label}>Time</Text>
          <TextInput
            style={styles.input}
            value={time}
            onChangeText={setTime}
            placeholder="Evening, 2pm…"
          />
        </View>
      </View>

      <Text style={styles.label}>Notes</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={note}
        onChangeText={setNote}
        placeholder="Wants a Zoom demo, prefers texts, etc."
        multiline
        numberOfLines={4}
      />

      <TouchableOpacity style={styles.button} onPress={handleSave} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Schedule Call</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  row: { flexDirection: 'row' },
  label: { fontSize: 13, color: '#666', marginBottom: 6, marginTop: 14, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fafafa',
  },
  textArea: { minHeight: 90, textAlignVertical: 'top' },
  suggestBox: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  suggestRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  suggestName: { fontSize: 15, color: '#1a1a2e', fontWeight: '500' },
  suggestPhone: { fontSize: 13, color: '#888' },
  button: {
    backgroundColor: '#2f5bff',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    marginTop: 28,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  errorBox: {
    backgroundColor: '#fdeceb',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  errorText: { color: '#c94a4a', fontSize: 14, fontWeight: '600' },
});
