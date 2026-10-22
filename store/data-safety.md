# Pen Fight — Google Play Data safety worksheet

> **DRAFT — for the owner to confirm before submitting.** These answers are based on the code and
> database as of 22 October 2026 (Supabase project `iipbtnpdkmklbwoxrmig`). If you add ads,
> analytics, crash reporting, in-app purchases or chat later, these answers must change.
>
> Before submitting: replace `CONTACT_EMAIL` in `public/privacy.html` and `public/delete-account.html`,
> deploy the website, and use the live URLs below.

## URLs for Play Console

| Field | Value |
|---|---|
| Privacy policy URL | `https://<your-domain>/privacy.html` (Vercel `cleanUrls` also serves it as `/privacy`) |
| Delete account URL (App content → Data deletion) | `https://<your-domain>/delete-account.html` |

## Section 1 — Data collection and security

| Question | Answer | Notes |
|---|---|---|
| Does your app collect or share any of the required user data types? | **Yes** | Only when a player signs in with Google. Offline profiles stay on the device. |
| Is all of the user data collected by your app encrypted in transit? | **Yes** | All traffic is HTTPS/WSS to Supabase (and Vercel for the website). |
| Which account creation methods does your app support? | **OAuth** (Sign in with Google via Supabase Auth) | Players can also skip sign-in and use a local offline profile. |
| Do you provide a way for users to request that their data be deleted? | **Yes** | In-app: Settings → Account → Delete account (calls `public.delete_my_account()`). Web: delete-account page + email request. |
| Can users request deletion of some data without deleting their account? (Data deletion page) | **Yes** — *owner to confirm* | Settings → Reset progress wipes coins, pens, stats and career; the cloud copy is overwritten on the next sync. Match history is not removed by this. |
| Has your app been independently validated against a global security standard? | **No** | Optional. |
| Is your app's data collection compliant with the Families policy? | N/A | The app is not directed at children under 13; set the target audience to 13+ in App content. |

## Section 2 — Data types

"Shared" = transferred to a third party. Transfers to **service providers that process data on our behalf**
(Supabase, Vercel) are **not** sharing under Google's definition, so **nothing is shared**.

| Category → Data type | Collected | Shared | Ephemeral? | Required / optional | Purposes |
|---|---|---|---|---|---|
| Personal info → **Name** | Yes | No | No | Optional (offline play needs no account) | Account management, App functionality |
| Personal info → **Email address** | Yes | No | No | Optional | Account management |
| Personal info → **User IDs** | Yes | No | No | Optional | Account management, App functionality |
| Photos and videos → **Photos** (Google profile photo) — *owner to confirm* | Yes | No | No | Optional | App functionality (avatar) |
| App activity → **App interactions** (coins, XP, level, trophies, pens/desks owned, career, achievements, match stats, match results, last online time) | Yes | No | No | Optional | App functionality |
| App activity → Other user-generated content (custom gamer name) — *optional to declare; it is also covered by "Name"* | Yes | No | No | Optional | App functionality |

### Not collected (answer "No")

Location (approximate or precise), Financial info / purchase history, Health and fitness, Messages (the game has no chat),
Photos/videos other than the profile photo, Audio, Files and docs, Calendar, Contacts, Web browsing history,
Installed apps, In-app search history, App info and performance (no crash logs, no diagnostics, no analytics SDK),
Device or other IDs (no advertising ID; the random local player ID never leaves the device).

## Notes behind the answers

- **Where the data comes from:** Google sign-in via Supabase Auth gives name, email, profile photo and an account ID.
  The email lives in Supabase Auth; the game's own profile sync does not upload it, and it is not readable
  through the public API (column-level grants in `supabase/migrations/20261021120000_secure_rls_and_realtime.sql`).
- **Public visibility:** gamer name, profile photo, level, trophies, coins and stats appear on the in-game leaderboard,
  in online rooms and in match results. This is core functionality the player sees and expects, not "sharing".
- **Online rooms** (`deskduel_rooms`) are temporary and auto-deleted by `cleanup_stale_deskduel_rooms()`
  (lobbies/finished rooms after 10 minutes, running games after 2 hours). Live moves go over Supabase Realtime
  broadcast and are not stored.
- **Service providers (processors):** Supabase (database, auth, realtime), Vercel (website hosting; standard request
  logs such as IP addresses), Google (sign-in).
- **No ads, no data selling, no third-party analytics or tracking.**
- **Account deletion** (`supabase/migrations/20261022120000_delete_my_account.sql`): deletes the profile row, rooms
  hosted by the player and the `auth.users` row (cascading identities and sessions). Match history is kept but
  anonymised (`reported_by`/`winner_id` set to null, the player's name becomes "Deleted player", their id is removed
  from `players`). The app then signs out and clears the local save.
- **Retention:** account data is kept while the account exists; backups held by Supabase expire on the provider's schedule.
