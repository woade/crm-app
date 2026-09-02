# CRM (React Native / Expo)

A mobile CRM for calling and updating leads on the go — built to share one Supabase backend with **LeadScout**, the Mac tool that scans Google Places for local businesses without websites. Leads found in LeadScout show up here automatically; calls, status changes, and notes made on your phone sync back to LeadScout too.

## Features

- Email/password login (Supabase Auth), data scoped per user with row-level security
- **Leads**: the same pipeline as LeadScout (New → Contacted → No Answer → Interested → Proposal Sent → Not Interested / Not Valid), tap-to-call, Google Maps/website links, notes, and a call log — two-way synced with LeadScout
- Contacts: add, edit, search, view detail — for once a lead becomes an ongoing relationship
- Deals: pipeline stages (Lead → Contacted → Proposal → Negotiation → Won/Lost), linked to a contact
- Tasks: due dates, complete/incomplete, optionally linked to a contact or deal
- Activity notes: a timeline of notes on each contact and deal

## 1. Create a Supabase project

1. Go to https://supabase.com, sign in, and create a new project.
2. Once it's ready, open **SQL Editor** and run the contents of `supabase/schema.sql` (in this folder). This creates the `contacts`, `deals`, `tasks`, `activity_notes`, and `leads` tables with row-level security so each user only sees their own data.
3. Go to **Project Settings → API**. You'll need:
   - **Project URL**
   - **anon public** key
4. (Optional) Under **Authentication → Providers → Email**, you can turn off "Confirm email" while testing, so new accounts can sign in immediately without clicking a confirmation link.

## 2. Configure the app

In this folder, copy `.env.example` to `.env` and fill in your values:

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
```

## 3. Run it

You'll need [Node.js](https://nodejs.org) installed, and the **Expo Go** app on your iPhone (App Store).

```bash
cd CRM
npm install
npm start
```

This opens the Expo dev tools with a QR code. Scan it with your iPhone camera (or the Expo Go app) — the app will load on your phone. Your phone and computer need to be on the same Wi-Fi network.

## 4. Connect LeadScout to the same backend

LeadScout (in the sibling `LeadScout/` folder) now has an optional cloud sync layer that talks to the same Supabase project. It still works completely offline with its own local storage if you never set this up — the sync is purely additive.

1. Launch LeadScout (`launchleadscout.command`) and click **☁ Not connected** in the top bar.
2. Paste the same **Project URL** and **anon public key** from step 1.
3. Enter an email/password — the **same account** you use to sign in on the phone. If it doesn't exist yet, entering it here creates it (sign in with that same email/password on the phone afterward).
4. Click **Connect**. Every lead you scan, call, or update status/notes on in LeadScout pushes to Supabase; the same happens in reverse from the phone. Both sides poll on load and update live in the background while connected.

## 5. Use it

1. On first launch, tap **Sign up**, create an account, sign in — use the same login on LeadScout (step 4 above) so both see the same data.
2. Open the **Leads** tab to see everything LeadScout has scanned. Filter by status, search by name/phone/city, tap the phone icon to call directly.
3. After a call, open the lead, tap **Log a Call** (stamps the call in the history and flips status off "New" automatically), update the status dropdown, and jot notes — LeadScout picks these up next time it's open.
4. Contacts/Deals/Tasks work as a general-purpose CRM for once a lead turns into an actual client relationship.

## Project structure

```
app/
  (auth)/           login & signup screens
  (tabs)/
    leads/          list (status filters + search), detail (call/status/notes/call log), manual add
    contacts/       list, detail, add/edit
    deals/          pipeline list, detail, add/edit
    tasks/          list, add
    settings.tsx    sign out
context/
  AuthContext.tsx   Supabase session state
lib/
  supabase.ts       Supabase client
types/
  index.ts          shared TypeScript types
supabase/
  schema.sql         table + RLS definitions to run in Supabase
```

## Notes

- Data storage: Supabase (Postgres). Every row is tagged with `user_id` and protected by row-level security, so only the signed-in user can read or write their own data.
- Sync conflict handling: each `leads` row has an `updated_at` Postgres timestamp; LeadScout tracks a matching local `updatedAt` per lead and whichever side edited most recently wins when the two are merged. In practice you're one person editing from one place at a time, so this rarely matters.
- Due dates for tasks are entered as plain text in `YYYY-MM-DD` format to avoid extra native dependencies — swap in `@react-native-community/datetimepicker` later if you want a native date picker.
- Leads added manually from the phone get a synthetic `place_id` (`manual-<timestamp>`) since they have no Google Place ID.
- To build a real installable iOS app (rather than running through Expo Go), you'd eventually run `npx eas build --platform ios`, which requires an Apple Developer account.
