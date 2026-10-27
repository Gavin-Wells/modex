// Copyright ModelSwitch. Licensed under Apache-2.0.
import { ShellTerminal } from '@/components/Session/PreviewPanel/tabs/terminal/ShellTerminal';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';
import { DsText } from '@/components/ui/ds-text';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useHost } from '@/host';
import { disposeShellSession } from '@/lib/shellSessions';
import { useState } from 'react';

type Launch = {
  tool: 'claude' | 'codex';
  apiKey: string;
  model: string;
  id: string;
  cwd: string;
};

export function ModelSwitchTerminal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const host = useHost();
  const [tool, setTool] = useState<'claude' | 'codex'>('claude');
  const [key, setKey] = useState('');
  const [claudeModel, setClaudeModel] = useState('claude-opus-5-5');
  const [codexModel, setCodexModel] = useState('gpt-6.1-sol');
  const [cwd, setCwd] = useState('');
  const [launch, setLaunch] = useState<Launch | null>(null);

  function close() {
    if (launch) disposeShellSession(host?.electronAPI, launch.id);
    setLaunch(null);
    setKey('');
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      <DialogContent size="lg" overlayVariant="dimmed">
        <DialogHeader title="ModelSwitch · Code" />
        <div className="flex flex-col gap-ds-stack-related p-ds-panel-inset">
          {!launch ? (
            <>
              <label htmlFor="modelswitch-tool">
                <DsText>工具</DsText>
              </label>
              <Select
                value={tool}
                onValueChange={(value) => setTool(value as 'claude' | 'codex')}
              >
                <SelectTrigger id="modelswitch-tool">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="claude">Claude Code</SelectItem>
                  <SelectItem value="codex">Codex</SelectItem>
                </SelectContent>
              </Select>
              <label htmlFor="modelswitch-key">
                <DsText>ModelSwitch API Key</DsText>
              </label>
              <Input
                id="modelswitch-key"
                type="password"
                autoComplete="off"
                value={key}
                onChange={(event) => setKey(event.target.value)}
              />
              <label htmlFor="modelswitch-model">
                <DsText>模型</DsText>
              </label>
              {tool === 'claude' ? (
                <Select value={claudeModel} onValueChange={setClaudeModel}>
                  <SelectTrigger id="modelswitch-model">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="claude-opus-5-5">
                      Claude Opus 5.5
                    </SelectItem>
                    <SelectItem value="claude-sonnet-5-5">
                      Claude Sonnet 5.5
                    </SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="modelswitch-model"
                  value={codexModel}
                  onChange={(event) => setCodexModel(event.target.value)}
                />
              )}
              <label>
                <DsText>项目文件夹</DsText>
              </label>
              <div className="flex items-center gap-ds-control-gap">
                <Input
                  readOnly
                  value={cwd}
                  placeholder="请选择项目文件夹"
                  aria-label="项目文件夹"
                />
                <Button
                  variant="secondary"
                  onClick={async () => {
                    const result = await host?.electronAPI?.selectFile({
                      properties: ['openDirectory'],
                    });
                    if (result?.success && result.files?.[0]?.filePath)
                      setCwd(result.files[0].filePath);
                  }}
                >
                  选择
                </Button>
              </div>
              <Button
                variant="primary"
                disabled={
                  !host?.electronAPI ||
                  !key.trim() ||
                  !cwd ||
                  !(tool === 'claude' ? claudeModel : codexModel).trim()
                }
                onClick={() =>
                  setLaunch({
                    tool,
                    apiKey: key.trim(),
                    model: tool === 'claude' ? claudeModel : codexModel.trim(),
                    cwd,
                    id: `modelswitch-${crypto.randomUUID()}`,
                  })
                }
              >
                启动
              </Button>
            </>
          ) : (
            <>
              <div className="h-[480px] min-h-0 overflow-hidden">
                <ShellTerminal
                  shellId={launch.id}
                  cwd={launch.cwd}
                  modelswitch={launch}
                />
              </div>
              <Button
                variant="secondary"
                onClick={() => {
                  disposeShellSession(host?.electronAPI, launch.id);
                  setLaunch(null);
                }}
              >
                结束会话
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
