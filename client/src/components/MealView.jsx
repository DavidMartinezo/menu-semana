import { useState } from 'react';
import { X, Youtube, Link as LinkIcon, Play, Pencil } from 'lucide-react';
import { Tag, StarsDisplay, useBackdropClose } from './ui.jsx';
import { storeMeta } from '../data/seed.js';
import { getYouTubeId, youtubeThumbnail, youtubeEmbed } from '../lib/youtube.js';

const TYPE_META = {
  desayuno: '🌅 Desayuno',
  almuerzo: '🥪 Almuerzo',
  cena: '🌙 Cena',
};

// Vista de solo lectura de una receta — para consultar ingredientes/pasos/video sin pasar por
// el formulario de edición (que además trae los tres cuadros de importación, de más aquí).
export default function MealView({ meal, stores, onClose, onEdit }) {
  const [playing, setPlaying] = useState(false);
  const backdrop = useBackdropClose(onClose);
  const videoId = getYouTubeId(meal.videoUrl);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-20 p-0 sm:p-4" {...backdrop}>
      <div className="bg-stone-50 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 sticky top-0 bg-stone-50 border-b border-stone-200 z-10">
          <div className="min-w-0">
            <h3 className="font-semibold text-stone-800 truncate">{meal.name}</h3>
            <p className="text-xs text-stone-400">{meal.cat}</p>
          </div>
          <button onClick={onClose} className="p-1 text-stone-400 shrink-0"><X size={20} /></button>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex flex-wrap gap-1.5 items-center">
            {meal.types?.map((t) => <Tag key={t}>{TYPE_META[t] || t}</Tag>)}
            {meal.easy && <Tag>⚡ Fácil</Tag>}
            {meal.favorite && <Tag>❤️ Favorito</Tag>}
            {meal.rating > 0 && <Tag><StarsDisplay value={meal.rating} /></Tag>}
            {meal.healthy && <Tag>🥗 Saludable</Tag>}
            {meal.left && <Tag>Rinde para el almuerzo</Tag>}
            {meal.kcal != null && <Tag>~{meal.kcal} kcal (receta)</Tag>}
            {meal.kcal != null && meal.servings > 0 && <Tag>~{Math.round(meal.kcal / meal.servings)} kcal/porción</Tag>}
          </div>

          {videoId && (
            <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
              {playing ? (
                <iframe
                  src={youtubeEmbed(videoId)}
                  title={meal.name}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full"
                />
              ) : (
                <button onClick={() => setPlaying(true)} className="w-full h-full relative block">
                  <img src={youtubeThumbnail(videoId)} alt="" className="w-full h-full object-cover" />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <span className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center">
                      <Play size={24} className="text-stone-800 ml-1" fill="currentColor" />
                    </span>
                  </span>
                </button>
              )}
            </div>
          )}

          {meal.sourceUrl && (
            <a href={meal.sourceUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm text-sky-600 hover:underline">
              <LinkIcon size={14} /> Ver receta original
            </a>
          )}
          {meal.videoUrl && !videoId && (
            <a href={meal.videoUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm text-rose-600 hover:underline">
              <Youtube size={14} /> Ver video
            </a>
          )}

          {meal.ing.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-400 mb-1.5">Ingredientes</p>
              <ul className="bg-white rounded-xl shadow-sm divide-y divide-stone-100">
                {meal.ing.map((g, i) => (
                  <li key={i} className="px-3 py-2 flex items-center gap-2 text-sm">
                    <span className="flex-1 text-stone-700">{g.item}</span>
                    {typeof g.qty === 'number' && (
                      <span className="text-stone-400 shrink-0">{g.qty}{g.unit ? ` ${g.unit}` : ''}</span>
                    )}
                    <span className="text-xs text-stone-400 shrink-0">
                      {g.pantry ? 'Despensa' : storeMeta(g.store, stores).label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {meal.steps?.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-400 mb-1.5">Pasos</p>
              <ol className="ml-4 list-decimal text-sm text-stone-600 space-y-1">
                {meal.steps.map((s, k) => <li key={k}>{s}</li>)}
              </ol>
            </div>
          )}
        </div>

        <div className="p-4 sticky bottom-0 bg-stone-50 border-t border-stone-200">
          <button
            onClick={onEdit}
            className="w-full flex items-center justify-center gap-1.5 bg-white border border-stone-200 text-stone-600 hover:bg-stone-100 font-medium py-2.5 rounded-xl"
          >
            <Pencil size={16} /> Editar
          </button>
        </div>
      </div>
    </div>
  );
}
