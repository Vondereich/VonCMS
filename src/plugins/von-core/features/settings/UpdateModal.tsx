import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
  X,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { BASE_PATH } from '../../../../config/site.config';
import { getAuthHeader } from '../../../../config/auth.config';
import { vonFetch } from '../../../../utils/api';
import AdminModal from '../../../../components/admin/AdminModal';
import ReleaseNotes from './ReleaseNotes';

interface UpdateModalProps {
  currentVersion: string;
  latestVersion: string;
  downloadUrl: string;
  releaseNotes: string;
  releaseUrl?: string;
  releaseNotesTruncated?: boolean;
  expectedHash?: string;
  onClose: () => void;
  onSuccess: () => void;
}

type UpdateStep = 'idle' | 'checking' | 'installing' | 'success' | 'error';

class UpdateUiError extends Error {}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const readJsonRecord = async (response: Response): Promise<Record<string, unknown>> => {
  try {
    const data: unknown = await response.json();
    if (isRecord(data)) return data;
  } catch {
    // The caller presents a stable, non-sensitive error below.
  }
  throw new UpdateUiError('The server returned an unexpected update response.');
};

export const UpdateModal: React.FC<UpdateModalProps> = ({
  currentVersion,
  latestVersion,
  downloadUrl,
  releaseNotes,
  releaseUrl,
  releaseNotesTruncated,
  expectedHash,
  onClose,
  onSuccess,
}) => {
  const [step, setStep] = useState<UpdateStep>('idle');
  const [activity, setActivity] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const reloadTimerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (reloadTimerRef.current !== null) window.clearTimeout(reloadTimerRef.current);
    },
    []
  );

  const addActivity = (message: string) => {
    const boundedMessage = message.slice(0, 180);
    setActivity((previous) => [...previous.slice(-5), boundedMessage]);
  };

  const startUpdate = async () => {
    if (!downloadUrl) {
      setStep('error');
      setErrorMessage('The Deploy package is not available for this release.');
      return;
    }

    setStep('checking');
    setErrorMessage('');
    setActivity([]);
    addActivity('Checking server permissions and update requirements.');

    try {
      const permissionResponse = await vonFetch(
        `${BASE_PATH}von_system.php?action=system_update_check`,
        { headers: { Authorization: getAuthHeader() || '' } }
      );
      if (!permissionResponse.ok) {
        throw new UpdateUiError('Pre-flight checks could not be completed.');
      }

      const permissionPayload = await readJsonRecord(permissionResponse);
      const permissionData = permissionPayload['data'];
      if (!isRecord(permissionData) || permissionData['root_writable'] !== true) {
        throw new UpdateUiError(
          'Update files are not writable. Check the server permissions and try again.'
        );
      }

      const csrfToken =
        typeof permissionPayload['csrf_token'] === 'string'
          ? permissionPayload['csrf_token'].slice(0, 512)
          : '';
      if (!csrfToken) {
        throw new UpdateUiError('The secure update session could not be prepared.');
      }

      addActivity('Pre-flight checks passed.');
      setStep('installing');
      addActivity('Downloading and verifying the release package.');

      const updateResponse = await vonFetch(
        `${BASE_PATH}von_system.php?action=system_update_start`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(getAuthHeader() ? { Authorization: getAuthHeader() } : {}),
          },
          body: JSON.stringify({
            version: latestVersion,
            download_url: downloadUrl,
            expected_hash: expectedHash || undefined,
            csrf_token: csrfToken,
          }),
        }
      );
      const updatePayload = await readJsonRecord(updateResponse);
      const updateSucceeded =
        updateResponse.ok &&
        (updatePayload['success'] === true || updatePayload['status'] === 'success');

      if (!updateSucceeded) {
        throw new UpdateUiError(
          'The update could not be installed. Your existing installation remains available.'
        );
      }

      setStep('success');
      addActivity('Installation completed. The dashboard will reload shortly.');
      toast.success(`VonCMS updated to v${latestVersion}.`, { duration: 5000 });
      reloadTimerRef.current = window.setTimeout(onSuccess, 3000);
    } catch (error: unknown) {
      const message =
        error instanceof UpdateUiError
          ? error.message
          : 'The update service could not complete the request. Please try again.';
      setStep('error');
      setErrorMessage(message);
      addActivity('The update stopped safely.');
      toast.error(message, { duration: 5000 });
    }
  };

  const resetUpdate = () => {
    setStep('idle');
    setActivity([]);
    setErrorMessage('');
  };

  const canDismiss = step === 'idle' || step === 'error' || step === 'success';
  const isWorking = step === 'checking' || step === 'installing';

  return (
    <AdminModal
      isOpen
      onClose={onClose}
      ariaLabelledBy="system-update-title"
      className="w-full max-w-xl"
      closeOnBackdrop={false}
      closeOnEscape={canDismiss}
    >
      <section className="max-h-[calc(100dvh-1.5rem)] w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-admin-border dark:bg-admin-panel">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-5 dark:border-admin-border sm:px-6">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400">
              <RefreshCw className={isWorking ? 'animate-spin' : ''} size={21} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary-600 dark:text-primary-400">
                System update
              </p>
              <h2
                id="system-update-title"
                className="mt-1 text-xl font-bold text-slate-900 dark:text-white"
              >
                Update to v{latestVersion}
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Current version: v{currentVersion}
              </p>
            </div>
          </div>
          {canDismiss && (
            <button
              type="button"
              onClick={onClose}
              className="flex size-11 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 dark:text-slate-400 dark:hover:bg-admin-hover dark:hover:text-white"
              aria-label="Close system update"
            >
              <X size={20} />
            </button>
          )}
        </header>

        <div className="space-y-5 p-5 sm:p-6">
          {step === 'idle' && (
            <>
              <div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="font-semibold text-slate-900 dark:text-white">Release notes</h3>
                  {releaseUrl && (
                    <a
                      href={releaseUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-11 items-center gap-1.5 text-xs font-medium text-primary-600 hover:underline dark:text-primary-400"
                    >
                      View on GitHub <ExternalLink size={13} />
                    </a>
                  )}
                </div>
                <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-admin-border dark:bg-admin-canvas">
                  <ReleaseNotes
                    markdown={releaseNotes}
                    truncated={releaseNotesTruncated}
                    releaseUrl={releaseUrl}
                  />
                </div>
              </div>

              <div className="flex items-start gap-3 border-t border-slate-200 pt-4 dark:border-admin-border">
                <ShieldCheck
                  size={19}
                  className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                />
                <div className="text-sm">
                  <p className="font-semibold text-slate-800 dark:text-slate-100">
                    Your site data stays protected
                  </p>
                  <p className="mt-1 leading-6 text-slate-500 dark:text-slate-400">
                    The updater preserves <strong>von_config.php</strong>,{' '}
                    <strong>.htaccess</strong>, <strong>data</strong>, <strong>uploads</strong>, and{' '}
                    <strong>backups</strong> while replacing managed release files.
                  </p>
                  <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                    If the release notes mention .htaccess changes, run System Tools &gt; Repair
                    .htaccess once after updating.
                  </p>
                </div>
              </div>

              {!downloadUrl && (
                <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                  <AlertTriangle size={19} className="mt-0.5 shrink-0" />
                  <p>
                    The Deploy package is not available yet. Review the GitHub release and retry
                    later.
                  </p>
                </div>
              )}
            </>
          )}

          {isWorking && (
            <div role="status" aria-live="polite" className="space-y-4 py-4 text-center">
              <RefreshCw
                size={34}
                className="mx-auto animate-spin text-primary-600 dark:text-primary-400"
              />
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">
                  {step === 'checking' ? 'Checking update requirements' : 'Installing update'}
                </p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {step === 'checking'
                    ? 'Confirming permissions and preparing a secure update session.'
                    : 'The package is being downloaded, verified, backed up, and installed.'}
                </p>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Keep this window open until the operation finishes.
              </p>
            </div>
          )}

          {step === 'error' && (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300"
            >
              <AlertTriangle size={22} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">Update failed</p>
                <p className="mt-1 text-sm leading-6">{errorMessage}</p>
              </div>
            </div>
          )}

          {step === 'success' && (
            <div
              role="status"
              aria-live="polite"
              className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300"
            >
              <CheckCircle2 size={22} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">Update complete</p>
                <p className="mt-1 text-sm">The dashboard will reload in a few seconds.</p>
              </div>
            </div>
          )}

          {activity.length > 0 && step !== 'idle' && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-admin-border dark:bg-admin-canvas">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Update activity
              </h3>
              <ul className="mt-2 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                {activity.map((item, index) => (
                  <li key={`${index}-${item}`} className="flex gap-2">
                    <span aria-hidden="true">-</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <footer className="admin-safe-bottom flex flex-col-reverse justify-end gap-3 border-t border-slate-200 bg-slate-50 p-4 dark:border-admin-border dark:bg-admin-canvas/50 sm:flex-row">
          {step === 'idle' && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="min-h-11 w-full rounded-lg px-4 py-2 text-slate-600 transition-colors hover:bg-slate-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 dark:text-slate-300 dark:hover:bg-admin-hover sm:w-auto"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={startUpdate}
                disabled={!downloadUrl}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-6 py-2 font-semibold text-white shadow-sm transition-colors hover:bg-primary-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                <Download size={18} /> Install Update
              </button>
            </>
          )}
          {step === 'error' && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="min-h-11 rounded-lg px-4 py-2 text-slate-600 transition-colors hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-admin-hover"
              >
                Close
              </button>
              <button
                type="button"
                onClick={resetUpdate}
                className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary-600 px-5 py-2 font-semibold text-white transition-colors hover:bg-primary-700"
              >
                <RefreshCw size={17} /> Try Again
              </button>
            </>
          )}
        </footer>
      </section>
    </AdminModal>
  );
};
