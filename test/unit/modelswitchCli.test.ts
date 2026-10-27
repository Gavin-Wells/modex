// Copyright ModelSwitch. Licensed under Apache-2.0.
import fs from 'node:fs';
import os from 'node:os';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cliLaunchOptions } from '../../electron/main/modelswitchCli';

describe('ModelSwitch CLI launch', () => {
  afterEach(() => vi.restoreAllMocks());

  it('passes the Claude key only through the process environment', () => {
    vi.spyOn(os, 'homedir').mockReturnValue('/test-home');
    vi.spyOn(fs, 'accessSync').mockImplementation(() => undefined);
    const result = cliLaunchOptions({
      tool: 'claude',
      apiKey: 'test-private-key',
      model: 'claude-opus-5-5',
    });
    expect(result.env.ANTHROPIC_AUTH_TOKEN).toBe('test-private-key');
    expect(result.env.CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST).toBe('1');
    expect(result.env.ANTHROPIC_DEFAULT_HAIKU_MODEL).toBe('claude-sonnet-5-5');
    expect(JSON.stringify(result.args)).not.toContain('test-private-key');
  });

  it('uses provider-specific Codex authentication without exposing the key in arguments', () => {
    vi.spyOn(fs, 'accessSync').mockImplementation(() => undefined);
    const result = cliLaunchOptions({
      tool: 'codex',
      apiKey: 'test-private-key',
      model: 'gpt-6.1-sol',
    });
    expect(result.env.MODELSWITCH_API_KEY).toBe('test-private-key');
    expect(result.args).toContain(
      'model_providers.modelswitch.env_key="MODELSWITCH_API_KEY"'
    );
    expect(result.args).toContain(
      'model_providers.modelswitch.requires_openai_auth=false'
    );
    expect(JSON.stringify(result.args)).not.toContain('test-private-key');
  });

  it('rejects unsafe model values and missing credentials', () => {
    expect(() =>
      cliLaunchOptions({ tool: 'codex', apiKey: 'x', model: 'bad"\nmodel' })
    ).toThrow();
    expect(() =>
      cliLaunchOptions({ tool: 'claude', apiKey: '', model: 'claude-opus-5-5' })
    ).toThrow();
  });
});
