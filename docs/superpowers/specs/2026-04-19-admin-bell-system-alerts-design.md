# Admin Bell System Alerts Design

## Goal

Replace the current empty admin bell icon with a lightweight system alerts tray that surfaces only actionable system health states already available in the existing codebase.

This is intentionally not a full notification center. No new database tables, no unread state, no background polling loop, and no new backend endpoint are part of this design.

## Scope

In scope:

- Turn the bell button in `src/components/layouts/AdminLayout.tsx` into a clickable tray/dropdown
- Show current system alerts derived from existing runtime state
- Auto-hide alerts when the underlying issue is resolved
- Keep the implementation small and reuse existing endpoints and status sources

Out of scope:

- Notification history
- Read/unread tracking
- Dismiss persistence
- Realtime sockets or push notifications
- New backend APIs for notifications

## Recommended Approach

Use the bell as a `System Alerts Tray`.

Why this approach:

- The bell already exists in `AdminLayout.tsx`
- `AdminLayout` already reacts to integrity-related state via `settings._serverInfo?.integrityNeeded`
- The dashboard already fetches database health through `API.checkDbStatus`
- This gives immediate value without introducing a new notification system

Rejected alternatives:

1. Recent activity feed in the bell
   - More interesting visually, but needs combining multiple audit/log sources and adds more wiring
2. Full notification center
   - Too much surface area for a small fix and would require persistence rules

## Data Sources

The tray will use only existing sources:

1. Integrity alert
   - Source: `settings._serverInfo?.integrityNeeded`
   - Meaning: current install indicates `.htaccess` / integrity action is needed
2. Database repair alert
   - Source: `API.checkDbStatus`
   - Meaning: database schema/status check reports `needs_repair = true`

Optional future source, not part of v1:

- Security stats from `API.securityLogs`

## UX Behavior

### Bell idle state

- Bell stays visible in the admin header
- Red dot appears only when at least one active system alert exists
- The tray should feel intentional even when the system is healthy; it should never look like a dead icon or empty placeholder

### Bell open state

When clicked:

- Toggle a small dropdown tray under the bell
- Render a compact list of current alerts from the latest status snapshot
- If no alerts are active, show a calm empty state:
  - `No active system alerts`
  - `Checked just now` on a fresh scan, or a small current-session freshness label on later opens
- Expose a lightweight `Refresh` action so the admin can rescan without reloading the full admin shell

### Auto-detect / auto-clear behavior

Alerts are state-based, not message-based.

- If the system reports an active issue, it appears
- If the issue is fixed, it disappears automatically on the next refresh/open

That means:

- no manual mark-as-read flow
- no stale notifications hanging around
- no cleanup job needed

### Current-session behavior

The tray should keep its latest scan result for the current mounted admin session.

- The admin shell performs one lightweight DB status scan automatically after load for admin users
- Opening the bell after that should reuse the cached result instead of blocking on another fetch
- A manual `Refresh` action should trigger a new scan when the admin wants to re-check immediately
- Refreshing the browser or remounting the admin shell resets the session cache naturally

## Alert Items

### Integrity repair needed

Shown when:

- `settings._serverInfo?.integrityNeeded === true`

Content:

- Title: `Integrity repair needed`
- Body: brief line telling the admin that server integrity or rewrite rules need attention
- Action: link/button to the existing repair destination

### Database schema update required

Shown when:

- `API.checkDbStatus` returns `success && needs_repair`

Content:

- Title: `Database schema update required`
- Body: short summary based on current dashboard wording
- Action: link to the existing Tools/repair flow

## Fetching Strategy

Keep fetching simple:

1. Integrity status
   - Read directly from existing `settings` prop
2. DB status
   - Perform one lightweight fetch automatically after the admin shell loads
   - Cache that result in local component state for the current mounted session
   - Reuse the cached result when the bell is opened
   - Provide one manual `Refresh` trigger for an explicit rescan

No global polling loop is required.
No shared notification store is required.

## Component Changes

Primary file:

- `src/components/layouts/AdminLayout.tsx`

Expected changes:

- Add local open/close state for the bell tray
- Add small alert state derived from:
  - `settings._serverInfo?.integrityNeeded`
  - `API.checkDbStatus`
- Add a tiny current-session snapshot state for:
  - loading
  - loaded
  - last checked time
- Replace the dead bell button with:
  - click behavior
  - conditional red badge
  - dropdown tray
  - refresh action
  - deliberate healthy-state copy

No backend change is expected for v1.

## Error Handling

If the DB status fetch fails:

- Do not break the admin header
- Keep the tray usable
- Show only the alerts that can still be derived locally
- Avoid noisy toast errors from bell open behavior unless the failure becomes disruptive
- Keep the last successful current-session snapshot if one exists
- If no snapshot exists yet, the tray may continue to show the loading/scan state until the request settles

## Testing / Verification

Minimum verification:

1. Open admin shell with no active issues
   - Status check runs once
   - Bell opens to `No active system alerts`
   - A freshness label appears
   - No red dot
2. Re-open the bell in the same mounted session
   - Existing result is reused without a second blocking fetch
3. Simulate integrity-needed state
   - Bell shows red dot
   - Integrity alert appears
4. Simulate DB repair-needed response
   - Bell shows red dot
   - DB alert appears
5. Trigger `Refresh`
   - The tray shows a fresh scan state and updates to the new result
6. Resolve issue state
   - Alert disappears on the next refresh or new session snapshot
7. Confirm no regression to existing admin header controls
   - dark mode toggle still works
   - search still works
   - profile area still works

## Implementation Constraint

This should remain a minimum viable enhancement.

If implementation starts expanding into shared notification abstractions, new APIs, or persistent state, it has exceeded the approved design.
