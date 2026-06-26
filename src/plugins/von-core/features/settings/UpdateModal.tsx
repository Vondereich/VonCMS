import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { RefreshCw, Download, ShieldCheck, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { BASE_PATH } from '../../../../config/site.config';
import { getAuthHeader } from '../../../../config/auth.config';
import { vonFetch } from '../../../../utils/api';

interface UpdateModalProps {
  currentVersion: string;
  latestVersion: string;
  downloadUrl: string;
  releaseNotes: string;
  expectedHash?: string;
  onClose: () => void;
  onSuccess: () => void;
}

type UpdateStep = 'idle' | 'checking' | 'downloading' | 'swapping' | 'success' | 'error';

// Step definitions for progress tracking
const UPDATE_STEPS = [
  { id: 'checking', label: 'Pre-flight Checks', weight: 10 },
  { id: 'downloading', label: 'Downloading Package', weight: 40 },
  { id: 'swapping', label: 'Installing Files', weight: 40 },
  { id: 'success', label: 'Complete', weight: 10 },
];

export const UpdateModal: React.FC<UpdateModalProps> = ({
  currentVersion,
  latestVersion,
  downloadUrl,
  releaseNotes,
  expectedHash,
  onClose,
  onSuccess,
}) => {
  const [step, setStep] = useState<UpdateStep>('idle');
  const [logs, setLogs] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [progress, setProgress] = useState(0);

  const addLog = (msg: string) =>
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);

  // Calculate progress based on current step
  const getProgressForStep = (currentStep: UpdateStep): number => {
    const stepIndex = UPDATE_STEPS.findIndex((s) => s.id === currentStep);
    if (stepIndex === -1) return 0;
    let progress = 0;
    for (let i = 0; i < stepIndex; i++) {
      progress += UPDATE_STEPS[i].weight;
    }
    return progress;
  };

  const getCurrentStepNumber = (): number => {
    const idx = UPDATE_STEPS.findIndex((s) => s.id === step);
    return idx >= 0 ? idx + 1 : 0;
  };

  const startUpdate = async () => {
    setStep('checking');
    setProgress(getProgressForStep('checking'));
    setLogs([]);
    addLog('Starting pre-flight checks...');

    try {
      // 1. Check Permissions
      const permRes = await vonFetch(`${BASE_PATH}von_system.php?action=system_update_check`, {
        headers: { Authorization: getAuthHeader() || '' },
      });
      const permJson = await permRes.json();

      if (!permJson.data) {
        throw new Error(
          permJson.error || 'Failed to check permissions. Unexpected server response.'
        );
      }

      const token = permJson.csrf_token || '';

      if (permJson.data.error) {
        throw new Error(permJson.data.error);
      }

      if (!permJson.data.root_writable) {
        throw new Error(
          `Server Root (${permJson.data.root_path}) is not writable. Check file permissions.`
        );
      }
      addLog('\u2713 Permissions verified. Root is writable.');
      setProgress(10);

      // 2. Trigger Update
      setStep('downloading');
      setProgress(getProgressForStep('downloading'));
      addLog(`Downloading update v${latestVersion} from GitHub...`);

      const updateRes = await vonFetch(`${BASE_PATH}von_system.php?action=system_update_start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(getAuthHeader() ? { Authorization: getAuthHeader() } : {}),
        },
        body: JSON.stringify({
          version: latestVersion,
          download_url: downloadUrl,
          expected_hash: expectedHash || undefined,
          csrf_token: token,
        }),
      });

      const updateData = await updateRes.json();

      // Show backend logs if present
      if (updateData.logs && Array.isArray(updateData.logs)) {
        updateData.logs.forEach((msg: string) => {
          addLog(`[Server] ${msg}`);
          // Simulate progress during swap
          if (msg.includes('Swap') || msg.includes('Copying')) {
            setStep('swapping');
            setProgress(60);
          }
        });
      }

      if (
        updateData.status === 'error' ||
        (!updateData.success && updateData.status !== 'success')
      ) {
        throw new Error(updateData.message || updateData.error || 'Update script failed.');
      }

      setStep('success');
      setProgress(100);
      addLog('\u2713 Update completed successfully!');
      toast.success(`\uD83C\uDF89 VonCMS updated to v${latestVersion}!`, { duration: 5000 });
      setTimeout(onSuccess, 3000);
    } catch (err: any) {
      setStep('error');
      setErrorMsg(err.message);
      addLog(`\u2717 ERROR: ${err.message}`);
      toast.error('Update failed: ' + err.message, { duration: 5000 });
    }
  };

  return createPortal(
    <div className="fixed inset-0 w-full h-full bg-black/60 flex items-center justify-center z-[9999] animate-fade-in backdrop-blur-sm">
      <div className="bg-white dark:bg-[#1a1b26] rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden border border-slate-200 dark:border-[#2a2b36]">
        {/* Header */}
        <div className="bg-orange-600 px-6 py-4 flex items-center justify-between">
          <div className="text-white">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <RefreshCw
                className={step === 'downloading' || step === 'swapping' ? 'animate-spin' : ''}
                size={22}
              />
              System Update
            </h2>
            <p className="text-amber-100 text-sm">
              v{currentVersion} {'\u2192'}{' '}
              <span className="font-bold text-white">v{latestVersion}</span>
            </p>
          </div>
          {(step === 'idle' || step === 'error' || step === 'success') && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 text-white rounded-full transition-colors"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {step === 'idle' && (
            <>
              <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-200 dark:border-amber-700">
                <h4 className="font-bold text-amber-700 dark:text-amber-300 mb-2 flex items-center gap-2">
                  <ShieldCheck size={18} /> What will happen?
                </h4>
                <ul className="text-sm text-amber-800 dark:text-amber-200 list-disc list-inside space-y-1">
                  <li>System will download the latest core files.</li>
                  <li>
                    <strong>public/assets</strong> folder will be replaced.
                  </li>
                  <li>API files will be updated.</li>
                  <li>
                    Your <strong>von_config.php</strong>, <strong>.htaccess</strong>,{' '}
                    <strong>data</strong>, <strong>uploads</strong>, and <strong>backups</strong>{' '}
                    are protected during OTA.
                  </li>
                  <li>
                    If the release notes mention <strong>.htaccess</strong> routing or security
                    changes, run <strong>System Tools &gt; Repair .htaccess</strong> once after the
                    update.
                  </li>
                </ul>
              </div>

              <div className="max-h-40 overflow-y-auto p-3 bg-slate-100 dark:bg-[#16161e] rounded-lg text-sm border border-slate-200 dark:border-[#2a2b36]">
                <h5 className="font-bold mb-1 text-slate-700 dark:text-slate-300">
                  Release Notes:
                </h5>
                <pre className="whitespace-pre-wrap font-sans text-xs text-slate-600 dark:text-slate-400">
                  {releaseNotes}
                </pre>
              </div>
            </>
          )}

          {step !== 'idle' && (
            <div className="space-y-4">
              {/* Progress Bar (WP Bridge Style) */}
              <div>
                <div className="flex justify-between text-sm mb-1 text-slate-600 dark:text-slate-300">
                  <span>
                    Step {getCurrentStepNumber()}/{UPDATE_STEPS.length}:{' '}
                    {UPDATE_STEPS[getCurrentStepNumber() - 1]?.label || 'Processing'}
                  </span>
                  <span className="font-mono">{progress}%</span>
                </div>
                <div className="h-3 bg-slate-200 dark:bg-[#242633] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-orange-500 transition-all duration-500 ease-out"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              </div>

              {/* Terminal Log Panel */}
              <div className="bg-[#101018] text-green-400 p-4 rounded-xl font-mono text-xs h-48 overflow-y-auto shadow-inner border border-[#2a2b36]">
                {logs.map((log, i) => (
                  <div key={i} className="mb-1">
                    <span className="text-slate-500 mr-2">{'\u279C'}</span>
                    {log}
                  </div>
                ))}
                {(step === 'downloading' || step === 'swapping') && (
                  <div className="animate-pulse mt-2 text-amber-400">
                    {step === 'downloading'
                      ? '\u2B07 Downloading package...'
                      : '\uD83D\uDCE6 Installing files...'}
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 'error' && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl flex items-center gap-3 border border-red-200 dark:border-red-800">
              <AlertTriangle size={24} />
              <div>
                <p className="font-bold">Update Failed</p>
                <p className="text-sm">{errorMsg}</p>
              </div>
            </div>
          )}

          {step === 'success' && (
            <div className="bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 p-4 rounded-xl flex items-center gap-3 border border-green-200 dark:border-green-800">
              <CheckCircle2 size={24} />
              <div>
                <p className="font-bold">Update Complete!</p>
                <p className="text-sm">Reloading dashboard in 3 seconds...</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-[#2a2b36] bg-slate-50 dark:bg-[#16161e]/50 flex justify-end gap-3">
          {step === 'idle' && (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#1a1b26] rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={startUpdate}
                className="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-bold flex items-center gap-2 shadow-lg shadow-orange-500/30 transform hover:scale-105 transition-all"
              >
                <Download size={18} /> Update Now
              </button>
            </>
          )}
          {step === 'error' && (
            <button
              onClick={() => {
                setStep('idle');
                setLogs([]);
                setProgress(0);
              }}
              className="px-4 py-2 bg-slate-600 hover:bg-[#242633] text-white rounded-lg transition-colors"
            >
              Try Again
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
