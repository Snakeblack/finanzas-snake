Did not write `context.md` because the task also said “Do not modify files”; no-edit wins. Findings below.

## root_cause_hypothesis

Primary bug: after `localStorage.clear()`, the app loses the `finanzas_v5_unified_idb` migration flag and user names. On next mount:

1. `getInitialData()` sees no migration flag, assumes legacy/localStorage mode.
2. It creates default accounts using fallback names `Usuario A/B`.
3. It writes those default accounts back to localStorage.
4. `executeSilentMigrationIfRequired()` then “migrates” those generated defaults into IndexedDB.
5. `saveStoredAccounts()` bulk-clears the IndexedDB `accounts` store before saving, overwriting real accounts.

So clearing localStorage can overwrite canonical IndexedDB data.

## evidence

- `src/context/FinanzasContext.tsx`
  - lines 251-252: `userAName/userBName` initialize only from localStorage.
  - lines 453-455: migration depends on localStorage flag `finanzas_v5_unified_idb`.
  - lines 470-490 and 2245-2265: fallback account generation still reads names from localStorage.
  - lines 551-556: user names are saved back only to localStorage.
  - lines 2137-2153: backup export reads migrated data only from localStorage.
- `src/services/storageService.ts`
  - lines 247-249: migration skip flag is localStorage-only.
  - lines 256-269: localStorage accounts are migrated to IndexedDB.
  - lines 202-219 + 681-683: bulk save clears the store first, so generated defaults replace existing IDB accounts.
  - lines 529-655: `getInitialData()` can generate default accounts and write them to localStorage before async IDB load.
- `src/components/sync/SyncModal.tsx`
  - lines 149-166: sync export still reads domain data from localStorage.
  - lines 323-345: sync import still writes user names / encrypted payloads into localStorage.
- `src/services/db/idbProvider.ts`
  - lines 25-29: existing `config` store can hold migrated config/profile keys.

## localStorage key table

| Key | Current use | Classification |
|---|---|---|
| `finanzas_theme` | theme | allowed preference |
| `finanzas_hide_sensitive_data` | privacy UI toggle | allowed preference |
| `finanzas_v3_custom_ice_servers` | sync network config | probably allowed functional preference |
| `finanzas_v3_userA_name` / `userB_name` | user profile/domain labels | forbidden; move to IDB config |
| `finanzas_v3_accounts` | accounts | forbidden canonical data |
| `finanzas_v3_transactions` | transactions | forbidden canonical data |
| `finanzas_v3_debts` | debts | forbidden canonical data |
| `finanzas_v3_periods` | periods | forbidden canonical data |
| `finanzas_v2_gemini_key` | Gemini key | forbidden secret/config data |
| `finanzas_v3_ai_chat` | Gemini chat history | forbidden app/domain data |
| `finanzas_v5_unified_idb` | migration flag | unsafe in localStorage; root trigger |
| `finanzas_v3_cleared_v2` | legacy cleanup flag | unsafe legacy marker |
| `finanzas_v3_password_salt/check` | PIN metadata | not UI preference; should likely move to IDB config too |
| `finanzas_v2_*` | legacy migration only | ok as read/remove-only legacy, not canonical |

## recommended RED/GREEN verification

RED first:
1. Add storage regression in `src/__tests__/storageService.test.ts`:
   - save custom accounts to IDB,
   - clear localStorage,
   - call `getInitialData()` then `executeSilentMigrationIfRequired()`,
   - assert IDB accounts are still custom, not default.
2. Add context regression in `src/__tests__/FinanzasContext.test.tsx`:
   - migrate localStorage names/accounts to IDB,
   - clear localStorage,
   - render provider,
   - expect custom user names and accounts survive.
3. Add backup/sync regression: migrated IDB data exports non-null payload when localStorage domain keys are absent.

GREEN strategy:
- `src/services/storageService.ts`
  - add IDB config helpers for user names and migration flag.
  - migrate user names into IDB.
  - stop `getInitialData()` from writing generated defaults into localStorage.
  - prevent migration from overwriting non-empty IDB stores when localStorage flag is missing.
- `src/context/FinanzasContext.tsx`
  - load/save user names via IDB service.
  - update export to serialize current state / IDB data, not localStorage.
- `src/components/sync/SyncModal.tsx`
  - export/import via IDB/state services, not localStorage domain keys.

Verify with:
- `pnpm test -- --run src/__tests__/storageService.test.ts src/__tests__/FinanzasContext.test.tsx`
- `pnpm typecheck`

## risks

- Existing users who already cleared localStorage may have lost names unless recoverable from account labels.
- PIN metadata in localStorage means encrypted DBs can also become inaccessible after localStorage clear.
- Sync encrypted branch still assumes old localStorage ciphertext format.

## skill_resolution

`paths-injected`: loaded both requested skills:
- `C:\Users\sn4ke\.copilot\skills\bug-resolution\SKILL.md`
- `C:\Users\sn4ke\.claude\skills\typescript\SKILL.md`

Engram note: no Engram/memory tool was available in this subagent runtime, so nothing was saved there.