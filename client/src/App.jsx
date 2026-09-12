import { useState, useEffect, useMemo } from 'react';
import { Calendar, ShoppingCart, BookOpen } from 'lucide-react';
import { storage } from './lib/storage.js';
import { resolveHouseholdId, getHouseholdStorage, joinHousehold, leaveHousehold } from './lib/userStorage.js';
import { signOutUser, signInWithGoogle, upgradeGuestToGoogle } from './lib/auth.js';
import { track } from './lib/analytics.js';
import { SEED_MEALS, DAYS, EMPTY_WEEK, DEFAULT_STORES, storeMeta, uid, withIds, normalizeMeal, breakfastNameToMeal } from './data/seed.js';
import { mondayOf } from './lib/dates.js';
import SemanaTab from './components/SemanaTab.jsx';
import ListaTab from './components/ListaTab.jsx';
import RecetasTab from './components/RecetasTab.jsx';
import MealEditor from './components/MealEditor.jsx';
import PlanWizard from './components/PlanWizard.jsx';
import WeeksList from './components/WeeksList.jsx';
import SharePanel from './components/SharePanel.jsx';
import StoresPanel from './components/StoresPanel.jsx';

const STORE_KEY = 'planner-v1';
const SCHEMA_VERSION = 2; // v2 = banco de comidas unificado (desayuno/almuerzo/cena con types)

export default function App({ user }) {
  // A qué hogar (households/{id}) pertenece esta cuenta — por defecto el suyo propio (su uid),
  // salvo que se haya unido al de alguien más (incluye invitados: alguien puede entrar como
  // invitado y unirse a un hogar directo desde el login, sin cuenta de Google — ver Login.jsx).
  const [householdId, setHouseholdId] = useState(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [storesOpen, setStoresOpen] = useState(false);
  const [stores, setStores] = useState(DEFAULT_STORES); // preferencia del hogar, no por semana
  const [upgradeError, setUpgradeError] = useState(null);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setHouseholdId(null);
    setLoadError(null);
    resolveHouseholdId(user.uid)
      .then((id) => { if (!cancelled) setHouseholdId(id); })
      .catch((e) => { if (!cancelled) setLoadError(e.message || String(e)); });
    return () => { cancelled = true; };
  }, [user.uid]);

  const userStore = useMemo(() => (householdId ? getHouseholdStorage(householdId) : null), [householdId]);

  const [tab, setTab] = useState('semana');
  const [meals, setMeals] = useState(null); // null = cargando
  // Cada semana (identificada por su lunes en ISO) guarda su propio plan, para que cambiar
  // de fecha nunca borre lo que ya estaba planeado en otra semana.
  const [weeks, setWeeks] = useState({}); // weekStartISO -> {plan, bfPlan, lunchPlan, busyDays, checked}
  const [weekStart, setWeekStart] = useState(mondayOf()); // fecha (ISO) del lunes de la semana que se está viendo
  const [healthyOnly, setHealthyOnly] = useState(false);  // preferencia persistente del wizard/Recetas
  const [editing, setEditing] = useState(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [weeksListOpen, setWeeksListOpen] = useState(false);

  const currentWeek = weeks[weekStart] || EMPTY_WEEK;
  const { plan, bfPlan, lunchPlan, busyDays, checked, lunchReuseAll } = currentWeek;

  // Escribe en la semana actualmente activa (weekStart), sin tocar las demás.
  const updateWeek = (key, updater) =>
    setWeeks((prev) => {
      const wk = prev[weekStart] || EMPTY_WEEK;
      const nextVal = typeof updater === 'function' ? updater(wk[key]) : updater;
      return { ...prev, [weekStart]: { ...wk, [key]: nextVal } };
    });

  const setPlan = (u) => updateWeek('plan', u);
  const setBfPlan = (u) => updateWeek('bfPlan', u);
  const setLunchPlan = (u) => updateWeek('lunchPlan', u);
  const setBusyDays = (u) => updateWeek('busyDays', u);
  const setChecked = (u) => updateWeek('checked', u);
  const setLunchReuseAll = (u) => updateWeek('lunchReuseAll', u);

  const deleteWeek = (key) =>
    setWeeks((prev) => { const next = { ...prev }; delete next[key]; return next; });

  // --- Cargar de Firestore (o sembrar la primera vez) ---
  useEffect(() => {
    if (!userStore) return; // todavía resolviendo a qué hogar pertenece esta cuenta
    let cancelled = false;
    (async () => {
      try {
        let r = await userStore.get(STORE_KEY);

        // Documento nuevo (nunca inició sesión antes): si hay datos sueltos en el localStorage
        // de este navegador, se suben una sola vez a su cuenta nueva. Si el documento YA existía
        // (usuario que vuelve), nunca se toca localStorage — así no se sobreescribe algo más
        // nuevo en la nube con algo viejo local. localStorage no se borra en ningún caso.
        if (!r) {
          const local = await storage.get(STORE_KEY);
          if (local?.value) {
            r = await userStore.set(STORE_KEY, local.value);
          }
        }

        if (cancelled) return;
        if (r?.value) {
          const d = JSON.parse(r.value);
          const ws = d.weekStart || mondayOf();

          // normalizeMeal rellena campos nuevos (healthy, videoUrl, qty/unit/pantry por ingrediente,
          // types) en recetas guardadas antes de que existieran, para no perderlas ni romper la UI.
          let meals = d.meals?.length ? d.meals.map(normalizeMeal) : withIds(SEED_MEALS);

          // Si no hay "weeks" (guardado de antes de esa feature), se arma una sola entrada con
          // el plan suelto que hubiera a nivel raíz.
          let weeksDict = d.weeks || {
            [ws]: { plan: d.plan || {}, bfPlan: d.bfPlan || {}, busyDays: d.busyDays || {}, checked: d.checked || {}, lunchReuseAll: false },
          };

          // Migración al banco unificado (v2): antes, el desayuno vivía aparte como puros
          // strings sueltos (sin ingredientes ni id). Se convierte una sola vez a recetas
          // normales del banco (types:['desayuno']) y se reescriben las referencias guardadas
          // para que apunten al id nuevo en vez del nombre.
          const isLegacy = !d.schemaVersion || d.schemaVersion < SCHEMA_VERSION;
          if (isLegacy) {
            const names = new Set(d.breakfasts || []);
            for (const w of Object.values(weeksDict)) {
              for (const name of Object.values(w.bfPlan || {})) {
                if (name) names.add(name);
              }
            }
            const nameToId = {};
            for (const name of names) {
              const bf = breakfastNameToMeal(name);
              meals = [...meals, bf];
              nameToId[name] = bf.id;
            }
            weeksDict = Object.fromEntries(
              Object.entries(weeksDict).map(([key, w]) => [
                key,
                {
                  ...w,
                  bfPlan: Object.fromEntries(
                    Object.entries(w.bfPlan || {}).map(([day, name]) => [day, nameToId[name] || name])
                  ),
                  lunchPlan: w.lunchPlan || {},
                  lunchReuseAll: w.lunchReuseAll || false,
                },
              ])
            );
          } else {
            // Ya en v2 — de todos modos se completa lunchPlan por si una semana quedó guardada
            // sin él (ej. un guardado interrumpido a mitad de este mismo cambio).
            weeksDict = Object.fromEntries(
              Object.entries(weeksDict).map(([key, w]) => [key, { ...w, lunchPlan: w.lunchPlan || {}, lunchReuseAll: w.lunchReuseAll || false }])
            );
          }

          setMeals(meals);
          setWeeks(weeksDict);
          setWeekStart(ws);
          setHealthyOnly(d.healthyOnly || false);
          setStores(d.stores?.length ? d.stores : DEFAULT_STORES);
          return;
        }
      } catch { /* primera vez */ }
      if (!cancelled) setMeals(withIds(SEED_MEALS));
    })();
    return () => { cancelled = true; };
  }, [user.uid, userStore]);

  // --- Guardar en Firestore (con un pequeño debounce) ---
  useEffect(() => {
    if (meals === null) return;
    const t = setTimeout(() => {
      userStore.set(STORE_KEY, JSON.stringify({
        schemaVersion: SCHEMA_VERSION, meals, weeks, weekStart, healthyOnly, stores,
      })).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [meals, weeks, weekStart, healthyOnly, stores, userStore]);

  const toggleBusyDay = (key) => setBusyDays((p) => ({ ...p, [key]: !p[key] }));

  const mealById = useMemo(() => Object.fromEntries((meals || []).map((m) => [m.id, m])), [meals]);

  // --- Llenar la semana automáticamente: respeta días ocupados (solo fáciles) y, si aplica,
  // el modo saludable. Acepta overrides explícitos para que el wizard pueda aplicar valores
  // recién elegidos sin esperar a que el estado de React se actualice. También llena desayunos,
  // con la misma lógica de "no repetir en la semana" que la cena. El almuerzo depende de lo que
  // haya elegido el usuario en el asistente: aprovechar la cena del día anterior cuando se pueda,
  // generar recetas de almuerzo dedicadas, o ambas cosas (ver más abajo).
  const shuffle = (a) => a.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map((x) => x[1]);

  // Reparte un pool de recetas entre los 7 días sin repetir hasta agotar la variedad; si el día
  // está marcado ocupado, prioriza el subconjunto "fácil" del pool.
  const fillWeek = (pool, busy) => {
    const easy = pool.filter((m) => m.easy);
    let poolEasy = shuffle(easy.length ? easy : pool);
    let poolAll = shuffle(pool);
    const used = new Set();
    const next = {};
    for (const d of DAYS) {
      const isBusy = !!busy[d.key];
      const p = isBusy ? poolEasy : poolAll;
      let pick = p.find((m) => !used.has(m.id));
      if (!pick) { // se agotó la variedad: reiniciamos
        pick = (isBusy ? shuffle(easy.length ? easy : pool) : shuffle(pool))[0];
        used.clear();
      }
      if (pick) { next[d.key] = pick.id; used.add(pick.id); }
    }
    return next;
  };

  const autofill = ({ busy = busyDays, healthy = healthyOnly, reuseDinner = true, fillLunch = false } = {}) => {
    if (!meals?.length) return;

    let base = healthy ? meals.filter((m) => m.healthy) : meals;
    if (!base.length) base = meals; // si el modo saludable se queda sin opciones, no dejamos días vacíos

    // Si el filtro saludable deja un tipo sin candidatos, se cae al banco completo de ese tipo
    // en vez de dejar el día vacío.
    const poolFor = (type) => {
      const typed = base.filter((m) => m.types.includes(type));
      return typed.length ? typed : meals.filter((m) => m.types.includes(type));
    };
    const cenaPool = poolFor('cena');
    const bfPool = poolFor('desayuno');

    let nextPlan = null;
    if (cenaPool.length) {
      nextPlan = fillWeek(cenaPool, busy);
      setPlan(nextPlan);
      setChecked({});
    }
    if (bfPool.length) setBfPlan(fillWeek(bfPool, {})); // el desayuno no tiene noción de "ocupado"

    // Almuerzo: "aprovechar cena" es una decisión para toda la semana, no receta por receta —
    // marca lunchReuseAll y SemanaTab.jsx sugiere la cena de ayer todos los días, sin importar
    // si esa receta en particular tiene la etiqueta "rinde". "Generar recetas" hace lo opuesto:
    // una receta real cada día, ignorando esa etiqueta por completo. Son excluyentes.
    setLunchReuseAll(reuseDinner);
    if (fillLunch) {
      const lunchPool = poolFor('almuerzo');
      if (lunchPool.length) setLunchPlan(fillWeek(lunchPool, {}));
    }
  };

  const clearWeek = () => { setPlan({}); setBfPlan({}); setLunchPlan({}); setChecked({}); setLunchReuseAll(false); };

  // --- Lista de compras agregada, agrupada por tienda; despensa aparte y sin cantidad ---
  const shopping = useMemo(() => {
    const allStoreIds = [...stores.map((s) => s.id), 'both'];
    const groups = Object.fromEntries(allStoreIds.map((id) => [id, {}]));
    const pantry = {};
    const addMealIngredients = (m) => {
      if (!m) return;
      for (const g of m.ing) {
        const itemKey = g.item.toLowerCase().trim();
        if (g.pantry) {
          if (!pantry[itemKey]) pantry[itemKey] = { key: `pantry:${itemKey}`, item: g.item, from: [] };
          if (!pantry[itemKey].from.includes(m.name)) pantry[itemKey].from.push(m.name);
          continue;
        }
        // `store` inválido cae en "both": hay que resolverlo antes de armar la clave, para que
        // la clave no diga una tienda distinta de la lista donde realmente quedó el ingrediente.
        const storeKey = groups[g.store] ? g.store : 'both';
        const bucket = groups[storeKey];
        // se agrupa por item+unidad: cantidades con la misma unidad se suman entre recetas.
        const unitKey = (g.unit || '').toLowerCase().trim();
        const groupKey = `${itemKey}|${unitKey}`;
        // `key` se arma con los valores normalizados (los mismos que agrupan), no con `item`/`unit`
        // tal como se escribieron: esos guardan la mayúscula de la PRIMERA receta que aportó el
        // ingrediente, así que cambiar qué receta va primero renombraba la clave y ListaTab perdía
        // el palomeado de un ingrediente que en realidad es el mismo.
        if (!bucket[groupKey]) bucket[groupKey] = { key: `${storeKey}:${groupKey}`, item: g.item, qty: 0, hasQty: false, unit: g.unit || '', from: [] };
        if (typeof g.qty === 'number') {
          bucket[groupKey].qty += g.qty;
          bucket[groupKey].hasQty = true;
        }
        if (!bucket[groupKey].from.includes(m.name)) bucket[groupKey].from.push(m.name);
      }
    };
    for (const d of DAYS) {
      addMealIngredients(mealById[plan[d.key]]);
      addMealIngredients(mealById[bfPlan[d.key]]);
      // El almuerzo solo suma si se eligió a mano — si se está aprovechando la cena de ayer,
      // esos ingredientes ya se contaron con la cena del día anterior; sumarlos de nuevo duplicaría.
      if (lunchPlan[d.key]) addMealIngredients(mealById[lunchPlan[d.key]]);
    }
    const toList = (o) => Object.values(o).sort((a, b) => a.item.localeCompare(b.item));
    return {
      byStore: allStoreIds.map((id) => ({ id, ...storeMeta(id, stores), items: toList(groups[id]) })),
      pantry: toList(pantry),
    };
  }, [plan, bfPlan, lunchPlan, mealById, stores]);

  const saveMeal = (m) =>
    setMeals((prev) =>
      m.id && prev.some((x) => x.id === m.id)
        ? prev.map((x) => (x.id === m.id ? m : x))
        : [...prev, { ...m, id: uid() }]
    );

  // Cambiar de hogar (unirse o salir) apunta userStore a otro documento — se vuelve a mostrar
  // "Cargando…" mientras el efecto de arriba trae los datos de ese hogar.
  const handleJoin = async (code) => {
    await joinHousehold(code, user.uid);
    setMeals(null);
    setHouseholdId(code);
    setShareOpen(false);
  };
  const handleLeave = async () => {
    await leaveHousehold(user.uid);
    setMeals(null);
    setHouseholdId(user.uid);
  };

  const handleUpgrade = async () => {
    setUpgradeError(null);
    try {
      await upgradeGuestToGoogle();
    } catch (e) {
      if (e.code === 'auth/credential-already-in-use') {
        setUpgradeError({
          message: 'Esa cuenta de Google ya tiene su propio banco de recetas — inicia sesión normal en vez de vincular (perderás lo armado como invitado).',
          conflict: true,
        });
      } else if (e.code !== 'auth/popup-closed-by-user') {
        setUpgradeError({ message: 'No se pudo vincular la cuenta. Inténtalo de nuevo.', conflict: false });
      }
    }
  };

  // Desde el mensaje de "esa cuenta ya tiene datos propios" — entra normal con esa cuenta en
  // vez de obligar a pasar primero por "Salir" y la pantalla de login.
  const handleUseGoogleAccount = async () => {
    setUpgradeError(null);
    try {
      await signInWithGoogle();
    } catch (e) {
      if (e.code !== 'auth/popup-closed-by-user') {
        setUpgradeError({ message: 'No se pudo iniciar sesión. Inténtalo de nuevo.', conflict: false });
      }
    }
  };

  if (loadError) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center text-center p-4 gap-3">
        <p className="text-stone-600">No se pudo cargar tus datos.</p>
        <p className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg p-2 max-w-md">{loadError}</p>
        <button onClick={signOutUser} className="text-sm px-3 py-1.5 rounded-lg border border-emerald-800/20 text-emerald-800 hover:bg-emerald-50">
          Cerrar sesión
        </button>
      </div>
    );
  }

  if (meals === null) {
    return <div className="min-h-screen bg-stone-50 flex items-center justify-center text-stone-400">Cargando…</div>;
  }

  const tabs = [
    { k: 'semana', label: 'Semana', Icon: Calendar },
    { k: 'lista', label: 'Lista', Icon: ShoppingCart },
    { k: 'recetas', label: 'Recetas', Icon: BookOpen },
  ];

  return (
    <div className="min-h-screen bg-stone-50 text-stone-800">
      <div className="max-w-3xl mx-auto px-4 pb-24">
        <header className="pt-6 pb-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-emerald-800 tracking-tight">Menú de la semana</h1>
            <p className="text-sm text-stone-500 mt-0.5">Planea, arma la lista y compra sin pensarlo dos veces.</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap sm:shrink-0">
            {user.isAnonymous ? (
              <>
                <span className="text-sm text-stone-500 hidden sm:inline">Modo invitado</span>
                <button
                  onClick={handleUpgrade}
                  className="text-sm px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-medium"
                >
                  Vincular con Google
                </button>
                <button
                  onClick={signOutUser}
                  className="text-sm px-3 py-1.5 rounded-lg border border-emerald-800/20 text-emerald-800 hover:bg-emerald-50"
                  title="Sale del modo invitado (lo que armaste aquí no se recupera después, salvo que hayas vinculado una cuenta)"
                >
                  Salir
                </button>
              </>
            ) : (
              <>
                {user.photoURL && (
                  <img src={user.photoURL} alt="" referrerPolicy="no-referrer" className="w-8 h-8 rounded-full" />
                )}
                <span className="text-sm text-emerald-800 hidden sm:inline">{user.displayName}</span>
                <button
                  onClick={() => setStoresOpen(true)}
                  className="text-sm px-3 py-1.5 rounded-lg border border-emerald-800/20 text-emerald-800 hover:bg-emerald-50"
                >
                  Tiendas
                </button>
                <button
                  onClick={() => setShareOpen(true)}
                  className="text-sm px-3 py-1.5 rounded-lg border border-emerald-800/20 text-emerald-800 hover:bg-emerald-50"
                >
                  Compartir
                </button>
                <button
                  onClick={signOutUser}
                  className="text-sm px-3 py-1.5 rounded-lg border border-emerald-800/20 text-emerald-800 hover:bg-emerald-50"
                >
                  Cerrar sesión
                </button>
              </>
            )}
          </div>
        </header>
        {upgradeError && (
          <div className="-mt-2 mb-4 text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg p-2">
            <p>{upgradeError.message}</p>
            {upgradeError.conflict && (
              <button
                onClick={handleUseGoogleAccount}
                className="mt-2 text-sm px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-medium"
              >
                Iniciar sesión con esa cuenta
              </button>
            )}
          </div>
        )}

        <nav className="flex gap-1 bg-white rounded-xl p-1 shadow-sm sticky top-2 z-10">
          {tabs.map(({ k, label, Icon }) => (
            <button key={k} onClick={() => { setTab(k); track('tab_view', { tab: k }); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium transition ${tab === k ? 'bg-emerald-700 text-white' : 'text-stone-600 hover:bg-stone-100'}`}>
              <Icon size={16} /> {label}
            </button>
          ))}
        </nav>

        {tab === 'semana' && (
          <SemanaTab {...{
            meals, plan, setPlan, bfPlan, setBfPlan, lunchPlan, setLunchPlan, lunchReuseAll, mealById, clearWeek,
            busyDays, toggleBusyDay, weekStart, setWeekStart, openWizard: () => setWizardOpen(true),
            openWeeksList: () => setWeeksListOpen(true),
          }} />
        )}
        {tab === 'lista' && <ListaTab {...{ shopping, checked, setChecked, plan, bfPlan, lunchPlan, mealById, stores }} />}
        {tab === 'recetas' && <RecetasTab {...{ meals, setMeals, setEditing, healthyOnly, setHealthyOnly }} />}
      </div>

      {editing && (
        <MealEditor
          meal={editing}
          categories={[...new Set(meals.map((m) => m.cat))].sort((a, b) => a.localeCompare(b, 'es'))}
          stores={stores}
          onClose={() => setEditing(null)}
          onSave={(m) => { saveMeal(m); setEditing(null); }}
        />
      )}

      {storesOpen && (
        <StoresPanel
          stores={stores}
          setStores={setStores}
          onClose={() => setStoresOpen(false)}
        />
      )}

      {wizardOpen && (
        <PlanWizard
          busyDays={busyDays}
          healthyOnly={healthyOnly}
          lunchPoolSize={meals.filter((m) => m.types.includes('almuerzo')).length}
          hasAnyPlan={DAYS.some((d) => plan[d.key] || bfPlan[d.key] || lunchPlan[d.key])}
          onClose={() => setWizardOpen(false)}
          onApply={({ busyDays: selBusy, healthyOnly: selHealthy, reuseDinner, fillLunch }) => {
            setBusyDays(selBusy);
            setHealthyOnly(selHealthy);
            autofill({ busy: selBusy, healthy: selHealthy, reuseDinner, fillLunch });
            setWizardOpen(false);
          }}
        />
      )}

      {weeksListOpen && (
        <WeeksList
          weeks={weeks}
          weekStart={weekStart}
          onSelect={(k) => { setWeekStart(k); setWeeksListOpen(false); }}
          onDelete={deleteWeek}
          onClose={() => setWeeksListOpen(false)}
        />
      )}

      {shareOpen && (
        <SharePanel
          householdId={householdId}
          isMember={householdId !== user.uid}
          onJoin={handleJoin}
          onLeave={handleLeave}
          onClose={() => setShareOpen(false)}
        />
      )}
    </div>
  );
}
