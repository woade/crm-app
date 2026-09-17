import { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { crossAlert } from '@/lib/alert';
import { Link, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Task } from '@/types';

function isOverdue(task: Task) {
  if (!task.due_date || task.completed) return false;
  return new Date(task.due_date) < new Date(new Date().toDateString());
}

export default function TasksListScreen() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompleted, setShowCompleted] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('tasks')
      .select('*, contacts(full_name), deals(title)')
      .order('due_date', { ascending: true, nullsFirst: false });
    if (!error && data) setTasks(data as unknown as Task[]);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const toggleComplete = async (task: Task) => {
    const { error } = await supabase
      .from('tasks')
      .update({ completed: !task.completed })
      .eq('id', task.id);
    if (error) {
      crossAlert('Error', error.message);
      return;
    }
    load();
  };

  const visible = tasks.filter((t) => showCompleted || !t.completed);

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.filterRow} onPress={() => setShowCompleted((v) => !v)}>
        <Text style={styles.filterText}>{showCompleted ? 'Hide completed' : 'Show completed'}</Text>
      </TouchableOpacity>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 100 }}
          ListEmptyComponent={<Text style={styles.empty}>No tasks. Tap + to add one.</Text>}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <TouchableOpacity onPress={() => toggleComplete(item)} style={styles.checkbox}>
                <Text style={{ fontSize: 18 }}>{item.completed ? '✅' : '⬜️'}</Text>
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, item.completed && styles.titleDone]}>{item.title}</Text>
                <Text style={[styles.sub, isOverdue(item) && styles.overdue]}>
                  {item.due_date ? `Due ${item.due_date}` : 'No due date'}
                  {item.contacts?.full_name ? ` · ${item.contacts.full_name}` : ''}
                  {item.deals?.title ? ` · ${item.deals.title}` : ''}
                </Text>
              </View>
            </View>
          )}
        />
      )}

      <Link href="/(tabs)/tasks/new" asChild>
        <TouchableOpacity style={styles.fab}>
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  filterRow: { paddingHorizontal: 16, paddingVertical: 10 },
  filterText: { color: '#2f5bff', fontSize: 14, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  checkbox: { marginRight: 12 },
  title: { fontSize: 16, fontWeight: '600', color: '#1a1a2e' },
  titleDone: { textDecorationLine: 'line-through', color: '#999' },
  sub: { fontSize: 13, color: '#888', marginTop: 2 },
  overdue: { color: '#d64545', fontWeight: '600' },
  empty: { textAlign: 'center', marginTop: 60, color: '#999' },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2f5bff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  fabText: { color: '#fff', fontSize: 28, marginTop: -2 },
});
