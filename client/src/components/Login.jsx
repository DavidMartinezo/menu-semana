import { useState } from 'react';
import { signInWithGoogle, signInAsGuest } from '../lib/auth.js';
import { joinHousehold } from '../lib/userStorage.js';
import { track } from '../lib/analytics.js';
import { useT } from '../lib/i18n/LanguageContext.jsx';
import LanguageToggle from './LanguageToggle.jsx';
import { hasInvite, parseInviteCode } from '../lib/invite.js';

function useAuthErrorMapper() {
  const { t } = useT();
  return (code) => {
    if (code === 'auth/popup-closed-by-user') return t('errors.popupClosed');
    if (code === 'auth/popup-blocked') return t('errors.popupBlocked');
    if (code === 'auth/unauthorized-domain') return t('errors.unauthorizedDomain');
    if (code === 'auth/operation-not-allowed') return t('errors.operationNotAllowed');
    return t('errors.generic');
  };
}

// Logo oficial de Google ("G" multicolor), en línea como SVG para no depender de ninguna librería.
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.68-3.87 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.83.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.03l2.99-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.97l2.99 2.33C4.66 5.17 6.65 3.58 9 3.58z" />
    </svg>
  );
}

export default function Login() {
  const { t } = useT();
  const mapAuthError = useAuthErrorMapper();
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingGuest, setLoadingGuest] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [loadingJoin, setLoadingJoin] = useState(false);
  // Se abrió con un link de invitación (/?hogar=…): App pregunta si unirse apenas entre, así
  // que acá solo cambia el texto — no hay que pedirle ningún código a mano.
  const invited = hasInvite();
  const busy = loading || loadingGuest || loadingJoin;

  const handleClick = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
      // No hace falta hacer nada más acá — el listener onAuthChange en AuthGate
      // detecta la sesión nueva y cambia a la app solo.
    } catch (e) {
      setError(mapAuthError(e.code));
    } finally {
      setLoading(false);
    }
  };

  const handleGuest = async () => {
    setError(null);
    setLoadingGuest(true);
    try {
      await signInAsGuest();
      track('guest_start');
    } catch (e) {
      setError(mapAuthError(e.code));
    } finally {
      setLoadingGuest(false);
    }
  };

  // Entra como invitado (misma cuenta anónima temporal) y de una la une al hogar del código —
  // para alguien sin cuenta de Google que solo quiere ver/editar lo que ya comparte otra persona.
  const handleJoinWithCode = async () => {
    const code = parseInviteCode(joinCode);
    if (!code) return;
    setError(null);
    setLoadingJoin(true);
    try {
      const cred = await signInAsGuest();
      await joinHousehold(code, cred.user.uid);
      track('guest_start', { joined_with_code: true });
    } catch (e) {
      setError(mapAuthError(e.code));
    } finally {
      setLoadingJoin(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm p-8 max-w-sm w-full text-center relative">
        <LanguageToggle className="absolute top-4 right-4" />
        <h1 className="text-2xl font-bold text-emerald-800 tracking-tight">{t('app.title')}</h1>
        <p className="text-sm text-stone-500 mt-2 mb-6">{t('login.subtitle')}</p>
        {invited && (
          <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-xl p-3 mb-4 text-left">
            {t('login.invited')}
          </p>
        )}

        <button
          onClick={handleGuest}
          disabled={busy}
          className="w-full bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-semibold py-3 rounded-xl shadow-sm"
        >
          {loadingGuest ? t('login.connecting') : invited ? t('login.enterAndJoin') : t('login.start')}
        </button>
        <p className="text-xs text-stone-400 mt-2">{t('login.guestNote')}</p>

        <button
          onClick={handleClick}
          disabled={busy}
          className="w-full mt-4 flex items-center justify-center gap-2.5 bg-white hover:bg-stone-50 disabled:opacity-50 text-stone-700 font-medium py-2.5 rounded-xl border border-stone-200"
        >
          {!loading && <GoogleIcon />}
          {loading ? t('login.connectingSlow') : t('login.continueGoogle')}
        </button>
        <p className="text-xs text-stone-400 mt-2">{t('login.googleNote')}</p>

        {invited ? null : !joinOpen ? (
          <button onClick={() => setJoinOpen(true)} className="w-full mt-3 text-xs text-stone-400 hover:text-stone-600 underline">
            {t('login.haveCode')}
          </button>
        ) : (
          <div className="mt-3 text-left">
            <div className="flex items-center gap-2">
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder={t('login.pasteCode')}
                className="flex-1 px-3 py-2 rounded-lg border border-stone-200 text-sm"
              />
              <button
                onClick={handleJoinWithCode}
                disabled={busy || !joinCode.trim()}
                className="px-3 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white text-sm font-medium"
              >
                {loadingJoin ? t('login.joining') : t('login.join')}
              </button>
            </div>
            <p className="text-xs text-stone-400 mt-1.5">{t('login.joinNote')}</p>
          </div>
        )}
        {error && <p className="mt-4 text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg p-2">{error}</p>}
      </div>
    </div>
  );
}
