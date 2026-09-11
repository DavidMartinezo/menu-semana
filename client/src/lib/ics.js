// Genera un archivo .ics (RFC 5545) con el menú de una semana, para importarlo al
// calendario del celular (Google Calendar / iOS). Hecho a mano: para el puñado de líneas
// que necesitamos (VCALENDAR/VEVENT/VALARM) no vale la pena una dependencia npm.
import { addDays } from './dates.js';

// Horarios fijos de las comidas y del recordatorio (hora local). Ajustables acá.
export const DINNER_START = '18:00';
export const DINNER_END = '19:00';
export const BREAKFAST_START = '07:00';
export const BREAKFAST_END = '07:30';
export const LUNCH_START = '12:30';
export const LUNCH_END = '13:30';
export const ALARM_HOUR_BEFORE = '19:00'; // recordatorio, la noche anterior a la cena

// Escapa texto para campos TEXT de RFC 5545. El backslash va primero para no
// doble-escapar los caracteres que agregamos después.
function escapeText(s) {
  return String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

// DTSTART/DTEND en hora "flotante" (sin 'Z' ni VTIMEZONE): la app no maneja timezones en
// ningún lado, es uso personal de una sola persona en una sola zona horaria, y floating time
// le dice al calendario del dispositivo "usa la hora local de quien lo abre" — justo lo que
// queremos, sin tener que embeber una base de datos de timezones.
function toICSDateTime(isoDate, hhmm) {
  const [h, m] = hhmm.split(':');
  return `${isoDate.replace(/-/g, '')}T${h}${m}00`;
}

// DTSTAMP sí debe ser UTC real (con 'Z'), a diferencia de DTSTART/DTEND.
function toICSDateTimeStampUTC(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T` +
    `${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

// UID determinístico (no aleatorio): así, si el usuario reexporta la misma semana tras un
// ajuste menor, los calendarios que deduplican por UID no crean eventos repetidos.
function makeUID(isoDate, mealType) {
  return `menu-semana-${isoDate}-${mealType}@menu-semana.local`;
}

// Duración relativa (ej. "-PT23H") para que la alarma de la cena caiga a ALARM_HOUR_BEFORE
// del día anterior. Se calcula desde las constantes en vez de hardcodear el número de horas,
// para que ajustar los horarios de arriba mantenga el cálculo correcto solo.
function computeAlarmTrigger(dinnerStartHHMM, alarmHourBeforeHHMM) {
  const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
  const minsBefore = (24 * 60 - toMin(alarmHourBeforeHHMM)) + toMin(dinnerStartHHMM);
  const h = Math.floor(minsBefore / 60);
  const m = minsBefore % 60;
  return `-PT${h}H${m ? m + 'M' : ''}`;
}

// "2 unidad Pollo" si hay cantidad, o solo "Pollo" si no.
function formatIngredientLine(ing) {
  const qtyPart = typeof ing.qty === 'number' ? `${ing.qty} ${ing.unit || ''}`.trim() : '';
  return qtyPart ? `${qtyPart} ${ing.item}` : ing.item;
}

// Se listan todos los ingredientes, incluidos los de despensa: "pantry" significa "ya lo
// tengo en casa", no "no necesita prep", y el punto del recordatorio es no adivinar qué
// necesita descongelarse o cortarse — solo mostrar la lista completa para que el usuario decida.
function buildAlarmDescription(mealName, ingredients) {
  const lines = ingredients.map(formatIngredientLine);
  return [`Prepara para mañana: ${mealName}`, ...lines].join('\n');
}

function buildEventLines({ uid, dtStart, dtEnd, summary, description, alarmDescription, alarmTrigger }) {
  const lines = [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${toICSDateTimeStampUTC()}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeText(summary)}`,
  ];
  if (description) lines.push(`DESCRIPTION:${escapeText(description)}`);
  if (alarmTrigger) {
    lines.push(
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeText(alarmDescription)}`,
      `TRIGGER:${alarmTrigger}`,
      'END:VALARM',
    );
  }
  lines.push('END:VEVENT');
  return lines;
}

// Nota: no se hace line folding a 75 octetos (como pide el RFC estrictamente). Nuestras
// líneas más largas (DESCRIPTION con varios ingredientes) rondan 150-250 caracteres, y los
// calendarios modernos (Apple, Google, Outlook) las toleran igual. Si algún día un import
// real falla por esto, folding es lo primero a agregar.
export function buildWeekICS({ DAYS, weekStart, plan, bfPlan, lunchPlan = {}, mealById }) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//menu-semana//planner//ES',
    'CALSCALE:GREGORIAN',
  ];

  const alarmTrigger = computeAlarmTrigger(DINNER_START, ALARM_HOUR_BEFORE);

  DAYS.forEach((d, i) => {
    const isoDate = addDays(weekStart, i);

    const bf = mealById[bfPlan[d.key]];
    if (bf) {
      lines.push(...buildEventLines({
        uid: makeUID(isoDate, 'desayuno'),
        dtStart: toICSDateTime(isoDate, BREAKFAST_START),
        dtEnd: toICSDateTime(isoDate, BREAKFAST_END),
        summary: `Desayuno: ${bf.name}`,
      }));
    }

    // El almuerzo solo genera evento cuando se eligió a mano (si no, se está aprovechando
    // la cena de ayer y no hay una receta concreta que poner en el calendario).
    const lunch = mealById[lunchPlan[d.key]];
    if (lunch) {
      lines.push(...buildEventLines({
        uid: makeUID(isoDate, 'almuerzo'),
        dtStart: toICSDateTime(isoDate, LUNCH_START),
        dtEnd: toICSDateTime(isoDate, LUNCH_END),
        summary: `Almuerzo: ${lunch.name}`,
      }));
    }

    const meal = mealById[plan[d.key]];
    if (meal) {
      const ing = meal.ing || [];
      lines.push(...buildEventLines({
        uid: makeUID(isoDate, 'cena'),
        dtStart: toICSDateTime(isoDate, DINNER_START),
        dtEnd: toICSDateTime(isoDate, DINNER_END),
        summary: `Cena: ${meal.name}`,
        description: ing.length ? ing.map(formatIngredientLine).join(', ') : '',
        alarmDescription: buildAlarmDescription(meal.name, ing),
        alarmTrigger,
      }));
    }
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

// Única parte que toca el DOM — se mantiene aislada para que buildWeekICS() se pueda
// probar con Node puro, sin navegador.
export function downloadICS(icsString, filename) {
  const blob = new Blob([icsString], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
