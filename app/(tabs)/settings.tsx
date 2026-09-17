import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Switch,
  TextInput,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import { supabase } from '@/lib/supabase';
import { getNoWebsiteOnly, setNoWebsiteOnly } from '@/lib/settings';
import { TeamMember } from '@/types';

export default function SettingsScreen() {
  const { session, signOut } = useAuth();
  const { isMember, initials, displayName, refresh } = useWorkspace();
  const [noWebsiteOnly, setNoWebsiteOnlyState] = useState(true);
  const [loaded, setLoaded] = useState(false);

  const [team, setTeam] = useState<TeamMember[]>([]);
  const [teamLoading, setTeamLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteInitials, setInviteInitials] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    getNoWebsiteOnly().then((v) => {
      setNoWebsiteOnlyState(v);
      setLoaded(true);
    });
  }, []);

  const loadTeam = useCallback(async () => {
    if (isMember) {
      setTeamLoading(false);
      return;
    }
    setTeamLoading(true);
    const { data } = await supabase
      .from('team_members')
      .select('*, profiles(email)')
      .order('created_at', { ascending: true });
    setTeam((data as TeamMember[]) ?? []);
    setTeamLoading(false);
  }, [isMember]);

  useEffect(() => {
    loadTeam();
  }, [loadTeam]);

  // Adding a rep is a lookup, not an invite email: they sign up themselves
  // first, which creates their login and a profiles row. Linking that row to
  // your account is what actually grants access to your leads.
  const handleAddMember = async () => {
    const email = inviteEmail.trim().toLowerCase();
    const ini = inviteInitials.trim().toUpperCase();
    if (!email || !ini) {
      Alert.alert('Missing info', 'Enter the rep’s email and the initials to show on their edits.');
      return;
    }
    setAdding(true);
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('email', email)
      .maybeSingle();

    if (!profile) {
      setAdding(false);
      Alert.alert(
        'No account with that email',
        'Ask them to open the app and sign up with this exact email first, then add them here.'
      );
      return;
    }
    if (profile.id === session?.user?.id) {
      setAdding(false);
      Alert.alert('That’s you', 'You already have full access to your own leads.');
      return;
    }

    const { error } = await supabase.from('team_members').insert({
      owner_id: session?.user?.id,
      member_id: profile.id,
      initials: ini.slice(0, 3),
      display_name: email.split('@')[0],
    });
    setAdding(false);
    if (error) {
      Alert.alert('Could not add', error.message);
      return;
    }
    setInviteEmail('');
    setInviteInitials('');
    loadTeam();
  };

  const handleRemoveMember = (member: TeamMember) => {
    Alert.alert(
      'Remove access?',
      `${member.profiles?.email ?? member.display_name ?? 'This person'} will immediately stop seeing your leads. Their login still works, and any edits they already made stay put.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await supabase.from('team_members').delete().eq('id', member.id);
            loadTeam();
          },
        },
      ]
    );
  };

  const handleToggle = async (value: boolean) => {
    setNoWebsiteOnlyState(value);
    await setNoWebsiteOnly(value);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 24, paddingTop: 40, paddingBottom: 60 }}>
      <Text style={styles.label}>Signed in as</Text>
      <View style={styles.meRow}>
        <Text style={styles.email}>{session?.user.email}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{initials}</Text>
        </View>
      </View>
      {isMember && (
        <Text style={styles.memberNote}>
          You’re on {displayName ? `${displayName}’s` : 'a'} team. Your edits are marked “{initials}”.
        </Text>
      )}

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

      {/* Only the account that owns the leads manages the team. A rep sees
          their own badge above but no controls. */}
      {!isMember && (
        <>
          <Text style={styles.sectionTitle}>Team</Text>
          {teamLoading ? (
            <ActivityIndicator style={{ marginBottom: 20 }} />
          ) : team.length === 0 ? (
            <Text style={styles.teamEmpty}>
              No one else has access. Add a sales rep below and their edits will show their initials on
              each lead.
            </Text>
          ) : (
            team.map((m) => (
              <View key={m.id} style={styles.memberRow}>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{m.initials}</Text>
                </View>
                <Text style={styles.memberEmail} numberOfLines={1}>
                  {m.profiles?.email ?? m.display_name ?? 'Team member'}
                </Text>
                <TouchableOpacity onPress={() => handleRemoveMember(m)}>
                  <Text style={styles.removeText}>Remove</Text>
                </TouchableOpacity>
              </View>
            ))
          )}

          <Text style={styles.addHint}>
            Have them sign up in the app first, then add that email here.
          </Text>
          <View style={styles.addRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={inviteEmail}
              onChangeText={setInviteEmail}
              placeholder="rep@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TextInput
              style={[styles.input, styles.initialsInput]}
              value={inviteInitials}
              onChangeText={setInviteInitials}
              placeholder="B"
              autoCapitalize="characters"
              maxLength={3}
            />
          </View>
          <TouchableOpacity
            style={[styles.addButton, adding && { opacity: 0.6 }]}
            onPress={handleAddMember}
            disabled={adding}
          >
            <Text style={styles.addButtonText}>{adding ? 'Adding…' : 'Give Access'}</Text>
          </TouchableOpacity>
        </>
      )}

      <TouchableOpacity style={styles.button} onPress={() => signOut()}>
        <Text style={styles.buttonText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  label: { fontSize: 13, color: '#888' },
  meRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, marginBottom: 24 },
  email: { fontSize: 17, fontWeight: '600', color: '#1a1a2e', flexShrink: 1 },
  memberNote: { fontSize: 12, color: '#888', marginTop: -18, marginBottom: 24 },
  badge: {
    backgroundColor: '#eef0ff',
    borderWidth: 1,
    borderColor: '#c9cfff',
    borderRadius: 999,
    minWidth: 26,
    paddingHorizontal: 7,
    paddingVertical: 3,
    alignItems: 'center',
  },
  badgeText: { fontSize: 12, fontWeight: '800', color: '#4650c4' },
  teamEmpty: { fontSize: 13, color: '#888', marginBottom: 14, lineHeight: 19 },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f7f8fb',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  memberEmail: { flex: 1, fontSize: 14, color: '#1a1a2e' },
  removeText: { color: '#d64545', fontSize: 13, fontWeight: '600' },
  addHint: { fontSize: 12, color: '#888', marginTop: 10, marginBottom: 8 },
  addRow: { flexDirection: 'row', gap: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    backgroundColor: '#fafafa',
  },
  initialsInput: { width: 70, textAlign: 'center', fontWeight: '700' },
  addButton: {
    backgroundColor: '#2f5bff',
    borderRadius: 10,
    padding: 13,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 32,
  },
  addButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
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
