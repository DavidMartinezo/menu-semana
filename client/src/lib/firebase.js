// Inicializa Firebase una sola vez (Auth + Firestore). A diferencia de analytics.js, esto se
// importa de forma normal (no diferida) porque el login ya no es opcional en la app.
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  // Sin measurementId a propósito: ya existe PostHog para analítica (ver lib/analytics.js),
  // un segundo tracker (Firebase Analytics) sería peso de más sin beneficio.
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// El ID real de la base en Firebase Console es "default" (sin paréntesis) — la app se creó así
// por accidente en vez de usar la base "(default)" que el SDK pide si no se le indica nada, y
// por eso hay que pasarla explícita. Cambiar el ID de una base ya creada no es posible desde la
// consola, así que apuntamos el código a la que existe en vez de recrear todo de cero.
export const db = getFirestore(app, 'default');
