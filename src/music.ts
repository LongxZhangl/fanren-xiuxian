import { useEffect, useRef, useState } from 'react';
import type { MusicSettings } from './game';
export const TRACKS = [
  { name: '云水入梦', src: `${import.meta.env.BASE_URL}audio/yun-shui-ru-meng.mp3` },
  { name: '松风问道', src: `${import.meta.env.BASE_URL}audio/song-feng-wen-dao.mp3` },
  { name: '月下听泉', src: `${import.meta.env.BASE_URL}audio/yue-xia-ting-quan.mp3` },
];
export function useMusic(settings: MusicSettings, onChange: (next: MusicSettings) => void, onNotice: (message: string) => void) {
  const audio = useRef<HTMLAudioElement | null>(null); const [available, setAvailable] = useState(true);
  useEffect(() => { const element = new Audio(); audio.current = element; element.preload = 'none'; const error = () => { setAvailable(false); onNotice('未配置音乐资源，可将 MP3 放入 public/audio/ 后重试。'); onChange({ ...settings, playing: false }); }; element.addEventListener('error', error); return () => { element.pause(); element.removeEventListener('error', error); }; }, []);
  useEffect(() => { const element = audio.current; if (!element) return; element.src = TRACKS[settings.track]?.src ?? TRACKS[0].src; element.volume = settings.volume; element.muted = settings.muted; element.loop = settings.loop; if (settings.playing) element.play().catch(() => { onNotice('浏览器阻止了自动播放，请点击播放按钮开始音乐。'); onChange({ ...settings, playing: false }); }); else element.pause(); }, [settings.track, settings.volume, settings.muted, settings.loop, settings.playing]);
  return { available, toggle: () => onChange({ ...settings, playing: !settings.playing }), next: () => onChange({ ...settings, track: (settings.track + 1) % TRACKS.length, playing: true }), previous: () => onChange({ ...settings, track: (settings.track + TRACKS.length - 1) % TRACKS.length, playing: true }) };
}
