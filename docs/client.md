# Client — `menu-semana/client`

Technical reference for the React/Vite frontend.
Maintenance rule: [`SelfDocumenting.md`](./SelfDocumenting.md). Backend counterpart: [`server.md`](./server.md).

> **Terminology mapping.** This repo has no `modules/` folder and no SQL database. This document
> maps the requested "node / modal / db table" structure onto what actually exists: full-screen and
> tab components are documented as **nodes** (§4), overlay dialogs as **modals** (§5), and Firestore
> **collections** stand in for tables (§8). `lib/userStorage.js` is the "db package" (§7.7).

---

## 0. Quick index — "I need to change X, where do I look?"

| Task | Section | Files |
|---|---|---|
| Add/change a field on a recipe | §3, §5.1, §7.9 | `MealEditor.jsx`, `data/seed.js` (`normalizeMeal`) |
| Change how the week is auto-filled | §4.1, §5.2 | `App.jsx` (`autofill`, `fillWeek`), `PlanWizard.jsx` |
| Change the shopping-list aggregation | §4.1, §4.5 | `App.jsx` (`shopping` memo), `ListaTab.jsx` |
| Change what gets saved / loaded | §4.1, §7.7, §8, §9.1 | `App.jsx` (load + save effects), `lib/userStorage.js` |
| Touch login / guest / account linking | §4.2, §4.3, §7.2 | `AuthGate.jsx`, `Login.jsx`, `lib/auth.js` |
| Touch household sharing | §5.4, §7.7, §9.2 | `SharePanel.jsx`, `App.jsx` (`handleJoin`/`handleLeave`), `lib/userStorage.js` |
| Touch AI import / kcal estimation | §5.1, §7.1, §9.3 | `MealEditor.jsx`, `lib/api.js`, then [`server.md`](./server.md) |
| Change the calendar export | §4.4, §7.5 | `lib/ics.js`, `SemanaTab.jsx` (`handleExportICS`) |
| Change the day pickers / dropdown behavior | §6 (`Autocomplete`) | `components/ui.jsx` (`Autocomplete`) |
| Add a Firestore field or collection | §8, then every §4/§5 "DB schema" field | `lib/userStorage.js`, `README.md` rules |

---

## 1. Architecture at a glance

**Stack**: React 18 + Vite 6 · Tailwind v4 (`@tailwindcss/vite`; `index.css` is just
`@import "tailwindcss";`) · `lucide-react` icons · Firebase JS SDK v12 (Auth + Firestore) ·
`posthog-js` (optional, lazily imported).

**Entry chain**: `index.html` → [`main.jsx`](../client/src/main.jsx) (calls `initAnalytics()`, mounts
`<AuthGate/>` in `<StrictMode>`) → [`AuthGate.jsx`](../client/src/components/AuthGate.jsx) →
[`Login.jsx`](../client/src/components/Login.jsx) *or* [`App.jsx`](../client/src/App.jsx).

**Ownership model**: `App.jsx` is the single owner of all application state. Every tab and modal is
a controlled component — it receives values plus setters and never persists anything itself. There
is no Redux/Context/reducer layer; all wiring is explicit props.

**Persistence model**: the browser talks to Firestore **directly** via the Firebase SDK. The Node
backend is never involved in reading or writing user data — it only performs AI extraction
(§9.3). The entire planner state for a household is one JSON string in one Firestore document.

```
                    ┌───────────────────────────────────────────┐
  Firebase Auth ───► AuthGate  (user: undefined | null | User)   │
                    └───────┬───────────────────────┬───────────┘
                            │ null                  │ User
                       ┌────▼─────┐          ┌──────▼──────────────────────────────┐
                       │  Login   │          │ App  (owns meals, weeks, weekStart, │
                       └────┬─────┘          │       healthyOnly, modal flags)     │
                            │                └──┬──────────────┬──────────────┬────┘
                    signInAsGuest +             │ props+setters│              │
                    joinHousehold               │              │              │
                                          ┌─────▼────┐  ┌──────▼─────┐  ┌─────▼──────┐
                                          │ SemanaTab│  │  ListaTab  │  │ RecetasTab │
                                          └─────┬────┘  └────────────┘  └─────┬──────┘
                                                │ openWizard/openWeeksList    │ setEditing
                                          ┌─────▼──────────────────────┐ ┌────▼───────┐
                                          │ PlanWizard │ WeeksList     │ │ MealEditor │──► lib/api.js ──► server
                                          └────────────────────────────┘ └────────────┘
   App ──► lib/userStorage.js ──► Firestore:  users/{uid} (pointer)  ·  households/{id} (data)
```

**Env vars** (`client/.env`, all baked in at build time by Vite):

| Var | Required | Effect if missing |
|---|---|---|
| `VITE_FIREBASE_API_KEY` + `_AUTH_DOMAIN` `_PROJECT_ID` `_STORAGE_BUCKET` `_MESSAGING_SENDER_ID` `_APP_ID` | Yes (6) | Firebase init fails → app unusable |
| `VITE_API_URL` | Prod only | Falls back to `''` → relative `/api/*`, which works in dev via the Vite proxy (`vite.config.js` → `http://localhost:3001`) but 404s in prod |
| `VITE_POSTHOG_KEY` | No | Analytics fully disabled; the ~100KB SDK is never even downloaded (§7.8) |
| `VITE_POSTHOG_HOST` | No | Defaults to `https://us.i.posthog.com` |

**Deployment**: `render.yaml` defines the static site `menu-semana-web-beta` (build
`npm install && npm run build`, publish `client/dist`). The `-beta` suffix is deliberate while the
`feature/cuentas` branch is unmerged — see the comment at the top of `render.yaml`.

---

## 2. Invariants & gotchas

Non-obvious rules. Breaking one of these produces bugs that are hard to trace back to their cause.

1. **`<App key={user.uid}/>`** (`AuthGate.jsx`) — the `key` forces a full remount when a
   different account signs in in the same tab, which is the *only* thing resetting `App`'s
   `useState`s. Never remove it, and never assume `user.uid` can change within one `App` instance.
2. **`setDoc(..., {merge: true})` in `getHouseholdStorage.set`** (`userStorage.js`) — without
   `merge`, every ordinary save would erase the `members` array that lives on the same document,
   silently revoking everyone else's access to the shared household.
3. **Lunch modes are mutually exclusive.** `lunchReuseAll` (reuse yesterday's dinner, week-wide)
   and a populated `lunchPlan` (a real lunch recipe per day) represent two different user choices
   (the `lunchMode` state in `PlanWizard.jsx`). Three places must agree on "only count lunch when picked by hand,
   otherwise it's yesterday's dinner and its ingredients were already counted": the `shopping`
   memo in `App.jsx`, the kcal roll-up in `SemanaTab.jsx`, `byRecipeText` in `ListaTab.jsx`, and
   `buildWeekICS` in `ics.js`. Change one, change all four.
4. **Monday never shows a leftover suggestion** — `prevCena` is `i > 0 ? …` (`SemanaTab.jsx`),
   so day index 0 has no previous dinner by construction.
5. **`uid()` is `Math.random().toString(36).slice(2,9)`** (`seed.js`) — 7 base-36 chars, not
   collision-proof and not cryptographic. Acceptable only because each household holds a few dozen
   recipes. Don't reuse it for anything security- or merge-sensitive.
6. **`autofill` is only ever called from `PlanWizard`'s `onApply`** (`App.jsx`). The
   "Sorpréndeme" button opens the wizard rather than filling directly (`SemanaTab.jsx`), so
   `autofill`'s parameter defaults (`reuseDinner = true, fillLunch = false`) are currently dead
   code paths — the only caller always passes all four explicitly.
7. **A shopping row's identity is its `key` field, never its display text.** `App.jsx`'s `shopping` memo
   builds `key` from the same normalized values used for grouping — `` `${store}:${item}|${unit}` ``
   lowercased and trimmed, or `` `pantry:${item}` `` — and `ListaTab` uses `x.key` verbatim for both
   the React key and the `checked` map. The `item`/`unit` fields on the row keep the *first-seen*
   original casing and are display-only. Never rebuild a check-off key from them: the first-seen
   casing changes whenever a different recipe contributes the ingredient first, which silently
   orphans the check-off. (This is why `checked` entries saved before this contract existed no
   longer match — a one-time, per-week reset of check marks.)
8. **A brand-new household document is seeded, not empty.** `getHouseholdStorage.get` returns
   `null` unless the document has `key === 'planner-v1'` **and** a string `value`
   (`userStorage.js`). Joining a code that doesn't exist yet creates
   `households/{code}` holding only `{members:[uid]}` — so `get` returns `null` and `App` seeds
   `SEED_MEALS` (§9.2).
9. **localStorage is read exactly once, never written by the app anymore.** The one-time
   `storage.get` fallback (`App.jsx`) only runs when the Firestore document does not exist;
   a returning user's cloud data is never overwritten by stale local data, and localStorage is
   never cleared (§7.6).
10. **The saved document is a JSON *string*, not a Firestore map** (`value` field, §8). Firestore
    queries/indexes therefore cannot see inside it; any future server-side or query-based feature
    needs a schema change, not just a read.

---

## 3. Shared data model

Defined and normalized in [`data/seed.js`](../client/src/data/seed.js).

**Meal** — one recipe in the bank (`normalizeMeal` in `seed.js`):

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | From `uid()`; assigned by `withIds` (seed) or `App.saveMeal` (new) |
| `name` | `string` | Trimmed on save; blank name blocks saving (`MealEditor.jsx`) |
| `cat` | `string` | Free text; defaults to `'Otros'` if blank on save |
| `easy` | `boolean` | ⚡ — the only tag `autofill` honors for busy days |
| `favorite` / `rating` | `boolean` / `0..5` | Personal taste; never set by AI import |
| `healthy` | `boolean` | 🥗 — drives `healthyOnly` filtering |
| `left` | `boolean` | "rinde" — leftovers viable as tomorrow's lunch |
| `types` | `string[]` | Subset of `'desayuno' \| 'almuerzo' \| 'cena'`; `[]` is allowed but hides the recipe from every picker |
| `kcal` / `servings` | `number \| null` | **Tri-state**: `null` = never estimated, ≠ `0` |
| `videoUrl` / `sourceUrl` | `string` | `''` when absent |
| `steps` | `string[]` | Blank lines filtered on save |
| `ing` | `Ingredient[]` | Entries with a blank `item` dropped on save |

**Ingredient** (`normalizeIng` in `seed.js`):
```ts
{ item: string, store: 'costco' | 'walmart' | 'both', qty: number | null, unit: string, pantry: boolean }
```
`unit` is one of `'' | unidad | g | kg | ml | l | lb | oz | taza | cda | cdta | diente`
(the `UNITS` list in `MealEditor.jsx`; the backend normalizes to the same vocabulary — see
[`server.md §3`](./server.md#3-data-contracts-dtos)). `pantry: true` means "already at home" —
it moves the item to a separate, quantity-less list section, it does **not** exclude it from the
`.ics` prep reminder (`buildAlarmDescription` in `ics.js`).

**Week** — one entry of `weeks`, keyed by the Monday's ISO date. The empty shape is the shared
`EMPTY_WEEK` constant in `seed.js`, imported by both `App.jsx` (state fallback) and
`WeeksList.jsx` (an active week not yet saved) so the two cannot drift apart:
```ts
{
  plan:     { [dayKey]: mealId },  // dinner
  bfPlan:   { [dayKey]: mealId },  // breakfast
  lunchPlan:{ [dayKey]: mealId },  // lunch — ONLY when explicitly picked (see §2.3)
  busyDays: { [dayKey]: boolean },
  checked:  { [itemKey]: boolean },// shopping check-offs, per week
  lunchReuseAll: boolean,
}
```
`dayKey` ∈ `lun mar mie jue vie sab dom` (`DAYS` in `seed.js`) — fixed 7-day week, index order
matters (`addDays(weekStart, i)`).

**Persisted document** — the JSON string stored in Firestore field `value` (§8):
```ts
{ schemaVersion: 2, meals: Meal[], weeks: { [weekStartISO]: Week }, weekStart: string, healthyOnly: boolean }
```
`STORE_KEY = 'planner-v1'`, `SCHEMA_VERSION = 2` (`App.jsx`). v2 = unified meal bank
(breakfasts became ordinary Meals tagged `types:['desayuno']`); v1 documents are migrated on load
(§9.1).

---

## 4. Nodes

### 4.1 `App.jsx` — root shell
**File**: [`client/src/App.jsx`](../client/src/App.jsx) · rendered by `AuthGate`

- **Functionality**. Resolves which household the signed-in account belongs to, loads and migrates
  the planner document, owns every piece of application state, derives the aggregated shopping
  list, debounce-saves back to Firestore, and renders the header, tab nav, active tab and any open
  modal.

- **UI functions**.
  | Function | Behavior |
  |---|---|
  | tab buttons | `setTab(k)` + `track('tab_view', {tab:k})` |
  | `updateWeek(key, updater)` | Writes one field of the **active** week only; all setters below are built on it |
  | `setPlan/setBfPlan/setLunchPlan/setBusyDays/setChecked/setLunchReuseAll` | Per-field week setters passed down as props |
  | `toggleBusyDay(key)` | Flips one day's busy flag |
  | `shuffle(a)` / `fillWeek(pool, busy)` | Random distribution across the 7 days without repeating until the pool is exhausted; busy days draw from the `easy` subset (falling back to the whole pool if no easy recipe exists) |
  | `autofill({busy, healthy, reuseDinner, fillLunch})` | Fills dinner + breakfast (+ lunch if `fillLunch`), clears `checked`, sets `lunchReuseAll`. Per-type pool falls back to the unfiltered bank when the healthy filter empties it |
  | `clearWeek()` | Empties plan/bfPlan/lunchPlan/checked and unsets `lunchReuseAll` |
  | `deleteWeek(key)` | Removes a whole week from `weeks` |
  | `saveMeal(m)` | Upsert: replaces by `id`, or appends with a fresh `uid()` |
  | `handleJoin/handleLeave` | Switch household, resetting `meals` to `null` so the loader re-runs |
  | `handleUpgrade` | Links the anonymous account to Google; maps `auth/credential-already-in-use` to a recovery prompt and swallows `auth/popup-closed-by-user` |
  | `handleUseGoogleAccount` | Escape hatch from that conflict: signs in with the Google account instead of linking |

- **Permutations / states**.
  | Condition | Render / behavior |
  |---|---|
  | `loadError` truthy | Full-screen error + "Cerrar sesión"; nothing else mounts |
  | `meals === null` | Full-screen "Cargando…" — covers first load *and* household switches |
  | `householdId === null` | `userStore` is `null`; both Firestore effects no-op |
  | `user.isAnonymous` | Guest header: "Modo invitado" + "Vincular con Google" + "Salir" |
  | else | Google header: avatar + display name + "Compartir" + "Cerrar sesión" |
  | `upgradeError.conflict` | Adds the "Iniciar sesión con esa cuenta" button |
  | `tab` = `semana`/`lista`/`recetas` | One of the three tab nodes |
  | `editing` / `wizardOpen` / `weeksListOpen` / `shareOpen` | Mounts the corresponding modal — independent flags, not a stack |
  | legacy document (`!schemaVersion \|\| < 2`) | One-time v1→v2 migration, see §9.1 |
  | Firestore doc missing + localStorage present | One-time upload of local data |

- **View / Inputs / Outputs**.
  - *Input*: prop `user` (Firebase `User`: `uid`, `isAnonymous`, `displayName`, `photoURL`).
  - *Renders*: header, sticky tab nav, active tab, conditional modals.
  - *Outputs / side effects*: debounced (300 ms) `userStore.set(STORE_KEY, JSON.stringify({…}))`
    on any change to `meals`, `weeks`, `weekStart`, `healthyOnly`, or `userStore`;
    analytics events; Firebase auth calls.
  - *Derived*: `mealById` (id→Meal lookup) and `shopping` — grouped by store with
    quantities summed per `item|unit`, pantry items split out quantity-less. Each row is
    `{key, item, qty, hasQty, unit, from[]}` (pantry rows: `{key, item, from[]}`), where `key` is
    the stable, normalized check-off identity described in §2.7 and `from` lists the contributing
    recipes.

- **Service wire-up** (in execution order):
  1. `resolveHouseholdId(user.uid)` — §7.7 — on mount, `.catch` → `loadError`.
  2. `getHouseholdStorage(householdId)` → memoized `userStore`.
  3. `userStore.get(STORE_KEY)` → fallback `storage.get(STORE_KEY)` (§7.6) → `userStore.set(...)`.
  4. `normalizeMeal` / `withIds` / `breakfastNameToMeal` / `mondayOf` for load-time normalization.
  5. Debounced `userStore.set(...)` writer.
  6. `joinHousehold` / `leaveHousehold`; `signOutUser` / `signInWithGoogle` / `upgradeGuestToGoogle`.
  7. `track('tab_view', …)`.

- **Associated models / DTOs**: Meal, Ingredient, Week, persisted document (§3); `EMPTY_WEEK`
  (imported from `data/seed.js`, §7.9); shopping row `{key, item, qty, hasQty, unit, from[]}` and
  pantry row `{key, item, from[]}`.

- **DB package calls**: `resolveHouseholdId`, `getHouseholdStorage(...).get/.set`, `joinHousehold`,
  `leaveHousehold` — all from `lib/userStorage.js` (§7.7).

- **DB schema**: `households/{householdId}` (fields `key`, `value`, `updatedAt`, and `members`
  which it must never clobber) and, indirectly, `users/{uid}` (`householdId` pointer). §8.

---

### 4.2 `AuthGate.jsx` — authentication gate
**File**: [`client/src/components/AuthGate.jsx`](../client/src/components/AuthGate.jsx)

- **Functionality**. Mounted by `main.jsx` instead of `App`. Subscribes to Firebase auth state and
  renders loading / `Login` / `App`. Login is mandatory — there is deliberately no local-only mode
  to maintain alongside the cloud one.
- **UI functions**. None; purely state-driven rendering.
- **Permutations / states**. `user === undefined` → "Cargando…"; `user === null` → `<Login/>`;
  otherwise `<App user={user} key={user.uid}/>` (see §2.1 for why the `key` matters).
- **View / Inputs / Outputs**. No props. Output is one of the three renders; no callbacks.
- **Service wire-up**. `onAuthChange(setUser)` (§7.2), unsubscribed on unmount.
- **Associated models / DTOs**. Firebase `User`.
- **DB package calls / DB schema**. None — delegated to `App`.

---

### 4.3 `Login.jsx` — sign-in screen
**File**: [`client/src/components/Login.jsx`](../client/src/components/Login.jsx)

- **Functionality**. Shown when signed out. Three entry paths: Google sign-in, guest (anonymous)
  sign-in, and "guest + join a shared household by code" for someone without a Google account who
  only wants access to another person's data.
- **UI functions**.
  - `handleClick` — `signInWithGoogle()`.
  - `handleGuest` — `signInAsGuest()`, then `track('guest_start')`.
  - `handleJoinWithCode` — `signInAsGuest()` → `joinHousehold(code, cred.user.uid)` →
    `track('guest_start', {joined_with_code: true})`.
  - `mapAuthError(code)` — maps `auth/popup-closed-by-user`, `auth/popup-blocked`,
    `auth/unauthorized-domain`, `auth/operation-not-allowed` to Spanish messages, with a generic
    fallback.
  - `GoogleIcon` — inline SVG, avoids an icon dependency for the official multicolor "G".
- **Permutations / states**. `busy = loading || loadingGuest || loadingJoin` disables all three
  buttons while any flow runs; each button shows its own progress label. `joinOpen` toggles the
  code sub-form; the join button additionally requires `joinCode.trim()`. `error` renders an
  inline banner.
- **View / Inputs / Outputs**. No props, no callbacks — success is observed by `AuthGate`'s
  `onAuthChange` listener, which swaps the whole screen.
- **Service wire-up**. `signInWithGoogle`, `signInAsGuest` (§7.2); `joinHousehold` (§7.7);
  `track` (§7.8).
- **Associated models / DTOs**. Firebase `UserCredential` (only `cred.user.uid` is used).
- **DB package calls**. `joinHousehold(code, uid)` in the join-by-code path only.
- **DB schema**. `households/{code}.members` (array-union) + `users/{uid}.householdId` — and note
  §2.8: joining a non-existent code creates a fresh, seeded household rather than failing.

---

### 4.4 `SemanaTab.jsx` — "Semana" tab (weekly planner)
**File**: [`client/src/components/SemanaTab.jsx`](../client/src/components/SemanaTab.jsx)

- **Functionality**. The planning surface: one card per day with breakfast / lunch / dinner
  autocompletes, a busy-day toggle, kcal roll-ups, the leftover-lunch hint, collapsible dinner
  steps, week navigation, and `.ics` export.
- **UI functions**.
  - Three `Autocomplete` pickers per day writing `bfPlan` / `lunchPlan` / `plan`.
  - `toggleBusyDay(d.key)` and the per-day "Mostrar todas / Solo fáciles" override, held in
    local `showAllDay` state.
  - `<input type="date">` sets `weekStart` directly; "Mis semanas" calls `openWeeksList`.
  - "Sorpréndeme" calls `openWizard` (**not** `autofill` — §2.6); "Limpiar" calls `clearWeek`.
  - `handleExportICS` — `buildWeekICS(...)` then `downloadICS(..., 'menu-semana-<weekStart>.ics')`.
- **Permutations / states**.
  | State | Dinner picker options |
  |---|---|
  | day not busy | all `cenaCandidates`, ungrouped |
  | busy, filter active (`!showAllDay[key]`) | `easyMeals` only |
  | busy, "Mostrar todas" | grouped: `⚡ Fáciles (recomendadas)` then `Otras` |

  Also: `showLeftover = !!prevCena && (lunchReuseAll || prevCena.left)` — changes only the
  lunch **label and placeholder**, never the stored value; Monday never qualifies (§2.4).
  `weekKcal`/`avgDayKcal` average over days that actually have kcal data, not over 7.
  The `Calendario` button is disabled while `!hasAnyPlan`. Dinner detail chips
  (favorite/rating/healthy/left/kcal/per-serving/video) and the `<details>` step list render only
  when a dinner is selected and that field exists.
- **View / Inputs / Outputs**.
  - *Input props*: `meals, plan, setPlan, bfPlan, setBfPlan, lunchPlan, setLunchPlan, lunchReuseAll,
    mealById, clearWeek, busyDays, toggleBusyDay, weekStart, setWeekStart, openWizard,
    openWeeksList`.
  - *Output*: writes through the passed setters; triggers a client-side file download. No network
    or Firestore calls.
- **Service wire-up**. `buildWeekICS` + `downloadICS` (§7.5); `addDays`, `formatShort` (§7.3).
- **Associated models / DTOs**. Meal, Week (read-only); `Autocomplete` option `{value, label, group?}`.
- **DB package calls / DB schema**. None directly — persistence happens in `App`'s debounced effect.

---

### 4.5 `ListaTab.jsx` — "Lista" tab (shopping list)
**File**: [`client/src/components/ListaTab.jsx`](../client/src/components/ListaTab.jsx)

- **Functionality**. Renders the pre-aggregated shopping list grouped by store plus a pantry
  section, with per-item check-off and two clipboard export formats.
- **UI functions**.
  - Row click toggles `checked[x.key]`, using the stable key the `shopping` memo emits
    rather than rebuilding one from the display text — see §2.7.
  - `copyText(text, label)` — `navigator.clipboard.writeText`, falling back to a hidden
    `<textarea>` + `document.execCommand('copy')`; sets a 1.8 s "¡Copiado!" flash.
  - `byStoreText()` — `☐`-prefixed list under `— COSTCO —` / `— WALMART —` /
    `— CUALQUIER TIENDA —` / `— DE DESPENSA (revisar si hay) —`, quantities prefixed when known.
  - `byRecipeText()` — grouped by recipe in breakfast → lunch → dinner order per day, each
    ingredient annotated with store label and `, despensa` when applicable.
- **Permutations / states**. `anyMeals === false` → empty state pointing back to "Semana".
  Each store block renders only when non-empty; the pantry block only when
  `shopping.pantry.length > 0`. Checked rows render struck-through and dimmed.
- **View / Inputs / Outputs**.
  - *Input props*: `shopping` (`{costco, walmart, both, pantry}`), `checked`, `setChecked`, `plan`,
    `bfPlan`, `lunchPlan`, `mealById`.
  - *Output*: writes `checked` through the setter; writes to the system clipboard.
- **Service wire-up**. `STORE_META` (§7.9) for labels/classes; `CopyBtn` (§6). No lib services.
- **Associated models / DTOs**. Shopping row `{key, item, qty, hasQty, unit, from[]}`, pantry row
  `{key, item, from[]}` — both produced by `App.jsx`'s `shopping` memo, not here.
- **DB package calls / DB schema**. None directly.

---

### 4.6 `RecetasTab.jsx` — "Recetas" tab (recipe bank)
**File**: [`client/src/components/RecetasTab.jsx`](../client/src/components/RecetasTab.jsx)

- **Functionality**. Searchable, filterable browser over the meal bank, grouped by category, with
  create / edit / delete and the persistent `healthyOnly` preference.
- **UI functions**.
  - "Agregar comida" — opens `MealEditor` with a blank template
    (`{name:'', cat:'Salvadoreño', easy:true, favorite:false, rating:0, healthy:false, left:true,
    kcal:null, servings:null, types:['cena'], steps:[], ing:[]}` — note: no `id`, which is what
    makes `saveMeal` treat it as an insert).
  - Search box filtering on `searchable(m)` — name + category + the literal words `fácil`,
    `favorito`, `rinde`, `saludable` when those flags are set, + `types`; lowercase substring match.
  - Type chips (`desayuno`/`almuerzo`/`cena`), OR-combined; 🥗 chip toggles `healthyOnly`.
  - Pencil → `setEditing(m)`; Trash → `confirm()`-guarded removal from `meals`.
- **Permutations / states**. Filters compose in order: `healthyOnly` → type chips (only when
  `anyTypeSelected`) → text query. No matches → "No hay recetas que coincidan." Category
  headings derive from the *filtered* set, so they appear and disappear with the filters. Per-card
  chips render conditionally per flag; `~kcal/porción` needs both `kcal != null` and `servings > 0`.
- **View / Inputs / Outputs**.
  - *Input props*: `meals`, `setMeals`, `setEditing`, `healthyOnly`, `setHealthyOnly`.
  - *Output*: deletes directly via `setMeals`; creation/editing is delegated to `MealEditor`
    through `setEditing` (the save round-trips through `App.saveMeal`).
- **Service wire-up**. None — pure client-side filtering. Uses `Tag` / `StarsDisplay` (§6).
- **Associated models / DTOs**. Meal.
- **DB package calls / DB schema**. None directly.

---

## 5. Modals

All four use `useBackdropClose` (§6) and the same shell: `fixed inset-0 bg-black/40`, bottom-sheet
on mobile (`items-end`, `rounded-t-2xl`) and centered card on `sm:` and up. They are mounted by
`App.jsx` behind independent boolean flags, so they never stack.

### 5.1 `MealEditor.jsx` — create / edit recipe
**File**: [`client/src/components/MealEditor.jsx`](../client/src/components/MealEditor.jsx)

- **Functionality**. The full recipe form plus three AI import paths (YouTube URL, web page URL,
  pasted text) and an AI kcal/servings estimator. Everything the AI returns lands in the form as a
  *suggestion* the user can still edit before saving.
- **UI functions**.
  - `runImport('youtube' | 'url' | 'text')` — dispatches to `importFromYoutube` /
    `importFromUrl` / `extractFromText`, then `applyRecipe(parsed, setters)` merges only the
    fields the response actually contains. `favorite`, `rating` and `healthy` are never touched by
    AI — they are personal taste (see the comment above `applyRecipe`).
  - `runEstimateKcal()` — `estimateKcal({name, ing, steps})`; a `null` `kcal` in the response
    is treated as "couldn't estimate" and surfaced as `kcalErr`, not as a failure.
  - `toggleType(t)`, `setIngAt(i, patch)`, add/remove ingredient rows.
  - Save — trims `name`/`cat`/`videoUrl`/`sourceUrl`, defaults blank `cat` to `'Otros'`,
    drops blank steps and blank-item ingredients, then `onSave({...meal, ...fields})`; a blank
    `name` makes the button a no-op.
- **Permutations / states**.
  | State | Effect |
  |---|---|
  | `busy` ∈ `'' \| 'youtube' \| 'url' \| 'text' \| 'kcal'` | Only one import/estimate at a time; the active button shows "Importando…/Extrayendo…/Estimando…" and **all** action buttons are disabled |
  | `!hasIngredients` | "Estimar con IA" disabled + amber hint; otherwise the "no es un dato médico" disclaimer |
  | `types.length === 0` | Amber warning: the recipe won't appear in any weekly picker |
  | `kcal != null && servings > 0` | Shows the computed per-serving figure |
  | `err` / `kcalErr` | Two independent inline error banners (import vs. estimation) |
  | `meal.id` present | Title "Editar comida"; otherwise "Nueva comida" |
  | each import button | Also disabled while its own input is blank |
- **View / Inputs / Outputs**.
  - *Input props*: `meal` (existing Meal or blank template), `categories` (sorted unique `cat`
    values from `App.jsx`, feeding a `<datalist>`), `onClose`, `onSave(meal)`.
  - *Output*: exactly one `onSave(meal)` on submit, or `onClose()` (X button / backdrop).
- **Service wire-up**. `extractFromText`, `importFromYoutube`, `importFromUrl`, `estimateKcal`
  (§7.1) → the Express backend ([`server.md §2`](./server.md#2-nodes-routes--endpoints)).
- **Associated models / DTOs**. Meal, Ingredient (§3); the **Recipe DTO** returned by the backend —
  [`server.md §3`](./server.md#3-data-contracts-dtos) — consumed by `applyRecipe`, where
  `videoUrl`/`sourceUrl` arrive only from the YouTube/URL routes respectively; kcal DTO
  `{kcal, servings}`.
- **DB package calls / DB schema**. None. The saved Meal reaches Firestore only after
  `onSave → App.saveMeal → setMeals` triggers the debounced write (§9.1).

---

### 5.2 `PlanWizard.jsx` — "Sorpréndeme" wizard
**File**: [`client/src/components/PlanWizard.jsx`](../client/src/components/PlanWizard.jsx)

- **Functionality**. Two-step wizard collecting the inputs `autofill` needs: which days are busy,
  variety vs. healthy-only, and how lunch should be resolved for the whole week.
- **UI functions**. `toggleDay(key)`; `setStep` navigation ("Siguiente" / "Atrás");
  `setSelHealthy(false|true)`; `setLunchMode('reuse'|'generate')`; "Armar semana" calls
  `onApply({busyDays, healthyOnly, reuseDinner, fillLunch})`.
- **Permutations / states**. `step` ∈ `{0, 1}` — step 0 is the day grid, step 1 holds both the
  variety choice and the lunch choice; "Atrás" only renders on step 1, and the primary button
  switches from "Siguiente" to "Armar semana". `lunchMode` is exclusive by design (§2.3);
  "Generar recetas de almuerzo" is disabled when `lunchPoolSize === 0`, with the hint to tag
  recipes as `almuerzo` first. Local selections start from the current `busyDays`/`healthyOnly`
  and are discarded on close — nothing is applied until "Armar semana".
- **View / Inputs / Outputs**.
  - *Input props*: `busyDays`, `healthyOnly` (seed values), `lunchPoolSize` (count of meals tagged
    `almuerzo`, computed in `App.jsx`), `onClose`, `onApply`.
  - *Output*: one `onApply({busyDays, healthyOnly, reuseDinner: lunchMode === 'reuse',
    fillLunch: lunchMode === 'generate' && lunchPoolSize > 0})`; `App` then calls `setBusyDays`,
    `setHealthyOnly` and `autofill(...)` with those exact values — passing them
    explicitly rather than relying on the state it just set, which would still be stale.
- **Service wire-up**. None; `DAYS` from `data/seed.js`. The fill algorithm lives in `App`.
- **Associated models / DTOs**. The `onApply` payload above.
- **DB package calls / DB schema**. None directly.

---

### 5.3 `WeeksList.jsx` — saved weeks
**File**: [`client/src/components/WeeksList.jsx`](../client/src/components/WeeksList.jsx)

- **Functionality**. Lists every stored week (plus the active one even when still empty), sorted by
  ISO key, showing the date range and how many dinners are planned; lets the user jump to or delete
  a week.
- **UI functions**. Arrow → `onSelect(key)`; trash → `confirm()`-guarded `onDelete(key)`; X /
  backdrop → `onClose()`.
- **Permutations / states**. The active week is highlighted, labeled "· viendo", and has no jump
  arrow. `all` synthesizes an entry for `weekStart` from the shared `EMPTY_WEEK` (`data/seed.js`,
  §7.9) when none is stored. Keys sort lexicographically, which is chronological for ISO dates.
- **View / Inputs / Outputs**.
  - *Input props*: `weeks`, `weekStart`, `onSelect`, `onDelete`, `onClose`.
  - *Output*: `onSelect(key)` → `App` sets `weekStart` and closes; `onDelete(key)` → `App`
    `deleteWeek(key)` (the modal stays open).
- **Service wire-up**. `addDays`, `formatShort` (§7.3); `DAYS.length` for the range end.
- **Associated models / DTOs**. Week (read-only; only `plan` is inspected).
- **DB package calls / DB schema**. None directly.

---

### 5.4 `SharePanel.jsx` — household sharing
**File**: [`client/src/components/SharePanel.jsx`](../client/src/components/SharePanel.jsx)

- **Functionality**. Shows the account's household code (which is literally the Firestore document
  id) for copying, accepts someone else's code to join, and offers leaving a shared household.
  Only reachable for Google accounts — the header hides "Compartir" for guests (`App.jsx`).
- **UI functions**. `copyCode()` — clipboard write + 1.5 s flash; `handleJoinClick()` —
  trims, rejects the user's own code with an inline error, otherwise `onJoin(code)` and clears the
  field; "Salir del hogar compartido" → `onLeave()`.
- **Permutations / states**. `joinError` renders only for the self-join case (other failures
  surface through `App`, not here). "Salir del hogar compartido" renders only when `isMember`
  (`householdId !== user.uid`, computed in `App.jsx`). The join button is disabled while the
  field is blank.
- **View / Inputs / Outputs**.
  - *Input props*: `householdId`, `isMember`, `onJoin(code)`, `onLeave()`, `onClose`.
  - *Output*: `onJoin` → `App.handleJoin` (join, reset `meals`, switch `householdId`, close);
    `onLeave` → `App.handleLeave` (point back to own uid, reset `meals`; the modal is **not**
    auto-closed).
- **Service wire-up**. None directly — `App` performs the Firestore work.
- **Associated models / DTOs**. `householdId: string`.
- **DB package calls / DB schema**. Indirect: `joinHousehold` / `leaveHousehold` (§7.7) touching
  `households/{id}.members` and `users/{uid}.householdId` (§8, §9.2).

---

## 6. Shared UI primitives — `components/ui.jsx`

| Export | Purpose / non-obvious behavior |
|---|---|
| `useBackdropClose(onClose)` | Returns `{onMouseDown, onClick}`; closes only when the press **and** release both land on the backdrop. Without it, selecting text inside a modal and releasing outside would close it and discard the edit. |
| `Autocomplete({value, onChange, options, placeholder, emptyText})` | Combobox: type to filter, ↑/↓ to move, Enter to commit, Esc to cancel, click-outside to close. Options are flat `{value, label, group?}`; `group` renders `<optgroup>`-style headings, preserving group order but sorting labels alphabetically inside each group (`localeCompare(…, 'es')`). Injects a synthetic "Quitar selección" entry at the top when a value is set and the query is empty. `onMouseDown={e => e.preventDefault()}` on options keeps focus so the click registers before blur. |
| `Tag` | Neutral pill. |
| `Toggle({on, set, label})` | Flex-1 button; calls `set(!on)` — note it passes the **value**, so it works both with a plain setter and with a custom handler (`MealEditor` uses both forms). |
| `Stars({value, onChange, size})` | 0–5 editable rating; clicking the current value clears it to 0. |
| `StarsDisplay({value})` | Read-only `★`/`☆` string. |
| `CopyBtn({label, onClick, active})` | Copy button with a "¡Copiado!" active state (the timer lives in the parent). |

---

## 7. `lib/` and `data/` reference

### 7.1 `lib/api.js` — backend client
`post(path, body)` wraps `fetch` (JSON in/out) and throws `new Error(err.error || 'Error <status>')`
on non-2xx, which is what surfaces as the red banner in `MealEditor`. Base URL is
`import.meta.env.VITE_API_URL || ''` — empty in dev, where `vite.config.js` proxies `/api` to
`http://localhost:3001`. Exports: `extractFromText(text)`, `importFromYoutube(url)`,
`importFromUrl(url)`, `estimateKcal({name, ing, steps})`. **Only caller**: `MealEditor.jsx`.

### 7.2 `lib/auth.js` — Firebase Auth wrapper
`signInWithGoogle()` (popup; the in-file comment records that `signInWithRedirect` was tried and
abandoned because `getRedirectResult()` always resolved `null` in this setup — and that Google's
COOP header can delay popup-close detection by up to ~1 min, which is why the button warns about
the wait) · `signInAsGuest()` (anonymous; Firebase auto-deletes accounts after 30 days idle) ·
`upgradeGuestToGoogle()` (`linkWithPopup`, **keeps the same uid** so guest data needs no migration;
throws `auth/credential-already-in-use` if that Google account already exists) · `signOutUser()` ·
`onAuthChange(cb)` → unsubscribe. Callers: `AuthGate`, `Login`, `App`.

### 7.3 `lib/dates.js` — pure date helpers
`toISODate(d)` · `mondayOf(d = new Date())` (Sunday counts as the *previous* week's Monday, `day === 0 ? -6 : 1 - day`) ·
`addDays(iso, n)` (parses as `iso + 'T00:00:00'`, i.e. local midnight, avoiding UTC off-by-one) ·
`formatShort(iso)` → `"1 sep"`. Callers: `App`, `SemanaTab`, `WeeksList`, `lib/ics.js`.

### 7.4 `lib/firebase.js` — SDK initialization
Builds `firebaseConfig` from the six `VITE_FIREBASE_*` vars, exports `auth` and `db`.
**`db = getFirestore(app, 'default')`** — the database id is passed explicitly because the project's
database in the Firebase console is literally named `default`, not the SDK's implicit `(default)`
(created that way by accident; the id can't be changed after creation). Any new Firestore usage
must import this `db`. `measurementId` is deliberately omitted — PostHog already covers analytics.

### 7.5 `lib/ics.js` — calendar export
`buildWeekICS({DAYS, weekStart, plan, bfPlan, lunchPlan, mealById})` → RFC 5545 string;
`downloadICS(icsString, filename)` → Blob + synthetic `<a download>` click (the only DOM-touching
function, kept separate so `buildWeekICS` is testable in plain Node).

Times are constants at the top of the file: breakfast 07:00–07:30, lunch 12:30–13:30, dinner
18:00–19:00, reminder `ALARM_HOUR_BEFORE = 19:00`. `computeAlarmTrigger` derives the VALARM offset
from those two constants rather than hardcoding it — currently `-PT23H` (19:00 the previous
evening). Details worth knowing: `DTSTART`/`DTEND` are **floating** local times (no `Z`, no
VTIMEZONE) while `DTSTAMP` is real UTC; UIDs are deterministic
(`menu-semana-<date>-<mealType>@menu-semana.local`) so re-exporting the same week updates rather
than duplicates events; only dinners get a `VALARM`, whose description lists *all* ingredients
including pantry ones (deliberate — see the comment above `buildAlarmDescription`); no 75-octet line folding is
performed (accepted risk, documented in a comment above `buildWeekICS`). A lunch event is emitted **only** when
`lunchPlan[day]` is set (§2.3).

### 7.6 `lib/storage.js` — localStorage
`storage.get(key)` / `storage.set(key, value)` over `localStorage`, prefix `menu-semana:`, async
signature so the call sites didn't change when persistence moved to Firestore. Now used **only**
as the one-time import source for a brand-new household document (`App.jsx`); nothing in the
app writes to or clears it anymore.

### 7.7 `lib/userStorage.js` — **the DB package**
The only module that reads/writes Firestore application data.

| Function | Firestore calls | Docs touched | Notes |
|---|---|---|---|
| `resolveHouseholdId(uid)` | `getDoc(users/{uid})`; legacy path only: `setDoc(households/{uid}, data)`, `setDoc(users/{uid}, {householdId: uid})` | `users/{uid}`, `households/{uid}` | No `users/` doc → returns `uid` (the common case; most accounts never get one). Has `householdId` → returns it. Otherwise the doc is the **legacy** shape (planner data stored directly under `users/`) and is migrated once into `households/{uid}`, leaving a pointer behind. |
| `getHouseholdStorage(householdId)` | `getDoc(households/{id})`; `setDoc(households/{id}, {key, value, updatedAt: serverTimestamp()}, {merge: true})` | `households/{householdId}` | Returns `{get, set}`. `get` returns `null` unless `data.key === key` **and** `typeof data.value === 'string'` (§2.8). `merge: true` is load-bearing (§2.2). |
| `joinHousehold(householdId, myUid)` | `setDoc(households/{id}, {members: arrayUnion(myUid)}, {merge: true})`; `setDoc(users/{myUid}, {householdId})` | both | Two writes, not atomic — a failure between them leaves `members` updated but the pointer unset. |
| `leaveHousehold(myUid)` | `setDoc(users/{myUid}, {householdId: myUid})` | `users/{myUid}` | Deliberately does **not** remove the uid from the old household's `members` (see the comment on `leaveHousehold`), so leaving does not revoke the ability to rejoin. |

Callers: `App.jsx` (all four), `Login.jsx` (`joinHousehold`).

### 7.8 `lib/analytics.js` — PostHog (optional)
No-ops entirely without `VITE_POSTHOG_KEY`, and the SDK is loaded through a dynamic `import()` so
it isn't downloaded at all in that case. `initAnalytics()` (once, from `main.jsx`) sets
`capture_pageview: true` and `person_profiles: 'identified_only'`. `track(event, props)` is used
for `tab_view` (`App`) and `guest_start` (`Login`, optionally `{joined_with_code: true}`) — that
is the complete event list.

### 7.9 `data/seed.js` — seed data, constants, normalizers
`SEED_MEALS` (32 recipes: 22 dinners in compact `[item, store]` tuple form + 10 breakfasts tagged
`types:['desayuno']`) · `DAYS` (7 fixed keys) · `EMPTY_WEEK` (the empty-week shape, shared by
`App.jsx` and `WeeksList.jsx` so a new Week field can't be added to one and forgotten in the
other) · `STORE_META` (labels + Tailwind classes for
`costco`/`walmart`/`both`) · `uid()` (§2.5) · `normalizeIng` / `normalizeMeal` (backfill fields
added after data was already saved: `favorite`, `rating`, `healthy`, `videoUrl`, `sourceUrl`,
`steps`, `types`, `kcal`, `servings`, and per-ingredient `qty`/`unit`/`pantry`) · `withIds(arr)`
(seed tuples → normalized Meals with ids) · `breakfastNameToMeal(name)` (v1→v2 migration helper).

> When adding a Meal field, `normalizeMeal` is the mandatory second edit — without it, every
> pre-existing saved recipe renders with `undefined` for the new field.

---

## 8. Firestore schema — the "tables" of this app

Database: Firestore, explicit id **`default`** (§7.4). Two collections; no subcollections, no
indexes required (nothing is queried — every read is a direct document `get`).

### `users/{uid}` — pointer, one per account
```ts
{ householdId: string }   // which households/ document this account reads and writes
```
Exists only for accounts that have joined someone else's household (or that predate the feature).
Legacy shape, auto-migrated on next load by `resolveHouseholdId`:
```ts
{ key: 'planner-v1', value: string /* JSON */, updatedAt: Timestamp }
```
Rule (`README.md`): an account may read/write only its own `users/{uid}`.

### `households/{householdId}` — the data
```ts
{
  key: 'planner-v1',      // must match STORE_KEY or reads return null (§2.8)
  value: string,           // JSON.stringify of the persisted document (§3) — opaque to Firestore
  updatedAt: Timestamp,    // serverTimestamp() on every write
  members?: string[],      // uids that joined via a code; the owner's uid is implicit, never listed
}
```
`householdId` defaults to the owner's `uid`. Rule (`README.md`): the uid equal to the document id,
or any uid present in `members`, has full read/write; an outsider may only add **themselves** to
`members` and change nothing else (the self-service "join" operation, which avoids needing Cloud
Functions). Documented, accepted risk: knowing a code is enough to join, with no approval step.

**Nothing else is persisted.** There is no per-meal, per-week or per-ingredient document — the
whole planner is the single `value` blob, which is why concurrent edits from two devices are
last-write-wins on the entire dataset.

---

## 9. End-to-end flows

### 9.1 Load → migrate → edit → save
1. `AuthGate` receives a `User` → mounts `App` with `key={user.uid}`.
2. Effect A (household resolution): `resolveHouseholdId(uid)` → `setHouseholdId`; failure → `loadError`.
3. `userStore = getHouseholdStorage(householdId)` (memo, 42).
4. Effect B (load + migrate): `userStore.get('planner-v1')`.
   - Missing → try `storage.get` (localStorage); if present, upload once via `userStore.set`.
   - Still missing → `setMeals(withIds(SEED_MEALS))` and stop (a fresh, seeded bank).
   - Present → `JSON.parse(value)`, `meals.map(normalizeMeal)`, rebuild `weeks` (synthesizing one
     entry from root-level `plan`/`bfPlan`/… for pre-`weeks` documents), then:
     - **v1 → v2 migration**: collect breakfast names from `d.breakfasts` and every
       `bfPlan` value, convert each via `breakfastNameToMeal`, append to `meals`, and rewrite every
       `bfPlan` entry from name → new id.
     - **v2 documents**: backfill `lunchPlan` / `lunchReuseAll` on any week missing them.
5. Any state change → Effect C (the debounced writer) waits 300 ms, then writes the whole document with
   `schemaVersion: 2`. Errors are swallowed (`.catch(() => {})`) — saves fail silently by design.

### 9.2 Sharing a household
- **Copy**: `SharePanel` shows `householdId` (= the document id) verbatim; there is no separate
  code generation.
- **Join** (`App.handleJoin` or `Login.handleJoinWithCode`): `joinHousehold(code, uid)` →
  `members: arrayUnion(uid)` on `households/{code}` + `users/{uid} = {householdId: code}` →
  `setMeals(null)` + `setHouseholdId(code)` → Effect B re-runs and loads the other household.
  Joining an unknown code creates that household with only `{members:[uid]}`, so the joiner lands
  on a freshly seeded bank rather than an error (§2.8).
- **Leave** (`App.handleLeave`): `leaveHousehold(uid)` repoints the pointer to the user's own uid;
  the old household keeps the uid in `members` (§7.7).
- **Guest → Google** (`App.handleUpgrade`): `linkWithPopup` keeps the same uid, so the household id
  and all data carry over untouched. On `auth/credential-already-in-use` the UI offers signing in
  with that Google account instead, which abandons the guest data.

### 9.3 AI recipe import (client half)
`MealEditor.runImport(kind)` → `lib/api.js` → `POST /api/{extract|import-youtube|import-url}` →
Recipe DTO → `applyRecipe` writes it into the form → user edits → Save → `onSave` →
`RecetasTab`'s `setEditing(null)` + `App.saveMeal` → `setMeals` → debounced Firestore write.
The backend half (prompting, parsing, SSRF guards, rate limiting) is in
[`server.md`](./server.md); the DTO contract is [`server.md §3`](./server.md#3-data-contracts-dtos).

### 9.4 Auto-filling a week
"Sorpréndeme" → `PlanWizard` (busy days → variety/healthy + lunch mode) → `onApply` →
`App`: `setBusyDays(sel)`, `setHealthyOnly(sel)`, `autofill({busy, healthy, reuseDinner, fillLunch})`
→ `poolFor('cena'|'desayuno'|'almuerzo')` (healthy filter with fallback to the full bank) →
`fillWeek(pool, busy)` per meal type → `setPlan` / `setBfPlan` / optional `setLunchPlan`,
`setChecked({})`, `setLunchReuseAll(reuseDinner)` → debounced save.
