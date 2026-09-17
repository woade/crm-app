import { createContext, useContext, useEffect, useState, PropsWithChildren, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

/**
 * Who is using the app right now, and whose leads should they see.
 *
 * Two kinds of user:
 *  - Owner: signed in with the account that owns the leads. ownerId is their
 *    own id, isMember is false.
 *  - Member (a hired sales rep): has their own login and a row in
 *    team_members pointing at the owner. ownerId is the OWNER's id, so any
 *    lead they create lands in the owner's pile rather than a private one
 *    only they can see.
 *
 * `initials` is what gets stamped on a lead when it's edited, so the list can
 * show a small badge for who last touched it.
 */
interface WorkspaceValue {
  /** The account that owns the lead data — the owner's id either way. */
  ownerId: string | null;
  /** True when the signed-in user is a rep rather than the owner. */
  isMember: boolean;
  /** Badge initials for the signed-in user, e.g. "B". */
  initials: string;
  displayName: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceValue | undefined>(undefined);

/** Fallback when nobody has set explicit initials: first letter of the email. */
function initialsFromEmail(email: string | undefined): string {
  if (!email) return '?';
  return email.trim().charAt(0).toUpperCase() || '?';
}

export function WorkspaceProvider({ children }: PropsWithChildren) {
  const { session } = useAuth();
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [isMember, setIsMember] = useState(false);
  const [initials, setInitials] = useState('?');
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const userId = session?.user?.id ?? null;
    if (!userId) {
      setOwnerId(null);
      setIsMember(false);
      setInitials('?');
      setDisplayName(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    // Am I a member of someone else's team? maybeSingle() so "no row" is a
    // normal answer (that just means I'm the owner) rather than an error.
    const { data } = await supabase
      .from('team_members')
      .select('owner_id, initials, display_name')
      .eq('member_id', userId)
      .maybeSingle();

    if (data) {
      setOwnerId(data.owner_id);
      setIsMember(true);
      setInitials((data.initials || '').toUpperCase() || initialsFromEmail(session?.user?.email));
      setDisplayName(data.display_name ?? null);
    } else {
      setOwnerId(userId);
      setIsMember(false);
      setInitials(initialsFromEmail(session?.user?.email));
      setDisplayName(null);
    }
    setLoading(false);
  }, [session?.user?.id, session?.user?.email]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <WorkspaceContext.Provider
      value={{ ownerId, isMember, initials, displayName, loading, refresh }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used inside WorkspaceProvider');
  return ctx;
}
