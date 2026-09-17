import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { crossAlert } from '@/lib/alert';
import { Picker } from '@react-native-picker/picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Contact, DEAL_STAGES, DealStage, STAGE_LABELS } from '@/types';

export default function DealFormScreen() {
  const { id, contactId } = useLocalSearchParams<{ id?: string; contactId?: string }>();
  const isEdit = !!id;
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [value, setValue] = useState('');
  const [stage, setStage] = useState<DealStage>('lead');
  const [selectedContact, setSelectedContact] = useState<string>(contactId ?? '');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: contactData } = await supabase.from('contacts').select('*').order('full_name');
      if (contactData) setContacts(contactData as Contact[]);

      if (isEdit) {
        const { data, error } = await supabase.from('deals').select('*').eq('id', id).single();
        if (!error && data) {
          setTitle(data.title ?? '');
          setValue(data.value != null ? String(data.value) : '');
          setStage(data.stage);
          setSelectedContact(data.contact_id ?? '');
        }
      }
      setLoading(false);
    })();
  }, [id]);

  const handleSave = async () => {
    if (!title.trim()) {
      crossAlert('Title required', 'Please enter a deal title.');
      return;
    }
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const payload = {
      title: title.trim(),
      value: value.trim() ? Number(value) : null,
      stage,
      contact_id: selectedContact || null,
    };

    const result = isEdit
      ? await supabase.from('deals').update(payload).eq('id', id)
      : await supabase.from('deals').insert({ ...payload, user_id: user?.id });

    setSaving(false);
    if (result.error) {
      crossAlert('Error', result.error.message);
      return;
    }
    router.back();
  };

  if (loading) return <ActivityIndicator style={{ marginTop: 60 }} />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.label}>Title *</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Website redesign" />

      <Text style={styles.label}>Value ($)</Text>
      <TextInput style={styles.input} value={value} onChangeText={setValue} placeholder="5000" keyboardType="numeric" />

      <Text style={styles.label}>Stage</Text>
      <View style={styles.pickerWrap}>
        <Picker selectedValue={stage} onValueChange={(v) => setStage(v as DealStage)}>
          {DEAL_STAGES.map((s) => (
            <Picker.Item key={s} label={STAGE_LABELS[s]} value={s} />
          ))}
        </Picker>
      </View>

      <Text style={styles.label}>Contact</Text>
      <View style={styles.pickerWrap}>
        <Picker selectedValue={selectedContact} onValueChange={(v) => setSelectedContact(v)}>
          <Picker.Item label="None" value="" />
          {contacts.map((c) => (
            <Picker.Item key={c.id} label={c.full_name} value={c.id} />
          ))}
        </Picker>
      </View>

      <TouchableOpacity style={styles.button} onPress={handleSave} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{isEdit ? 'Save Changes' : 'Add Deal'}</Text>}
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
