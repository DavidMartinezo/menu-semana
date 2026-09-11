// Datos iniciales (banco de comidas) y constantes compartidas.
// store por ingrediente: 'costco' | 'walmart' | 'both'
// Las recetas de este array no traen "types" explícito: normalizeMeal() las completa
// como ['cena'], que es para lo que siempre fueron pensadas.

export const SEED_MEALS = [
  { name: 'Salmón a la plancha con arroz', cat: 'Pescado', easy: true, favorite: false, rating: 0, healthy: false, left: true, ing: [
    ['Salmón (filetes)', 'costco'], ['Arroz', 'costco'], ['Brócoli', 'costco'], ['Limón', 'walmart'], ['Ajo', 'walmart'], ['Mantequilla', 'walmart'] ] },
  { name: 'Salmón al horno con papas', cat: 'Pescado', easy: true, favorite: false, rating: 0, healthy: false, left: true, ing: [
    ['Salmón (filetes)', 'costco'], ['Papas', 'costco'], ['Limón', 'walmart'], ['Aceite de oliva', 'costco'], ['Sal y pimienta', 'walmart'] ] },
  { name: 'Pollo encebollado con arroz y frijoles', cat: 'Salvadoreño', easy: true, favorite: false, rating: 0, healthy: false, left: true, ing: [
    ['Muslos de pollo', 'costco'], ['Cebolla', 'walmart'], ['Arroz', 'costco'], ['Frijoles rojos', 'walmart'], ['Tomate', 'walmart'], ['Consomé de pollo', 'walmart'] ] },
  { name: 'Bistec encebollado', cat: 'Salvadoreño', easy: true, favorite: false, rating: 0, healthy: false, left: true, ing: [
    ['Bistec de res', 'costco'], ['Cebolla', 'walmart'], ['Tomate', 'walmart'], ['Arroz', 'costco'], ['Salsa inglesa', 'walmart'] ] },
  { name: 'Carne asada con casamiento', cat: 'Salvadoreño', easy: false, favorite: false, rating: 0, healthy: false, left: true, ing: [
    ['Carne para asar', 'costco'], ['Arroz', 'costco'], ['Frijoles rojos', 'walmart'], ['Plátano maduro', 'walmart'], ['Limón', 'walmart'], ['Chimol / especias', 'walmart'] ] },
  { name: 'Tacos de carne molida', cat: 'Mexicano', easy: true, favorite: false, rating: 0, healthy: false, left: true, ing: [
    ['Carne molida', 'costco'], ['Tortillas', 'costco'], ['Queso rallado', 'costco'], ['Lechuga', 'walmart'], ['Tomate', 'walmart'], ['Sazón para taco', 'walmart'] ] },
  { name: 'Quesadillas de pollo', cat: 'Mexicano', easy: true, favorite: false, rating: 0, healthy: false, left: true, ing: [
    ['Pechuga de pollo', 'costco'], ['Tortillas de harina', 'costco'], ['Queso rallado', 'costco'] ] },
  { name: 'Pasta con carne (spaghetti)', cat: 'Pasta', easy: true, favorite: false, rating: 0, healthy: false, left: true, ing: [
    ['Pasta spaghetti', 'costco'], ['Carne molida', 'costco'], ['Salsa marinara', 'costco'], ['Ajo', 'walmart'], ['Queso parmesano', 'costco'] ] },
  { name: 'Pollo a la plancha con vegetales', cat: 'Pollo', easy: true, favorite: false, rating: 0, healthy: false, left: true, ing: [
    ['Pechuga de pollo', 'costco'], ['Vegetales mixtos', 'costco'], ['Arroz', 'costco'], ['Sazón', 'walmart'] ] },
  { name: 'Hamburguesas caseras', cat: 'Americano', easy: true, favorite: false, rating: 0, healthy: false, left: false, ing: [
    ['Carne molida', 'costco'], ['Pan de hamburguesa', 'costco'], ['Queso americano', 'costco'], ['Papas para freír', 'costco'], ['Lechuga', 'walmart'], ['Tomate', 'walmart'] ] },
  { name: 'Alitas al horno', cat: 'Pollo', easy: true, favorite: false, rating: 0, healthy: false, left: true, ing: [
    ['Alitas de pollo', 'costco'], ['Salsa BBQ', 'walmart'], ['Sazón', 'walmart'], ['Papas', 'costco'] ] },
  { name: 'Milanesa de pollo', cat: 'Pollo', easy: true, favorite: false, rating: 0, healthy: false, left: true, ing: [
    ['Pechuga de pollo', 'costco'], ['Pan molido', 'walmart'], ['Huevos', 'costco'], ['Arroz', 'costco'], ['Limón', 'walmart'] ] },
  { name: 'Sheet pan de pollo y vegetales', cat: 'Pollo', easy: true, favorite: false, rating: 0, healthy: false, left: true, ing: [
    ['Muslos de pollo', 'costco'], ['Papas', 'costco'], ['Zanahoria', 'costco'], ['Cebolla', 'walmart'], ['Aceite de oliva', 'costco'] ] },
  { name: 'Pollo guisado con papas', cat: 'Pollo', easy: false, favorite: false, rating: 0, healthy: false, left: true, ing: [
    ['Pollo en piezas', 'costco'], ['Papas', 'costco'], ['Tomate', 'walmart'], ['Cebolla', 'walmart'], ['Arroz', 'costco'], ['Consomé', 'walmart'] ] },
  { name: 'Arroz con pollo', cat: 'Salvadoreño', easy: false, favorite: false, rating: 0, healthy: false, left: true, ing: [
    ['Pollo en piezas', 'costco'], ['Arroz', 'costco'], ['Vegetales mixtos', 'costco'], ['Achiote/sazón', 'walmart'], ['Cebolla', 'walmart'], ['Pimiento', 'walmart'] ] },
  { name: 'Carne guisada', cat: 'Salvadoreño', easy: false, favorite: false, rating: 0, healthy: false, left: true, ing: [
    ['Carne de res para guisar', 'costco'], ['Papas', 'costco'], ['Tomate', 'walmart'], ['Cebolla', 'walmart'], ['Arroz', 'costco'] ] },
  { name: 'Sopa de res', cat: 'Salvadoreño', easy: false, favorite: false, rating: 0, healthy: false, left: true, ing: [
    ['Carne de res con hueso', 'costco'], ['Yuca', 'walmart'], ['Elote', 'costco'], ['Güisquil', 'walmart'], ['Repollo', 'walmart'], ['Zanahoria', 'costco'] ] },
  { name: 'Costillas BBQ al horno', cat: 'Americano', easy: false, favorite: false, rating: 0, healthy: false, left: true, ing: [
    ['Costillas de cerdo', 'costco'], ['Salsa BBQ', 'walmart'], ['Papas', 'costco'], ['Elote', 'costco'] ] },
  { name: 'Pupusas revueltas con curtido', cat: 'Salvadoreño', easy: false, favorite: false, rating: 0, healthy: false, left: true, ing: [
    ['Harina de maíz (Maseca)', 'walmart'], ['Queso para pupusas', 'costco'], ['Chicharrón molido', 'walmart'], ['Frijoles rojos', 'walmart'], ['Repollo', 'walmart'], ['Zanahoria', 'costco'] ] },
  { name: 'Yuca frita con chicharrón', cat: 'Salvadoreño', easy: false, favorite: false, rating: 0, healthy: false, left: false, ing: [
    ['Yuca', 'walmart'], ['Chicharrón', 'walmart'], ['Repollo', 'walmart'], ['Curtido', 'walmart'] ] },
  { name: 'Camarones al ajillo', cat: 'Mariscos', easy: true, favorite: false, rating: 0, healthy: false, left: true, ing: [
    ['Camarones', 'costco'], ['Ajo', 'walmart'], ['Mantequilla', 'walmart'], ['Arroz', 'costco'], ['Perejil', 'walmart'] ] },
  { name: 'Panes con pollo', cat: 'Salvadoreño', easy: false, favorite: false, rating: 0, healthy: false, left: true, ing: [
    ['Pollo en piezas', 'costco'], ['Pan francés (bolillo)', 'walmart'], ['Lechuga', 'walmart'], ['Tomate', 'walmart'], ['Pepino', 'walmart'], ['Berro/rábano', 'walmart'] ] },

  // Desayunos: antes vivían aparte como puros nombres (sin ingredientes ni banco propio).
  // Ahora son recetas normales del mismo banco, solo que marcadas types: ['desayuno'].
  { name: 'Huevos revueltos con tortilla', cat: 'Desayuno', easy: true, favorite: false, rating: 0, healthy: false, left: false, types: ['desayuno'], ing: [] },
  { name: 'Pancakes', cat: 'Desayuno', easy: true, favorite: false, rating: 0, healthy: false, left: false, types: ['desayuno'], ing: [] },
  { name: 'Cereal con fruta', cat: 'Desayuno', easy: true, favorite: false, rating: 0, healthy: false, left: false, types: ['desayuno'], ing: [] },
  { name: 'Licuado de banano', cat: 'Desayuno', easy: true, favorite: false, rating: 0, healthy: false, left: false, types: ['desayuno'], ing: [] },
  { name: 'Pan francés (French toast)', cat: 'Desayuno', easy: true, favorite: false, rating: 0, healthy: false, left: false, types: ['desayuno'], ing: [] },
  { name: 'Huevos con frijoles y plátano', cat: 'Desayuno', easy: true, favorite: false, rating: 0, healthy: false, left: false, types: ['desayuno'], ing: [] },
  { name: 'Yogurt con granola', cat: 'Desayuno', easy: true, favorite: false, rating: 0, healthy: false, left: false, types: ['desayuno'], ing: [] },
  { name: 'Waffles', cat: 'Desayuno', easy: true, favorite: false, rating: 0, healthy: false, left: false, types: ['desayuno'], ing: [] },
  { name: 'Avena con fruta', cat: 'Desayuno', easy: true, favorite: false, rating: 0, healthy: false, left: false, types: ['desayuno'], ing: [] },
  { name: 'Quesadilla rápida', cat: 'Desayuno', easy: true, favorite: false, rating: 0, healthy: false, left: false, types: ['desayuno'], ing: [] },
];

// Los días no traen "ocupado" fijo: el usuario los marca desde la UI (ver busyDays en App.jsx).
export const DAYS = [
  { key: 'lun', label: 'Lunes' },
  { key: 'mar', label: 'Martes' },
  { key: 'mie', label: 'Miércoles' },
  { key: 'jue', label: 'Jueves' },
  { key: 'vie', label: 'Viernes' },
  { key: 'sab', label: 'Sábado' },
  { key: 'dom', label: 'Domingo' },
];

// Forma de una semana sin nada planeado. Vive acá (y no en App.jsx) porque WeeksList.jsx
// también la necesita para la semana activa todavía sin guardar: con una copia en cada archivo,
// agregar un campo nuevo a la semana arreglaba uno y dejaba el otro incompleto en silencio.
export const EMPTY_WEEK = { plan: {}, bfPlan: {}, lunchPlan: {}, busyDays: {}, checked: {}, lunchReuseAll: false };

// Tiendas por defecto para hogares nuevos (o ya existentes, antes de que esto fuera
// configurable) — el usuario las puede renombrar, borrar o agregar más desde "Tiendas".
export const DEFAULT_STORES = [
  { id: 'costco', label: 'Costco' },
  { id: 'walmart', label: 'Walmart' },
];

// Solo para el id reservado "cualquier tienda" — las demás tiendas son configurables por
// hogar (ver `stores` en App.jsx) y no tienen un label/color fijo en código.
export const STORE_META = {
  both: { label: 'Cualquier tienda', cls: 'bg-stone-200 text-stone-600' },
};

// Colores que se reparten por índice entre las tiendas configuradas del hogar, para que cada
// una se vea distinta en la lista de compras sin que el usuario tenga que elegir un color.
const STORE_COLORS = [
  'bg-rose-100 text-rose-700',
  'bg-sky-100 text-sky-700',
  'bg-amber-100 text-amber-700',
  'bg-violet-100 text-violet-700',
  'bg-teal-100 text-teal-700',
];

// Label + clase de color para cualquier id de tienda: busca en la lista de tiendas del hogar,
// cae en "Cualquier tienda" para el id reservado o para un id que ya no existe (tienda borrada
// después de que una receta ya la usaba).
export function storeMeta(id, stores) {
  const idx = (stores || []).findIndex((s) => s.id === id);
  if (idx === -1) return STORE_META.both;
  return { label: stores[idx].label, cls: STORE_COLORS[idx % STORE_COLORS.length] };
}

export const uid = () => Math.random().toString(36).slice(2, 9);

// Rellena los campos nuevos de un ingrediente si faltan (recetas guardadas antes de que existieran).
export const normalizeIng = (g) => ({
  item: g.item,
  store: g.store,
  qty: typeof g.qty === 'number' ? g.qty : null,
  unit: g.unit || '',
  pantry: !!g.pantry,
});

// Rellena los campos nuevos de una receta si faltan (migración de datos guardados en localStorage).
export const normalizeMeal = (m) => ({
  ...m,
  favorite: !!m.favorite,
  rating: m.rating || 0,
  healthy: !!m.healthy,
  videoUrl: m.videoUrl || '',
  sourceUrl: m.sourceUrl || '',
  steps: m.steps || [],
  ing: (m.ing || []).map(normalizeIng),
  // Recetas guardadas antes de que existiera "types" eran, en la práctica, siempre de cena.
  types: Array.isArray(m.types) && m.types.length ? m.types : ['cena'],
  // null = todavía sin estimar (distinto de 0 kcal). Se calcula al importar o con el botón
  // "Estimar con IA" en el editor — no se recalcula solo si se editan los ingredientes.
  kcal: typeof m.kcal === 'number' ? m.kcal : null,
  servings: typeof m.servings === 'number' ? m.servings : null,
});

// Convierte el formato compacto del seed (tuplas [item, store]) a objetos normalizados con id.
export const withIds = (arr) =>
  arr.map((m) =>
    normalizeMeal({
      ...m,
      id: uid(),
      ing: m.ing.map(([item, store]) => ({ item, store })),
    })
  );

// Convierte un nombre de desayuno del formato viejo (puro string, sin banco propio) en una
// receta completa del banco unificado, marcada types: ['desayuno']. La usa la migración de
// datos guardados en App.jsx la primera vez que se carga la app tras este cambio.
export const breakfastNameToMeal = (name) => ({
  id: uid(),
  name,
  cat: 'Desayuno',
  easy: true,
  favorite: false,
  rating: 0,
  healthy: false,
  left: false,
  kcal: null,
  servings: null,
  videoUrl: '',
  sourceUrl: '',
  steps: [],
  ing: [],
  types: ['desayuno'],
});
