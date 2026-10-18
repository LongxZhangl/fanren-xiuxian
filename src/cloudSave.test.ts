import { describe, expect, it } from 'vitest';
import { cloudRevision, readCloud, resetCloudState, saveCloud } from './cloudSave';
import { initialGame } from './game';
describe('云存档安全边界', () => { it('账号切换会重置 revision，旧账号请求不会污染新账号', async () => { resetCloudState('user-a'); resetCloudState('user-b'); expect(cloudRevision()).toBe(0); const result = await saveCloud('user-a', initialGame(), 0); expect(result.ok).toBe(false); if (!result.ok) expect(result.code).toBe('not_configured'); }); it('未配置 Supabase 时读取与保存都明确返回未配置', async () => { resetCloudState(null); expect((await readCloud('user-a')).ok).toBe(false); expect((await saveCloud('user-a', initialGame(), 0)).ok).toBe(false); }); });
