import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Switch } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { getNoWebsiteOnly, setNoWebsiteOnly } from '@/lib/settings';

export default function SettingsScreen() {
  const { session, signOut } = useAuth();
  const [noWebsiteOnly, setNoWebsiteOnlyState] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getNoWebsiteOnly().then((v) => {
      setNoWebsiteOnlyState(v);
      setLoaded(true);
    });
  }, []);

  const handleToggle = async (value: boolean) => {
    setNoWebsiteOnlyState(value);
    await setNoWebsiteOnly(value);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Signed in as</Text>
      <Text style={styles.email}>{session?.user.email}</Text>

      <Text style={styles.sectionTitle}>Leads</Text>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>No website only</Text>
          <Text style={styles.rowSub}>Hide leads that already have a website, everywhere in the app.</Text>
        </View>
        {loaded && (
          <Switch value={noWebsiteOnly} onValueChange={handleToggle} trackColor={{ true: '#2f5bff' }} />
        )}
      </View>

      <TouchableOpacity style={styles.button} onPress={() => signOut()}>
        <Text style={styles.buttonText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 24, paddingTop: 40 },
  label: { fontSize: 13, color: '#888' },
  email: { fontSize: 17, fontWeight: '600', color: '#1a1a2e', marginTop: 4, marginBottom: 24 },
  sectionTitle: { fontSize: 13, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f7f8fb',
    borderRadius: 10,
    padding: 14,
    marginBottom: 32,
  },
  rowTitle: { fontSize: 15, fontWeight: '600', color: '#1a1a2e' },
  rowSub: { fontSize: 12, color: '#888', marginTop: 3 },
  button: {
    backgroundColor: '#d64545',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
