// Mismo patrón de reconocimiento de ID que server/src/services/youtube.js, pero del lado del
// cliente — para armar la miniatura/embed sin depender de una llamada al backend.
export function getYouTubeId(url) {
  if (!url) return null;
  const patterns = [
    /[?&]v=([\w-]{11})/,
    /youtu\.be\/([\w-]{11})/,
    /shorts\/([\w-]{11})/,
    /embed\/([\w-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

export const youtubeThumbnail = (id) => `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
export const youtubeEmbed = (id) => `https://www.youtube.com/embed/${id}?autoplay=1`;
