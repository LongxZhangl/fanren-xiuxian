import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { advance, breakthrough, cultivationRate, initialGame, isComplete, MAX_OFFLINE, realmName, requirement, restore, SAVE_KEY, stoneRate, upgrade, upgradeCost, type Game } from './game';
import './style.css';
const number = (n: number) => n.toLocaleString('zh-CN', { maximumFractionDigits: 1 });
function load() {
  try { const raw = localStorage.getItem(SAVE_KEY); return raw ? { ...restore(raw), error: '' } : { game: initialGame(), seconds: 0, cultivation: 0, stones: 0, error: '' }; }
  catch { return { game: initialGame(), seconds: 0, cultivation: 0, stones: 0, error: '本地存档无法读取，原存档尚未覆盖。请导入有效存档，或点击「启用保存」使用当前进度。' }; }
}
function App() {
  const [loaded] = useState(load);
  const [game, setGame] = useState(loaded.game);
  const [message, setMessage] = useState(loaded.error);
  const [saving, setSaving] = useState(!loaded.error);
  const [offline, setOffline] = useState(loaded.seconds >= 60 ? loaded : null);
  const [tab, setTab] = useState('修行');
  const file = useRef<HTMLInputElement>(null);
  const current = useRef(game);
  current.current = game;
  useEffect(() => {
    const timer = window.setInterval(() => setGame(g => advance(g, Date.now())), 1000);
    const resume = () => { if (document.visibilityState === 'visible') setGame(g => { const result = restore(JSON.stringify(g)); if (result.seconds >= 60) setOffline({ ...result, error: '' }); return result.game; }); };
    document.addEventListener('visibilitychange', resume);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', resume); };
  }, []);
  useEffect(() => {
    if (!saving) return;
    const save = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(advance(current.current, Date.now()))); } catch { setMessage('自动保存失败，请导出存档备份，并检查浏览器存储空间。'); } };
    save(); const timer = window.setInterval(save, 5000);
    const hidden = () => { if (document.visibilityState === 'hidden') save(); };
    window.addEventListener('pagehide', save); document.addEventListener('visibilitychange', hidden);
    return () => { clearInterval(timer); window.removeEventListener('pagehide', save); document.removeEventListener('visibilitychange', hidden); };
  }, [saving]);
  function act(fn: (g: Game) => Game) { setGame(g => fn(advance(g, Date.now()))); }
  function exportSave() {
    const blob = new Blob([JSON.stringify(advance(current.current, Date.now()), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = '凡人问道-存档.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage('存档已导出，请妥善保存。');
  }
  async function importSave(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0]; event.target.value = ''; if (!selected) return;
    if (selected.size > 100_000) { setMessage('导入失败：存档文件过大。'); return; }
    try { const result = restore(await selected.text()); if (!window.confirm('导入将覆盖当前修行进度，是否继续？')) return; setGame(result.game); current.current = result.game; setSaving(true); setOffline(result.seconds >= 60 ? { ...result, error: '' } : null); try { localStorage.setItem(SAVE_KEY, JSON.stringify(result.game)); setMessage('存档导入成功。'); } catch { setMessage('存档已导入，但本地保存失败，请导出备份。'); } }
    catch { setMessage('导入失败：请选择有效的凡人问道 JSON 存档，当前进度未改变。'); }
  }
  const progress = Math.min(100, game.cultivation / requirement(game) * 100);
  return <div className="app"><header><a className="brand" href="#">凡人<span>问道</span><small>一念入仙途</small></a><span className="save-status"><i/> {saving ? '本地自动存档' : '存档保护中'}</span></header>
    <section className="landscape" aria-label="水墨山峦"><div className="moon"/><div className="mountain far"/><div className="mountain near"/><div className="hero-copy"><span className="eyebrow">山中无甲子 · 修行不知年</span><h1>凡心不灭，<br/>大道可期。</h1><p>且听松风，静候一场破境。</p></div><span className="seal">问<br/>道</span><div className="landscape-foot"><span>青云山 · 无名洞府</span><span>✦ 灵气充盈</span></div></section>
    <nav aria-label="游戏导航">{['修行','洞府','功法','日志'].map((t, i) => <button key={t} className={tab === t ? 'active' : ''} onClick={() => { setTab(t); document.getElementById(t)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}><span>{['◈','⌂','▤','☷'][i]}</span>{t}</button>)}</nav>
    <main><div className="section-title"><h2>仙途初启</h2><span>道阻且长，行则将至</span></div><div className="grid"><section className="panel cultivation" id="修行"><div className="panel-top"><h3><span>◈</span> 静心修炼</h3><span className="tag">自动修炼中</span></div><div className="realm"><div className="realm-symbol">道</div><div><small>当前境界</small><h2>{realmName(game)}</h2><p>{isComplete(game) ? '已至化神之巅，静悟天地' : '吐纳天地灵气，淬炼一缕真元'}</p></div></div><div className="progress-label"><span>修为</span><span>{number(game.cultivation)} <em>/ {number(requirement(game))}</em></span></div><div className="progress" role="progressbar" aria-label="修为进度" aria-valuenow={Math.floor(progress)} aria-valuemin={0} aria-valuemax={100}><div style={{ width: `${progress}%` }}/></div><div className="rate"><span>每秒修为 <b>+{number(cultivationRate(game))}</b></span><span>{progress >= 100 ? '修为圆满' : '心无旁骛，自有所成'}</span></div><button className="primary" onClick={() => act(breakthrough)} disabled={progress < 100 || isComplete(game)}>{isComplete(game) ? '化神圆满' : progress >= 100 ? '✦ 突破境界' : '凝神蓄力 · 待突破'}</button><p className="hint">{isComplete(game) ? '此间仙途已圆满，仍可积攒灵石与参悟功法。' : '修为圆满即可突破 · 突破必定成功'}</p></section>
    <div className="side"><section className="panel" id="洞府"><div className="panel-top"><h3><span>⌂</span> 洞府灵脉</h3><span className="muted">一方清净地</span></div><div className="resource"><div className="stone">◇</div><div><small>持有灵石</small><strong>{number(game.stones)}</strong></div><span className="income">+{number(stoneRate(game))} / 秒</span></div><p className="description">灵脉流转，聚天地之精华。即使离去，洞府依然为你积攒灵石。</p><div className="panel-note"><span>灵脉品阶</span><b>{['凡品','灵品','玄品','地品','天品'][game.realm]} · 随境界提升</b></div></section>
    <section className="panel" id="功法"><div className="panel-top"><h3><span>▤</span> 功法参悟</h3><span className="muted">道法自然</span></div><div className="technique"><div className="book">引<br/>气<br/>诀</div><div><h4>引气诀 <span>第 {game.technique} 重</span></h4><p>引天地之气，养己身之道。</p><small>修炼基础效率 <b>+{(game.technique - 1) * 50}%</b></small></div></div><button className="secondary" disabled={game.stones < upgradeCost(game) || game.technique >= 50} onClick={() => act(upgrade)}>{game.technique >= 50 ? '功法已臻圆满' : <>参悟功法 <span>◇ {number(upgradeCost(game))} 灵石</span></>}</button></section></div></div>
    <section className="panel logs" id="日志"><div className="panel-top"><h3><span>☷</span> 修炼手记</h3><span className="muted">仙途留痕</span></div><ul>{game.logs.map((entry, i) => <li key={`${i}-${entry}`}><span className="log-dot"/><span>{entry}</span>{i === 0 && <small>最新</small>}</li>)}</ul></section>
    <section className="archive"><div><h3>留一卷仙途，待来日续写</h3><p>每 5 秒自动保存 · 离线收益上限 {MAX_OFFLINE / 3600} 小时</p></div><div className="archive-actions"><button onClick={exportSave}>↓ 导出存档</button><button onClick={() => file.current?.click()}>↑ 导入存档</button><input ref={file} type="file" accept=".json,application/json" onChange={importSave} aria-label="选择 JSON 存档" hidden/></div></section>
    {message && <div className="notice" role="status">{message}{!saving && <button onClick={() => { setSaving(true); setMessage('已启用当前进度的自动保存。'); }}>启用保存</button>}<button aria-label="关闭提示" onClick={() => setMessage('')}>×</button></div>}
    <footer>凡人问道 <span>·</span> 不争朝夕，只问长生<small>进度仅保存在此浏览器，建议定期导出备份</small></footer></main>
    {offline && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="offline-title"><span className="eyebrow">故人归山</span><h2 id="offline-title">闭关有所得</h2><p>已结算 {number(offline.seconds / 60)} 分钟修行，最多计入 8 小时。</p><div className="offline-gains"><span>修为 <b>+{number(offline.cultivation)}</b></span><span>灵石 <b>+{number(offline.stones)}</b></span></div><p className="hint">修为达到突破要求后停止累积。</p><button autoFocus className="primary" onClick={() => setOffline(null)}>收下所得 · 继续问道</button></section></div>}
  </div>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
