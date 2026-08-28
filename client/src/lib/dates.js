// Utilidades pequeñas para calcular las fechas reales de la semana que se está planificando.

const pad = (n) => String(n).padStart(2, '0');

export const toISODate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Lunes de la semana que contiene `d` (por defecto, hoy), como fecha ISO (yyyy-mm-dd).
export function mondayOf(d = new Date()) {
  const date = new Date(d);
  const day = date.getDay(); // 0 = domingo … 6 = sábado
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return toISODate(date);
}

export function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

// "1 sep" — para mostrar junto al nombre del día.
export function formatShort(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('es', { day: 'numeric', month: 'short' });
}
