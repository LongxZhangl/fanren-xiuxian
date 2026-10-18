export const SAVE_KEY = 'fanren-wendao-v1';
export const MAX_OFFLINE = 8 * 60 * 60;
export const REALMS = ['炼气', '筑基', '金丹', '元婴', '化神'];
export type Gender = 'male' | 'female';
export type ActionState = 'idle' | 'breathing' | 'cultivating' | 'meditating';
export interface MusicSettings { playing: boolean; volume: number; muted: boolean; track: number; loop: boolean }
export interface Game { version: 1; realm: number; layer: number; cultivation: number; stones: number; technique: number; updatedAt: number; logs: string[]; gender: Gender; action: ActionState; music: MusicSettings }
export function initialGame(now = Date.now()): Game {
  return { version: 1, realm: 0, layer: 1, cultivation: 0, stones: 0, technique: 1, updatedAt: now, logs: ['你在青山深处结庐，自此踏上问道之途。'], gender: 'male', action: 'idle', music: { playing: false, volume: 0.45, muted: false, track: 0, loop: true } };
}
export const realmName = (g: Game) => `${REALMS[g.realm]}${['一','二','三','四','五','六','七','八','九','十'][g.layer - 1]}层`;
export const requirement = (g: Game) => Math.round(60 * 6 ** g.realm * 1.65 ** (g.layer - 1));
export const cultivationRate = (g: Game) => (1 + (g.technique - 1) * 0.5) * (1 + g.realm * 0.5);
export const stoneRate = (g: Game) => 0.5 * (g.realm + 1);
export const upgradeCost = (g: Game) => Math.round(30 * 1.6 ** (g.technique - 1));
export const isComplete = (g: Game) => g.realm === 4 && g.layer === 10;
function log(g: Game, message: string): Game { return { ...g, logs: [message, ...g.logs].slice(0, 30) }; }
export function advance(g: Game, now: number): Game {
  const seconds = Math.min(MAX_OFFLINE, Math.max(0, (now - g.updatedAt) / 1000));
  return { ...g, cultivation: Math.min(requirement(g), g.cultivation + seconds * cultivationRate(g)), stones: Math.min(1e15, g.stones + seconds * stoneRate(g)), updatedAt: Math.max(g.updatedAt, now) };
}
export function breakthrough(g: Game): Game {
  if (g.cultivation < requirement(g) || isComplete(g)) return g;
  const next = { ...g, cultivation: 0, layer: g.layer === 10 ? 1 : g.layer + 1, realm: g.layer === 10 ? g.realm + 1 : g.realm };
  return log(next, `破境成功！你已踏入${realmName(next)}。`);
}
export function upgrade(g: Game): Game {
  const cost = upgradeCost(g);
  if (g.stones < cost || g.technique >= 50) return g;
  return log({ ...g, stones: g.stones - cost, technique: g.technique + 1 }, `参悟《引气诀》，功法提升至第 ${g.technique + 1} 重。`);
}
export function parseSave(raw: string): Game {
  if (raw.length > 100_000) throw new Error('存档文件过大');
  const g = JSON.parse(raw) as Game;
  if (!g || g.version !== 1 || !Number.isInteger(g.realm) || g.realm < 0 || g.realm > 4 || !Number.isInteger(g.layer) || g.layer < 1 || g.layer > 10 || !Number.isInteger(g.technique) || g.technique < 1 || g.technique > 50 || ![g.cultivation, g.stones, g.updatedAt].every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0) || g.stones > 1e15 || g.updatedAt > Date.now() + 60_000 || g.cultivation > requirement(g) || !Array.isArray(g.logs) || g.logs.length > 30 || !g.logs.every(s => typeof s === 'string' && s.length <= 300)) throw new Error('存档格式或数值无效');
  const gender: Gender = g.gender === 'female' ? 'female' : 'male';
  const action: ActionState = ['idle', 'breathing', 'cultivating', 'meditating'].includes(g.action) ? g.action as ActionState : 'idle';
  const music = { playing: Boolean(g.music?.playing), volume: typeof g.music?.volume === 'number' ? Math.min(1, Math.max(0, g.music.volume)) : 0.45, muted: Boolean(g.music?.muted), track: Number.isInteger(g.music?.track) && g.music.track >= 0 && g.music.track < 3 ? g.music.track : 0, loop: g.music?.loop !== false };
  return { version: 1, realm: g.realm, layer: g.layer, cultivation: g.cultivation, stones: g.stones, technique: g.technique, updatedAt: g.updatedAt, logs: [...g.logs], gender, action, music };
}
export function restore(raw: string, now = Date.now()): { game: Game; seconds: number; cultivation: number; stones: number } {
  const saved = parseSave(raw);
  const game = advance(saved, now);
  return { game, seconds: Math.min(MAX_OFFLINE, Math.max(0, (now - saved.updatedAt) / 1000)), cultivation: game.cultivation - saved.cultivation, stones: game.stones - saved.stones };
}
