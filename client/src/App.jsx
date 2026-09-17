import { useState, useEffect, useMemo } from 'react';
import { Calendar, ShoppingCart, BookOpen, HelpCircle, Store, Users, LogOut } from 'lucide-react';
import { storage } from './lib/storage.js';
import { resolveHouseholdId, getHouseholdStorage, joinHousehold, leaveHousehold } from './lib/userStorage.js';
import { signOutUser, signInWithGoogle, upgradeGuestToGoogle } from './lib/auth.js';
import { track } from './lib/analytics.js';
import { getInvite, clearInvite } from './lib/invite.js';
import { SEED_MEALS, DAYS, EMPTY_WEEK, DEFAULT_STORES, storeMeta, uid, withIds, normalizeMeal, breakfastNameToMeal } from './data/seed.js';
import { mondayOf } from './lib/dates.js';
import SemanaTab from './components/SemanaTab.jsx';
import ListaTab from './components/ListaTab.jsx';
import RecetasTab from './components/RecetasTab.jsx';
import MealEditor from './components/MealEditor.jsx';
import MealView from './components/MealView.jsx';
import PlanWizard from './components/PlanWizard.jsx';
import WeeksList from './components/WeeksList.jsx';
import SharePanel from './components/SharePanel.jsx';
import StoresPanel from './components/StoresPanel.jsx';
import LanguageToggle from './components/LanguageToggle.jsx';
import GuidedTour from './components/GuidedTour.jsx';
import { ConfirmDialog } from './components/ui.jsx';
import { useT } from './lib/i18n/LanguageContext.jsx';

const STORE_KEY = 'planner-v1';
const SCHEMA_VERSION = 2; // v2 = banco de comidas unificado (desayuno/almuerzo/cena con types)
const TOUR_KEY_PREFIX = 'menu-semana:tourDone:';

export default function App({ user }) {
  const { t, lang } = useT();
  // A qué hogar (households/{id}) pertenece esta cuenta — por defecto el suyo propio (su uid),
  // salvo que se haya unido al de alguien más (incluye invitados: alguien puede entrar como
  // invitado y unirse a un hogar directo desde el login, sin cuenta de Google — ver Login.jsx).
  const [householdId, setHouseholdId] = useState(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [storesOpen, setStoresOpen] = useState(false);
  const [stores, setStores] = useState(DEFAULT_STORES); // preferencia del hogar, no por semana
  // Recordatorio de "ya compraste esto" — nombre de ingrediente (minúscula) -> fecha ISO de la
  // última vez que se palomeó como comprado. Tampoco es por semana, es del hogar.
  const [purchaseHistory, setPurchaseHistory] = useState({});
  const markPurchased = (itemName) => {
    const key = itemName.toLowerCase().trim();
    if (!key) return;
    setPurchaseHistory((p) => ({ ...p, [key]: new Date().toISOString().slice(0, 10) }));
  };
  // A qué tienda quedó asociado cada ingrediente la última vez que se guardó una receta con él
  // — así una importación nueva no vuelve a adivinar de cero (y puede contradecirse) para un
  // ingrediente que ya se resolvió antes, sea por la IA o corregido a mano.
  const [ingredientStores, setIngredientStores] = useState({});
  const rememberIngredientStores = (ing) =>
    setIngredientStores((p) => {
      const next = { ...p };
      for (const g of ing) {
        const key = g.item?.toLowerCase().trim();
        if (key) next[key] = g.store;
      }
      return next;
    });
  // Productos de la lista de compras que no vienen de ninguna receta (ej. papel higiénico) —
  // al estilo Keep: marcarlo lo tacha pero no lo borra, para desmarcarlo cuando se vuelva a
  // necesitar sin tener que volver a escribirlo. Tampoco es por semana, es del hogar.
  const [extraItems, setExtraItems] = useState([]);
  const addExtraItem = (name, store) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setExtraItems((p) => [...p, { id: uid(), name: trimmed, store, checked: false }]);
  };
  // Al marcarlo (comprado) también entra al mismo recordatorio de "ya lo compraste" que usan
  // los ingredientes de receta — igual de útil aquí: si semanas después lo desmarcas porque
  // se te acabó, el recordatorio te dice desde cuándo lo tenías.
  const toggleExtraItem = (id) =>
    setExtraItems((p) => p.map((x) => {
      if (x.id !== id) return x;
      const next = { ...x, checked: !x.checked };
      if (next.checked) markPurchased(x.name);
      return next;
    }));
  const removeExtraItem = (id) => setExtraItems((p) => p.filter((x) => x.id !== id));

  const [upgradeError, setUpgradeError] = useState(null);
  const [loadError, setLoadError] = useState(null);
  // Código de hogar que venía en el link (/?hogar=…), si lo había. Se pregunta antes de
  // aplicarlo: unirse cambia a qué hogar apunta esta cuenta, y eso no se hace a espaldas de
  // nadie. Ver lib/invite.js.
  const [inviteCode, setInviteCode] = useState(() => getInvite());
  const [inviteError, setInviteError] = useState(null);

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
  const [viewing, setViewing] = useState(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [weeksListOpen, setWeeksListOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);

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
          setPurchaseHistory(d.purchaseHistory || {});
          setIngredientStores(d.ingredientStores || {});
          setExtraItems(d.extraItems || []);
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
        schemaVersion: SCHEMA_VERSION, meals, weeks, weekStart, healthyOnly, stores, purchaseHistory, ingredientStores, extraItems,
      })).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [meals, weeks, weekStart, healthyOnly, stores, purchaseHistory, ingredientStores, extraItems, userStore]);

  // --- Tutorial guiado: se abre solo la primera vez, por cuenta y por dispositivo (no es un
  // dato del hogar compartido — cada persona que se une ve el suyo, sin depender de si otro
  // miembro del hogar ya lo vio). Espera a que meals termine de cargar para no aparecer
  // encima de la pantalla de "Cargando…".
  const tourKey = TOUR_KEY_PREFIX + user.uid;
  useEffect(() => {
    if (meals === null) return;
    if (inviteCode) return; // primero se resuelve la invitación del link, luego sale el tutorial
    let seen = true;
    try { seen = localStorage.getItem(tourKey) === '1'; } catch { /* noop */ }
    if (!seen) setTourOpen(true);
  }, [meals, tourKey, inviteCode]);

  const finishTour = () => {
    setTourOpen(false);
    try { localStorage.setItem(tourKey, '1'); } catch { /* noop */ }
  };
  // Reabrir a mano (botón "?"): fuerza la pestaña Semana primero para que "Sorpréndeme" esté
  // montado cuando el tour llegue a ese paso, y sube el scroll al inicio — si quien reabre
  // había bajado bastante en la lista de días, ese botón podría quedar fuera de la pantalla.
  const reopenTour = () => {
    setTab('semana');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTourOpen(true);
  };

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
  // Se agrupa PRIMERO por ingrediente+unidad (ignorando tienda) para que dos recetas con el
  // mismo ingrediente siempre se sumen en una sola línea, aunque la IA haya clasificado cada
  // una en una tienda distinta al importarlas por separado — solo al final se decide en qué
  // sección de tienda mostrar esa línea ya consolidada, por mayoría de votos entre las tiendas
  // de sus ingredientes de origen (empate → "Cualquier tienda").
  const shopping = useMemo(() => {
    const allStoreIds = [...stores.map((s) => s.id), 'both'];
    const merged = {};
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
        // se agrupa por item+unidad: cantidades con la misma unidad se suman entre recetas.
        const unitKey = (g.unit || '').toLowerCase().trim();
        const groupKey = `${itemKey}|${unitKey}`;
        if (!merged[groupKey]) merged[groupKey] = { item: g.item, qty: 0, hasQty: false, unit: g.unit || '', from: [], storeVotes: {} };
        const entry = merged[groupKey];
        if (typeof g.qty === 'number') {
          entry.qty += g.qty;
          entry.hasQty = true;
        }
        if (!entry.from.includes(m.name)) entry.from.push(m.name);
        const voteStore = allStoreIds.includes(g.store) ? g.store : 'both';
        entry.storeVotes[voteStore] = (entry.storeVotes[voteStore] || 0) + 1;
      }
    };
    for (const d of DAYS) {
      addMealIngredients(mealById[plan[d.key]]);
      addMealIngredients(mealById[bfPlan[d.key]]);
      // El almuerzo solo suma si se eligió a mano — si se está aprovechando la cena de ayer,
      // esos ingredientes ya se contaron con la cena del día anterior; sumarlos de nuevo duplicaría.
      if (lunchPlan[d.key]) addMealIngredients(mealById[lunchPlan[d.key]]);
    }

    // Tienda ganadora por mayoría de votos; empate entre dos o más tiendas cae en "both".
    const pickStore = (votes) => {
      const entries = Object.entries(votes);
      if (!entries.length) return 'both';
      entries.sort((a, b) => b[1] - a[1]);
      const top = entries[0][1];
      return entries.filter(([, c]) => c === top).length > 1 ? 'both' : entries[0][0];
    };

    const groups = Object.fromEntries(allStoreIds.map((id) => [id, []]));
    for (const [groupKey, entry] of Object.entries(merged)) {
      const storeId = pickStore(entry.storeVotes);
      groups[storeId].push({ key: `${storeId}:${groupKey}`, item: entry.item, qty: entry.qty, hasQty: entry.hasQty, unit: entry.unit, from: entry.from });
    }

    const toList = (o) => Object.values(o).sort((a, b) => a.item.localeCompare(b.item));
    return {
      byStore: allStoreIds.map((id) => ({ id, ...storeMeta(id, stores), items: groups[id].sort((a, b) => a.item.localeCompare(b.item)) })),
      pantry: toList(pantry),
    };
  }, [plan, bfPlan, lunchPlan, mealById, stores]);

  const saveMeal = (m) => {
    rememberIngredientStores(m.ing);
    setMeals((prev) =>
      m.id && prev.some((x) => x.id === m.id)
        ? prev.map((x) => (x.id === m.id ? m : x))
        : [...prev, { ...m, id: uid() }]
    );
  };

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

  // --- Invitación que venía en el link (/?hogar=…) ---
  // Aceptarla reusa handleJoin, exactamente el mismo camino que el panel de Compartir.
  const acceptInvite = async () => {
    setInviteError(null);
    try {
      await handleJoin(inviteCode);
      setInviteCode(null);
      clearInvite();
      track('household_join', { via: 'link' });
    } catch (e) {
      // Se deja el diálogo abierto con el error: el caso típico es un código mal copiado.
      setInviteError(e.message || String(e));
    }
  };
  const dismissInvite = () => { setInviteCode(null); clearInvite(); };

  // Una invitación que no lleva a ningún lado (es el propio código, o el hogar en el que esta
  // cuenta ya está) se descarta sola y sin preguntar nada — si no, quedaría pendiente para
  // siempre y bloquearía el tutorial de arriba.
  useEffect(() => {
    if (!inviteCode || !householdId) return;
    if (inviteCode === householdId || inviteCode === user.uid) {
      setInviteCode(null);
      clearInvite();
    }
  }, [inviteCode, householdId, user.uid]);

  const handleUpgrade = async () => {
    setUpgradeError(null);
    try {
      await upgradeGuestToGoogle();
    } catch (e) {
      if (e.code === 'auth/credential-already-in-use') {
        setUpgradeError({
          message: t('app.upgradeConflict'),
          conflict: true,
        });
      } else if (e.code !== 'auth/popup-closed-by-user') {
        setUpgradeError({ message: t('app.upgradeFailed'), conflict: false });
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
        setUpgradeError({ message: t('app.signInFailed'), conflict: false });
      }
    }
  };

  if (loadError) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center text-center p-4 gap-3">
        <p className="text-stone-600">{t('app.loadError')}</p>
        <p className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg p-2 max-w-md">{loadError}</p>
        <button onClick={signOutUser} className="text-sm px-3 py-1.5 rounded-lg border border-emerald-800/20 text-emerald-800 hover:bg-emerald-50">
          {t('header.signOut')}
        </button>
      </div>
    );
  }

  if (meals === null) {
    return <div className="min-h-screen bg-stone-50 flex items-center justify-center text-stone-400">{t('app.loading')}</div>;
  }

  const tabs = [
    { k: 'semana', label: t('tab.semana'), Icon: Calendar },
    { k: 'lista', label: t('tab.lista'), Icon: ShoppingCart },
    { k: 'recetas', label: t('tab.recetas'), Icon: BookOpen },
  ];

  return (
    <div className="min-h-screen bg-stone-50 text-stone-800">
      <div className="max-w-3xl mx-auto px-4 pb-24">
        <header className="pt-6 pb-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-emerald-800 tracking-tight">{t('app.title')}</h1>
            <p className="text-sm text-stone-500 mt-0.5">{t('app.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap sm:shrink-0">
            <LanguageToggle />
            <button
              onClick={reopenTour}
              className="p-1.5 rounded-lg text-stone-400 hover:text-emerald-700 hover:bg-emerald-50"
              title={t('tour.reopenTitle')}
            >
              <HelpCircle size={18} />
            </button>
            {user.isAnonymous ? (
              <>
                <span className="text-sm text-stone-500 hidden sm:inline">{t('header.guestMode')}</span>
                <button
                  onClick={handleUpgrade}
                  className="text-sm px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-medium"
                >
                  {t('header.linkGoogle')}
                </button>
                <button
                  onClick={signOutUser}
                  className="text-sm px-3 py-1.5 rounded-lg border border-emerald-800/20 text-emerald-800 hover:bg-emerald-50"
                  title={t('header.exitTitle')}
                >
                  {t('header.exit')}
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
                  className="flex items-center gap-1.5 text-sm px-2 sm:px-3 py-1.5 rounded-lg border border-emerald-800/20 text-emerald-800 hover:bg-emerald-50"
                  title={t('header.stores')}
                >
                  <Store size={16} /> <span className="hidden sm:inline">{t('header.stores')}</span>
                </button>
                <button
                  data-tour="share-btn"
                  onClick={() => setShareOpen(true)}
                  className="flex items-center gap-1.5 text-sm px-2 sm:px-3 py-1.5 rounded-lg border border-emerald-800/20 text-emerald-800 hover:bg-emerald-50"
                  title={t('header.share')}
                >
                  <Users size={16} /> <span className="hidden sm:inline">{t('header.share')}</span>
                </button>
                <button
                  onClick={signOutUser}
                  className="flex items-center gap-1.5 text-sm px-2 sm:px-3 py-1.5 rounded-lg border border-emerald-800/20 text-emerald-800 hover:bg-emerald-50"
                  title={t('header.signOut')}
                >
                  <LogOut size={16} /> <span className="hidden sm:inline">{t('header.signOut')}</span>
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
                {t('app.useThisAccount')}
              </button>
            )}
          </div>
        )}

        <nav data-tour="tabs-nav" className="flex gap-1 bg-white rounded-xl p-1 shadow-sm sticky top-2 z-10">
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
            openWeeksList: () => setWeeksListOpen(true), openView: setViewing,
          }} />
        )}
        {tab === 'lista' && <ListaTab {...{ shopping, checked, setChecked, plan, bfPlan, lunchPlan, mealById, stores, purchaseHistory, markPurchased, extraItems, addExtraItem, toggleExtraItem, removeExtraItem }} />}
        {tab === 'recetas' && <RecetasTab {...{ meals, setMeals, setEditing, healthyOnly, setHealthyOnly, openView: setViewing }} />}
      </div>

      {editing && (
        <MealEditor
          meal={editing}
          categories={[...new Set(meals.map((m) => m.cat))].sort((a, b) => a.localeCompare(b, lang))}
          stores={stores}
          ingredientStores={ingredientStores}
          onClose={() => setEditing(null)}
          onSave={(m) => { saveMeal(m); setEditing(null); }}
        />
      )}

      {viewing && (
        <MealView
          meal={viewing}
          stores={stores}
          onClose={() => setViewing(null)}
          onEdit={() => { setViewing(null); setEditing(viewing); }}
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

      {inviteCode && householdId && inviteCode !== householdId && inviteCode !== user.uid && (
        <ConfirmDialog
          title={t('invite.title')}
          message={inviteError ? `${t('invite.message')} — ${inviteError}` : t('invite.message')}
          confirmLabel={t('invite.confirm')}
          danger={false}
          onConfirm={acceptInvite}
          onCancel={dismissInvite}
        />
      )}

      {tourOpen && <GuidedTour isAnonymous={user.isAnonymous} tab={tab} onSetTab={setTab} onFinish={finishTour} />}
    </div>
  );
}
