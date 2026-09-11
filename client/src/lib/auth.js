// Envoltorio delgado sobre Firebase Auth.
import { GoogleAuthProvider, signInWithPopup, signInAnonymously, linkWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase.js';

const googleProvider = new GoogleAuthProvider();

// Popup, no redirect: se probaron ambos. redirect() nunca reconocía haber vuelto de Google en
// este entorno (getRedirectResult() siempre resolvía null, sin error, incluso en incógnito
// limpio) — falla de forma silenciosa e indiagnosticable desde acá. popup() sí funciona de
// punta a punta; el único costo conocido es que accounts.google.com manda su propio header
// Cross-Origin-Opener-Policy (fuera de nuestro control) que hace que detectar el cierre del
// popup tarde hasta ~1 min en vez de ser instantáneo — Firebase igual lo resuelve solo, solo
// que no tan rápido. El mensaje del botón ya avisa que puede tardar.
export function signInWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}

// Cuenta anónima real de Firebase — sin correo, temporal (se borra sola tras 30 días de
// inactividad, ver Firebase Console > Authentication > Sign-in method > Anónimo).
export function signInAsGuest() {
  return signInAnonymously(auth);
}

// Asocia una cuenta de Google real a la cuenta anónima actual, MISMO uid — así los datos
// guardados como invitado no se pierden ni hay que migrarlos. Lanza `auth/credential-already-in-use`
// si esa cuenta de Google ya tiene su propia cuenta real con datos propios.
export function upgradeGuestToGoogle() {
  return linkWithPopup(auth.currentUser, googleProvider);
}

export function signOutUser() {
  return signOut(auth);
}

// Devuelve la función de unsubscribe.
export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}
