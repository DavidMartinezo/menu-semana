import { useState } from 'react';
import { X, Users } from 'lucide-react';
import { useBackdropClose, useLockBodyScroll, CopyBtn } from './ui.jsx';
import { useT } from '../lib/i18n/LanguageContext.jsx';
import { buildInviteLink, parseInviteCode } from '../lib/invite.js';

// Modal para compartir el banco de recetas/plan con otra cuenta de Google (ej. la esposa), o
// unirse al hogar compartido de otra persona con su código. Ver lib/userStorage.js para el
// modelo de datos (households/{id} + puntero en users/{uid}).
export default function SharePanel({ householdId, isMember, onJoin, onLeave, onClose }) {
  const { t } = useT();
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [joinError, setJoinError] = useState(null);
  const backdrop = useBackdropClose(onClose);
  useLockBodyScroll();

  const inviteLink = buildInviteLink(householdId);

  // Se copia el LINK, no el uid pelado: quien invita lo reenvía por WhatsApp y quien lo abre cae
  // en la app con la pregunta de unirse ya hecha, sin trámite que explicar. El código suelto
  // sigue sirviendo igual en la casilla de abajo, para quien ya lo tenga de antes.
  const copyCode = () => {
    navigator.clipboard.writeText(inviteLink).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => setCopyError(true) // algunos navegadores embebidos no dan permiso al portapapeles
    );
  };

  const handleJoinClick = () => {
    const trimmed = parseInviteCode(code);
    if (!trimmed) return;
    if (trimmed === householdId) {
      setJoinError(t('share.ownCodeError'));
      return;
    }
    setJoinError(null);
    onJoin(trimmed);
    setCode('');
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-20 p-0 sm:p-4" {...backdrop}>
      <div className="bg-stone-50 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200">
          <h3 className="font-semibold text-stone-800 flex items-center gap-1.5"><Users size={16} /> {t('share.title')}</h3>
          <button onClick={onClose} className="p-1 text-stone-400"><X size={20} /></button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <p className="text-sm font-medium text-stone-700 mb-1">{t('share.codeLabel')}</p>
            <p className="text-xs text-stone-500 mb-2">
              {t('share.codeHint')}
            </p>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={inviteLink}
                onFocus={(e) => e.target.select()}
                className="flex-1 min-w-0 text-xs bg-white border border-stone-200 rounded-lg px-3 py-2.5 text-stone-600"
              />
              <CopyBtn label={t('share.copy')} active={copied} onClick={copyCode} />
            </div>
            {copyError && <p className="text-xs text-stone-500 mt-1.5">{t('share.copyFailed')}</p>}
          </div>

          <div className="border-t border-stone-200 pt-4">
            <p className="text-sm font-medium text-stone-700 mb-2">{t('share.joinLabel')}</p>
            <div className="flex items-center gap-2">
              <input
                value={code}
                onChange={(e) => { setCode(e.target.value); setJoinError(null); }}
                placeholder={t('share.joinPlaceholder')}
                className="flex-1 px-3 py-2.5 rounded-lg border border-stone-200 bg-white text-sm"
              />
              <button
                onClick={handleJoinClick}
                disabled={!code.trim()}
                className="px-4 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white text-sm font-medium"
              >
                {t('share.join')}
              </button>
            </div>
            {joinError && <p className="text-xs text-rose-600 mt-1.5">{joinError}</p>}
          </div>

          {isMember && (
            <button onClick={onLeave} className="w-full text-sm text-rose-600 py-2">
              {t('share.leave')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
