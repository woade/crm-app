import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Alert, Linking } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Contact, Deal, Task, ActivityNote, STAGE_LABELS } from '@/types';

export default function ContactDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [contact, setContact] = useState<Contact | null>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<ActivityNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [c, d, t, n] = await Promise.all([
      supabase.from('contacts').select('*').eq('id', id).single(),
      supabase.from('deals').select('*').eq('contact_id', id).order('created_at', { ascending: false }),
      supabase.from('tasks').select('*').eq('contact_id', id).order('due_date', { ascending: true }),
      supabase.from('activity_notes').select('*').eq('contact_id', id).order('created_at', { ascending: false }),
    ]);
    if (c.data) setContact(c.data as Contact);
    if (d.data) setDeals(d.data as Deal[]);
    if (t.data) setTasks(t.data as Task[]);
    if (n.data) setNotes(n.data as ActivityNote[]);
    setLoading(false);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleDelete = () => {
    Alert.alert('Delete contact', 'This also removes linked deals, tasks, and notes references. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('contacts').delete().eq('id', id);
          if (error) Alert.alert('Error', error.message);
          else router.back();
        },
      },
    ]);
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    setPosting(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('activity_notes')
      .insert({ body: newNote.trim(), contact_id: id, user_id: user?.id });
    setPosting(false);
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    setNewNote('');
    load();
  };

  if (loading || !contact) return <ActivityIndicator style={{ marginTop: 60 }} />;

  return (
    <>
      <Stack.Screen options={{ title: contact.full_name }} />
      <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{contact.full_name}</Text>
            {!!contact.company && <Text style={styles.company}>{contact.company}</Text>}
          </View>
          <TouchableOpacity onPress={() => router.push(`/(tabs)/contacts/new?id=${contact.id}`)}>
            <Text style={styles.link}>Edit</Text>
          </TouchableOpacity>
        </View>

        {!!contact.phone && (
          <TouchableOpacity onPress={() => Linking.openURL(`tel:${contact.phone}`)}>
            <Text style={styles.contactLine}>📞 {contact.phone}</Text>
          </TouchableOpacity>
        )}
        {!!contact.email && (
          <TouchableOpacity onPress={() => Linking.openURL(`mailto:${contact.email}`)}>
            <Text style={styles.contactLine}>✉️ {contact.email}</Text>
          </TouchableOpacity>
        )}
        {!!contact.notes && <Text style={styles.notesText}>{contact.notes}</Text>}

        <Text style={styles.sectionTitle}>Deals ({deals.length})</Text>
        {deals.length === 0 ? (
          <Text style={styles.emptySection}>No deals linked yet.</Text>
        ) : (
          deals.map((d) => (
            <TouchableOpacity key={d.id} style={styles.card} onPress={() => router.push(`/(tabs)/deals/${d.id}`)}>
              <Text style={styles.cardTitle}>{d.title}</Text>
              <Text style={styles.cardSub}>{STAGE_LABELS[d.stage]}{d.value ? ` · $${d.value}` : ''}</Text>
            </TouchableOpacity>
          ))
        )}

        <Text style={styles.sectionTitle}>Tasks ({tasks.length})</Text>
        {tasks.length === 0 ? (
          <Text style={styles.emptySection}>No tasks linked yet.</Text>
        ) : (
          tasks.map((t) => (
            <View key={t.id} style={styles.card}>
              <Text style={styles.cardTitle}>{t.completed ? '✅ ' : '⬜️ '}{t.title}</Text>
              {!!t.due_date && <Text style={styles.cardSub}>Due {t.due_date}</Text>}
            </View>
          ))
        )}

        <Text style={styles.sectionTitle}>Activity</Text>
        <View style={styles.noteInputRow}>
          <TextInput
            style={styles.noteInput}
            placeholder="Log a call, meeting, or note..."
            value={newNote}
            onChangeText={setNewNote}
            multiline
          />
          <TouchableOpacity style={styles.noteButton} onPress={handleAddNote} disabled={posting}>
            <Text style={styles.noteButtonText}>{posting ? '...' : 'Post'}</Text>
          </TouchableOpacity>
        </View>
        {notes.map((n) => (
          <View key={n.id} style={styles.noteCard}>
            <Text style={styles.noteBody}>{n.body}</Text>
            <Text style={styles.noteDate}>{new Date(n.created_at).toLocaleString()}</Text>
          </View>
        ))}

        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          <Text style={styles.deleteText}>Delete Contact</Text>
        </TouchableOpacity>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start' },
  name: { fontSize: 24, fontWeight: '700', color: '#1a1a2e' },
  company: { fontSize: 15, color: '#666', marginTop: 2 },
  link: { color: '#2f5bff', fontSize: 15, fontWeight: '600' },
  contactLine: { fontSize: 15, color: '#2f5bff', marginTop: 10 },
  notesText: { fontSize: 14, color: '#444', marginTop: 12, lineHeight: 20 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1a1a2e', marginTop: 26, marginBottom: 8 },
  emptySection: { color: '#999', fontSize: 14 },
  card: { backgroundColor: '#f7f8fb', borderRadius: 10, padding: 12, marginBottom: 8 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#1a1a2e' },
  cardSub: { fontSize: 13, color: '#777', marginTop: 2 },
  noteInputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  noteInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 10,
    fontSize: 14,
    minHeight: 44,
    backgroundColor: '#fafafa',
  },
  noteButton: { backgroundColor: '#2f5bff', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12 },
  noteButtonText: { color: '#fff', fontWeight: '600' },
  noteCard: { marginTop: 12, borderLeftWidth: 2, borderLeftColor: '#2f5bff', paddingLeft: 10 },
  noteBody: { fontSize: 14, color: '#333' },
  noteDate: { fontSize: 12, color: '#999', marginTop: 3 },
  deleteButton: { marginTop: 36, alignItems: 'center', padding: 12 },
  deleteText: { color: '#d64545', fontSize: 15, fontWeight: '600' },
});
