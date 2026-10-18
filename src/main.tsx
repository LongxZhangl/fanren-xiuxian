import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { advance, breakthrough, cultivationRate, initialGame, isComplete, MAX_OFFLINE, realmName, requirement, restore, SAVE_KEY, stoneRate, upgrade, upgradeCost, type Game } from './game';
import { currentSession, onAuthChange, requestPasswordReset, signIn, signOut, signUp, updatePassword, type AuthResult } from './auth';
import { cloudRevision, readCloud, resetCloudState, saveCloud } from './cloudSave';
import type { User } from '@supabase/supabase-js';
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
  const [gender, setGender] = useState<'male' | 'female'>(() => localStorage.getItem('fanren-character-gender') === 'female' ? 'female' : 'male');
  const [meditationAction, setMeditationAction] = useState<'cultivate' | 'breath' | 'still' | 'finish'>('cultivate');
  useEffect(() => { try { localStorage.setItem('fanren-character-gender', gender); } catch { /* character preference is optional */ } }, [gender]);
  const [user, setUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'reset' | 'new-password' | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [cloudBusy, setCloudBusy] = useState(false);
  const [cloudChoice, setCloudChoice] = useState<{ remote: Game; local: Game } | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const current = useRef(game);
  current.current = game;
  useEffect(() => { currentSession().then(session => { setUser(session?.user ?? null); resetCloudState(session?.user.id ?? null); }); const subscription = onAuthChange((event, session) => { setUser(session?.user ?? null); resetCloudState(session?.user.id ?? null); setCloudChoice(null); if (event === 'PASSWORD_RECOVERY') setAuthMode('new-password'); }); return () => subscription?.unsubscribe(); }, []);
  useEffect(() => { if (!user) return; let cancelled = false; setCloudBusy(true); readCloud(user.id).then(result => { if (cancelled) return; setCloudBusy(false); if (!result.ok) { setMessage(result.message); return; } if (!result.value) { setMessage('云端暂无存档。当前本地存档仍保留，请在账号卡片中选择上传或开始新游戏。'); return; } try { const remote = parseRemote(result.value.save_data); if (JSON.stringify(remote) !== JSON.stringify(game)) setCloudChoice({ remote, local: game }); } catch { setMessage('云端存档格式无效，已保留本地进度。'); } }); return () => { cancelled = true; }; }, [user]);
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
  async function handleAuth(email: string, password: string, confirm: string) { if (authMode !== 'new-password' && !email.includes('@')) { setMessage('请输入有效邮箱。'); return; } if (password.length < 6) { setMessage('密码至少需要 6 位。'); return; } if ((authMode === 'signup' || authMode === 'new-password') && password !== confirm) { setMessage('两次输入的密码不一致。'); return; } setAuthBusy(true); const result: AuthResult = authMode === 'signup' ? await signUp(email, password) : authMode === 'reset' ? await requestPasswordReset(email) : authMode === 'new-password' ? await updatePassword(password) : await signIn(email, password); setAuthBusy(false); if (!result.ok) { setMessage(result.message); return; } setAuthMode(null); setMessage(authMode === 'reset' ? '重置密码邮件已发送，请查收邮箱。' : authMode === 'new-password' ? '密码已更新，请继续问道。' : result.session ? '登录成功，正在读取云端存档。' : '注册成功，请先确认邮箱后再登录。'); }
  async function uploadCloud() { if (!user) return; setCloudBusy(true); const result = await saveCloud(user.id, advance(current.current, Date.now()), cloudRevision()); setCloudBusy(false); setMessage(result.ok ? '本地进度已安全上传到云端。' : result.message); if (!result.ok && result.code === 'conflict') { const remote = result.remote?.save_data; if (remote) setCloudChoice({ remote, local: current.current }); } }
  async function chooseCloud(source: 'local' | 'remote') { if (!user || !cloudChoice) return; if (source === 'remote') { setGame(cloudChoice.remote); current.current = cloudChoice.remote; setCloudChoice(null); setMessage('已载入云端存档。'); } else { setCloudChoice(null); await uploadCloud(); } }
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
  return <div className="app"><header><a className="brand" href="#">凡人<span>问道</span><small>一念入仙途</small></a><div className="account"><span className="save-status"><i/> {user ? `云端：${user.email}` : saving ? '本地自动存档' : '存档保护中'}</span>{user ? <button onClick={async () => { await uploadCloud(); await signOut(); setUser(null); setMessage('已退出登录，游客存档仍保留。'); }}>退出</button> : <button onClick={() => setAuthMode('login')}>邮箱登录</button>}</div></header>
    <section className={`cultivation-stage action-${meditationAction} gender-${gender}`} aria-label="人物打坐修行">
      <div className="stage-heading"><span>云深不知处</span><span className="stage-status"><i/>灵气流转</span></div>
      <div className="stage-scene">
        <div className="stage-halo halo-one"/><div className="stage-halo halo-two"/>
        <div className="formation formation-outer"/><div className="formation formation-inner"/>
        <div className="stage-mist mist-left"/><div className="stage-mist mist-right"/>
        <div className="qi-stream stream-one"/><div className="qi-stream stream-two"/><div className="qi-stream stream-three"/>
        <span className="qi-particle particle-one"/><span className="qi-particle particle-two"/><span className="qi-particle particle-three"/><span className="qi-particle particle-four"/><span className="qi-particle particle-five"/><span className="qi-particle particle-six"/>
        <svg className="meditating-person" viewBox="0 0 320 340" role="img" aria-label={gender === 'male' ? '白衣男修盘膝打坐' : '青衣女修盘膝打坐'}>
          <defs>
            <linearGradient id="robeMain" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={gender === 'male' ? '#f3f0dc' : '#c5d8c1'}/><stop offset="0.55" stopColor={gender === 'male' ? '#c8d2c4' : '#8eb4a2'}/><stop offset="1" stopColor={gender === 'male' ? '#718c82' : '#426d64'}/></linearGradient>
            <linearGradient id="robeShadow" x1="0" y1="0" x2="0.9" y2="1"><stop stopColor="#243b36"/><stop offset="1" stopColor="#101e1d"/></linearGradient>
            <linearGradient id="skin" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#f1d5bd"/><stop offset="1" stopColor="#bd9279"/></linearGradient>
            <filter id="personGlow"><feGaussianBlur stdDeviation="4"/></filter>
          </defs>
          <ellipse cx="160" cy="306" rx="94" ry="15" fill="#9dcdb1" opacity=".14" filter="url(#personGlow)"/>
          <g className="body-breath">
            <path d="M116 143 Q90 155 79 196 L56 242 Q49 255 63 260 Q75 263 83 249 L119 207Z" fill="url(#robeMain)" stroke="#a9c6b3" strokeWidth="2"/>
            <path d="M204 143 Q230 155 241 196 L264 242 Q271 255 257 260 Q245 263 237 249 L201 207Z" fill="url(#robeMain)" stroke="#a9c6b3" strokeWidth="2"/>
            <path d="M111 139 Q91 180 100 229 L72 271 Q81 295 124 299 L196 299 Q239 295 248 271 L220 229 Q229 180 209 139 Q187 126 160 126 Q133 126 111 139Z" fill="url(#robeMain)" stroke="#c6d7c5" strokeWidth="2"/>
            <path d="M132 132 L160 176 L188 132 L201 145 L184 209 L160 233 L136 209 L119 145Z" fill="url(#robeShadow)" stroke="#c2b78a" strokeWidth="2"/>
            <path d="M136 145 L160 181 L184 145 L176 207 L160 221 L144 207Z" fill="#d7ddce" opacity=".92"/>
            <path d="M116 224 Q160 244 204 224 L198 241 Q160 258 122 241Z" fill="#b4a16e" stroke="#e0d4a5" strokeWidth="2"/>
            <circle cx="160" cy="240" r="6" fill="#d8c68b"/><path d="M160 246 L160 273" stroke="#d7c68d" strokeWidth="2"/>
            <path d="M111 251 Q78 270 85 287 Q104 307 142 304 L160 292 L178 304 Q216 307 235 287 Q242 270 209 251 L189 268 Q175 279 160 278 Q145 279 131 268Z" fill="url(#robeMain)" stroke="#b6cbb8" strokeWidth="2"/>
            <path d="M84 285 Q116 297 145 286 M176 286 Q204 297 236 285" fill="none" stroke="#e0d9b7" strokeWidth="2" opacity=".85"/>
            <path d="M122 270 Q104 260 91 271 Q85 278 96 284 Q110 290 131 281Z" fill="url(#skin)" stroke="#d8b9a1" strokeWidth="1.5"/>
            <path d="M198 270 Q216 260 229 271 Q235 278 224 284 Q210 290 189 281Z" fill="url(#skin)" stroke="#d8b9a1" strokeWidth="1.5"/>
            <path d="M143 83 Q143 67 160 67 Q177 67 177 83 L177 118 Q171 132 160 132 Q149 132 143 118Z" fill="url(#skin)"/>
            <path d="M138 85 Q130 47 158 42 Q190 44 183 87 L176 102 L174 75 Q160 83 143 72 L142 100Z" fill={gender === 'male' ? '#172220' : '#172522'}/>
            {gender === 'female' ? <>
              <path d="M140 62 Q126 69 132 115 L142 135 L150 118 L145 85Z M178 62 Q194 75 188 119 L177 137 L170 117 L178 84Z" fill="#1a2824"/>
              <path d="M151 43 Q160 32 170 43 L175 55 L145 55Z" fill="#b9a879" stroke="#e0d3a6" strokeWidth="2"/>
            </> : <>
              <path d="M145 48 Q160 36 175 48 L179 66 Q160 60 141 66Z" fill="#1b2724"/>
              <path d="M160 41 L160 20 Q164 16 168 21 L168 43" fill="#1a2824"/>
              <path d="M166 23 L166 48" stroke="#c6b580" strokeWidth="2"/>
            </>}
            <path d="M150 90 Q160 95 170 90" fill="none" stroke="#9d7464" strokeWidth="1.4" opacity=".7"/>
            <path d="M152 105 Q160 109 168 105" fill="none" stroke="#9a6658" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M145 82 Q151 78 156 82 M164 82 Q169 78 175 82" fill="none" stroke="#403a32" strokeWidth="2" strokeLinecap="round"/>
            <path d="M119 143 L140 165 M201 143 L180 165" stroke="#f2ead1" strokeWidth="3" opacity=".8"/>
          </g>
        </svg>
        <div className="stage-ground"><span>☯</span><i/><i/><i/></div>
        <div className="breath-caption">{meditationAction === 'breath' ? '吐纳天地 · 引气入脉' : meditationAction === 'still' ? '心神归一 · 万念俱寂' : meditationAction === 'finish' ? '气归丹田 · 收功归元' : '静心凝神 · 周天自转'}</div>
      </div>
      <div className="character-controls">
        <div className="gender-picker" role="group" aria-label="选择修行角色性别">
          <span>修行者</span><button className={gender === 'male' ? 'selected' : ''} onClick={() => setGender('male')} aria-pressed={gender === 'male'}>♂ 男修</button><button className={gender === 'female' ? 'selected' : ''} onClick={() => setGender('female')} aria-pressed={gender === 'female'}>♀ 女修</button>
        </div>
        <div className="action-picker" role="group" aria-label="修行动作">
          <button className={meditationAction === 'cultivate' ? 'selected' : ''} onClick={() => setMeditationAction('cultivate')}>开始修行</button>
          <button className={meditationAction === 'breath' ? 'selected' : ''} onClick={() => setMeditationAction('breath')}>吐纳调息</button>
          <button className={meditationAction === 'still' ? 'selected' : ''} onClick={() => setMeditationAction('still')}>入定</button>
          <button className={meditationAction === 'finish' ? 'selected' : ''} onClick={() => setMeditationAction('finish')}>收功</button>
        </div>
      </div>
    </section>
    <nav aria-label="游戏导航">{['修行','洞府','功法','日志'].map((t, i) => <button key={t} className={tab === t ? 'active' : ''} onClick={() => { setTab(t); document.getElementById(t)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}><span>{['◈','⌂','▤','☷'][i]}</span>{t}</button>)}</nav>
    <main><div className="section-title"><h2>仙途初启</h2><span>道阻且长，行则将至</span></div><div className="grid"><section className="panel cultivation" id="修行"><div className="panel-top"><h3><span>◈</span> 静心修炼</h3><span className="tag">自动修炼中</span></div><div className="realm"><div className="realm-symbol">道</div><div><small>当前境界</small><h2>{realmName(game)}</h2><p>{isComplete(game) ? '已至化神之巅，静悟天地' : '吐纳天地灵气，淬炼一缕真元'}</p></div></div><div className="progress-label"><span>修为</span><span>{number(game.cultivation)} <em>/ {number(requirement(game))}</em></span></div><div className="progress" role="progressbar" aria-label="修为进度" aria-valuenow={Math.floor(progress)} aria-valuemin={0} aria-valuemax={100}><div style={{ width: `${progress}%` }}/></div><div className="rate"><span>每秒修为 <b>+{number(cultivationRate(game))}</b></span><span>{progress >= 100 ? '修为圆满' : '心无旁骛，自有所成'}</span></div><button className="primary" onClick={() => act(breakthrough)} disabled={progress < 100 || isComplete(game)}>{isComplete(game) ? '化神圆满' : progress >= 100 ? '✦ 突破境界' : '凝神蓄力 · 待突破'}</button><p className="hint">{isComplete(game) ? '此间仙途已圆满，仍可积攒灵石与参悟功法。' : '修为圆满即可突破 · 突破必定成功'}</p></section>
    <div className="side"><section className="panel" id="洞府"><div className="panel-top"><h3><span>⌂</span> 洞府灵脉</h3><span className="muted">一方清净地</span></div><div className="resource"><div className="stone">◇</div><div><small>持有灵石</small><strong>{number(game.stones)}</strong></div><span className="income">+{number(stoneRate(game))} / 秒</span></div><p className="description">灵脉流转，聚天地之精华。即使离去，洞府依然为你积攒灵石。</p><div className="panel-note"><span>灵脉品阶</span><b>{['凡品','灵品','玄品','地品','天品'][game.realm]} · 随境界提升</b></div></section>
    <section className="panel" id="功法"><div className="panel-top"><h3><span>▤</span> 功法参悟</h3><span className="muted">道法自然</span></div><div className="technique"><div className="book">引<br/>气<br/>诀</div><div><h4>引气诀 <span>第 {game.technique} 重</span></h4><p>引天地之气，养己身之道。</p><small>修炼基础效率 <b>+{(game.technique - 1) * 50}%</b></small></div></div><button className="secondary" disabled={game.stones < upgradeCost(game) || game.technique >= 50} onClick={() => act(upgrade)}>{game.technique >= 50 ? '功法已臻圆满' : <>参悟功法 <span>◇ {number(upgradeCost(game))} 灵石</span></>}</button></section></div></div>
    <section className="panel logs" id="日志"><div className="panel-top"><h3><span>☷</span> 修炼手记</h3><span className="muted">仙途留痕</span></div><ul>{game.logs.map((entry, i) => <li key={`${i}-${entry}`}><span className="log-dot"/><span>{entry}</span>{i === 0 && <small>最新</small>}</li>)}</ul></section>
    <section className="archive"><div><h3>留一卷仙途，待来日续写</h3><p>每 5 秒自动保存 · 离线收益上限 {MAX_OFFLINE / 3600} 小时</p></div><div className="archive-actions"><button onClick={exportSave}>↓ 导出存档</button><button onClick={() => file.current?.click()}>↑ 导入存档</button><input ref={file} type="file" accept=".json,application/json" onChange={importSave} aria-label="选择 JSON 存档" hidden/></div></section>
    {message && <div className="notice" role="status">{message}{!saving && <button onClick={() => { setSaving(true); setMessage('已启用当前进度的自动保存。'); }}>启用保存</button>}<button aria-label="关闭提示" onClick={() => setMessage('')}>×</button></div>}
    <footer>凡人问道 <span>·</span> 不争朝夕，只问长生<small>进度仅保存在此浏览器，建议定期导出备份</small></footer></main>
    {user && <button className="cloud-save" disabled={cloudBusy} onClick={uploadCloud}>{cloudBusy ? '云端处理中…' : '☁ 保存到云端'}</button>}
    {authMode && <AuthPanel mode={authMode} busy={authBusy} onClose={() => setAuthMode(null)} onSubmit={handleAuth} onMode={setAuthMode} />}
    {cloudChoice && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true"><span className="eyebrow">两份仙途相遇</span><h2>选择存档</h2><p>检测到本地与云端各有一份进度。请确认保留哪一份，系统不会静默覆盖。</p><div className="archive-actions"><button onClick={() => chooseCloud('local')}>保留本地并上传</button><button onClick={() => chooseCloud('remote')}>载入云端存档</button></div></section></div>}
    {offline && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="offline-title"><span className="eyebrow">故人归山</span><h2 id="offline-title">闭关有所得</h2><p>已结算 {number(offline.seconds / 60)} 分钟修行，最多计入 8 小时。</p><div className="offline-gains"><span>修为 <b>+{number(offline.cultivation)}</b></span><span>灵石 <b>+{number(offline.stones)}</b></span></div><p className="hint">修为达到突破要求后停止累积。</p><button autoFocus className="primary" onClick={() => setOffline(null)}>收下所得 · 继续问道</button></section></div>}
  </div>;
}
function parseRemote(value: unknown): Game { return restore(JSON.stringify(value)).game; }
function AuthPanel({ mode, busy, onClose, onSubmit, onMode }: { mode: 'login' | 'signup' | 'reset' | 'new-password'; busy: boolean; onClose: () => void; onSubmit: (email: string, password: string, confirm: string) => void; onMode: (mode: 'login' | 'signup' | 'reset' | 'new-password') => void }) { const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState(''); const reset = mode === 'reset'; const newPassword = mode === 'new-password'; return <div className="modal-backdrop"><section className="modal auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title"><button className="modal-close" onClick={onClose} aria-label="关闭">×</button><span className="eyebrow">云端仙途</span><h2 id="auth-title">{newPassword ? '设置新密码' : reset ? '重置密码' : mode === 'signup' ? '结缘问道' : '邮箱登录'}</h2><p>{newPassword ? '请输入新的登录密码。' : reset ? '输入邮箱，我们会发送密码重置链接。' : '登录后可在不同设备继续修行。游客进度会保留。'}</p>{!newPassword && <label>邮箱<input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" /></label>}{!reset && <label>密码<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} /></label>}{(mode === 'signup' || newPassword) && <label>确认密码<input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" /></label>}<button className="primary" disabled={busy} onClick={() => onSubmit(email, password, confirm)}>{busy ? '处理中…' : newPassword ? '更新密码' : reset ? '发送重置邮件' : mode === 'signup' ? '注册邮箱' : '登录'}</button><div className="auth-links">{mode === 'login' && <><button onClick={() => onMode('signup')}>注册新账号</button><button onClick={() => onMode('reset')}>忘记密码</button></>}{mode !== 'login' && !newPassword && <button onClick={() => onMode('login')}>返回登录</button>}</div></section></div> }
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
