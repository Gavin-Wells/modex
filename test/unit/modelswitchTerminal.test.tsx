// Copyright ModelSwitch. Licensed under Apache-2.0.
import { ModelSwitchTerminal } from '@/components/ModelSwitch/ModelSwitchTerminal';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  selectFile: vi.fn(),
  dispose: vi.fn(),
  terminal: vi.fn(),
}));
vi.mock('@/host', () => ({
  useHost: () => ({ electronAPI: { selectFile: mocks.selectFile } }),
}));
vi.mock('@/lib/shellSessions', () => ({ disposeShellSession: mocks.dispose }));
vi.mock(
  '@/components/Session/PreviewPanel/tabs/terminal/ShellTerminal',
  () => ({
    ShellTerminal: (props: unknown) => {
      mocks.terminal(props);
      return <div>Terminal ready</div>;
    },
  })
);

describe('ModelSwitch terminal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.selectFile.mockResolvedValue({
      success: true,
      files: [{ filePath: '/work/project' }],
    });
  });

  it('requires a key and a project directory, then cleans up the launched session', async () => {
    render(<ModelSwitchTerminal open onOpenChange={vi.fn()} />);
    const start = screen.getByRole('button', { name: '启动' });
    expect(start).toBeDisabled();
    fireEvent.change(screen.getByLabelText('ModelSwitch API Key'), {
      target: { value: 'test-key' },
    });
    expect(start).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '选择' }));
    await waitFor(() => expect(start).toBeEnabled());
    fireEvent.click(start);
    expect(await screen.findByText('Terminal ready')).toBeInTheDocument();
    expect(mocks.terminal).toHaveBeenLastCalledWith(
      expect.objectContaining({
        cwd: '/work/project',
        modelswitch: expect.objectContaining({
          tool: 'claude',
          apiKey: 'test-key',
          model: 'claude-opus-5-5',
        }),
      })
    );
    fireEvent.click(screen.getByRole('button', { name: '结束会话' }));
    expect(mocks.dispose).toHaveBeenCalledTimes(1);
  });
});
