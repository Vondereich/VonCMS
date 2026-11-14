import { useCallback, useEffect, useRef, useState } from 'react';
import { Info, KeyRound, Loader2 } from 'lucide-react';
import { API } from '../../../../config/site.config';
import { vonFetch, getErrorMessage } from '../../../../utils/api';
import toast from 'react-hot-toast';

interface CredentialStatus {
  configured: boolean;
  mask: string;
  state: 'empty' | 'encrypted' | 'expired' | 'unavailable';
  revision: string;
  savedAt: string;
  expiresAt: string;
}

const readStatus = (data: unknown): CredentialStatus => {
  if (!data || typeof data !== 'object' || !('credential' in data))
    throw Error('Invalid credential status.');
  const value = data.credential;
  if (
    !value ||
    typeof value !== 'object' ||
    !('configured' in value) ||
    typeof value.configured !== 'boolean' ||
    !('state' in value) ||
    !['empty', 'encrypted', 'expired', 'unavailable'].includes(String(value.state)) ||
    !('revision' in value) ||
    typeof value.revision !== 'string' ||
    !('savedAt' in value) ||
    typeof value.savedAt !== 'string' ||
    !('expiresAt' in value) ||
    typeof value.expiresAt !== 'string'
  )
    throw Error('Invalid credential status.');
  return {
    configured: value.configured,
    mask: value.configured ? '********' : '',
    state: value.state as CredentialStatus['state'],
    revision: value.revision,
    savedAt: value.savedAt,
    expiresAt: value.expiresAt,
  };
};

/** Mounted only for the signed-in account, never for an Admin's other-user edit dialog. */
export default function PersonalAiKey({ userId }: { userId: string }) {
  const [status, setStatus] = useState<CredentialStatus | null>(null);
  const [key, setKey] = useState('');
  const [expire, setExpire] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const requestVersion = useRef(0);
  const pending = useRef(false);
  useEffect(() => {
    const request = ++requestVersion.current;
    const controller = new AbortController();
    setLoading(true);
    setStatus(null);
    setKey('');
    setError('');
    void (async () => {
      try {
        const response = await vonFetch(`${API.ownAccount}?section=ai`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        const data: unknown = await response.json();
        if (!response.ok)
          throw Error(
            data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
              ? data.error
              : 'Personal key status could not be loaded.'
          );
        if (
          !data ||
          typeof data !== 'object' ||
          !('accountId' in data) ||
          data.accountId !== userId
        )
          throw Error('Your signed-in account changed. Reload before saving.');
        const next = readStatus(data);
        if (request !== requestVersion.current) return;
        setStatus(next);
        setExpire(Boolean(next.expiresAt));
      } catch (caught) {
        if (!controller.signal.aborted && request === requestVersion.current)
          setError(getErrorMessage(caught, 'Personal key status could not be loaded.'));
      } finally {
        if (request === requestVersion.current) setLoading(false);
      }
    })();
    return () => {
      controller.abort();
      requestVersion.current = request + 1;
    };
  }, [userId, retry]);

  const save = useCallback(
    async (action: 'save' | 'remove') => {
      if (pending.current || loading || !status) return;
      if (action === 'save' && !key.trim()) {
        setError('Enter your Gemini API key first.');
        return;
      }
      const request = requestVersion.current;
      pending.current = true;
      setBusy(true);
      setError('');
      try {
        const response = await vonFetch(API.ownAccount, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action,
            key: action === 'save' ? key.trim() : '',
            revision: status.revision,
            expireAfter30Days: expire,
            expectedUserId: userId,
          }),
        });
        const data: unknown = await response.json();
        if (
          !response.ok ||
          !data ||
          typeof data !== 'object' ||
          !('success' in data) ||
          data.success !== true
        ) {
          const message =
            data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
              ? data.error
              : 'Personal key change was not confirmed.';
          throw Error(message);
        }
        if (request !== requestVersion.current) return;
        const next = readStatus(data);
        setStatus(next);
        setKey('');
        setExpire(Boolean(next.expiresAt));
        toast.success(
          action === 'save'
            ? 'Personal AI key saved.'
            : 'Personal AI key removed. Shared access applies if configured.'
        );
      } catch (caught) {
        if (request === requestVersion.current)
          setError(getErrorMessage(caught, 'Personal key change was not confirmed.'));
      } finally {
        pending.current = false;
        if (request === requestVersion.current) setBusy(false);
      }
    },
    [key, expire, loading, status, userId]
  );

  return (
    <section
      aria-label="Personal AI key"
      data-personal-ai
      className="space-y-4 border-t border-slate-200 pt-5 dark:border-admin-border"
    >
      <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-gray-400">
        <KeyRound size={15} />
        Personal AI Key
      </h4>
      <aside
        id="personal-ai-key-guidance"
        aria-label="Personal AI key guidance"
        className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
      >
        <p className="flex items-start gap-2 font-semibold">
          <Info size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          How your personal key works
        </p>
        <div className="mt-3 space-y-3">
          <div>
            <p className="font-semibold">Privacy &amp; access</p>
            <p className="mt-1">
              Private to your account. Your saved key is encrypted and cannot be displayed. It takes
              priority over shared AI access.
            </p>
          </div>
          <div>
            <p className="font-semibold">AI model</p>
            <p className="mt-1">
              Model selection in the editor currently follows the Primary Admin&apos;s settings.
              More AI options are planned for future updates.
            </p>
          </div>
        </div>
      </aside>
      {loading ? (
        <p className="flex items-center gap-2 text-sm text-slate-500 dark:text-gray-400">
          <Loader2 size={15} className="animate-spin" />
          Loading private key status...
        </p>
      ) : (
        status && (
          <p className="text-sm text-slate-700 dark:text-slate-300" role="status">
            {status.configured
              ? `${status.mask} - ${status.state === 'encrypted' ? 'Saved securely' : status.state === 'expired' ? 'Expired - replace or remove' : 'Unavailable - restore storage or replace/remove'}`
              : 'No personal key. Shared access is used if configured.'}
          </p>
        )
      )}
      <div>
        <label
          htmlFor="personal-ai-key"
          className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          Gemini API key
        </label>
        <input
          id="personal-ai-key"
          name="personalAiKey"
          aria-describedby="personal-ai-key-guidance personal-ai-key-expiry-help"
          type="password"
          autoComplete="off"
          maxLength={512}
          value={key}
          disabled={loading || busy || !status}
          onChange={(event) => setKey(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              void save('save');
            }
          }}
          placeholder={
            status?.configured ? 'Enter a replacement key' : 'Enter your own Gemini API key'
          }
          className="min-h-11 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 disabled:opacity-50 dark:border-admin-border-strong dark:bg-admin-inset dark:text-white"
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
        <input
          type="checkbox"
          id="personal-ai-expiry"
          name="personalAiExpiry"
          aria-describedby="personal-ai-key-expiry-help"
          checked={expire}
          onChange={(event) => setExpire(event.target.checked)}
          disabled={loading || busy || !status}
        />
        Expire this saved key after 30 days
      </label>
      <p
        id="personal-ai-key-expiry-help"
        className="rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600 dark:bg-admin-inset dark:text-gray-400"
      >
        Expiry starts on Save/Replace and applies only to your personal key. An expired or rejected
        personal key never silently charges the shared key.
      </p>
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void save('save')}
          disabled={loading || busy || !status || !key.trim()}
          className="min-h-11 rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
        >
          {busy ? 'Saving...' : status?.configured ? 'Replace Key' : 'Save Key'}
        </button>
        {status?.configured && (
          <button
            type="button"
            onClick={() => void save('remove')}
            disabled={loading || busy}
            className="admin-action-delete min-h-11 rounded-xl px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
          >
            Remove Personal Key
          </button>
        )}
        {error && !loading && (
          <button
            type="button"
            disabled={busy}
            onClick={() => setRetry((value) => value + 1)}
            className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 dark:border-admin-border dark:text-slate-300"
          >
            Reload Status
          </button>
        )}
      </div>
    </section>
  );
}
