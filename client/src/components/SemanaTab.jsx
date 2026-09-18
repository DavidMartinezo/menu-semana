import { useState, useMemo } from 'react';
import { Shuffle, Clock, Youtube, CalendarDays, CalendarPlus, Trash2, Eye, ChevronsRight } from 'lucide-react';
import { DAYS } from '../data/seed.js';
import { addDays, formatShort } from '../lib/dates.js';
import { buildWeekICS, downloadICS } from '../lib/ics.js';
import { Autocomplete, StarsDisplay, ConfirmDialog } from './ui.jsx';
import { useT } from '../lib/i18n/LanguageContext.jsx';

export default function SemanaTab({
  meals, plan, setPlan, bfPlan, setBfPlan, lunchPlan, setLunchPlan, lunchReuseAll, mealById, clearWeek,
  busyDays, toggleBusyDay, weekStart, setWeekStart, openWizard, openWeeksList, openView, onMoveToNextWeek,
}) {
  const { t, lang } = useT();
  const cenaCandidates = meals.filter((m) => m.types.includes('cena'));
  const bfCandidates = meals.filter((m) => m.types.includes('desayuno'));
  const lunchCandidates = meals.filter((m) => m.types.includes('almuerzo'));
  const easyMeals = cenaCandidates.filter((m) => m.easy);
  const otherMeals = cenaCandidates.filter((m) => !m.easy);
  const [showAllDay, setShowAllDay] = useState({}); // day.key -> true si se saltó el filtro de "ocupado"
  const [confirmClear, setConfirmClear] = useState(false);
  // Aviso pasajero de "lo pasé a tal día" bajo el desplegable recién movido: { id, targetDay }
  // donde id es `${slot}:${dayKey}` y targetDay es null si la próxima semana ya estaba llena.
  const [moved, setMoved] = useState(null);

  const moveMeal = (slot, dayKey) => {
    const targetDay = onMoveToNextWeek(slot, dayKey);
    setMoved({ id: `${slot}:${dayKey}`, targetDay });
    setTimeout(() => setMoved(null), 2500);
  };

  // Botón chico junto a "Ver receta", solo cuando ese tiempo de comida tiene algo elegido.
  const MoveBtn = ({ slot, dayKey }) => (
    <button
      onClick={() => moveMeal(slot, dayKey)}
      className="p-1 -my-1 text-stone-400 hover:text-emerald-700 rounded shrink-0"
      title={t('semana.moveNextWeek')}
    >
      <ChevronsRight size={16} />
    </button>
  );

  // El aviso se muestra bajo el desplegable del slot que se acaba de mover.
  const MovedNote = ({ slot, dayKey }) =>
    moved?.id === `${slot}:${dayKey}` ? (
      <p className={`text-xs mt-1 ${moved.targetDay ? 'text-emerald-700' : 'text-amber-600'}`}>
        {moved.targetDay ? t('semana.movedTo', { day: t(`days.${moved.targetDay}`) }) : t('semana.nextWeekFull')}
      </p>
    ) : null;

  const hasAnyPlan = DAYS.some((d) => plan[d.key] || bfPlan[d.key] || lunchPlan[d.key]);

  // Solo suma el almuerzo si se eligió a mano — mismo criterio que la lista de compras, para
  // no sumar de más cuando ese día en realidad se está aprovechando la cena de ayer.
  // El promedio diario se calcula sobre los días que sí tienen algo con kcal planeado, no
  // sobre los 7 días fijos — si solo hay 2 días planeados, el promedio real de esos días es
  // más útil que uno artificialmente bajo por dividir entre días todavía vacíos.
  const { weekKcal, avgDayKcal } = useMemo(() => {
    let total = 0;
    let daysWithKcal = 0;
    for (const d of DAYS) {
      const cenaK = mealById[plan[d.key]]?.kcal;
      const bfK = mealById[bfPlan[d.key]]?.kcal;
      const lunchK = lunchPlan[d.key] ? mealById[lunchPlan[d.key]]?.kcal : null;
      let dayTotal = 0;
      if (typeof cenaK === 'number') dayTotal += cenaK;
      if (typeof bfK === 'number') dayTotal += bfK;
      if (typeof lunchK === 'number') dayTotal += lunchK;
      total += dayTotal;
      if (dayTotal > 0) daysWithKcal += 1;
    }
    return { weekKcal: total, avgDayKcal: daysWithKcal > 0 ? Math.round(total / daysWithKcal) : 0 };
  }, [plan, bfPlan, lunchPlan, mealById]);

  const handleExportICS = () => {
    const ics = buildWeekICS({ DAYS, weekStart, plan, bfPlan, lunchPlan, mealById, t });
    downloadICS(ics, `menu-semana-${weekStart}.ics`);
  };

  return (
    <div className="mt-4">
      <div className="flex items-center gap-2 mb-3 text-sm flex-wrap">
        <span className="text-stone-400">{t('semana.weekOf')}</span>
        <input
          type="date"
          value={weekStart}
          onChange={(e) => setWeekStart(e.target.value)}
          className="px-2 py-1 rounded-lg border border-stone-200 bg-white text-stone-700"
        />
        <button onClick={openWeeksList} className="text-xs text-emerald-700 font-medium flex items-center gap-1 hover:underline">
          <CalendarDays size={14} /> {t('semana.myWeeks')}
        </button>
        {weekKcal > 0 && (
          <span className="text-xs text-stone-400">
            {t('semana.weekKcal', { total: weekKcal.toLocaleString(lang), avg: avgDayKcal.toLocaleString(lang) })}
          </span>
        )}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <button
          data-tour="wizard-btn"
          onClick={openWizard}
          className="w-full sm:w-64 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold py-3 rounded-xl shadow-sm transition"
        >
          <Shuffle size={18} /> {t('semana.surprise')}
        </button>

        <div className="flex gap-4 px-0.5">
          <button
            onClick={() => { if (hasAnyPlan) setConfirmClear(true); else clearWeek(); }}
            className="flex flex-col items-center gap-1 text-stone-400 hover:text-stone-600"
          >
            <span className="w-9 h-9 rounded-lg bg-white shadow-sm border border-stone-100 flex items-center justify-center">
              <Trash2 size={15} />
            </span>
            <span className="text-[10px]">{t('semana.clear')}</span>
          </button>
          <button
            onClick={handleExportICS}
            disabled={!hasAnyPlan}
            className="flex flex-col items-center gap-1 text-stone-400 hover:text-stone-600 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className="w-9 h-9 rounded-lg bg-white shadow-sm border border-stone-100 flex items-center justify-center">
              <CalendarPlus size={15} />
            </span>
            <span className="text-[10px]">{t('semana.calendar')}</span>
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {DAYS.map((d, i) => {
          const cena = mealById[plan[d.key]];
          const prevCena = i > 0 ? mealById[plan[DAYS[i - 1].key]] : null;
          // Con "aprovechar cena" activado desde el Asistente, es una decisión para toda la
          // semana — se sugiere la cena de ayer todos los días, sin importar si esa receta en
          // particular tiene la etiqueta "rinde". Sin eso, solo se sugiere cuando sí la tiene.
          const showLeftover = !!prevCena && (lunchReuseAll || prevCena.left);
          const busy = !!busyDays[d.key];
          const filterActive = busy && !showAllDay[d.key];

          // Mismo criterio que weekKcal: el almuerzo solo suma si se eligió a mano.
          const bf = mealById[bfPlan[d.key]];
          const lunch = lunchPlan[d.key] ? mealById[lunchPlan[d.key]] : null;
          const dayKcal = [cena, bf, lunch].reduce((sum, m) => (typeof m?.kcal === 'number' ? sum + m.kcal : sum), 0);

          return (
            <div key={d.key} className="bg-white rounded-xl shadow-sm p-4">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="font-semibold text-stone-800">{t(`days.${d.key}`)}</span>
                <span className="text-xs text-stone-400">{formatShort(addDays(weekStart, i))}</span>
                {dayKcal > 0 && <span className="text-xs text-stone-400">{t('semana.dayKcal', { kcal: dayKcal.toLocaleString(lang) })}</span>}
                <button
                  onClick={() => toggleBusyDay(d.key)}
                  className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium transition ${busy ? 'bg-amber-100 text-amber-700' : 'bg-stone-100 text-stone-400 hover:text-stone-600'}`}
                >
                  <Clock size={12} /> {busy ? t('semana.busy') : t('semana.markBusy')}
                </button>
                {busy && (
                  <button
                    onClick={() => setShowAllDay((p) => ({ ...p, [d.key]: !p[d.key] }))}
                    className="text-xs text-stone-400 underline hover:text-stone-600"
                  >
                    {filterActive ? t('semana.showAll') : t('semana.easyOnly')}
                  </button>
                )}
              </div>

              <label className="flex items-center justify-between text-xs text-stone-400 mb-1">
                {t('semana.breakfast')}
                {bf && (
                  <span className="flex items-center gap-1 shrink-0">
                    <button onClick={() => openView(bf)} className="flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-medium normal-case"><Eye size={14} /> {t('semana.viewRecipe')}</button>
                    <MoveBtn slot="bfPlan" dayKey={d.key} />
                  </span>
                )}
              </label>
              <Autocomplete
                value={bfPlan[d.key] || ''}
                onChange={(v) => setBfPlan((p) => ({ ...p, [d.key]: v }))}
                placeholder={t('semana.chooseBreakfast')}
                options={bfCandidates.map((m) => ({ value: m.id, label: m.name }))}
              />
              <MovedNote slot="bfPlan" dayKey={d.key} />

              <label className="flex items-center justify-between text-xs text-stone-400 mt-3 mb-1">
                <span>{t('semana.lunch')}{!lunchPlan[d.key] && showLeftover && <span className="text-emerald-700 font-normal normal-case">{t('semana.leftoverNote', { name: prevCena.name })}</span>}</span>
                {lunch && (
                  <span className="flex items-center gap-1 shrink-0">
                    <button onClick={() => openView(lunch)} className="flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-medium normal-case"><Eye size={14} /> {t('semana.viewRecipe')}</button>
                    <MoveBtn slot="lunchPlan" dayKey={d.key} />
                  </span>
                )}
              </label>
              <Autocomplete
                value={lunchPlan[d.key] || ''}
                onChange={(v) => setLunchPlan((p) => ({ ...p, [d.key]: v }))}
                placeholder={showLeftover ? t('semana.leftoverPlaceholder', { name: prevCena.name }) : t('semana.chooseLunch')}
                options={lunchCandidates.map((m) => ({ value: m.id, label: m.name }))}
                emptyText={t('semana.noLunchRecipes')}
              />
              <MovedNote slot="lunchPlan" dayKey={d.key} />

              <label className="flex items-center justify-between text-xs text-stone-400 mt-3 mb-1">
                {t('semana.dinner')}
                {cena && (
                  <span className="flex items-center gap-1 shrink-0">
                    <button onClick={() => openView(cena)} className="flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-medium normal-case"><Eye size={14} /> {t('semana.viewRecipe')}</button>
                    <MoveBtn slot="plan" dayKey={d.key} />
                  </span>
                )}
              </label>
              <Autocomplete
                value={plan[d.key] || ''}
                onChange={(v) => setPlan((p) => ({ ...p, [d.key]: v }))}
                placeholder={t('semana.chooseDinner')}
                options={
                  filterActive
                    ? easyMeals.map((m) => ({ value: m.id, label: m.name }))
                    : busy
                    ? [
                        ...easyMeals.map((m) => ({ value: m.id, label: m.name, group: t('semana.easyGroup') })),
                        ...otherMeals.map((m) => ({ value: m.id, label: m.name, group: t('semana.otherGroup') })),
                      ]
                    : cenaCandidates.map((m) => ({ value: m.id, label: m.name }))
                }
              />
              <MovedNote slot="plan" dayKey={d.key} />

              {cena && (
                <>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-xs items-center">
                    {cena.favorite && <span className="bg-rose-50 text-rose-600 px-2 py-0.5 rounded-full">{t('semana.favorite')}</span>}
                    {cena.rating > 0 && <span className="bg-amber-50 px-2 py-0.5 rounded-full"><StarsDisplay value={cena.rating} /></span>}
                    {cena.healthy && <span className="bg-lime-50 text-lime-700 px-2 py-0.5 rounded-full">{t('semana.healthy')}</span>}
                    {cena.left && <span className="bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">{t('semana.leftoverTag')}</span>}
                    {cena.kcal != null && <span className="bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">{t('semana.kcalRecipe', { kcal: cena.kcal })}</span>}
                    {cena.kcal != null && cena.servings > 0 && (
                      <span className="bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">{t('semana.kcalServing', { kcal: Math.round(cena.kcal / cena.servings) })}</span>
                    )}
                    {cena.videoUrl && (
                      <a href={cena.videoUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-rose-600 hover:underline px-2 py-0.5">
                        <Youtube size={13} /> {t('semana.watchVideo')}
                      </a>
                    )}
                  </div>
                  {cena.steps?.length > 0 && (
                    <details className="mt-2">
                      <summary className="text-xs text-emerald-700 font-medium cursor-pointer">{t('semana.viewSteps')}</summary>
                      <ol className="mt-1 ml-4 list-decimal text-xs text-stone-600 space-y-0.5">
                        {cena.steps.map((s, k) => <li key={k}>{s}</li>)}
                      </ol>
                    </details>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {confirmClear && (
        <ConfirmDialog
          title={t('semana.confirmClearTitle')}
          message={t('semana.confirmClearMsg')}
          confirmLabel={t('semana.confirmClearBtn')}
          onConfirm={() => { clearWeek(); setConfirmClear(false); }}
          onCancel={() => setConfirmClear(false)}
        />
      )}
    </div>
  );
}
