import React, { useState } from 'react';
import {
  AlertCircle,
  Database,
  Globe,
  Server,
  Shield,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
} from 'lucide-react';
import { API } from '../../../../config/site.config';
import { vonFetch } from '../../../../utils/api';
import { useNavigate } from 'react-router-dom';

const InstallWizard: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);
  const [showPassword, setShowPassword] = useState(false);

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
    <div className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-100 p-4 font-sans relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 opacity-20 pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-purple-600 rounded-full blur-[120px]" />
        <div className="absolute top-[40%] -right-[10%] w-[40%] h-[60%] bg-blue-600 rounded-full blur-[120px]" />
      </div>

      <div className="w-full max-w-2xl bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl relative z-10 overflow-hidden">
        {/* Header */}
        <div className="bg-white/5 p-6 border-b border-white/5 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg">
              <Database size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">VonCMS Installer</h1>
              <p className="text-xs text-slate-400">System Setup Wizard v1.25 "OpenGate"</p>
            </div>
          </div>
          <div className="flex gap-2">
            <div className={`w-3 h-3 rounded-full ${step >= 1 ? 'bg-blue-500' : 'bg-slate-700'}`} />
            <div className={`w-3 h-3 rounded-full ${step >= 2 ? 'bg-blue-500' : 'bg-slate-700'}`} />
            <div
              className={`w-3 h-3 rounded-full ${step >= 3 ? 'bg-green-500' : 'bg-slate-700'}`}
            />
          </div>
        </div>

        {/* Content */}
        <div className="p-8">
          {/* STEP 1: WELCOME & DB INFO */}
          {step === 1 && (
            <div className="animate-fade-in space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold mb-2">Welcome to your new site</h2>
                <p className="text-slate-400">
                  Let's connect to your database. You will need your MySQL connection details.
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
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-slate-500 uppercase">
                      Database Host
                    </span>
                    <div className="relative">
                      <Server size={16} className="absolute left-3 top-3 text-slate-500" />
                      <input
                        aria-label="localhost"
                        required
                        name="dbHost"
                        value={formData.dbHost}
                        onChange={handleChange}
                        className="w-full bg-slate-800/50 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="localhost"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-slate-500 uppercase">
                      Database Name
                    </span>
                    <div className="relative">
                      <Database size={16} className="absolute left-3 top-3 text-slate-500" />
                      <input
                        aria-label="my_database"
                        required
                        name="dbName"
                        value={formData.dbName}
                        onChange={handleChange}
                        className="w-full bg-slate-800/50 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="my_database"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-slate-500 uppercase">
                      Database User
                    </span>
                    <div className="relative">
                      <Shield size={16} className="absolute left-3 top-3 text-slate-500" />
                      <input
                        aria-label="root"
                        required
                        name="dbUser"
                        value={formData.dbUser}
                        onChange={handleChange}
                        className="w-full bg-slate-800/50 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="root"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-slate-500 uppercase">
                      Database Password
                    </span>
                    <div className="relative">
                      <Shield size={16} className="absolute left-3 top-3 text-slate-500" />
                      <input
                        aria-label="Leave empty if none"
                        type="password"
                        name="dbPass"
                        value={formData.dbPass}
                        onChange={handleChange}
                        className="w-full bg-slate-800/50 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Leave empty if none"
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex justify-end">
                  <button
                    type="submit"
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-lg font-bold transition-all shadow-lg shadow-blue-600/20"
                  >
                    Next Step <ArrowRight size={18} />
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* STEP 2: SITE INFO & ADMIN */}
          {step === 2 && (
            <div className="animate-fade-in space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold mb-2">Create Administrator</h2>
                <p className="text-slate-400">Set up your site details and admin account.</p>
              </div>

              <form onSubmit={handleInstall}>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-slate-500 uppercase">Site Title</span>
                    <div className="relative">
                      <Globe size={16} className="absolute left-3 top-3 text-slate-500" />
                      <input
                        aria-label="Site Title"
                        required
                        name="siteTitle"
                        value={formData.siteTitle}
                        onChange={handleChange}
                        className="w-full bg-slate-800/50 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-slate-500 uppercase">
                        Admin Username
                      </span>
                      <input
                        aria-label="admin"
                        required
                        name="adminUsername"
                        value={formData.adminUsername}
                        onChange={handleChange}
                        className="w-full bg-slate-800/50 border border-slate-700 rounded-lg py-2.5 px-4 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="admin"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-slate-500 uppercase">
                        Admin Email
                      </span>
                      <input
                        aria-label="admin@example.com"
                        required
                        type="email"
                        name="adminEmail"
                        value={formData.adminEmail}
                        onChange={handleChange}
                        className="w-full bg-slate-800/50 border border-slate-700 rounded-lg py-2.5 px-4 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="admin@example.com"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-slate-500 uppercase">
                      Admin Password
                    </span>
                    <div className="relative">
                      <input
                        aria-label="Admin Password"
                        required
                        type={showPassword ? 'text' : 'password'}
                        name="adminPass"
                        value={formData.adminPass}
                        onChange={handleChange}
                        className={`w-full bg-slate-800/50 border rounded-lg py-2.5 pl-4 pr-10 text-white focus:ring-2 focus:ring-blue-500 outline-none ${passwordErrors.length > 0 && formData.adminPass ? 'border-red-500' : 'border-slate-700'}`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3 text-slate-400 hover:text-white transition-colors"
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
                              className={`flex items-center gap-2 text-xs ${isPassed ? 'text-green-400' : 'text-red-400'}`}
                            >
                              {isPassed ? <Check size={12} /> : <AlertCircle size={12} />}
                              {req}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {error && (
                  <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3 text-red-400 text-sm">
                    <AlertCircle size={18} />
                    {error}
                  </div>
                )}

                <div className="mt-8 flex justify-between">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="text-slate-400 hover:text-white px-4"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-8 py-2.5 rounded-lg font-bold transition-all shadow-lg shadow-green-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Installing...' : 'Install Now'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* STEP 3: SUCCESS */}
          {step === 3 && (
            <div className="animate-fade-in text-center py-8">
              <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-green-500/30">
                <Check size={40} className="text-white" />
              </div>
              <h2 className="text-3xl font-bold text-white mb-2">Success!</h2>
              <p className="text-slate-400 mb-8 max-w-md mx-auto">
                VonCMS has been installed. Your database is ready and your admin account is active.
              </p>

              <button
                onClick={() => navigate('/login')}
                className="bg-white text-slate-900 px-8 py-3 rounded-lg font-bold hover:bg-slate-100 transition-colors shadow-lg"
              >
                Login to Dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InstallWizard;
