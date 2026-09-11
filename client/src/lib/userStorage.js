// Guardado en Firestore. Dos colecciones:
//
// - `users/{uid}`: puntero chiquito, uno por cuenta — `{ householdId }`. La mayoría de la gente
//   nunca tiene uno de estos: solo hace falta cuando alguien se unió al hogar de otra persona.
//   Siempre es legible/escribible por su propio dueño, sin reglas especiales.
// - `households/{householdId}`: el documento con los datos de verdad (MISMA forma que antes:
//   {key, value, updatedAt}, más un `members: string[]` opcional). Por defecto, el `householdId`
//   de alguien que nunca compartió nada es su propio uid — comportamiento idéntico al de antes
//   de que existiera esta feature.
//
// Compartir = agregar tu uid a `members` del hogar de otra persona (regla de "auto-unirme" en
// Firestore) + apuntar tu propio puntero hacia ese householdId. Como el puntero vive en tu
// cuenta (no en el localStorage de un dispositivo), entra desde cualquier lugar donde inicies
// sesión — igual que compartir una nota de Google Keep.
import { doc, getDoc, setDoc, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { db } from './firebase.js';

// Resuelve a qué hogar pertenece una cuenta. Si el documento `users/{uid}` es del formato viejo
// (la data completa vivía ahí mismo, de antes de que existiera esta feature), se migra una sola
// vez a `households/{uid}` y se deja un puntero en su lugar.
export async function resolveHouseholdId(uid) {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return uid;

  const data = snap.data();
  if (data.householdId) return data.householdId;

  await setDoc(doc(db, 'households', uid), data);
  await setDoc(ref, { householdId: uid });
  return uid;
}

export function getHouseholdStorage(householdId) {
  const ref = doc(db, 'households', householdId);

  return {
    async get(key) {
      const snap = await getDoc(ref);
      if (!snap.exists()) return null;
      const data = snap.data();
      if (data.key !== key || typeof data.value !== 'string') return null;
      return { key: data.key, value: data.value };
    },
    async set(key, value) {
      // merge:true a propósito — sin esto, cada guardado normal borraría `members` (el arreglo
      // de quién más tiene acceso), que vive en el mismo documento pero no en este objeto.
      await setDoc(ref, { key, value, updatedAt: serverTimestamp() }, { merge: true });
      return { key, value };
    },
  };
}

export async function joinHousehold(householdId, myUid) {
  await setDoc(doc(db, 'households', householdId), { members: arrayUnion(myUid) }, { merge: true });
  await setDoc(doc(db, 'users', myUid), { householdId });
}

// Vuelve a ser dueña de lo suyo — no la quita de `members` del lado del hogar que deja (ver plan).
export async function leaveHousehold(myUid) {
  await setDoc(doc(db, 'users', myUid), { householdId: myUid });
}
