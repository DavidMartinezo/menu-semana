# Server — `menu-semana/server`

Technical reference for the Node/Express backend.
Maintenance rule: [`SelfDocumenting.md`](./SelfDocumenting.md). Frontend counterpart: [`client.md`](./client.md).

> **Terminology mapping.** Per the requested "node / modal / db" template: each HTTP route is
> documented as a **node** (§3). There are **no modals** — this tier has no UI. There are **no DB
> package calls and no DB schema**: the service is stateless and never touches Firestore or any
> other database (§7 explains why and what to do if that changes). All persistence is client-side —
> see [`client.md §8`](./client.md#8-firestore-schema--the-tables-of-this-app).

---

## 0. Quick index

| Task | Section | Files |
|---|---|---|
| Change the extraction prompt or output shape | §4, §6.2 | `services/recipe.js` (`buildPrompt`, `parseRecipe`) |
| Change the AI model / provider / token budget | §6.1 | `services/groq.js`, env `MODEL` |
| Add or change an endpoint | §3 | `src/index.js` (mounting) + `src/routes/*.js` |
| Debug "the import failed" | §5 (failure-mode tables) | the route's `catch`, then the service it calls |
| Change rate limiting / CORS / proxy handling | §2, §8 | `src/index.js` |
| Touch URL fetching or its SSRF guards | §6.3, §8 | `services/webpage.js` |
| Touch YouTube description/transcript sourcing | §6.4 | `services/youtube.js` |
| Change kcal estimation | §3.5, §6.2 | `routes/estimateKcal.js`, `buildKcalPrompt`/`parseKcalResponse` |

---

## 1. Architecture at a glance

**Stack**: Node 18+ (ESM, `"type": "module"`) · Express 4 · `openai` SDK v4 pointed at Groq's
OpenAI-compatible endpoint · `cheerio` (HTML parsing) · `youtube-transcript` (unofficial captions)
· `express-rate-limit` v8 · `cors` · `dotenv`.

**Why this tier exists at all** (from the README): (1) the AI API key must never reach the browser,
and (2) YouTube and arbitrary recipe pages can't be fetched from the frontend because of CORS.
Nothing else lives here — no auth, no sessions, no storage, no user data at rest.

**Entry point**: [`src/index.js`](../server/src/index.js) — mounts everything.
Dev: `node --watch src/index.js` (`npm run dev`). Prod: `npm run start`.

```
browser (MealEditor)
   │  POST /api/{extract | import-youtube | import-url | estimate-kcal}
   ▼
index.js:  trust proxy → cors → express.json(1mb) → aiLimiter (shared 20/15min) → route
   │
   ├─ extract.js ─────────────────────────┐
   ├─ importYoutube.js → youtube.js ──────┤
   ├─ importUrl.js    → webpage.js ───────┼─► recipe.buildPrompt → groq.complete → recipe.parseRecipe
   └─ estimateKcal.js ────────────────────┘   (kcal variant: buildKcalPrompt → parseKcalResponse)
                                                        │
                                         Groq API  ◄────┘   (also: YouTube Data API v3, arbitrary web pages)
```

**Env vars** (`server/.env`, loaded by `import 'dotenv/config'`):

| Var | Required | Default / effect if missing |
|---|---|---|
| `GROQ_API_KEY` | **Yes** | Startup logs a warning (`index.js`) and every AI call fails at request time with a 500 |
| `MODEL` | No | `openai/gpt-oss-20b`. The `.env.example` notes `openai/gpt-oss-120b` as the higher-accuracy, slower option |
| `YOUTUBE_API_KEY` | No | `fetchDescription` is skipped entirely; imports fall back to transcript only |
| `PORT` | No | `3001` |
| `CLIENT_URL` | Prod only | Missing → CORS allows **any** origin (intended for local dev only) |

**Deployment**: `render.yaml` service `menu-semana-api-beta` (`buildCommand: npm install`,
`startCommand: npm run start`, free plan — which sleeps after ~15 min idle, so the first request
after a nap takes a few seconds). The `-beta` suffix is deliberate while `feature/cuentas` is
unmerged. Secrets are `sync: false`, i.e. entered in the Render dashboard and never in the repo.

> Repo-level note: the root `package.json` pins `overrides: { "qs": "6.16.0" }` — a transitive
> Express dependency held at a fixed version. Don't drop it without checking why it was pinned.

---

## 2. Middleware chain (`src/index.js`)

| Order | What it does | Why it's written this way |
|---|---|---|
| 1 | `app.set('trust proxy', 1)` | Render sits behind Cloudflare **plus** its own proxy, so the hop count isn't reliably known |
| 2 | `cors(CLIENT_URL ? {origin: CLIENT_URL} : {})` | Locked to the exact frontend origin in prod so nobody else can burn the free Groq quota; wide open in dev where several localhost ports are in play |
| 3 | `express.json({limit: '1mb'})` | Body parsing with a size cap |
| 4 | `aiLimiter` — 20 requests / 15 min, `standardHeaders: true` | Applied **only** to the four expensive routes, and *before* the route body, so blocked requests never spend Groq quota |
| 5 | `GET /api/health` (unlimited) + the four rate-limited POST routes | — |

Two precise points about the limiter that are easy to get wrong:

- **The budget is shared, not per-endpoint.** One `aiLimiter` instance is reused in all four
  `app.use(...)` calls and is keyed only by IP, so a client gets 20 requests per 15 minutes
  *across all four endpoints combined* — not 20 each.
- **The key is `CF-Connecting-IP`, deliberately not `req.ip`** (`keyGenerator`).
  Cloudflare sets that header at its own edge and clients can't forge it. Deriving the IP from
  `X-Forwarded-For` would require knowing the exact hop count; guessing wrong scatters one
  client's requests across many buckets and the limit never actually engages. In local dev there
  is no such header and it falls back to `req.ip`.

---

## 3. Nodes (routes / endpoints)

All four POST routes share the same skeleton: validate the body → gather source text (if any) →
`buildPrompt` → `complete` → parse → respond; `catch` logs to `console.error` and returns a 500.
The differences are in validation, the text-gathering step, and whether the error message is
passed through to the client (§5).

### 3.1 `GET /api/health`
**File**: [`src/index.js`](../server/src/index.js) (inline, not a route module)

- **Functionality**: liveness probe (the README points at `http://localhost:3001/api/health`).
- **Request handling**: none — returns immediately. Not rate-limited.
- **Permutations / states**: one response, no failure branch.
- **View / Inputs / Outputs**: in: nothing. Out: `200 {ok: true}`.
- **Service wire-up**: none.
- **Associated models / DTOs**: `{ok: boolean}`.
- **DB package calls / DB schema**: N/A — §7.

---

### 3.2 `POST /api/extract` — pasted text → recipe
**File**: [`src/routes/extract.js`](../server/src/routes/extract.js)

- **Functionality**: turns hand-pasted recipe text (an Instagram caption, a copied blog snippet, or
  even just a dish name) into a structured recipe.
- **Request handling**: `const { text } = req.body || {}` → reject blank → `buildPrompt(text)` →
  `complete()` → `parseRecipe()` → `res.json(...)`.
- **Permutations / states**: `400` blank/missing `text` · `200` Recipe DTO · `500` anything thrown.
  Unlike the two URL routes, the 500 message is **fixed** (`'No se pudo extraer la receta.'`) — the
  underlying error is only logged, never returned.
- **View / Inputs / Outputs**: in `{text: string}` · out Recipe DTO (§4) or `{error: string}`.
- **Service wire-up**: `buildPrompt` → `complete` (§6.1) → `parseRecipe` (§6.2).
- **Associated models / DTOs**: Recipe DTO.
- **DB package calls / DB schema**: N/A.

---

### 3.3 `POST /api/import-youtube` — video URL → recipe
**File**: [`src/routes/importYoutube.js`](../server/src/routes/importYoutube.js)

- **Functionality**: pulls a video's title, description and transcript, then extracts a recipe from
  the combined text; tags the result with `videoUrl` so the client can link back to the video.
- **Request handling**: reject blank `url` → `getRecipeText(url)` (§6.4) → `buildPrompt` →
  `complete` → `res.json({...parseRecipe(raw), videoUrl: url})`.
- **Permutations / states**: `400` missing `url` · `200` Recipe DTO + `videoUrl` · `429` limiter ·
  `500` with **`e.message` passed through**, deliberately, so the useful Spanish messages from
  `services/youtube.js` (unrecognized URL, no description *and* no captions) reach the user — see
  the failure table in §5 and the caveat in §8.
  Note the raw `url` is echoed back, not the trimmed one used for validation.
- **View / Inputs / Outputs**: in `{url: string}` · out Recipe DTO + `{videoUrl}` or `{error}`.
- **Service wire-up**: `getRecipeText` (§6.4) → `buildPrompt` → `complete` → `parseRecipe`.
- **Associated models / DTOs**: Recipe DTO + `videoUrl: string`.
- **DB package calls / DB schema**: N/A.

---

### 3.4 `POST /api/import-url` — web page → recipe
**File**: [`src/routes/importUrl.js`](../server/src/routes/importUrl.js)

- **Functionality**: fetches an arbitrary recipe/blog page (behind SSRF guards), extracts its
  recipe text (JSON-LD first, visible text as fallback) and structures it; tags the result with
  `sourceUrl`.
- **Request handling**: reject blank `url` → `getRecipeTextFromUrl(url.trim())` (§6.3) →
  `buildPrompt` → `complete` → `res.json({...parseRecipe(raw), sourceUrl: url.trim()})`.
- **Permutations / states**: `400` missing `url` · `200` Recipe DTO + `sourceUrl` · `429` limiter ·
  `500` with `e.message` passed through — this route has the widest error surface of the four
  (malformed URL, blocked host, DNS failure, timeout, redirect problems, non-2xx page, no
  extractable text, model parse failure). Full table in §5.
- **View / Inputs / Outputs**: in `{url: string}` · out Recipe DTO + `{sourceUrl}` or `{error}`.
- **Service wire-up**: `getRecipeTextFromUrl` (§6.3) → `buildPrompt` → `complete` → `parseRecipe`.
- **Associated models / DTOs**: Recipe DTO + `sourceUrl: string`.
- **DB package calls / DB schema**: N/A.

---

### 3.5 `POST /api/estimate-kcal` — ingredients → kcal + servings
**File**: [`src/routes/estimateKcal.js`](../server/src/routes/estimateKcal.js)

- **Functionality**: estimates total calories and servings for a recipe that already has structured
  ingredients — a seed recipe or one typed by hand — without re-sending any original source text.
- **Request handling**: requires `Array.isArray(ing)` **and** at least one entry with a truthy
  `.item`, else `400`; then `buildKcalPrompt({name, ing, steps})` → `complete` →
  `parseKcalResponse` → `res.json(...)`.
- **Permutations / states**: `400` no usable ingredients · `200 {kcal, servings}` with numbers ·
  `200 {kcal: null, servings: null}` when the model couldn't estimate **or** returned unparseable
  output (`parseKcalResponse` never throws — §6.2), which the client renders as an inline hint
  rather than an error · `429` · `500` only if the Groq call itself fails, with a fixed message.
- **View / Inputs / Outputs**: in `{name?: string, ing: Ingredient[], steps?: string[]}` ·
  out `{kcal: number|null, servings: number|null}` or `{error: string}`.
- **Service wire-up**: `buildKcalPrompt` → `complete` → `parseKcalResponse` (§6.2).
- **Associated models / DTOs**: Ingredient (§4); kcal DTO.
- **DB package calls / DB schema**: N/A.

---

## 4. Data contracts (DTOs)

**Recipe DTO** — what `parseRecipe()` guarantees, regardless of what the model actually returns.
Every field is coerced; nothing is passed through raw, so the client can trust the shape:

```ts
{
  name: string,          // '' if omitted
  cat: string,            // 'Otros' if omitted
  easy: boolean,          // !!value
  left: boolean,          // !!value
  kcal: number | null,    // Math.round, or null if not a finite number
  servings: number | null,
  types: string[],        // filtered to {'desayuno','almuerzo','cena'}; ['cena'] if empty/invalid
  steps: string[],         // falsy entries dropped
  ing: Array<{
    item: string,          // entries without item are dropped entirely
    store: 'costco' | 'walmart' | 'both',  // anything else → 'costco'
    qty: number | null,
    unit: string,          // normalized, see below
    pantry: boolean,
  }>,
}
```

Routes then add `videoUrl` (`/api/import-youtube`) or `sourceUrl` (`/api/import-url`). Those two
are **not** produced by `parseRecipe` itself — `/api/extract` and `/api/estimate-kcal` never return
them. The client mirrors this shape as its Meal model ([`client.md §3`](./client.md#3-shared-data-model)),
adding the personal-taste fields (`favorite`, `rating`, `healthy`) that AI never sets.

**Unit vocabulary** (`normalizeUnit` in `recipe.js`): `unidad, g, kg, ml, l, lb, oz, taza, cda,
cdta, diente`. The prompt asks the model to convert units itself; `UNIT_ALIASES`
is the safety net for when it doesn't — `cup→taza`, `tsp→cdta`, `tbsp→cda`, `clove→diente`,
`piece→unidad`, `pound/lbs→lb`, `ounce→oz`, `gram→g`, `kilogram/kilo→kg`, `milliliter→ml`,
`liter/litre→l`, plus plurals. An unrecognized unit is passed through **unchanged** (not blanked),
so a stray value can still reach the client's `<select>`, where it simply won't match an option.

**kcal DTO**: `{kcal: number | null, servings: number | null}` — `null` means "not estimated",
which is distinct from `0`.

**Error DTO**: `{error: string}` on every non-2xx response, including the limiter's 429.

---

## 5. Failure modes (what actually produces which message)

`/api/extract` and `/api/estimate-kcal` return fixed generic messages. The two URL-based routes
pass `e.message` straight through, so the table below is effectively their error contract:

| Message reaching the client | HTTP | Thrown by |
|---|---|---|
| `Falta el texto de la receta.` / `Falta la URL de YouTube.` / `Falta la URL de la página.` / `Faltan ingredientes para estimar las calorías.` | 400 | the route's own validation |
| `Demasiadas peticiones. Espera un rato y vuelve a intentar.` | 429 | `aiLimiter` (§2) |
| `No reconocí un ID de video en esa URL.` | 500 | `youtube.js` — `getVideoId` returned null |
| `No encontré descripción ni subtítulos en ese video. Copia el texto de la receta a mano y usa "Extraer con IA".` | 500 | `youtube.js` (`getRecipeText`) — both sources empty |
| `Esa URL no es válida.` | 500 | `webpage.js` — a string `new URL()` can't parse, `localhost`, a private/loopback/link-local IP at **any** redirect hop, or a non-http(s) protocol |
| `No pude resolver esa dirección.` | 500 | `webpage.js` (`assertPublicHost`) — DNS lookup failed |
| `No pude abrir esa página. Revisa el enlace.` | 500 | `webpage.js` (`fetchValidated`) — fetch threw, including the 15 s timeout |
| `La página respondió con una redirección inválida.` | 500 | `webpage.js` (`fetchValidated`) — 3xx without a `Location` header |
| `La página respondió con error (404).` | 500 | `webpage.js` (`fetchValidated`) — non-2xx page (note: always reported as a 500 to the client, whatever the upstream status was) |
| `Demasiadas redirecciones.` | 500 | `webpage.js` (`fetchValidated`) — more than `MAX_REDIRECTS = 5` hops |
| `No encontré texto de receta en esa página.` | 500 | `webpage.js` (`getRecipeTextFromUrl`) — neither JSON-LD nor visible text yielded anything |
| `La IA no devolvió un JSON válido.` | 500 | `recipe.js` (`parseRecipe`) — no `{...}` found in the model output (also what an empty completion produces) |
| Groq SDK error text (e.g. auth/quota failures) | 500 | **Rough edge**: passed through verbatim by the two URL routes — see §8 |
| `No se pudo extraer la receta.` / `No se pudo importar la receta.` / `No se pudo estimar las calorías.` | 500 | the fixed fallbacks |

---

## 6. Services (external-integration wrappers)

This tier's equivalent of a data-access layer: the only place external systems are called. None of
them touch a database.

### 6.1 `services/groq.js`
`complete(prompt: string): Promise<string>` — one user-role message to
`https://api.groq.com/openai/v1` (OpenAI-compatible), model `process.env.MODEL ||
'openai/gpt-oss-20b'`, `max_tokens: 2048`, `reasoning_effort: 'low'`. That last one is deliberate
and documented in-file: gpt-oss is a reasoning model, and at higher effort it spends the token
budget thinking and leaves nothing for the answer — which surfaces downstream as
`'La IA no devolvió un JSON válido.'` Returns `res.choices[0]?.message?.content || ''`.
`GROQ_API_KEY` is read here and only here, and never leaves the process.
**Callers**: all four POST routes.

### 6.2 `services/recipe.js` — prompt construction + response coercion
| Export | Notes |
|---|---|
| `buildPrompt(source)` | Spanish extraction prompt with the exact JSON shape, the Costco/Walmart assignment heuristics (bulk proteins/rice/cheese → costco; spices/fresh herbs/regional items → walmart), the `easy`/`left`/`types`/`pantry` definitions, the unit conversion table, and `kcal`/`servings` as *whole-recipe* estimates. `types` defaults to `["cena"]` when the source gives no signal. |
| `parseRecipe(text)` | Strips ```` ```json ```` fences, slices from the first `{` to the last `}`, `JSON.parse`s, then coerces every field (§4). **Throws** `'La IA no devolvió un JSON válido.'` when no brace pair is found. |
| `buildKcalPrompt({name, ing, steps})` | Rebuilds a compact ingredient list (`- <qty> <unit> <item>`) from already-structured data, so estimation never needs the original video/page text again. |
| `parseKcalResponse(text)` | Same extraction approach, but **never throws** — any failure returns `{kcal: null, servings: null}`, because "couldn't estimate" is a normal, displayable outcome in the editor, not a server error. |

**Callers**: all four POST routes, always paired with `complete()`.

### 6.3 `services/webpage.js` — page fetching + recipe text extraction
Strategy, cleanest first: (1) `schema.org/Recipe` JSON-LD — most cooking blogs emit it for SEO,
and `findRecipe` also unwraps `@graph` nesting (the WP Recipe Maker pattern) and arrays; (2)
fallback to visible text with `script, style, noscript, svg, nav, footer, header, iframe` stripped.

| Export / helper | Notes |
|---|---|
| `getRecipeTextFromUrl(rawUrl, fetchImpl = fetch)` | Entry point. Parses `rawUrl` inside a `try`, converting the `TypeError` that `new URL()` throws on malformed input into the file's standard `'Esa URL no es válida.'` — the route returns `e.message` verbatim, so an untranslated message would otherwise reach the user. Caps the HTML read at `MAX_HTML_CHARS = 3_000_000` before parsing and the returned text at `MAX_TEXT_CHARS = 12_000` (token budget). Throws if no text is found. `fetchImpl` is injectable so the logic is testable without real network. |
| `isPrivateIp(ip)` | RFC1918 + loopback + link-local + `0.0.0.0/8` for IPv4; `::1`, `fc/fd` ULA, `fe80::` for IPv6; **also** re-checks IPv4-mapped IPv6 (`::ffff:10.0.0.1`) against the IPv4 rules instead of treating it as safe. Anything unrecognized returns `true` — fails closed. |
| `assertPublicHost(hostname)` | Rejects literal `localhost`, then `dns.lookup(..., {all: true})` and rejects if resolution fails or **any** returned address is private. |
| `fetchValidated(startUrl, fetchImpl)` | `redirect: 'manual'` with up to `MAX_REDIRECTS = 5` hops, re-running `assertPublicHost` on **every** hop — a first-hop-only check would let a public URL redirect the server into cloud metadata or an internal service. Also enforces http(s), a 15 s `AbortSignal.timeout`, and a fixed `MenuSemanaBot/1.0` user agent. Relative `Location` headers are resolved against the current URL. |
| `findRecipe` / `fromJsonLd` / `recipeToText` / `textFromInstructions` / `fromVisibleText` | JSON-LD traversal and text assembly. `textFromInstructions` handles strings, arrays, `itemListElement` nesting, and `{text}`/`{name}` step objects. Malformed JSON-LD blocks are skipped silently rather than failing the request. |

**Caller**: `routes/importUrl.js` only.

### 6.4 `services/youtube.js` — description + transcript
| Export / helper | Notes |
|---|---|
| `getVideoId(url)` | Matches `?v=`, `youtu.be/`, `/shorts/`, `/embed/`, or a bare 11-char id. Returns `null` otherwise. |
| `fetchDescription(videoId)` | Official YouTube Data API v3 (`videos?part=snippet`). Returns `null` when `YOUTUBE_API_KEY` is unset or the call fails — a soft failure, never a throw. |
| `fetchTranscript(videoId)` | Unofficial `youtube-transcript` package. Returns `null` on any error (no captions, library breakage). The README notes the ~100–200 requests/hour/IP ceiling and that strict reading of YouTube's ToS disfavors caption scraping, while the official description API is fine. |
| `getRecipeText(url)` | Runs both sources **concurrently** (`Promise.all`), joins whichever succeeded as `Título:` / `Descripción:` / `Transcripción:` blocks. Throws only when both come back empty. |

**Caller**: `routes/importYoutube.js` only.

---

## 7. DB package calls / DB schema

**N/A — this service has no database.** It holds no persistent state of any kind: no sessions, no
cache, no user records. Outbound calls go to Groq, the YouTube Data API, `youtube-transcript`, and
arbitrary recipe pages; nothing is written anywhere. All persistence happens in the browser against
Firestore — see [`client.md §7.7`](./client.md#77-libuserstoragejs--the-db-package) for the data-access
functions and [`client.md §8`](./client.md#8-firestore-schema--the-tables-of-this-app) for the schema.

If a database is ever added here (server-side recipe caching is the obvious candidate — the same
YouTube URL currently re-hits the model on every import), replace this section with real schema
documentation and fill in the per-route "DB package calls" / "DB schema" fields rather than leaving
them marked N/A.

---

## 8. Security posture

What is deliberately defended, and what is knowingly accepted:

**Defended**
- **API key isolation** — `GROQ_API_KEY` is read only in `services/groq.js`, server-side. The
  client never sees it; that is the whole reason this tier exists.
- **SSRF** — `services/webpage.js` fetches attacker-supplied URLs, so it validates the resolved IP
  on every redirect hop, blocks private/loopback/link-local ranges in both IPv4 and IPv6
  (including IPv4-mapped form), restricts protocols to http(s), caps redirects at 5, and times out
  at 15 s. This is the most security-sensitive file in the repo — change it carefully.
- **Quota abuse** — the shared 20-per-15-minutes limiter runs before route logic, keyed on an
  unforgeable Cloudflare-set header (§2).
- **Cross-origin abuse** — `CLIENT_URL` pins CORS to the deployed frontend in production.
- **Body size** — `express.json({limit: '1mb'})`.
- **Secrets in the repo** — verified: only `.env.example` templates are tracked (placeholders and
  empty values, e.g. `GROQ_API_KEY=gsk_xxxxxxxx`); the real `client/.env` and `server/.env` exist
  locally and are matched by `.gitignore:3`; a scan of the full history for `gsk_`, `AIza`, `sk-`,
  `phc_` and private-key headers found nothing.

**Accepted / worth knowing**
- **Error-message passthrough** — `/api/import-url` and `/api/import-youtube` return `e.message`
  verbatim on 500. That is what makes their friendly Spanish errors work, but it also means an
  unexpected upstream error (a Groq auth or quota failure, for instance) is echoed to the client.
  The known-untranslated case — `new URL()`'s `Invalid URL` — is now converted at the source
  (§6.3), but nothing structurally prevents the next one. Low impact for a family app; worth an
  allow-list of known messages if this ever goes public.
- **No authentication** — any caller who knows the URL can use the endpoints, bounded only by CORS
  and the rate limit. There is no per-user quota, because the server has no notion of users.
- **No CI secret scanning** — the repo has no CI workflow at all, so nothing enforces the checks
  above on future commits. Adding a gitleaks step would make this a standing guarantee instead of a
  one-time verification.
- **Unofficial transcript dependency** — `youtube-transcript` can break without notice when YouTube
  changes its site; the code already treats that as a soft failure.
