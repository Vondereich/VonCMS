import React, { useEffect, useRef, useState } from 'react';
import { Upload, CheckCircle, AlertTriangle, Activity } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { API } from '../../../../config/site.config';
import { vonFetch } from '../../../../utils/api';

const CHECKPOINT_KEY = 'voncms_wp_import_checkpoint';
const BATCH_LIMIT = 10;

interface ScanStats {
  posts: number;
  pages: number;
  media: number;
  authors: any[];
}

interface ImportCheckpoint {
  fileName: string;
  tempFile: string;
  stats: ScanStats;
  sourceSiteUrl: string;
  sourceBlogUrl: string;
  nextBatchIndex: number;
  processedCount: number;
  skippedCount: number;
  importedCount: number;
  progress: number;
  logs: string[];
  lastUpdated: string;
}

export const WPMigrator: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState('');
  const [safetyChecked, setSafetyChecked] = useState(false);
  const [step, setStep] = useState<'upload' | 'scanning' | 'ready' | 'importing' | 'complete'>(
    'upload'
  );
  const [stats, setStats] = useState<ScanStats | null>(null);
  const [tempFile, setTempFile] = useState('');
  const [sourceSiteUrl, setSourceSiteUrl] = useState('');
  const [sourceBlogUrl, setSourceBlogUrl] = useState('');
  const [progress, setProgress] = useState(0);
  const [processedCount, setProcessedCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);
  const [importedCount, setImportedCount] = useState(0);
  const [nextBatchIndex, setNextBatchIndex] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [resumeCheckpoint, setResumeCheckpoint] = useState<ImportCheckpoint | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CHECKPOINT_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as ImportCheckpoint;
      if (parsed?.tempFile && parsed?.stats) {
        setResumeCheckpoint(parsed);
      }
    } catch (error) {
      // Ignore malformed checkpoints.
    }
  }, []);

  const clearCheckpoint = () => {
    try {
      window.localStorage.removeItem(CHECKPOINT_KEY);
    } catch (error) {
      // Ignore storage failures.
    }
    setResumeCheckpoint(null);
  };

  const persistCheckpoint = (payload: ImportCheckpoint) => {
    try {
      window.localStorage.setItem(CHECKPOINT_KEY, JSON.stringify(payload));
      setResumeCheckpoint(payload);
    } catch (error) {
      // Ignore storage failures.
    }
  };

  const buildCheckpoint = (overrides: Partial<ImportCheckpoint> = {}): ImportCheckpoint | null => {
    if (!stats || !tempFile) return null;

    return {
      fileName,
      tempFile,
      stats,
      sourceSiteUrl,
      sourceBlogUrl,
      nextBatchIndex,
      processedCount,
      skippedCount,
      importedCount,
      progress,
      logs,
      lastUpdated: new Date().toISOString(),
      ...overrides,
    };
  };

  const restoreCheckpoint = () => {
    if (!resumeCheckpoint) return;

    setFile(null);
    setFileName(resumeCheckpoint.fileName || '');
    setStats(resumeCheckpoint.stats);
    setTempFile(resumeCheckpoint.tempFile);
    setSourceSiteUrl(resumeCheckpoint.sourceSiteUrl || '');
    setSourceBlogUrl(resumeCheckpoint.sourceBlogUrl || '');
    setNextBatchIndex(resumeCheckpoint.nextBatchIndex || 0);
    setProcessedCount(resumeCheckpoint.processedCount || 0);
    setSkippedCount(resumeCheckpoint.skippedCount || 0);
    setImportedCount(resumeCheckpoint.importedCount || 0);
    setProgress(resumeCheckpoint.progress || 0);
    setLogs(resumeCheckpoint.logs || []);
    setStep('ready');
    toast.success('Importer checkpoint restored. Ready to resume.');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setFileName(e.target.files[0].name);
    }
  };

  const handleScan = async () => {
    if (!file) return;

    setStep('scanning');
    const formData = new FormData();
    formData.append('xml_file', file);

    try {
      const res = await vonFetch(API.wpScan, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (data.success) {
        const nextSourceSiteUrl = data.source_site_url || '';
        const nextSourceBlogUrl = data.source_blog_url || '';

        setStats(data.stats);
        setTempFile(data.temp_file);
        setSourceSiteUrl(nextSourceSiteUrl);
        setSourceBlogUrl(nextSourceBlogUrl);
        setNextBatchIndex(0);
        setProcessedCount(0);
        setSkippedCount(0);
        setImportedCount(0);
        setProgress(0);
        setLogs([]);
        setStep('ready');

        persistCheckpoint({
          fileName: file.name,
          tempFile: data.temp_file,
          stats: data.stats,
          sourceSiteUrl: nextSourceSiteUrl,
          sourceBlogUrl: nextSourceBlogUrl,
          nextBatchIndex: 0,
          processedCount: 0,
          skippedCount: 0,
          importedCount: 0,
          progress: 0,
          logs: [],
          lastUpdated: new Date().toISOString(),
        });

        toast.success('Scan complete! Ready to import.');
      } else {
        toast.error(data.message || 'Scan failed');
        setStep('upload');
      }
    } catch (err) {
      toast.error('Scan error');
      setStep('upload');
    }
  };

  const runImport = async (startBatchIndex: number, totalItems: number, initialLogs: string[]) => {
    let currentBatchIndex = startBatchIndex;
    let processedSoFar = processedCount;
    let skippedSoFar = skippedCount;
    let importedSoFar = importedCount;
    let activeSourceSiteUrl = sourceSiteUrl;
    let activeSourceBlogUrl = sourceBlogUrl;
    let logBuffer = [...initialLogs];

    const pushLog = (message: string) => {
      logBuffer = [message, ...logBuffer].slice(0, 50);
      setLogs(logBuffer);
    };

    try {
      while (true) {
        const res = await vonFetch(API.wpImport, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            temp_file: tempFile,
            batch_index: currentBatchIndex,
            limit: BATCH_LIMIT,
            source_site_url: activeSourceSiteUrl,
            source_blog_url: activeSourceBlogUrl,
          }),
        });

        const rawText = await res.text();
        let result;
        try {
          result = JSON.parse(rawText);
        } catch (error) {
          pushLog(`Server Error: ${rawText.substring(0, 150)}...`);
          throw new Error('Invalid server response (not JSON).');
        }

        if (!result.success) {
          throw new Error(result.message || 'Import stopped due to an unknown server error.');
        }

        if (result.source_site_url && !activeSourceSiteUrl) {
          activeSourceSiteUrl = result.source_site_url;
          setSourceSiteUrl(result.source_site_url);
        }

        if (result.source_blog_url && !activeSourceBlogUrl) {
          activeSourceBlogUrl = result.source_blog_url;
          setSourceBlogUrl(result.source_blog_url);
        }

        const processedInBatch = Number(result.processed_in_batch || 0);
        const skippedInBatch = Number(result.skipped_in_batch ?? result.total_skipped ?? 0);
        const importedInBatch = Number(result.imported_in_batch ?? result.total_imported ?? 0);
        const localizedMediaInBatch = Number(result.localized_media_in_batch || 0);
        const nextBatch = Number(result.next_batch_index ?? currentBatchIndex + 1);

        processedSoFar += processedInBatch;
        skippedSoFar += skippedInBatch;
        importedSoFar += importedInBatch;

        const percent =
          totalItems > 0 ? Math.min(100, Math.round((processedSoFar / totalItems) * 100)) : 100;

        setProcessedCount(processedSoFar);
        setSkippedCount(skippedSoFar);
        setImportedCount(importedSoFar);
        setProgress(percent);
        setNextBatchIndex(nextBatch);

        pushLog(
          `Batch ${currentBatchIndex + 1}: imported ${importedInBatch}, skipped ${skippedInBatch}${
            localizedMediaInBatch > 0 ? `, localized ${localizedMediaInBatch} media` : ''
          }.`
        );

        if (Array.isArray(result.errors)) {
          result.errors.forEach((message: string) => pushLog(`Warning: ${message}`));
        }

        const checkpoint = buildCheckpoint({
          sourceSiteUrl: activeSourceSiteUrl,
          sourceBlogUrl: activeSourceBlogUrl,
          nextBatchIndex: nextBatch,
          processedCount: processedSoFar,
          skippedCount: skippedSoFar,
          importedCount: importedSoFar,
          progress: percent,
          logs: logBuffer,
        });
        if (checkpoint) persistCheckpoint(checkpoint);

        if (!(result.has_more && processedInBatch > 0)) {
          break;
        }

        currentBatchIndex = nextBatch;
      }

      setStep('complete');
      setNextBatchIndex(0);
      clearCheckpoint();
      toast.success('Migration Complete!', { duration: 5000 });
    } catch (error) {
      pushLog(`Import paused: ${String(error)}`);
      setStep('ready');
      const pausedProgress =
        totalItems > 0 ? Math.min(100, Math.round((processedSoFar / totalItems) * 100)) : 0;
      setProgress(pausedProgress);

      const checkpoint = buildCheckpoint({
        sourceSiteUrl: activeSourceSiteUrl,
        sourceBlogUrl: activeSourceBlogUrl,
        nextBatchIndex: currentBatchIndex,
        processedCount: processedSoFar,
        skippedCount: skippedSoFar,
        importedCount: importedSoFar,
        progress: pausedProgress,
        logs: logBuffer,
      });
      if (checkpoint) persistCheckpoint(checkpoint);

      toast.error('Import paused. Resume will continue from the last successful batch.');
    }
  };

  const startImport = () => {
    if (!stats || !tempFile) return;

    setStep('importing');
    const total = stats.posts + stats.pages;
    const startMessage =
      nextBatchIndex > 0
        ? `Resuming migration from batch ${nextBatchIndex + 1}...`
        : 'Starting migration process...';
    const initialLogs = nextBatchIndex > 0 ? [startMessage, ...logs].slice(0, 50) : [startMessage];
    setLogs(initialLogs);

    void runImport(nextBatchIndex, total, initialLogs);
  };

  return (
    <div className="bg-white dark:bg-[#1a1b26] rounded-xl shadow-sm border border-slate-200 dark:border-[#2a2b36] p-6 animate-fade-in max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
          <Upload size={24} />
        </div>
        <div>
          <h2 className="text-xl font-bold dark:text-white">WordPress Bridge</h2>
          <p className="text-slate-500 text-sm">One-click content migrator from WP Export (XML)</p>
        </div>
      </div>

      {step === 'upload' && resumeCheckpoint && (
        <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-bold text-blue-900 dark:text-blue-100">Resume Previous Import</h3>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                {resumeCheckpoint.fileName || 'WordPress XML'} paused after{' '}
                {resumeCheckpoint.processedCount} processed items.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={restoreCheckpoint}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
              >
                Resume
              </button>
              <button
                type="button"
                onClick={clearCheckpoint}
                className="rounded-lg border border-blue-300 px-4 py-2 text-sm font-bold text-blue-700 hover:bg-white dark:border-blue-700 dark:text-blue-200 dark:hover:bg-blue-950/40"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 'upload' && (
        <div className="space-y-6">
          <div
            className="border-2 border-dashed border-slate-300 dark:border-[#333544] rounded-xl p-8 text-center hover:border-blue-500 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              id="wpmigrator-375"
              name="wpmigrator375"
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".xml"
              className="hidden"
            />
            <Upload className="mx-auto text-slate-400 mb-4" size={48} />
            {file || fileName ? (
              <div className="text-blue-600 font-medium">{file?.name || fileName}</div>
            ) : (
              <>
                <p className="font-medium dark:text-white text-lg">Click to Upload XML</p>
                <p className="text-slate-400 text-sm mt-1">Supports WordPress eXtended RSS (WXR)</p>
              </>
            )}
          </div>

          <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
            <h4 className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-200 mb-2">
              <AlertTriangle size={18} /> Safety Check
            </h4>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                id="wpmigrator-398"
                name="wpmigrator398"
                type="checkbox"
                checked={safetyChecked}
                onChange={(e) => setSafetyChecked(e.target.checked)}
                className="mt-1 w-4 h-4 text-blue-600 rounded border-slate-300"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300">
                I confirm that I have <strong>backed up my current database</strong>. I understand
                this tool will import content directly into my live site.
              </span>
            </label>
          </div>

          <button
            onClick={handleScan}
            disabled={!file || !safetyChecked}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            Start Scan
          </button>
        </div>
      )}

      {step === 'scanning' && (
        <div className="text-center py-12">
          <Activity className="animate-spin text-blue-600 mx-auto mb-4" size={48} />
          <p className="text-lg font-medium dark:text-white">Analyzing XML Structure...</p>
        </div>
      )}

      {(step === 'ready' || step === 'importing' || step === 'complete') && stats && (
        <div className="space-y-6">
          {(sourceBlogUrl || sourceSiteUrl) && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 dark:border-[#2a2b36] dark:bg-[#16161e] dark:text-slate-300">
              <div>
                <strong>Detected Source:</strong> {sourceBlogUrl || sourceSiteUrl}
              </div>
              <div className="mt-1 text-slate-500 dark:text-slate-400">
                Smart import will clean Gutenberg blocks, convert supported embeds, remap internal
                links, and localize supported WordPress images into this site's uploads.
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            <div className="bg-slate-50 dark:bg-[#16161e] p-4 rounded-lg text-center border border-slate-200 dark:border-[#2a2b36]">
              <div className="text-2xl font-bold dark:text-white">{stats.posts}</div>
              <div className="text-xs text-slate-500 uppercase tracking-wider">Posts</div>
            </div>
            <div className="bg-slate-50 dark:bg-[#16161e] p-4 rounded-lg text-center border border-slate-200 dark:border-[#2a2b36]">
              <div className="text-2xl font-bold dark:text-white">{stats.pages}</div>
              <div className="text-xs text-slate-500 uppercase tracking-wider">Pages</div>
            </div>
            <div className="bg-slate-50 dark:bg-[#16161e] p-4 rounded-lg text-center border border-slate-200 dark:border-[#2a2b36]">
              <div className="text-2xl font-bold dark:text-white">{stats.media}</div>
              <div className="text-xs text-slate-500 uppercase tracking-wider">Media Files</div>
            </div>
          </div>

          {step === 'ready' && (
            <button
              onClick={startImport}
              className="w-full py-4 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold text-lg shadow-lg hover:shadow-xl transition-all"
            >
              {nextBatchIndex > 0
                ? `Resume Import from Batch ${nextBatchIndex + 1}`
                : 'Start Import (Batch Process)'}
            </button>
          )}

          {(step === 'importing' || step === 'complete') && (
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1 dark:text-slate-300">
                  <span>Progress</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-4 bg-slate-200 dark:bg-[#242633] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>Processed: {processedCount}</span>
                  <span>Imported: {importedCount}</span>
                  <span>Skipped: {skippedCount}</span>
                </div>
              </div>

              <div className="bg-[#101018] text-slate-300 p-4 rounded-lg font-mono text-sm h-48 overflow-y-auto">
                {logs.map((log, i) => (
                  <div key={i} className="mb-1 border-b border-white/10 pb-1 last:border-0">
                    <span className="text-green-500 opacity-50 mr-2">&gt;</span>
                    {log}
                  </div>
                ))}
                {step === 'complete' && (
                  <div className="text-green-400 font-bold mt-2">All tasks finished.</div>
                )}
              </div>
            </div>
          )}

          {step === 'complete' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-600 bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                <CheckCircle size={20} />
                <span className="font-medium">
                  Import successfully completed! Check your posts.
                </span>
              </div>
              <button
                onClick={() => {
                  clearCheckpoint();
                  setFile(null);
                  setFileName('');
                  setStats(null);
                  setTempFile('');
                  setSourceSiteUrl('');
                  setSourceBlogUrl('');
                  setNextBatchIndex(0);
                  setProcessedCount(0);
                  setSkippedCount(0);
                  setImportedCount(0);
                  setProgress(0);
                  setLogs([]);
                  setSafetyChecked(false);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                  setStep('upload');
                }}
                className="w-full py-3 bg-slate-600 hover:bg-[#242633] text-white rounded-lg font-bold transition-all"
              >
                Start New Import
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
