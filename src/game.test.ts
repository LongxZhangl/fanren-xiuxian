import { describe, expect, it } from 'vitest';
import { advance, breakthrough, cultivationRate, initialGame, MAX_OFFLINE, parseSave, realmName, requirement, restore, upgrade, upgradeCost } from './game';
describe('修行与资源', () => {
  it('初始为炼气一层，按秒产出修为和灵石', () => { const g = advance(initialGame(1000), 11000); expect(realmName(g)).toBe('炼气一层'); expect(g.cultivation).toBe(10); expect(g.stones).toBe(0.2); });
  it('离线最多八小时，修为不超过突破门槛', () => { const g = advance(initialGame(0), 24 * 3600 * 1000); expect(g.stones).toBe(MAX_OFFLINE * 0.02); expect(g.cultivation).toBe(requirement(g)); });
  it('时钟倒退不发奖励，不回退结算时间', () => { const g = initialGame(10000); expect(advance(g, 0)).toEqual(g); });
  it('重复结算不重复产生收益', () => { const g = advance(initialGame(0), 10000); expect(advance(g, 10000)).toEqual(g); });
  it('修为不足不能突破，满修为后消耗并升层', () => { const g = initialGame(0); expect(breakthrough(g)).toBe(g); const next = breakthrough({ ...g, cultivation: requirement(g) }); expect(next.layer).toBe(2); expect(next.cultivation).toBe(0); });
  it('每境十层并依序突破五大境界，化神十层封顶', () => { let g = initialGame(); for (let i = 0; i < 49; i++) g = breakthrough({ ...g, cultivation: requirement(g) }); expect(realmName(g)).toBe('化神十层'); g = { ...g, cultivation: requirement(g) }; expect(breakthrough(g)).toBe(g); });
  it('升级扣除准确灵石并提高效率，余额不足和满级不变', () => { const g = initialGame(); expect(upgrade(g)).toBe(g); const next = upgrade({ ...g, stones: upgradeCost(g) }); expect(next.stones).toBe(0); expect(next.technique).toBe(2); expect(cultivationRate(next)).toBe(1.5); const max = { ...g, technique: 50, stones: 1e12 }; expect(upgrade(max)).toBe(max); });
});
describe('存档', () => {
  it('JSON 往返保存所有进度', () => { const g = initialGame(); expect(parseSave(JSON.stringify(g))).toEqual(g); });
  it('读取存档结算离线奖励并保留累计资源', () => { const result = restore(JSON.stringify({ ...initialGame(0), stones: 20 }), 10000); expect(result.seconds).toBe(10); expect(result.stones).toBeCloseTo(0.2); expect(result.game.stones).toBeCloseTo(20.2); });
  it.each(['null', '{}', '{', JSON.stringify({ ...initialGame(), realm: 99 }), JSON.stringify({ ...initialGame(), stones: -1 }), JSON.stringify({ ...initialGame(), technique: 0 }), JSON.stringify({ ...initialGame(), cultivation: 999 }), JSON.stringify({ ...initialGame(), logs: [12] }), JSON.stringify({ ...initialGame(), updatedAt: Date.now() + 120000 })])('拒绝损坏或非法存档 %s', raw => { expect(() => parseSave(raw)).toThrow(); });
});

describe('v0.3 存档迁移', () => {
  it('旧版存档自动补齐性别、动作和音乐默认值', () => { const legacy = JSON.stringify({ ...initialGame(0), gender: undefined, action: undefined, music: undefined }); const g = JSON.parse(legacy); delete g.gender; delete g.action; delete g.music; const restored = parseSave(JSON.stringify(g)); expect(restored.gender).toBe('male'); expect(restored.action).toBe('idle'); expect(restored.music).toEqual({ playing: false, volume: 0.45, muted: false, track: 0, loop: true }); });
  it('性别、动作和音乐设置可持久化', () => { const g = { ...initialGame(), gender: 'female' as const, action: 'cultivating' as const, music: { playing: true, volume: 0.7, muted: true, track: 2, loop: false } }; expect(parseSave(JSON.stringify(g))).toMatchObject(g); });
});
