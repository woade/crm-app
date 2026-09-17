import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { crossAlert } from '@/lib/alert';
import { Picker } from '@react-native-picker/picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Contact, Deal } from '@/types';

export default function TaskFormScreen() {
  const { contactId, dealId } = useLocalSearchParams<{ contactId?: string; dealId?: string }>();
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [selectedContact, setSelectedContact] = useState<string>(contactId ?? '');
  const [selectedDeal, setSelectedDeal] = useState<string>(dealId ?? '');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const [c, d] = await Promise.all([
        supabase.from('contacts').select('*').order('full_name'),
        supabase.from('deals').select('*').order('title'),
      ]);
      if (c.data) setContacts(c.data as Contact[]);
      if (d.data) setDeals(d.data as Deal[]);
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    if (!title.trim()) {
      crossAlert('Title required', 'Please enter a task title.');
      return;
    }
    if (dueDate.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate.trim())) {
      crossAlert('Invalid date', 'Use the format YYYY-MM-DD, e.g. 2026-09-15.');
      return;
    }
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from('tasks').insert({
      title: title.trim(),
      due_date: dueDate.trim() || null,
      contact_id: selectedContact || null,
      deal_id: selectedDeal || null,
      user_id: user?.id,
    });

    setSaving(false);
    if (error) {
      crossAlert('Error', error.message);
      return;
    }
    router.back();
  };

  if (loading) return <ActivityIndicator style={{ marginTop: 60 }} />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.label}>Title *</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Follow up with Jane" />

      <Text style={styles.label}>Due date</Text>
      <TextInput
        style={styles.input}
        value={dueDate}
        onChangeText={setDueDate}
        placeholder="YYYY-MM-DD"
        autoCapitalize="none"
      />

      <Text style={styles.label}>Contact</Text>
      <View style={styles.pickerWrap}>
        <Picker selectedValue={selectedContact} onValueChange={(v) => setSelectedContact(v)}>
          <Picker.Item label="None" value="" />
          {contacts.map((c) => (
            <Picker.Item key={c.id} label={c.full_name} value={c.id} />
          ))}
        </Picker>
      </View>

      <Text style={styles.label}>Deal</Text>
      <View style={styles.pickerWrap}>
        <Picker selectedValue={selectedDeal} onValueChange={(v) => setSelectedDeal(v)}>
          <Picker.Item label="None" value="" />
          {deals.map((d) => (
            <Picker.Item key={d.id} label={d.title} value={d.id} />
          ))}
        </Picker>
      </View>

      <TouchableOpacity style={styles.button} onPress={handleSave} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Add Task</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  label: { fontSize: 13, color: '#666', marginBottom: 6, marginTop: 14, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fafafa',
  },
  pickerWrap: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    backgroundColor: '#fafafa',
    overflow: 'hidden',
  },
  button: {
    backgroundColor: '#2f5bff',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    marginTop: 28,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
