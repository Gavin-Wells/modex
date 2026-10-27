// Modified for Modex authentication.
// Copyright 2025-2026 @ Eigent.ai. Licensed under the Apache License, Version 2.0.
import { proxyFetchGet, proxyFetchPost } from '@/api/http';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/authStore';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

type SecurityConfig = {
  turnstile_required: boolean;
  turnstile_site_key: string;
};
type TurnstileApi = {
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  remove: (id: string) => void;
};

function Turnstile({
  siteKey,
  onToken,
  onError,
}: {
  siteKey: string;
  onToken: (token: string) => void;
  onError: (message: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;
    let widget: string | undefined;
    const getApi = () =>
      (window as Window & { turnstile?: TurnstileApi }).turnstile;
    const mount = () => {
      if (cancelled || !container.current) return;
      const api = getApi();
      if (!api) {
        onError('人机验证加载失败，请检查网络。');
        return;
      }
      widget = api.render(container.current, {
        sitekey: siteKey,
        callback: onToken,
        'expired-callback': () => onToken(''),
        'error-callback': () => {
          onToken('');
          onError('人机验证失败，请重试。');
        },
      });
    };
    if (getApi()) mount();
    else {
      const script = document.createElement('script');
      script.src =
        'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.onload = mount;
      script.onerror = () => {
        if (!cancelled) onError('人机验证加载失败，请检查网络。');
      };
      document.head.appendChild(script);
    }
    return () => {
      cancelled = true;
      if (widget) getApi()?.remove(widget);
    };
  }, [siteKey, onToken, onError]);
  return <div ref={container} />;
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    setAuth,
    setModelType,
    setLocalProxyValue,
    setInitState,
    setIsFirstLaunch,
  } = useAuthStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [challenge, setChallenge] = useState('');
  const [config, setConfig] = useState<SecurityConfig | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [challengeVersion, setChallengeVersion] = useState(0);
  const onChallengeError = useCallback(
    (message: string) => setError(message),
    []
  );

  useEffect(() => {
    let active = true;
    proxyFetchGet('/api/v1/user/modelswitch-security-config')
      .then((data) => {
        if (active) setConfig(data);
      })
      .catch(() => {
        if (active) setError('无法连接账号服务或本地工作台，请稍后重试。');
      });
    return () => {
      active = false;
    };
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!config || (config.turnstile_required && !challenge)) {
      setError('请先完成人机验证。');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await proxyFetchPost(
        '/api/v1/user/modelswitch-password-login',
        {
          username,
          password,
          turnstile_token: challenge,
        }
      );
      if (!data?.token || !data?.email)
        throw new Error('invalid login response');
      setAuth({ email: data.email, ...data });
      setLocalProxyValue(import.meta.env.VITE_USE_LOCAL_PROXY || null);
      setModelType('custom');
      setInitState('done');
      setIsFirstLaunch(false);
      setPassword('');
      const redirect =
        new URLSearchParams(location.search).get('redirect') || '/';
      navigate(
        redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : '/',
        { replace: true }
      );
    } catch {
      setError('登录失败，请检查账号、密码及人机验证，或稍后重试。');
      setChallenge('');
      setChallengeVersion((value) => value + 1);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="bg-background text-foreground flex min-h-screen items-center justify-center px-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-5">
        <div>
          <h1 className="text-2xl font-semibold">Modex</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            登录 ModelSwitch 账号
          </p>
        </div>
        <label className="block text-sm">
          账号
          <input
            autoComplete="username"
            required
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className="bg-background mt-2 h-10 w-full rounded-md border px-3"
          />
        </label>
        <label className="block text-sm">
          密码
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="bg-background mt-2 h-10 w-full rounded-md border px-3"
          />
        </label>
        {config?.turnstile_required && (
          <Turnstile
            key={challengeVersion}
            siteKey={config.turnstile_site_key}
            onToken={setChallenge}
            onError={onChallengeError}
          />
        )}
        {!config && !error && (
          <p role="status" className="text-muted-foreground text-sm">
            正在启动本地工作台...
          </p>
        )}
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        <Button
          type="submit"
          disabled={
            loading || !config || (config.turnstile_required && !challenge)
          }
          className="w-full"
        >
          {loading ? '登录中...' : '登录'}
        </Button>
      </form>
    </main>
  );
}
