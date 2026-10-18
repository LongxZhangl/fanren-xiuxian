import { useState } from 'react';
import type { ActionState, Gender } from './game';
import { characterAssets } from './characterAssets';
const labels: Record<ActionState, string> = { idle: '静坐待机', breathing: '吐纳调息', cultivating: '山巅修行', meditating: '澄心入定' };
export function Character({ gender, action }: { gender: Gender; action: ActionState }) {
  const [failed, setFailed] = useState(false);
  return <div className={`character-scene ${action}`} aria-label={`${gender === 'male' ? '男修' : '女修'}正在${labels[action]}`}>
    {!failed ? <img className="character-art" src={characterAssets[gender]} alt={`${gender === 'male' ? '男修' : '女修'}在山顶云海中打坐`} onError={() => setFailed(true)} /> : <div className="character-fallback"><span>☁</span><b>立绘资源待配置</b><small>请将角色图片放入 public/characters/</small></div>}
    <div className="mist mist-a"/><div className="mist mist-b"/><div className="soft-array">☷</div>
  </div>;
}
