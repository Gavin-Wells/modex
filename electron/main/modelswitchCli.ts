// Copyright ModelSwitch. Licensed under Apache-2.0.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export type ModelSwitchLaunch = {
  tool: 'claude' | 'codex';
  apiKey: string;
  model: string;
};

export function cliLaunchOptions(launch: ModelSwitchLaunch) {
  if (
    !launch ||
    !['claude', 'codex'].includes(launch.tool) ||
    typeof launch.apiKey !== 'string' ||
    !launch.apiKey.trim() ||
    typeof launch.model !== 'string' ||
    !/^[a-zA-Z0-9._/-]{1,100}$/.test(launch.model)
  ) {
    throw new Error('Invalid ModelSwitch launch configuration');
  }
  const directories = [
    path.join(os.homedir(), '.local', 'bin'),
    ...(process.env.PATH || '').split(path.delimiter),
    '/opt/homebrew/bin',
    '/usr/local/bin',
  ];
  const executable =
    process.platform === 'win32' ? `${launch.tool}.cmd` : launch.tool;
  const file = directories
    .map((directory) => path.join(directory, executable))
    .find((candidate) => {
      try {
        fs.accessSync(candidate, fs.constants.X_OK);
        return true;
      } catch {
        return false;
      }
    });
  if (!file)
    throw new Error(
      `${launch.tool === 'claude' ? 'Claude Code' : 'Codex'} CLI not found. Install it and try again.`
    );
  if (process.platform === 'win32')
    throw new Error('The preview terminal currently supports macOS and Linux.');
  if (launch.tool === 'claude') {
    return {
      file,
      args: [],
      env: {
        ANTHROPIC_AUTH_TOKEN: launch.apiKey.trim(),
        ANTHROPIC_API_KEY: '',
        ANTHROPIC_BASE_URL: 'https://api.modelswitch.org',
        ANTHROPIC_MODEL: launch.model,
        ANTHROPIC_DEFAULT_OPUS_MODEL: 'claude-opus-5-5',
        ANTHROPIC_DEFAULT_SONNET_MODEL: 'claude-sonnet-5-5',
        ANTHROPIC_DEFAULT_HAIKU_MODEL: 'claude-sonnet-5-5',
        ANTHROPIC_SMALL_FAST_MODEL: 'claude-sonnet-5-5',
        CLAUDE_CODE_USE_BEDROCK: '0',
        CLAUDE_CODE_USE_VERTEX: '0',
        CLAUDE_CODE_USE_FOUNDRY: '0',
      },
    };
  }
  return {
    file,
    args: [
      '-c',
      'model_provider="modelswitch"',
      '-c',
      `model=${JSON.stringify(launch.model)}`,
      '-c',
      'model_providers.modelswitch.name="ModelSwitch"',
      '-c',
      'model_providers.modelswitch.base_url="https://api.modelswitch.org/v1"',
      '-c',
      'model_providers.modelswitch.wire_api="responses"',
      '-c',
      'model_providers.modelswitch.env_key="MODELSWITCH_API_KEY"',
      '-c',
      'model_providers.modelswitch.requires_openai_auth=false',
    ],
    env: { MODELSWITCH_API_KEY: launch.apiKey.trim() },
  };
}
