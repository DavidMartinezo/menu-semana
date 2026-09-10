import { useState, useEffect, useMemo } from 'react';
import { Calendar, ShoppingCart, BookOpen } from 'lucide-react';
import { storage } from './lib/storage.js';
import { SEED_MEALS, DAYS, uid, withIds, normalizeMeal, breakfastNameToMeal } from './data/seed.js';
import { mondayOf } from './lib/dates.js';
import SemanaTab from './components/SemanaTab.jsx';
import ListaTab from './components/ListaTab.jsx';
import RecetasTab from './components/RecetasTab.jsx';
import MealEditor from './components/MealEditor.jsx';
import PlanWizard from './components/PlanWizard.jsx';
import WeeksList from './components/WeeksList.jsx';

const STORE_KEY = 'planner-v1';
const SCHEMA_VERSION = 2; // v2 = banco de comidas unificado (desayuno/almuerzo/cena con types)

// Plan vacío para una semana que todavía no tiene nada guardado.
const EMPTY_WEEK = { plan: {}, bfPlan: {}, lunchPlan: {}, busyDays: {}, checked: {} };

export default function App() {
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
  const { plan, bfPlan, lunchPlan, busyDays, checked } = currentWeek;

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

  const deleteWeek = (key) =>
    setWeeks((prev) => { const next = { ...prev }; delete next[key]; return next; });

  // --- Cargar del almacenamiento (o sembrar la primera vez) ---
  useEffect(() => {
    (async () => {
      try {
        const r = await storage.get(STORE_KEY);
        if (r?.value) {
          const d = JSON.parse(r.value);
          const ws = d.weekStart || mondayOf();

          // normalizeMeal rellena campos nuevos (healthy, videoUrl, qty/unit/pantry por ingrediente,
          // types) en recetas guardadas antes de que existieran, para no perderlas ni romper la UI.
          let meals = d.meals?.length ? d.meals.map(normalizeMeal) : withIds(SEED_MEALS);

          // Si no hay "weeks" (guardado de antes de esa feature), se arma una sola entrada con
          // el plan suelto que hubiera a nivel raíz.
          let weeksDict = d.weeks || {
            [ws]: { plan: d.plan || {}, bfPlan: d.bfPlan || {}, busyDays: d.busyDays || {}, checked: d.checked || {} },
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
                },
              ])
            );
          } else {
            // Ya en v2 — de todos modos se completa lunchPlan por si una semana quedó guardada
            // sin él (ej. un guardado interrumpido a mitad de este mismo cambio).
            weeksDict = Object.fromEntries(
              Object.entries(weeksDict).map(([key, w]) => [key, { ...w, lunchPlan: w.lunchPlan || {} }])
            );
          }

          setMeals(meals);
          setWeeks(weeksDict);
          setWeekStart(ws);
          setHealthyOnly(d.healthyOnly || false);
          return;
        }
      } catch { /* primera vez */ }
      setMeals(withIds(SEED_MEALS));
    })();
  }, []);

  // --- Guardar (con un pequeño debounce) ---
  useEffect(() => {
    if (meals === null) return;
    const t = setTimeout(() => {
      storage.set(STORE_KEY, JSON.stringify({
        schemaVersion: SCHEMA_VERSION, meals, weeks, weekStart, healthyOnly,
      })).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [meals, weeks, weekStart, healthyOnly]);

  const toggleBusyDay = (key) => setBusyDays((p) => ({ ...p, [key]: !p[key] }));

  const mealById = useMemo(() => Object.fromEntries((meals || []).map((m) => [m.id, m])), [meals]);

  // --- Llenar la semana automáticamente: respeta días ocupados (solo fáciles) y, si aplica,
  // el modo saludable. Acepta overrides explícitos para que el wizard pueda aplicar valores
  // recién elegidos sin esperar a que el estado de React se actualice. También llena desayunos,
  // con la misma lógica de "no repetir en la semana" que la cena. El almuerzo NO se autocompleta
  // — sigue sugiriendo sobras del día anterior por defecto; el usuario lo elige a mano si quiere otra cosa.
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

  const autofill = ({ busy = busyDays, healthy = healthyOnly } = {}) => {
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

    if (cenaPool.length) {
      setPlan(fillWeek(cenaPool, busy));
      setChecked({});
    }
    if (bfPool.length) setBfPlan(fillWeek(bfPool, {})); // el desayuno no tiene noción de "ocupado"
  };

  const clearWeek = () => { setPlan({}); setBfPlan({}); setLunchPlan({}); setChecked({}); };

  // --- Lista de compras agregada, agrupada por tienda; despensa aparte y sin cantidad ---
  const shopping = useMemo(() => {
    const groups = { costco: {}, walmart: {}, both: {} };
    const pantry = {};
    const addMealIngredients = (m) => {
      if (!m) return;
      for (const g of m.ing) {
        const itemKey = g.item.toLowerCase().trim();
        if (g.pantry) {
          if (!pantry[itemKey]) pantry[itemKey] = { item: g.item, from: [] };
          if (!pantry[itemKey].from.includes(m.name)) pantry[itemKey].from.push(m.name);
          continue;
        }
        const bucket = groups[g.store] || groups.both;
        // se agrupa por item+unidad: cantidades con la misma unidad se suman entre recetas.
        const unitKey = (g.unit || '').toLowerCase().trim();
        const groupKey = `${itemKey}|${unitKey}`;
        if (!bucket[groupKey]) bucket[groupKey] = { item: g.item, qty: 0, hasQty: false, unit: g.unit || '', from: [] };
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
      // El almuerzo solo suma si se eligió a mano — si se está infiriendo de sobras, esos
      // ingredientes ya se contaron con la cena del día anterior; sumarlos de nuevo duplicaría.
      if (lunchPlan[d.key]) addMealIngredients(mealById[lunchPlan[d.key]]);
    }
    const toList = (o) => Object.values(o).sort((a, b) => a.item.localeCompare(b.item));
    return {
      costco: toList(groups.costco),
      walmart: toList(groups.walmart),
      both: toList(groups.both),
      pantry: toList(pantry),
    };
  }, [plan, bfPlan, lunchPlan, mealById]);

  const saveMeal = (m) =>
    setMeals((prev) =>
      m.id && prev.some((x) => x.id === m.id)
        ? prev.map((x) => (x.id === m.id ? m : x))
        : [...prev, { ...m, id: uid() }]
    );

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
        <header className="pt-6 pb-4">
          <h1 className="text-2xl font-bold text-emerald-800 tracking-tight">Menú de la semana</h1>
          <p className="text-sm text-stone-500 mt-0.5">Planea, arma la lista y compra sin pensarlo dos veces.</p>
        </header>

        <nav className="flex gap-1 bg-white rounded-xl p-1 shadow-sm sticky top-2 z-10">
          {tabs.map(({ k, label, Icon }) => (
            <button key={k} onClick={() => setTab(k)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium transition ${tab === k ? 'bg-emerald-700 text-white' : 'text-stone-600 hover:bg-stone-100'}`}>
              <Icon size={16} /> {label}
            </button>
          ))}
        </nav>

        {tab === 'semana' && (
          <SemanaTab {...{
            meals, plan, setPlan, bfPlan, setBfPlan, lunchPlan, setLunchPlan, mealById, autofill, clearWeek,
            busyDays, toggleBusyDay, weekStart, setWeekStart, openWizard: () => setWizardOpen(true),
            openWeeksList: () => setWeeksListOpen(true),
          }} />
        )}
        {tab === 'lista' && <ListaTab {...{ shopping, checked, setChecked, plan, bfPlan, lunchPlan, mealById }} />}
        {tab === 'recetas' && <RecetasTab {...{ meals, setMeals, setEditing, healthyOnly, setHealthyOnly }} />}
      </div>

      {editing && (
        <MealEditor
          meal={editing}
          onClose={() => setEditing(null)}
          onSave={(m) => { saveMeal(m); setEditing(null); }}
        />
      )}

      {wizardOpen && (
        <PlanWizard
          busyDays={busyDays}
          healthyOnly={healthyOnly}
          onClose={() => setWizardOpen(false)}
          onApply={({ busyDays: selBusy, healthyOnly: selHealthy }) => {
            setBusyDays(selBusy);
            setHealthyOnly(selHealthy);
            autofill({ busy: selBusy, healthy: selHealthy });
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
    </div>
  );
}
