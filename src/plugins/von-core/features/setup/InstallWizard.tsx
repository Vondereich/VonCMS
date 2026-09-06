import React, { useState } from 'react';
import {
  AlertCircle,
  Database,
  Globe,
  KeyRound,
  LockKeyhole,
  Mail,
  Server,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  UserRound,
} from 'lucide-react';
import { API } from '../../../../config/site.config';
import { vonFetch } from '../../../../utils/api';
import { useNavigate } from 'react-router';

const INSTALL_STEPS = [
  { number: '01', title: 'Database', description: 'Connect your site data' },
  { number: '02', title: 'Administrator', description: 'Create your owner account' },
  { number: '03', title: 'Ready', description: 'Open your new site' },
];

const InstallWizard: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [adminPassConfirm, setAdminPassConfirm] = useState('');

  // Password validation function
  const validatePassword = (password: string): string[] => {
    const errors: string[] = [];
    if (password.length < 8) errors.push('Minimum 8 characters');
    if (!/[A-Z]/.test(password)) errors.push('At least 1 uppercase letter');
    if (!/[0-9]/.test(password)) errors.push('At least 1 number');
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) errors.push('At least 1 special character');
    return errors;
  };

  // Form State
  const [formData, setFormData] = useState({
    dbHost: '',
    dbName: '',
    dbUser: '',
    dbPass: '',
    siteTitle: '',
    adminUsername: '',
    adminEmail: '',
    adminPass: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });

    // Real-time password validation
    if (name === 'adminPass') {
      setPasswordErrors(validatePassword(value));
    }
  };

  const handleInstall = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate password before submitting
    const pwdErrors = validatePassword(formData.adminPass);
    if (pwdErrors.length > 0) {
      setPasswordErrors(pwdErrors);
      setError('Please fix password requirements before continuing.');
      return;
    }

    if (formData.adminPass !== adminPassConfirm) {
      setError('The administrator passwords do not match.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // In Dev mode, this might hit the Node server if not proxied, but we want it to hit PHP
      // We assume the user is running the PHP server or using the proxy correctly.
      // For now, we point to the relative path which Vite proxies to PHP if configured,
      // or the Node server handles it (Node server doesn't have this endpoint implemented, so it must be PHP).

      // NOTE: In the Hybrid Dev environment, this request might fail if PHP isn't running.
      // We adding a fallback or check? No, Installation implies Production/PHP environment usually.

      const response = await vonFetch(API.install, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      // Allow mock success for dev demonstration if PHP fails (Optional, but good for UI dev)
      // if (!res.ok && import.meta.env.DEV) { ... }

      if (data.success) {
        setStep(3); // Success Step
      } else {
        setError(data.message || 'Installation failed.');
      }
    } catch (err) {
      setError('Connection failed. Make sure your PHP server is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f7f5] font-sans text-slate-950 md:grid md:grid-cols-[19rem_minmax(0,1fr)]">
      <aside className="flex flex-col bg-admin-sidebar p-6 text-white sm:p-8 md:min-h-screen md:p-10">
        <div className="border-l-2 border-blue-500 pl-4">
          <h1 className="text-xl font-semibold tracking-tight">VonCMS</h1>
          <p className="mt-1 text-sm text-[#a7aab2]">A quick, guided setup</p>
        </div>

        <ol className="mt-8 grid grid-cols-3 gap-2 md:mt-14 md:block md:space-y-1">
          {INSTALL_STEPS.map((item, index) => {
            const itemStep = index + 1;
            const isActive = itemStep === step;
            const isComplete = itemStep < step;

            return (
              <li
                key={item.number}
                aria-current={isActive ? 'step' : undefined}
                className={`border-t-2 pt-3 md:border-l-2 md:border-t-0 md:py-3 md:pl-4 ${
                  isActive
                    ? 'border-blue-500 text-white'
                    : isComplete
                      ? 'border-emerald-500 text-[#d7dae0]'
                      : 'border-[#34363c] text-[#7e828c]'
                }`}
              >
                <div className="text-xs font-medium">{item.number}</div>
                <div className="mt-1 text-sm font-semibold">{item.title}</div>
                <div className="mt-0.5 hidden text-xs text-[#9da1aa] md:block">
                  {item.description}
                </div>
              </li>
            );
          })}
        </ol>

        <p className="mt-auto hidden border-t border-[#303238] pt-6 text-xs leading-5 text-[#a7aab2] md:block">
          Keep your database details nearby. You can review them before starting the installation.
        </p>
      </aside>

      <main className="flex min-w-0 flex-col bg-[#f7f7f5] p-6 sm:p-10 lg:p-14">
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col">
          <div className="mb-10 flex items-center justify-between border-b border-[#d9d9d4] pb-4">
            <span className="text-sm font-medium text-slate-600">Step {step} of 3</span>
            <span className="text-xs text-slate-500">VonCMS v1.27</span>
          </div>

          <div className="my-auto">
            {/* STEP 1: WELCOME & DB INFO */}
            {step === 1 && (
              <div className="animate-fade-in">
                <div className="mb-9 max-w-xl">
                  <p className="mb-3 text-sm font-medium text-blue-700">First, the database</p>
                  <h2 className="text-3xl font-semibold tracking-tight text-slate-950">
                    Connect VonCMS to your database
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    You can usually find these details in your hosting control panel. Nothing is
                    saved until the final step.
                  </p>
                </div>

                <form
                  id="install-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setStep(2);
                  }}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label htmlFor="dbHost" className="text-sm font-medium text-slate-700">
                        Database host
                      </label>
                      <div className="relative">
                        <Server
                          size={16}
                          aria-hidden="true"
                          className="absolute left-3 top-3 text-slate-400"
                        />
                        <input
                          aria-label="Database host"
                          id="dbHost"
                          required
                          name="dbHost"
                          value={formData.dbHost}
                          onChange={handleChange}
                          className="w-full rounded-md border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-slate-950 outline-hidden transition-colors focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
                          placeholder="localhost"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="dbName" className="text-sm font-medium text-slate-700">
                        Database name
                      </label>
                      <div className="relative">
                        <Database
                          size={16}
                          aria-hidden="true"
                          className="absolute left-3 top-3 text-slate-400"
                        />
                        <input
                          aria-label="Database name"
                          id="dbName"
                          required
                          name="dbName"
                          value={formData.dbName}
                          onChange={handleChange}
                          className="w-full rounded-md border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-slate-950 outline-hidden transition-colors focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
                          placeholder="my_database"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="dbUser" className="text-sm font-medium text-slate-700">
                        Database username
                      </label>
                      <div className="relative">
                        <UserRound
                          size={16}
                          aria-hidden="true"
                          className="absolute left-3 top-3 text-slate-400"
                        />
                        <input
                          aria-label="Database username"
                          id="dbUser"
                          required
                          name="dbUser"
                          value={formData.dbUser}
                          onChange={handleChange}
                          className="w-full rounded-md border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-slate-950 outline-hidden transition-colors focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
                          placeholder="root"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="dbPass" className="text-sm font-medium text-slate-700">
                        Database password
                      </label>
                      <div className="relative">
                        <KeyRound
                          size={16}
                          aria-hidden="true"
                          className="absolute left-3 top-3 text-slate-400"
                        />
                        <input
                          aria-label="Database password"
                          id="dbPass"
                          type="password"
                          name="dbPass"
                          value={formData.dbPass}
                          onChange={handleChange}
                          className="w-full rounded-md border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-slate-950 outline-hidden transition-colors focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
                          placeholder="Leave blank if no password is required"
                        />
                      </div>
                    </div>
                  </div>

                  <p className="mt-4 text-xs leading-5 text-slate-500">
                    Tip: on shared hosting, the database host is usually{' '}
                    <strong className="font-semibold">localhost</strong>. Use the exact value
                    supplied by your provider.
                  </p>

                  <div className="mt-8 flex justify-end border-t border-[#dfdfda] pt-6">
                    <button
                      type="submit"
                      className="flex min-h-11 items-center gap-2 rounded-md bg-admin-sidebar px-6 py-2.5 font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                    >
                      Continue <ArrowRight size={18} />
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* STEP 2: SITE INFO & ADMIN */}
            {step === 2 && (
              <div className="animate-fade-in">
                <div className="mb-9 max-w-xl">
                  <p className="mb-3 text-sm font-medium text-blue-700">Next, your site</p>
                  <h2 className="text-3xl font-semibold tracking-tight text-slate-950">
                    Name your site and create its owner
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    This account has full control of VonCMS. Use an email address you can access.
                  </p>
                </div>

                <form onSubmit={handleInstall}>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label htmlFor="siteTitle" className="text-sm font-medium text-slate-700">
                        Site title
                      </label>
                      <div className="relative">
                        <Globe
                          size={16}
                          aria-hidden="true"
                          className="absolute left-3 top-3 text-slate-400"
                        />
                        <input
                          aria-label="Site Title"
                          id="siteTitle"
                          required
                          name="siteTitle"
                          value={formData.siteTitle}
                          onChange={handleChange}
                          className="w-full rounded-md border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-slate-950 outline-hidden transition-colors focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
                          placeholder="My News Site"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label
                          htmlFor="adminUsername"
                          className="text-sm font-medium text-slate-700"
                        >
                          Admin username
                        </label>
                        <div className="relative">
                          <UserRound
                            size={16}
                            aria-hidden="true"
                            className="absolute left-3 top-3 text-slate-400"
                          />
                          <input
                            id="adminUsername"
                            required
                            name="adminUsername"
                            value={formData.adminUsername}
                            onChange={handleChange}
                            className="w-full rounded-md border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-slate-950 outline-hidden transition-colors focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
                            placeholder="admin"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label htmlFor="adminEmail" className="text-sm font-medium text-slate-700">
                          Admin email
                        </label>
                        <div className="relative">
                          <Mail
                            size={16}
                            aria-hidden="true"
                            className="absolute left-3 top-3 text-slate-400"
                          />
                          <input
                            id="adminEmail"
                            required
                            type="email"
                            name="adminEmail"
                            value={formData.adminEmail}
                            onChange={handleChange}
                            className="w-full rounded-md border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-slate-950 outline-hidden transition-colors focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
                            placeholder="admin@example.com"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="adminPass" className="text-sm font-medium text-slate-700">
                        Admin password
                      </label>
                      <div className="relative">
                        <LockKeyhole
                          size={16}
                          aria-hidden="true"
                          className="absolute left-3 top-3 text-slate-400"
                        />
                        <input
                          aria-label="Admin Password"
                          id="adminPass"
                          required
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="new-password"
                          name="adminPass"
                          value={formData.adminPass}
                          onChange={handleChange}
                          className={`w-full rounded-md border bg-white py-2.5 pl-10 pr-10 text-slate-950 outline-hidden transition-colors focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 ${passwordErrors.length > 0 && formData.adminPass ? 'border-red-500' : 'border-slate-300'}`}
                          placeholder="Create a strong password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                          aria-pressed={showPassword}
                          className="absolute right-3 top-3 text-slate-400 transition-colors hover:text-slate-950"
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                      {formData.adminPass && (
                        <div className="mt-2 space-y-1">
                          {[
                            'Minimum 8 characters',
                            'At least 1 uppercase letter',
                            'At least 1 number',
                            'At least 1 special character',
                          ].map((req) => {
                            const isPassed = !passwordErrors.includes(req);
                            return (
                              <div
                                key={req}
                                className={`flex items-center gap-2 text-xs ${isPassed ? 'text-emerald-700' : 'text-red-600'}`}
                              >
                                {isPassed ? <Check size={12} /> : <AlertCircle size={12} />}
                                {req}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <label
                        htmlFor="adminPassConfirm"
                        className="text-sm font-medium text-slate-700"
                      >
                        Confirm admin password
                      </label>
                      <div className="relative">
                        <KeyRound
                          size={16}
                          aria-hidden="true"
                          className="absolute left-3 top-3 text-slate-400"
                        />
                        <input
                          id="adminPassConfirm"
                          required
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="new-password"
                          value={adminPassConfirm}
                          onChange={(event) => setAdminPassConfirm(event.target.value)}
                          aria-invalid={
                            adminPassConfirm.length > 0 && adminPassConfirm !== formData.adminPass
                          }
                          className={`w-full rounded-md border bg-white py-2.5 pl-10 pr-4 text-slate-950 outline-hidden transition-colors focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 ${adminPassConfirm.length > 0 && adminPassConfirm !== formData.adminPass ? 'border-red-500' : 'border-slate-300'}`}
                          placeholder="Enter the same password again"
                        />
                      </div>
                      {adminPassConfirm.length > 0 && adminPassConfirm !== formData.adminPass && (
                        <p className="text-xs text-red-600">Passwords do not match yet.</p>
                      )}
                    </div>
                  </div>

                  {error && (
                    <div
                      role="alert"
                      aria-live="assertive"
                      className="mt-4 flex items-center gap-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                    >
                      <AlertCircle size={18} />
                      {error}
                    </div>
                  )}

                  <div className="mt-10 flex justify-between border-t border-[#dfdfda] pt-6">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="min-h-11 px-2 font-medium text-slate-600 transition-colors hover:text-slate-950"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex min-h-11 items-center gap-2 rounded-md bg-admin-sidebar px-8 py-2.5 font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {loading ? 'Setting up your site...' : 'Create Site'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* STEP 3: SUCCESS */}
            {step === 3 && (
              <div className="animate-fade-in py-8">
                <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-md bg-emerald-600">
                  <Check size={28} className="text-white" />
                </div>
                <p className="mb-3 text-sm font-medium text-emerald-700">Setup complete</p>
                <h2 className="text-3xl font-semibold tracking-tight text-slate-950">
                  Your site is ready
                </h2>
                <p className="mb-4 mt-3 max-w-md text-sm leading-6 text-slate-600">
                  VonCMS is installed, your database is connected, and the administrator account is
                  ready to use.
                </p>
                <p className="mb-8 max-w-md text-xs leading-5 text-slate-500">
                  <span className="font-semibold text-slate-700">Next:</span> Review your site
                  identity, Domain URL, and email settings from the dashboard.
                </p>

                <button
                  onClick={() => navigate('/login')}
                  className="min-h-11 rounded-md bg-admin-sidebar px-8 py-3 font-semibold text-white transition-colors hover:bg-blue-700"
                >
                  Login to Dashboard
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default InstallWizard;
