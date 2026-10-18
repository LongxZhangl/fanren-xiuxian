import { describe, expect, it } from 'vitest';
import { supabaseConfigured, validateCredentials } from './auth';
describe('认证基础校验', () => { it('拒绝无效邮箱、短密码和不一致确认密码', () => { expect(validateCredentials('bad', '123456')).toBeTruthy(); expect(validateCredentials('a@b.com', '123')).toContain('6'); expect(validateCredentials('a@b.com', '123456', '654321', true)).toContain('不一致'); }); it('接受有效注册表单', () => expect(validateCredentials('a@b.com', '123456', '123456', true)).toBeNull()); it('未配置 Supabase 时仍保持游客模式', () => expect(typeof supabaseConfigured).toBe('boolean')); });
