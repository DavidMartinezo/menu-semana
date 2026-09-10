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

export const STORE_META = {
  costco: { label: 'Costco', cls: 'bg-rose-100 text-rose-700' },
  walmart: { label: 'Walmart', cls: 'bg-sky-100 text-sky-700' },
  both: { label: 'Cualquiera', cls: 'bg-stone-200 text-stone-600' },
};

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
  videoUrl: '',
  sourceUrl: '',
  steps: [],
  ing: [],
  types: ['desayuno'],
});
