import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { crossAlert } from '@/lib/alert';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useWorkspace } from '@/context/WorkspaceContext';

export default function LeadFormScreen() {
  const router = useRouter();
  const { ownerId, initials } = useWorkspace();

  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  // You add a lead by hand because you met someone. Capturing who, there and
  // then, is the point - it is what you need to send the demo afterwards.
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      crossAlert('Name required', 'Please enter a business name.');
      return;
    }
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const placeId = 'manual-' + Date.now();
    const { error } = await supabase.from('leads').insert({
      place_id: placeId,
      name: name.trim(),
      industry: industry.trim() || null,
      city: city.trim() || null,
      address: address.trim() || null,
      phone: phone.trim() || null,
      website: website.trim() || null,
      contact_name: contactName.trim() || null,
      contact_email: contactEmail.trim() || null,
      notes: notes.trim() || null,
      // Interested, not New: you met them in person, which is further along
      // than a cold scan result. It also puts the lead in the protected set,
      // so no automatic cleanup can ever remove it.
      status: 'interested',
      // ownerId, not the current user: when a sales rep adds a lead it has to
      // land in the owner's pile. Stamping it with the rep's own id would
      // create a lead only they could see.
      user_id: ownerId ?? user?.id,
      last_edited_by: user?.id ?? null,
      last_edited_initials: initials,
      last_edited_at: new Date().toISOString(),
    });

    setSaving(false);
    if (error) {
      crossAlert('Error', error.message);
      return;
    }
    router.back();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.label}>Business name *</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Acme Roofing" />

      <Text style={styles.label}>Industry</Text>
      <TextInput style={styles.input} value={industry} onChangeText={setIndustry} placeholder="Roofing" />

      <Text style={styles.label}>City</Text>
      <TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="Austin, TX" />

      <Text style={styles.label}>Address</Text>
      <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder="123 Main St" />

      <Text style={styles.label}>Phone</Text>
      <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="(555) 123-4567" keyboardType="phone-pad" />

      <Text style={styles.label}>Website (leave blank if none)</Text>
      <TextInput
        style={styles.input}
        value={website}
        onChangeText={setWebsite}
        placeholder="https://…"
        autoCapitalize="none"
      />

      <Text style={styles.label}>Contact person</Text>
      <TextInput style={styles.input} value={contactName} onChangeText={setContactName} placeholder="Who you spoke to" autoCapitalize="words" />

      <Text style={styles.label}>Their email</Text>
      <TextInput
        style={styles.input}
        value={contactEmail}
        onChangeText={setContactEmail}
        placeholder="For the demo / Zoom invite"
        keyboardType="email-address"
        autoCapitalize="none"
        inputMode="email"
      />

      <Text style={styles.label}>Notes</Text>
      <TextInput style={[styles.input, styles.multiline]} value={notes} onChangeText={setNotes} multiline placeholder="Met at the chamber breakfast, wants a quote" />

      <TouchableOpacity style={styles.button} onPress={handleSave} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Add Lead</Text>}
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
  multiline: { height: 90, textAlignVertical: 'top' },
  button: {
    backgroundColor: '#2f5bff',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    marginTop: 28,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
