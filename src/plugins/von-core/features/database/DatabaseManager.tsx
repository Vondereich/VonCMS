import React, { useState } from 'react';
import toast from 'react-hot-toast';
import {
  Database,
  Play,
  Shield,
  Download,
  Upload,
  Plus,
  Trash2,
  RefreshCw,
  Server,
  Search,
} from 'lucide-react';
import { SqlResult } from '../../../../types';
import { API } from '../../../../config/site.config';
import { vonFetch } from '../../../../utils/api';

const DatabaseManager: React.FC = () => {
  // --- STATE MANAGEMENT ---
  const [databases, setDatabases] = useState<string[]>([]);
  const [selectedDb, setSelectedDb] = useState('Checking...'); // Dynamic Load
  const [isConnected] = useState(true);

  // Query State
  const [query, setQuery] = useState('SELECT * FROM users LIMIT 10;');
  const [result, setResult] = useState<SqlResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Load Tables on Mount
  React.useEffect(() => {
    const fetchTables = async () => {
      try {
        // Get Current DB Name
        const dbRes = await vonFetch(API.dbQuery, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: 'SELECT DATABASE() as name' }),
        });
        const dbData = await dbRes.json();
        if (dbData.success && dbData.data && dbData.data.length > 0) {
          setSelectedDb(dbData.data[0][0]);
        }

        // Get Tables
        const response = await vonFetch(API.dbQuery, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: 'SHOW TABLES' }),
        });
        const data = await response.json();
        if (data.success && data.data) {
          // Flatten the array of arrays [[table1], [table2]] -> [table1, table2]
          setDatabases(data.data.map((row: any[]) => row[0]));
        }
      } catch (e) {
        console.error('Failed to load tables', e);
        setSelectedDb('Connection Error');
      }
    };
    fetchTables();
  }, []);

  // --- ACTIONS ---

  const [safeMode, setSafeMode] = useState(true);

  const handleRunQuery = async () => {
    const destructiveKeywords = ['DROP', 'DELETE', 'TRUNCATE', 'ALTER', 'UPDATE', 'INSERT'];
    const upperQuery = query.toUpperCase();
    const isDestructive = destructiveKeywords.some((kw) => upperQuery.includes(kw));

    if (isDestructive) {
      if (safeMode) {
        toast.error(
          "Safety Block: Destructive queries are disabled in Safe Mode. Click 'SAFE MODE' to disable it if you are sure."
        );
        return;
      }

      if (
        !window.confirm(
          'WARNING: You are about to execute a destructive query. This cannot be undone. Are you sure?'
        )
      ) {
        return;
      }
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await vonFetch(API.dbQuery, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      const data = await response.json();

      if (data.success) {
        setResult({
          success: true,
          message: data.message,
          headers: data.headers,
          data: data.data,
        });

        if (isDestructive) {
          toast.success('Query executed successfully.');
          // Refresh tables if schema changed
          if (upperQuery.includes('CREATE') || upperQuery.includes('DROP')) {
            window.location.reload();
          }
        }
      } else {
        setResult({
          success: false,
          message: data.message,
          headers: [],
          data: [],
        });
      }
    } catch (error) {
      setResult({
        success: false,
        message: 'Network Error: Failed to connect to database API.',
        headers: [],
        data: [],
      });
    } finally {
      setLoading(false);
    }
  };

  const handleImportClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.sql';

    const uploadImportFile = async (file: File, confirmDestructive = false): Promise<void> => {
      const formData = new FormData();
      formData.append('sqlfile', file);
      if (confirmDestructive) {
        formData.append('confirm_destructive_import', 'yes');
      }

      const response = await vonFetch(API.importDb, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();

      if (data.success) {
        const backupNote = data.safetyBackup?.filename
          ? ` Safety backup: ${data.safetyBackup.filename}`
          : '';
        toast.success(`Import successful! ${data.message}${backupNote}`);
        // Refresh tables list
        window.location.reload();
        return;
      }

      if (data.requiresConfirmation) {
        const tables =
          Array.isArray(data.destructiveTables) && data.destructiveTables.length > 0
            ? `\n\nAffected tables: ${data.destructiveTables.slice(0, 12).join(', ')}${
                data.destructiveTables.length > 12 ? ', ...' : ''
              }`
            : '';
        const confirmed = window.confirm(
          `${data.message}\n\nVonCMS will create a server-side pre-import safety backup before continuing.${tables}\n\nContinue import?`
        );
        if (confirmed) {
          await uploadImportFile(file, true);
        } else {
          toast.error('Import cancelled.');
        }
        return;
      }

      const importError = data.error || data.message || 'Unknown import error';
      toast.error(`Import failed: ${importError}`);
    };

    input.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (file) {
        setIsImporting(true);
        try {
          await uploadImportFile(file);
        } catch (error) {
          toast.error('Import failed: Network error');
        } finally {
          setIsImporting(false);
        }
      }
    };
    input.click();
  };

  const handleBackupClick = async () => {
    // Generate CSRF token for secure POST
    const { getCsrfToken } = await import('../../../../utils/security');
    const token = await getCsrfToken();

    // 1.6 Backup DB CSRF leakage (Fix)
    // Use dynamic form for POST-based file download.
    // This prevents the token from appearing in the URL query string.
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = API.backupDb;
    form.target = '_blank';

    const tokenInput = document.createElement('input');
    tokenInput.type = 'hidden';
    tokenInput.name = 'csrf_token';
    tokenInput.value = token;

    form.appendChild(tokenInput);
    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
  };

  const [isRepairing, setIsRepairing] = useState(false);

  const handleRepairClick = async () => {
    if (
      !confirm(
        'This will repair common VonCMS schema issues such as missing tables, columns, and indexes. It does not repair low-level MySQL table corruption. Continue?'
      )
    )
      return;
    setIsRepairing(true);
    try {
      const response = await vonFetch(API.repairDb, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      if (data.success) {
        toast.success(data.message);
        if (data.repaired) {
          window.location.reload();
        }
      } else {
        toast.error('Repair failed: ' + data.message);
      }
    } catch (error) {
      toast.error('Repair failed: Network Error');
    } finally {
      setIsRepairing(false);
    }
  };

  return (
    <div className="h-full flex flex-col space-y-6">
      {/* Header Area */}
      <div className="flex justify-between items-center bg-white dark:bg-[#1a1b26] p-4 rounded-xl border border-slate-200 dark:border-[#2a2b36] shadow-sm">
        <div className="flex items-center gap-3">
          <div
            className={`p-2 rounded-lg ${isConnected ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}
          >
            <Server size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-white">Database Manager</h2>
            <div className="flex items-center gap-2 text-xs">
              <span
                className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}
              ></span>
              <span className="text-slate-500">{isConnected ? 'Connected' : 'Disconnected'}</span>
              <span className="text-slate-300">|</span>
              <span className="text-blue-500 font-bold uppercase tracking-wider">
                System Managed
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleImportClick}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-[#242633] dark:text-slate-300 rounded-lg text-sm font-medium transition-colors"
          >
            {isImporting ? <RefreshCw size={16} className="animate-spin" /> : <Upload size={16} />}{' '}
            Import SQL
          </button>
          <button
            onClick={handleRepairClick}
            className="flex items-center gap-2 px-4 py-2 bg-yellow-50 text-yellow-600 hover:bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400 rounded-lg text-sm font-medium transition-colors"
          >
            {isRepairing ? <RefreshCw size={16} className="animate-spin" /> : <Shield size={16} />}{' '}
            Schema Repair
          </button>
          <button
            onClick={handleBackupClick}
            className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 rounded-lg text-sm font-medium transition-colors"
          >
            <Download size={16} /> Backup
          </button>
        </div>
      </div>

      <div className="flex-grow flex flex-col lg:flex-row gap-6 h-full min-h-[500px]">
        {/* LEFT SIDEBAR: DB List */}
        <div className="lg:w-1/3 flex flex-col gap-6">
          {/* Database List Box */}
          <div className="bg-white dark:bg-[#1a1b26] rounded-xl border border-slate-200 dark:border-[#2a2b36] flex-grow flex flex-col overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-100 dark:border-[#2a2b36] flex justify-between items-center bg-slate-50 dark:bg-[#16161e]/50">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">Tables</h3>
              <button
                onClick={() =>
                  setQuery(
                    'CREATE TABLE new_table (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255));'
                  )
                }
                className="p-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                title="Create Table"
              >
                <Plus size={16} />
              </button>
            </div>
            <div className="overflow-y-auto flex-grow p-2 space-y-1">
              {databases.map((db) => (
                <div
                  key={db}
                  onClick={() => {
                    setSelectedDb(db);
                    setQuery(`SELECT * FROM ${db} LIMIT 50;`);
                  }}
                  className={`group flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-all ${selectedDb === db ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-900' : 'hover:bg-slate-50 dark:hover:bg-[#242633]/50 text-slate-600 dark:text-slate-400'}`}
                >
                  <div className="flex items-center gap-3">
                    <Database size={16} className={selectedDb === db ? 'fill-current' : ''} />
                    <span className="text-sm font-medium">{db}</span>
                  </div>
                  {selectedDb === db && (
                    <span className="text-[10px] font-bold bg-blue-200 dark:bg-blue-800 px-1.5 rounded text-blue-800 dark:text-blue-100">
                      SELECTED
                    </span>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setQuery(`DROP TABLE ${db};`);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 p-1"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT MAIN: SQL Editor & Results */}
        <div className="lg:w-2/3 flex flex-col gap-6 min-h-0">
          {/* SQL Editor Card */}
          <div className="flex-[0.4] min-h-[200px] flex flex-col bg-[#101018] rounded-2xl shadow-xl border border-white/10 overflow-hidden ring-1 ring-white/5">
            {/* Editor Toolbar */}
            <div className="bg-[#101018]/80 backdrop-blur-md px-4 py-3 border-b border-white/10 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  SQL Editor <span className="text-slate-600 mx-1">/</span>{' '}
                  <span className="text-yellow-400">{selectedDb}</span>
                </span>
              </div>
              <button
                onClick={() => setSafeMode(!safeMode)}
                className={`text-[9px] font-black uppercase tracking-widest flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all duration-300 ${
                  safeMode
                    ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20 hover:bg-emerald-400/20'
                    : 'text-rose-400 bg-rose-400/10 border-rose-400/20 hover:bg-rose-400/20 animate-pulse'
                }`}
              >
                <Shield size={12} className={safeMode ? '' : 'animate-bounce'} />
                {safeMode ? 'Safe Mode Active' : 'Danger: No Safety'}
              </button>
            </div>

            <div className="flex-1 relative group">
              <textarea
                id="databasemanager-388"
                name="databasemanager388"
                aria-label="Text Content"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="absolute inset-0 w-full h-full bg-[#101018]/50 text-emerald-400 font-mono p-6 text-sm focus:outline-none resize-none placeholder-slate-700 selection:bg-emerald-500/20"
                spellCheck={false}
                placeholder="-- Write your SQL query here..."
              />
            </div>

            <div className="bg-[#101018]/50 px-6 py-4 flex justify-between items-center border-t border-white/10">
              <div className="flex items-center gap-4">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  Ready to execute
                </p>
                <div className="h-1 w-12 bg-[#1a1b26] rounded-full overflow-hidden">
                  <div
                    className={`h-full bg-emerald-500 transition-all duration-1000 ${loading ? 'w-full' : 'w-0'}`}
                  ></div>
                </div>
              </div>
              <button
                onClick={handleRunQuery}
                disabled={loading}
                className="group flex items-center gap-3 px-8 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-emerald-900/40 transition-all transform active:scale-95 disabled:opacity-50 disabled:scale-100"
              >
                {loading ? (
                  <RefreshCw size={16} className="animate-spin" />
                ) : (
                  <>
                    <Play
                      size={16}
                      className="transition-transform group-hover:scale-125"
                      fill="currentColor"
                    />
                    Run Query
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Results Area */}
          <div className="flex-[0.6] flex flex-col bg-white dark:bg-[#16161e] rounded-2xl shadow-xl border border-slate-200 dark:border-white/10 overflow-hidden min-h-0 ring-1 ring-black/5 dark:ring-white/5">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-white/10 bg-slate-50/50 dark:bg-[#101018]/50 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <Search size={16} className="text-slate-400" />
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  Execution Results
                </h3>
              </div>
              {result && (
                <div className="flex items-center gap-3">
                  <div className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-[10px] font-black uppercase tracking-widest">
                    {result.data?.length || 0} ROWS
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 italic">
                    {result.message}
                  </span>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-auto bg-slate-50/20 dark:bg-[#16161e]/20 custom-scrollbar">
              {result ? (
                <div className="min-w-full inline-block align-middle">
                  <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-left">
                    <thead className="bg-white dark:bg-[#101018] sticky top-0 z-10 shadow-sm">
                      <tr>
                        {result.headers?.map((h) => (
                          <th
                            key={h}
                            className="px-6 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest"
                          >
                            <div className="flex items-center gap-2">
                              {h}
                              <div className="w-1 h-3 bg-slate-200 dark:bg-[#1a1b26] rounded-full"></div>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-transparent divide-y divide-slate-100 dark:divide-slate-800/50">
                      {result.data?.map((row, i) => (
                        <tr
                          key={i}
                          className="hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors group"
                        >
                          {row.map((c: any, j: number) => (
                            <td
                              key={j}
                              className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400 font-mono whitespace-nowrap group-hover:text-blue-600 dark:group-hover:text-blue-400"
                            >
                              {c === null ? (
                                <span className="text-slate-300 italic text-[10px]">NULL</span>
                              ) : (
                                c
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {result.data?.length === 0 && (
                    <div className="flex flex-col items-center justify-center p-20 text-slate-400 gap-4">
                      <Database size={48} className="opacity-10" />
                      <p className="text-xs font-bold uppercase tracking-widest opacity-40">
                        Command executed (Empty Result)
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-6 p-20">
                  <div className="relative">
                    <div className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full"></div>
                    <Search size={64} className="opacity-10 relative z-10" />
                  </div>
                  <div className="text-center space-y-2 relative z-10">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">
                      Ready Terminal
                    </p>
                    <p className="text-sm italic opacity-30">Waiting for query execution...</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DatabaseManager;
