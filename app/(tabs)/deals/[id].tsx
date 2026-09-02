import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Alert } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Deal, Task, ActivityNote, STAGE_LABELS } from '@/types';

export default function DealDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [deal, setDeal] = useState<Deal | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<ActivityNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [d, t, n] = await Promise.all([
      supabase.from('deals').select('*, contacts(full_name)').eq('id', id).single(),
      supabase.from('tasks').select('*').eq('deal_id', id).order('due_date', { ascending: true }),
      supabase.from('activity_notes').select('*').eq('deal_id', id).order('created_at', { ascending: false }),
    ]);
    if (d.data) setDeal(d.data as unknown as Deal);
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
    Alert.alert('Delete deal', 'This cannot be undone. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('deals').delete().eq('id', id);
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
      .insert({ body: newNote.trim(), deal_id: id, user_id: user?.id });
    setPosting(false);
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    setNewNote('');
    load();
  };

  if (loading || !deal) return <ActivityIndicator style={{ marginTop: 60 }} />;

  return (
    <>
      <Stack.Screen options={{ title: deal.title }} />
      <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{deal.title}</Text>
            <Text style={styles.sub}>
              {STAGE_LABELS[deal.stage]}
              {deal.value ? ` · $${deal.value.toLocaleString()}` : ''}
            </Text>
            {!!deal.contacts?.full_name && <Text style={styles.sub}>Contact: {deal.contacts.full_name}</Text>}
          </View>
          <TouchableOpacity onPress={() => router.push(`/(tabs)/deals/new?id=${deal.id}`)}>
            <Text style={styles.link}>Edit</Text>
          </TouchableOpacity>
        </View>

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
          <Text style={styles.deleteText}>Delete Deal</Text>
        </TouchableOpacity>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start' },
  name: { fontSize: 22, fontWeight: '700', color: '#1a1a2e' },
  sub: { fontSize: 14, color: '#666', marginTop: 4 },
  link: { color: '#2f5bff', fontSize: 15, fontWeight: '600' },
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
