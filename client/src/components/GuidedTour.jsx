import { useEffect, useState } from 'react';
import { useT } from '../lib/i18n/LanguageContext.jsx';
import { useLockBodyScroll } from './ui.jsx';

const PAD = 8;        // aire alrededor del elemento resaltado
const MARGIN = 16;     // separación mínima de la tarjeta con el borde de la pantalla

// Sigue la posición real de un elemento del DOM (por selector) mientras el paso esté activo —
// se recalcula si la ventana cambia de tamaño o si algo hace scroll (útil en mobile, donde
// rotar o abrir el teclado puede mover todo).
function useTargetRect(selector) {
  const [rect, setRect] = useState(null);
  useEffect(() => {
    if (!selector) { setRect(null); return; }
    const update = () => {
      const el = document.querySelector(selector);
      setRect(el ? el.getBoundingClientRect() : null);
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [selector]);
  return rect;
}

// Recorrido corto (5 pasos) que resalta partes reales de la interfaz para quien nunca usó la
// app — pensado para familiares que abren el link desde un chat, sin nadie al lado explicando.
// El paso de "Compartir" se omite para invitados (ese botón no existe para ellos). No cambia de
// pestaña: todos los elementos resaltados están siempre visibles, o el llamador ya garantiza
// que la pestaña Semana esté activa antes de abrir el tour (ver App.jsx).
export default function GuidedTour({ isAnonymous, onFinish }) {
  const { t } = useT();
  useLockBodyScroll();
  const [stepIndex, setStepIndex] = useState(0);

  const steps = [
    { selector: null, title: t('tour.welcomeTitle', { app: t('app.title') }), body: t('tour.welcomeBody') },
    { selector: '[data-tour="tabs-nav"]', title: t('tour.tabsTitle'), body: t('tour.tabsBody') },
    { selector: '[data-tour="wizard-btn"]', title: t('tour.wizardTitle'), body: t('tour.wizardBody') },
    ...(isAnonymous ? [] : [{ selector: '[data-tour="share-btn"]', title: t('tour.shareTitle'), body: t('tour.shareBody') }]),
    { selector: null, title: t('tour.doneTitle'), body: t('tour.doneBody') },
  ];

  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;
  const rect = useTargetRect(step.selector);

  const next = () => (isLast ? onFinish() : setStepIndex((i) => i + 1));
  const back = () => setStepIndex((i) => Math.max(0, i - 1));

  const cardWidth = typeof window !== 'undefined' ? Math.min(300, window.innerWidth - MARGIN * 2) : 300;

  const card = (
    <div className="bg-white rounded-2xl shadow-lg p-4" style={{ width: cardWidth }}>
      <h3 className="font-semibold text-stone-800 mb-1">{step.title}</h3>
      <p className="text-sm text-stone-600">{step.body}</p>
      <div className="flex items-center justify-between mt-4">
        <span className="text-xs text-stone-400">{stepIndex + 1}/{steps.length}</span>
        <div className="flex gap-1.5">
          {stepIndex > 0 && (
            <button onClick={back} className="text-sm px-3 py-1.5 rounded-lg text-stone-500 hover:bg-stone-100">
              {t('tour.back')}
            </button>
          )}
          <button onClick={onFinish} className="text-sm px-3 py-1.5 rounded-lg text-stone-400 hover:bg-stone-100">
            {t('tour.skip')}
          </button>
          <button onClick={next} className="text-sm px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-medium">
            {isLast ? t('tour.finish') : t('tour.next')}
          </button>
        </div>
      </div>
    </div>
  );

  if (!rect) {
    // Paso sin elemento que resaltar (bienvenida/cierre, o el selector no se encontró): fondo
    // oscuro parejo y tarjeta centrada, como un modal normal.
    return (
      <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
        {card}
      </div>
    );
  }

  const left = Math.min(Math.max(rect.left, MARGIN), window.innerWidth - cardWidth - MARGIN);
  const spaceBelow = window.innerHeight - rect.bottom;
  const placeBelow = spaceBelow > 180 || spaceBelow > rect.top;
  const cardStyle = placeBelow
    ? { top: rect.bottom + PAD + 6, left }
    : { bottom: window.innerHeight - rect.top + PAD + 6, left };

  return (
    <>
      {/* Un solo div: el "hueco" en el fondo oscuro es el propio elemento, recortado con
          box-shadow en vez de una máscara SVG o varios rectángulos. */}
      <div
        className="fixed z-[60] rounded-xl pointer-events-none transition-[top,left,width,height]"
        style={{
          top: rect.top - PAD,
          left: rect.left - PAD,
          width: rect.width + PAD * 2,
          height: rect.height + PAD * 2,
          boxShadow: '0 0 0 9999px rgba(0,0,0,0.6)',
        }}
      />
      <div className="fixed z-[61]" style={cardStyle}>
        {card}
      </div>
    </>
  );
}
