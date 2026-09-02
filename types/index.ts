export type DealStage =
  | 'lead'
  | 'contacted'
  | 'proposal'
  | 'negotiation'
  | 'won'
  | 'lost';

export const DEAL_STAGES: DealStage[] = [
  'lead',
  'contacted',
  'proposal',
  'negotiation',
  'won',
  'lost',
];

export const STAGE_LABELS: Record<DealStage, string> = {
  lead: 'Lead',
  contacted: 'Contacted',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  won: 'Won',
  lost: 'Lost',
};

export interface Contact {
  id: string;
  user_id: string;
  full_name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  created_at: string;
}

export interface Deal {
  id: string;
  user_id: string;
  contact_id: string | null;
  title: string;
  value: number | null;
  stage: DealStage;
  created_at: string;
  contacts?: { full_name: string } | null;
}

export interface Task {
  id: string;
  user_id: string;
  contact_id: string | null;
  deal_id: string | null;
  title: string;
  due_date: string | null;
  completed: boolean;
  created_at: string;
  contacts?: { full_name: string } | null;
  deals?: { title: string } | null;
}

export interface ActivityNote {
  id: string;
  user_id: string;
  contact_id: string | null;
  deal_id: string | null;
  body: string;
  created_at: string;
}

// Leads — synced with the LeadScout desktop scanner. Mirrors its schema
// exactly so a status change, note, or logged call shows up on both sides.
export type LeadStatus =
  | 'new'
  | 'contacted'
  | 'noanswer'
  | 'interested'
  | 'proposal'
  | 'notinterested'
  | 'notvalid';

export const LEAD_STATUSES: LeadStatus[] = [
  'new',
  'contacted',
  'noanswer',
  'interested',
  'proposal',
  'notinterested',
  'notvalid',
];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: '🔵 New',
  contacted: '📞 Contacted',
  noanswer: '🔔 No Answer – Follow Up',
  interested: '⭐ Interested',
  proposal: '📋 Proposal Sent',
  notinterested: '🚫 Not Interested',
  notvalid: '❌ Not Valid',
};

export const LEAD_STATUS_COLORS: Record<LeadStatus, string> = {
  new: '#8a8fa3',
  contacted: '#3d84f5',
  noanswer: '#e0a531',
  interested: '#fb923c',
  proposal: '#a78bfa',
  notinterested: '#d64545',
  notvalid: '#d64545',
};

export interface Lead {
  id: string;
  user_id: string;
  place_id: string;
  name: string;
  industry: string | null;
  city: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  rating: number | null;
  reviews: number | null;
  types: string[];
  is_open: boolean | null;
  status: LeadStatus;
  notes: string | null;
  call_log: string[];
  manual_has_site: boolean;
  site_url: string | null;
  maps_url: string | null;
  search_url: string | null;
  created_at: string;
  updated_at: string;
}

// Scheduled calls — replaces the old generic Tasks feature. A simple log of
// an upcoming Zoom/phone call: who with, how to reach them, and when.
export interface ScheduledCall {
  id: string;
  user_id: string;
  contact_name: string;
  phone: string | null;
  email: string | null;
  scheduled_at: string;
  completed: boolean;
  created_at: string;
}
