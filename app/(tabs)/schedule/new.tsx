import { useState } from 'react';
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

export default function ScheduleFormScreen() {
  const router = useRouter();

  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSave = async () => {
    setErrorMsg('');
    if (!contactName.trim()) {
      setErrorMsg('Enter a business or contact name.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
      setErrorMsg('Enter the day as YYYY-MM-DD, e.g. 2026-09-15.');
      return;
    }
    if (!/^\d{1,2}:\d{2}$/.test(time.trim())) {
      setErrorMsg('Enter the time as HH:MM (24-hour), e.g. 14:30.');
      return;
    }
    const scheduledAt = new Date(`${date.trim()}T${time.trim()}:00`);
    if (isNaN(scheduledAt.getTime())) {
      setErrorMsg('That day/time combination looks invalid.');
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
      scheduled_at: scheduledAt.toISOString(),
    });

    setSaving(false);
    if (error) {
      setErrorMsg(error.message);
      return;
    }
    router.back();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      {!!errorMsg && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      )}

      <Text style={styles.label}>Business / Contact Name *</Text>
      <TextInput
        style={styles.input}
        value={contactName}
        onChangeText={setContactName}
        placeholder="Jane's Bakery"
      />

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
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            autoCapitalize="none"
          />
        </View>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={styles.label}>Time</Text>
          <TextInput
            style={styles.input}
            value={time}
            onChangeText={setTime}
            placeholder="HH:MM"
            autoCapitalize="none"
          />
        </View>
      </View>

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
