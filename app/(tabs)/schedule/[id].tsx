import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { ScheduledCall } from '@/types';

export default function ScheduleEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [completed, setCompleted] = useState(false);

  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [day, setDay] = useState('');
  const [time, setTime] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from('scheduled_calls').select('*').eq('id', id).single();
      if (!error && data) {
        const call = data as ScheduledCall;
        setContactName(call.contact_name);
        setPhone(call.phone ?? '');
        setEmail(call.email ?? '');
        setDay(call.day ?? '');
        setTime(call.time ?? '');
        setNote(call.note ?? '');
        setCompleted(call.completed);
      } else if (error) {
        setErrorMsg(error.message);
      }
      setLoading(false);
    })();
  }, [id]);

  const handleSave = async () => {
    setErrorMsg('');
    if (!contactName.trim()) {
      setErrorMsg('Enter a business or contact name.');
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('scheduled_calls')
      .update({
        contact_name: contactName.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        day: day.trim() || null,
        time: time.trim() || null,
        note: note.trim() || null,
        completed,
      })
      .eq('id', id);
    setSaving(false);
    if (error) {
      setErrorMsg(error.message);
      return;
    }
    router.back();
  };

  const handleDelete = async () => {
    setSaving(true);
    const { error } = await supabase.from('scheduled_calls').delete().eq('id', id);
    setSaving(false);
    if (error) {
      setErrorMsg(error.message);
      return;
    }
    router.back();
  };

  if (loading) return <ActivityIndicator style={{ marginTop: 60 }} />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      {!!errorMsg && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      )}

      <TouchableOpacity style={styles.completeRow} onPress={() => setCompleted((v) => !v)}>
        <Text style={{ fontSize: 18 }}>{completed ? '✅' : '⬜️'}</Text>
        <Text style={styles.completeText}>{completed ? 'Completed' : 'Mark as completed'}</Text>
      </TouchableOpacity>

      <Text style={styles.label}>Business / Contact Name *</Text>
      <TextInput style={styles.input} value={contactName} onChangeText={setContactName} placeholder="Jane's Bakery" />

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
          <TextInput style={styles.input} value={day} onChangeText={setDay} placeholder="Thursday, 9/18…" />
        </View>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={styles.label}>Time</Text>
          <TextInput style={styles.input} value={time} onChangeText={setTime} placeholder="Evening, 2pm…" />
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
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save Changes</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={styles.deleteButton} onPress={handleDelete} disabled={saving}>
        <Text style={styles.deleteButtonText}>Delete</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  row: { flexDirection: 'row' },
  completeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f2f6',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  completeText: { marginLeft: 10, fontSize: 15, fontWeight: '600', color: '#1a1a2e' },
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
  button: {
    backgroundColor: '#2f5bff',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    marginTop: 28,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  deleteButton: {
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    marginTop: 12,
  },
  deleteButtonText: { color: '#d64545', fontSize: 15, fontWeight: '600' },
  errorBox: {
    backgroundColor: '#fdeceb',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  errorText: { color: '#c94a4a', fontSize: 14, fontWeight: '600' },
});
