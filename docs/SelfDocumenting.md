# SelfDocumenting

**Standing instruction. Read this before starting work in this repository, and again before
calling a change done.**

`docs/` holds the technical reference for this codebase: [`client.md`](./client.md) and
[`server.md`](./server.md), one file per app folder, with a section per node (screen/tab/route),
per modal, and per shared module. They exist so that finding and changing code here is fast and
accurate — but that only holds while they are true. **A stale doc is worse than no doc**: it gets
trusted and acted on without being re-checked against the code.

---

## 1. The rule

> **Any change to `client/src/**` or `server/src/**` — added, modified, or deleted — must update
> the matching section of `docs/client.md` or `docs/server.md` as part of the same change.**

Not as a follow-up task, not "next time someone touches it". If asked whether the docs need
updating, the answer is always yes, and it does not need to be requested each time — it is part of
finishing the work.

This applies to changes to configuration that the docs describe as well: `vite.config.js`,
`render.yaml`, `.env.example`, `package.json` dependencies, and the Firestore rules in the root
`README.md`.

**Exempt** (do not churn the docs for these): formatting-only edits, comment typos, and changes
under `node_modules/` or `dist/`.

---

## 2. What to do, by kind of change

### Something was added
Insert a new section in the right file **and the right place** — nodes with nodes, modals with
modals, services with services — not appended at the end. Follow the template in §3 exactly, and
add a row to that file's §0 Quick index table if the new thing is something a future task would
plausibly need to find.

### Something was modified
Re-read the current doc section **before** editing it; do not trust a summary from earlier in the
session. Then walk all eight template fields, not only the one that obviously changed — new
branches usually also change inputs/outputs, and new state usually also changes permutations.
Concretely, check whether the change affected:
- a **state or branch** → the *Permutations / states* table
- a **prop, request field, or response field** → *View / Inputs / Outputs* **and** the DTO section
  (`client.md §3` / `server.md §4`)
- a **call to another module** → *Service wire-up*, plus that module's own entry in
  `client.md §7` / `server.md §6`
- a **Firestore read or write** → *DB package calls*, *DB schema*, `client.md §7.7`, `client.md §8`
- an **error message or failure path** → `server.md §5` (the failure-mode table is an error
  contract, and the client renders those strings verbatim)
- a **renamed function, prop, file, or field** → grep both docs for the old name. Sections point at
  code by symbol (§4), so a rename is the one edit that actually breaks those pointers

### Something was deleted
Remove its section, then grep **both** docs for its name and fix every reference. The two files
cross-link heavily (the Recipe DTO in `server.md §4` is referenced from `client.md`'s MealEditor
section; `client.md §8` is referenced from `server.md §7`). A dangling pointer to deleted code is
itself a documentation bug.

### An invariant changed
`client.md §2` lists the non-obvious rules that break things when violated. If a change makes one
of them obsolete, delete it; if it introduces a new one, add it. This section is the highest-value
part of the docs and the easiest to let rot.

### The architecture changed
- New Firestore field or collection → `client.md §8` **and** every node/modal whose *DB schema*
  field mentions the affected document.
- New backend endpoint → `server.md §1` diagram, §0 index, a new §3 section, and §5 if it can fail
  in new ways.
- A real database added to the server tier → replace `server.md §7`'s "N/A" with actual schema
  documentation and fill in the per-route DB fields. The N/A framing is a statement about the
  current architecture, not a permanent default.
- A `modules/` folder or a second app folder ever appears → add one `.md` per app folder, matching
  the existing structure, and say so here.

---

## 3. Section template

Every node / modal / route section carries these eight fields, in this order:

1. **Functionality** — what it does and why it exists.
2. **UI functions** (client) / **Request handling** (server) — the concrete handlers and branches,
   with line references.
3. **Permutations / states** — every state or condition that changes behavior or rendering.
4. **View / Inputs / Outputs** — props or request body in; renders, responses and side effects out.
5. **Service wire-up** — which modules it calls, in what order.
6. **Associated models / DTOs** — exact shapes, or a link to where they are defined.
7. **DB package calls** — which persistence function runs and what it does internally.
8. **DB schema** — which collections/documents/fields are read or written.

If a field genuinely does not apply, say so and say *why* in this codebase's terms — the way
`server.md` explains that it has no database — rather than dropping the field. A missing field
reads as an oversight; a labeled N/A does not.

Shared modules (`client.md §7`, `server.md §6`) use a lighter format: per function, what it does,
what it calls, who calls it, and any non-obvious behavior.

---

## 4. Style rules for these docs

- **Never cite line numbers** — not in prose, not in tables, and not as per-file line counts. Point
  at code by symbol instead: `autofill()`, the `shopping` memo, `getHouseholdStorage.set`,
  `UNIT_ALIASES`. Line numbers shift on any edit above them, *including edits that change nothing
  documented*, so they generate constant churn and then fail silently — a stale number points
  confidently at the wrong code, which is the same failure mode this whole file exists to prevent.
  Symbols survive being moved, are greppable by both a person and a model, and when one is renamed
  that rename is itself worth documenting. (Removing them was a deliberate decision, not an
  oversight: a four-line bug fix had just forced ~30 citation edits. Don't reintroduce them.)
- **Document the "why", not just the "what".** The code already says what it does. The docs earn
  their keep by capturing the reasoning that is not visible in a diff: why popup instead of
  redirect for Google sign-in, why `merge: true` is load-bearing, why `reasoning_effort: 'low'`,
  why the rate limiter ignores `req.ip`.
- **Write down accepted trade-offs and rough edges**, not just the happy path. `server.md §8`'s
  "accepted / worth knowing" list and `client.md §2`'s gotchas are examples: they stop a future
  reader from "fixing" something deliberate, and stop them from assuming something rough is safe.
- **State facts you verified, not facts you assume.** If a claim about the database, deployment, or
  git history has not been checked this session, either check it or mark it as unverified.
- **Keep both files in the same language.** They are currently in English; if that changes, change
  both, and update this line.

---

## 5. Why this exists

These files are written for a reader — human or model — arriving with no context. The payoff:

- **Fewer tokens.** A task touching one component reads one section instead of re-deriving context
  from `App.jsx`'s 481 lines plus the lib modules it wires together. The DTO and schema tables
  replace re-reading `recipe.js` and `userStorage.js` on every question about shapes.
- **Less time.** "Which Firestore document does joining a household write?" is a table lookup in
  `client.md §7.7`, not a trace through `SharePanel → App.handleJoin → lib/userStorage.js`. The §0
  index maps a task directly to a section and a file.
- **More precision.** Field-level tables carry the details that are easy to get subtly wrong:
  `kcal` is tri-state (`null` ≠ `0`), `store` coerces invalid values to `'costco'`, the shopping
  aggregation key is lowercased while the `checked` key is not.
- **Fewer missed changes.** Most breakage here is not in the file you edited — it is in the second
  place that depended on the old behavior. The docs name those couplings explicitly (the four
  places that must agree about lunch reuse; the two `EMPTY_WEEK` definitions; the client sections
  that depend on the server's DTO), which is exactly what §2's "grep both docs" step is for.

All of which holds only while the docs match the code. That is the whole point of this file.
