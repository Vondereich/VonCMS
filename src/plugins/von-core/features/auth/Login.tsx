/// <reference types="vite/client" />
import { hasPasswordSpecialCharacter } from '../../../../utils/security';
import React, { useState } from 'react';
import {
  LockKeyhole,
  UserRound,
  ShieldCheck,
  Eye,
  EyeOff,
  Mail,
  ArrowLeft,
  ArrowRightToLine,
  UserRoundPlus,
  House,
} from 'lucide-react';
import { User as UserType, SiteSettings } from '../../../../types';
import { vonFetch } from '../../../../utils/api';
import { setCsrfToken } from '../../../../utils/security';
import { BASE_PATH, API } from '../../../../config/site.config';
import { VonLogo } from '../../../../components/VonLogo';

interface LoginProps {
  onLogin: (user: UserType) => void;
  isModal?: boolean;
  settings?: SiteSettings;
}

type AuthView = 'login' | 'register' | 'register-success' | 'forgot' | 'reset';

const VpLogin: React.FC<LoginProps> = ({ onLogin, isModal = false, settings }) => {
  const [view, setView] = useState<AuthView>('login');
  const [resetToken] = useState(
    () => new URLSearchParams(window.location.search).get('reset_token') || ''
  );

  const registrationEnabled = settings?.registrationEnabled ?? true;

  // Form States
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resendingVerification, setResendingVerification] = useState(false);
  const [verificationRequired, setVerificationRequired] = useState(false);
  const credentialRevision = React.useRef(0);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [registrationResult, setRegistrationResult] = useState<{
    message: string;
    emailSent: boolean;
  } | null>(null);

  // Rate Limiting State
  const [attempts, setAttempts] = useState(0);
  const [lockoutTime, setLockoutTime] = useState<number | null>(null);

  React.useEffect(() => {
    // Check for Lockout
    const stored = localStorage.getItem('login_lockout');
    if (stored) {
      const unlockTime = parseInt(stored, 10);
      if (Date.now() < unlockTime) {
        setLockoutTime(unlockTime);
      } else {
        localStorage.removeItem('login_lockout');
      }
    }

    // Check for Session Message (Auto-Kick Reason)
    const sessionMsg = sessionStorage.getItem('von_session_message');
    if (sessionMsg) {
      setMessage({ type: 'error', text: sessionMsg });
      sessionStorage.removeItem('von_session_message'); // Clear it so it shows only once
    }
  }, []);

  const clearForm = () => {
    credentialRevision.current += 1;
    setVerificationRequired(false);
    setUsername('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setHoneypot('');
    setMessage(null);
    setRegistrationResult(null);
  };

  // === LOGIN HANDLER ===
  const handleLoginSubmit = async (e: React.SyntheticEvent, resendVerification = false) => {
    e.preventDefault();

    if (lockoutTime && Date.now() < lockoutTime) {
      setMessage({
        type: 'error',
        text: `Too many attempts. Try again in ${Math.ceil((lockoutTime - Date.now()) / 60000)} minutes.`,
      });
      return;
    }

    if (!username) {
      setMessage({ type: 'error', text: 'Please enter your username or email.' });
      return;
    }
    if (!password || password.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters.' });
      return;
    }
    if (honeypot) {
      setMessage({ type: 'error', text: 'Login failed.' });
      return;
    }

    const submittedRevision = credentialRevision.current;
    if (!resendVerification) setVerificationRequired(false);
    setLoading(true);
    setMessage(null);
    setResendingVerification(resendVerification);

    try {
      const apiUrl = API.login;
      const response = await vonFetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password,
          hp_field: honeypot,
          remember_me: rememberMe,
          action: resendVerification ? 'resend_verification' : 'login',
        }),
      });

      const data = await response.json();

      // Verification feedback belongs to the submitted credentials, not later edits.
      // A successful login still owns the server session and must be handled.
      if (
        submittedRevision !== credentialRevision.current &&
        !(data.success && !resendVerification)
      ) {
        return;
      }

      if (data.success) {
        if (resendVerification) {
          setMessage({ type: 'success', text: data.message });
          return;
        }
        if (data.csrf_token) {
          setCsrfToken(data.csrf_token);
        }
        onLogin(data.user);
        setAttempts(0);
        localStorage.removeItem('login_lockout');
      } else {
        const needsVerification =
          response.status === 403 && data.error === 'Please verify your email before logging in.';
        if (needsVerification) setVerificationRequired(true);
        if (resendVerification || needsVerification) {
          setMessage({
            type: 'error',
            text: data.error || 'Verification email could not be sent.',
          });
          return;
        }
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);

        if (newAttempts >= 5) {
          const lockout = Date.now() + 15 * 60 * 1000;
          setLockoutTime(lockout);
          localStorage.setItem('login_lockout', lockout.toString());
          setMessage({
            type: 'error',
            text: 'Too many failed attempts. Locked out for 15 minutes.',
          });
        } else {
          setMessage({
            type: 'error',
            text: data.error || data.message || 'Invalid username or password.',
          });
        }
      }
    } catch {
      if (submittedRevision === credentialRevision.current) {
        setMessage({ type: 'error', text: 'Connection error. Please check your network.' });
      }
    } finally {
      setLoading(false);
      setResendingVerification(false);
    }
  };

  // === REGISTER HANDLER ===
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username || username.length < 3) {
      setMessage({ type: 'error', text: 'Username must be at least 3 characters.' });
      return;
    }
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      setMessage({ type: 'error', text: 'Please enter a valid email address.' });
      return;
    }
    if (
      password.length < 8 ||
      !/[A-Z]/.test(password) ||
      !/[0-9]/.test(password) ||
      !hasPasswordSpecialCharacter(password)
    ) {
      setMessage({
        type: 'error',
        text: 'Password must be at least 8 characters with at least one uppercase, one number, and one special character.',
      });
      return;
    }
    if (password !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match.' });
      return;
    }
    if (honeypot) {
      setMessage({ type: 'error', text: 'Registration failed.' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const apiUrl = API.register;
      const response = await vonFetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password, confirmPassword, hp_field: honeypot }),
      });

      const data = await response.json();

      if (data.success) {
        setUsername('');
        setEmail('');
        setPassword('');
        setConfirmPassword('');
        setHoneypot('');
        if (data.user) {
          onLogin(data.user);
        } else {
          setRegistrationResult({
            message: data.message || 'Your account has been created.',
            emailSent: data.emailSent === true,
          });
          setMessage(null);
          setView('register-success');
        }
      } else {
        // Registration failures intentionally retain the submitted fields for correction.
        setMessage({ type: 'error', text: data.error || data.message || 'Registration failed.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Connection error. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  // === FORGOT PASSWORD HANDLER ===
  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await vonFetch(API.resetPassword, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request', email, hp_field: honeypot }),
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: data.message });
      } else {
        setMessage({ type: 'error', text: data.error || data.message || 'Request failed' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error. Try again.' });
    } finally {
      setLoading(false);
    }
  };

  // === NEW PASSWORD HANDLER (FROM EMAIL LINK) ===
  const handleNewPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match.' });
      return;
    }

    setLoading(true);
    try {
      const response = await vonFetch(API.resetPassword, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reset',
          token: resetToken,
          password,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: 'Password Reset! redirecting to login...' });
        setTimeout(() => {
          window.location.href = BASE_PATH + 'login';
        }, 3000);
      } else {
        setMessage({ type: 'error', text: data.error || data.message || 'Reset failed' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error.' });
    } finally {
      setLoading(false);
    }
  };

  // Check for Reset Token on Load
  React.useLayoutEffect(() => {
    if (resetToken) {
      setView('reset');

      // Clear the credential before passive effects such as analytics can run.
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete('reset_token');
      const cleanPath = `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`;
      window.history.replaceState(window.history.state, '', cleanPath);
    }
  }, [resetToken]);

  // Solid auth surface classes
  const outerClass = isModal
    ? 'flex items-center justify-center font-sans bg-transparent'
    : 'min-h-screen flex items-center justify-center bg-[#e7e9eb] px-4 py-10 font-sans dark:bg-admin-inset';

  const cardClass = `w-full ${view === 'register' ? 'max-w-160' : 'max-w-lg'} rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-admin-border dark:bg-admin-panel ${
    isModal ? 'max-h-[calc(100dvh-8rem)] overflow-y-auto' : 'overflow-hidden'
  }`;
  const labelClass =
    'mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-slate-600 dark:text-gray-400';
  const inputClass =
    'block w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-slate-900 outline-hidden transition-colors placeholder:text-slate-400 focus:border-[#202124] focus:ring-4 focus:ring-slate-500/10 dark:border-admin-border-strong dark:bg-admin-inset dark:text-white dark:placeholder:text-gray-500 dark:focus:border-gray-300 dark:focus:ring-gray-300/10';
  const iconInputClass =
    'block w-full rounded-xl border border-slate-300 bg-white py-3.5 pl-11 pr-4 text-slate-900 outline-hidden transition-colors placeholder:text-slate-400 focus:border-[#202124] focus:ring-4 focus:ring-slate-500/10 dark:border-admin-border-strong dark:bg-admin-inset dark:text-white dark:placeholder:text-gray-500 dark:focus:border-gray-300 dark:focus:ring-gray-300/10';
  const registrationLabelClass =
    'mb-1.5 block text-xs font-semibold text-slate-700 dark:text-gray-300';
  const registrationInputClass = `${inputClass.replace('py-3.5', 'py-3')} text-base sm:text-sm`;
  const primaryButtonClass =
    'flex w-full items-center justify-center gap-2 rounded-xl bg-black font-bold text-white transition-colors hover:bg-neutral-900 disabled:cursor-not-allowed disabled:opacity-50 dark:ring-1 dark:ring-neutral-700';
  const headerIcon =
    view === 'login' ? (
      <VonLogo variant="simple" className="h-10 w-10 text-black dark:text-white" />
    ) : view === 'register' ? (
      <UserRoundPlus size={28} />
    ) : view === 'register-success' ? (
      <ShieldCheck size={28} />
    ) : view === 'forgot' ? (
      <Mail size={28} />
    ) : (
      <LockKeyhole size={28} />
    );

  return (
    <div className={outerClass}>
      <div className={cardClass} data-auth-view={view}>
        {/* Header */}
        <div
          className={
            view === 'register'
              ? 'px-6 pt-6 text-center sm:px-8'
              : 'border-b border-slate-200 bg-black p-6 text-center dark:border-admin-border dark:bg-black'
          }
        >
          <div
            className={
              view === 'register'
                ? 'mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-900 dark:bg-neutral-900 dark:text-white'
                : view === 'login'
                  ? 'mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900'
                  : 'mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-neutral-700 bg-neutral-900 text-slate-100 shadow-lg shadow-slate-950/20 dark:text-gray-100 dark:shadow-none'
            }
          >
            {headerIcon}
          </div>
          <h2
            className={`mb-1 text-2xl font-bold tracking-tight ${view === 'register' ? 'text-slate-900 dark:text-white' : 'text-white'}`}
          >
            {view === 'login'
              ? 'Welcome Back'
              : view === 'register'
                ? 'Create Account'
                : view === 'register-success'
                  ? 'Account Created'
                  : view === 'forgot'
                    ? 'Reset Password'
                    : 'New Password'}
          </h2>
          <p
            className={`text-sm ${view === 'register' ? 'text-slate-500 dark:text-gray-400' : 'text-slate-300 dark:text-gray-300'}`}
          >
            {view === 'login'
              ? 'Sign in to continue'
              : view === 'register'
                ? registrationEnabled
                  ? 'Create your free account'
                  : 'Registration Closed'
                : view === 'register-success'
                  ? 'Registration complete'
                  : 'Recover your access'}
          </p>
        </div>

        <div className={view === 'register' ? 'p-6 sm:px-8 sm:pb-8' : 'p-6 sm:p-8'}>
          {/* Message Alert */}
          {message && (
            <div
              className={`mb-6 rounded-xl border px-4 py-3 text-center text-sm font-semibold ${
                message.type === 'error'
                  ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300'
              }`}
            >
              <span className="font-bold">{message.type === 'error' ? 'Error:' : 'Success:'}</span>{' '}
              {message.text}
            </div>
          )}

          {/* Honeypot Field - Hidden */}
          <div
            style={{
              position: 'absolute',
              left: '-9999px',
              opacity: 0,
              height: 0,
              overflow: 'hidden',
            }}
            aria-hidden="true"
          >
            <input
              aria-label="Website"
              type="text"
              name="website"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
            />
          </div>

          {/* === LOGIN VIEW === */}
          {view === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-5">
              <div>
                <span className={labelClass}>Username or Email</span>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400 dark:text-gray-400">
                    <UserRound size={18} />
                  </div>
                  <input
                    id="login-374"
                    name="login374"
                    aria-label="Username or Email"
                    type="text"
                    value={username}
                    onChange={(e) => {
                      credentialRevision.current += 1;
                      setVerificationRequired(false);
                      setUsername(e.target.value);
                    }}
                    className={iconInputClass}
                    placeholder="Enter your username"
                    required
                  />
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className={labelClass.replace('mb-2 block ', '')}>Password</span>
                  <button
                    type="button"
                    onClick={() => {
                      clearForm();
                      setView('forgot');
                    }}
                    className="text-xs font-semibold text-slate-700 transition-colors hover:text-[#202124] dark:text-gray-300 dark:hover:text-white"
                  >
                    Forgot?
                  </button>
                </div>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400 dark:text-gray-400">
                    <LockKeyhole size={18} />
                  </div>
                  <input
                    aria-label="Password"
                    id="login-403"
                    name="login403"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      credentialRevision.current += 1;
                      setVerificationRequired(false);
                      setPassword(e.target.value);
                    }}
                    className={`${iconInputClass} pr-12`}
                    placeholder="Enter your password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-4 flex items-center text-slate-400 hover:text-slate-600 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 cursor-pointer rounded-sm border-slate-300 text-[#202124] focus:ring-slate-500 dark:accent-gray-400 dark:focus:ring-gray-400"
                />
                <label
                  htmlFor="remember-me"
                  className="ml-2 block cursor-pointer select-none text-sm text-slate-700 dark:text-gray-300"
                >
                  Remember me
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`${primaryButtonClass} py-4 shadow-lg shadow-slate-900/10`}
              >
                {loading && !resendingVerification ? (
                  <>
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Signing in...
                  </>
                ) : (
                  <>
                    <ArrowRightToLine size={20} /> Sign In
                  </>
                )}
              </button>

              {verificationRequired && (
                <>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={(event) => void handleLoginSubmit(event, true)}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50 dark:border-admin-border-strong dark:text-gray-200 dark:hover:bg-admin-hover"
                  >
                    {resendingVerification
                      ? 'Sending verification email...'
                      : 'Resend verification email'}
                  </button>
                  <p className="text-center text-xs text-slate-500 dark:text-gray-400">
                    To resend, use the username or email and password above. This does not sign you
                    in.
                  </p>
                </>
              )}

              {registrationEnabled && (
                <div className="pt-2 text-center">
                  <span className="text-sm text-slate-500 dark:text-gray-400">
                    Don't have an account?{' '}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      clearForm();
                      setView('register');
                    }}
                    className="text-sm font-bold text-slate-700 hover:text-[#202124] dark:text-gray-300 dark:hover:text-white"
                  >
                    Create Account
                  </button>
                </div>
              )}
            </form>
          )}

          {/* === REGISTER VIEW === */}
          {view === 'register' &&
            (registrationEnabled ? (
              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className={registrationLabelClass} htmlFor="login-483">
                      Username
                    </label>
                    <input
                      id="login-483"
                      name="login483"
                      aria-label="Username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className={registrationInputClass}
                      placeholder="Choose a username"
                      required
                    />
                  </div>
                  <div>
                    <label className={registrationLabelClass} htmlFor="login-500">
                      Email address
                    </label>
                    <input
                      aria-label="Email Address"
                      id="login-500"
                      name="login500"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={registrationInputClass}
                      placeholder="you@example.com"
                      required
                    />
                  </div>
                  <div>
                    <label className={registrationLabelClass} htmlFor="login-514">
                      Password
                    </label>
                    <input
                      id="login-514"
                      name="login514"
                      aria-label="Password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={registrationInputClass}
                      placeholder="Min 8 characters"
                      required
                    />
                  </div>
                  <div>
                    <label className={registrationLabelClass} htmlFor="login-525">
                      Confirm password
                    </label>
                    <input
                      aria-label="Confirm"
                      id="login-525"
                      name="login525"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={registrationInputClass}
                      placeholder="Repeat your password"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className={`${primaryButtonClass} mt-2 py-3 text-sm`}
                >
                  {loading ? (
                    <>
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Creating Account...
                    </>
                  ) : (
                    <>
                      <UserRoundPlus size={20} /> Create Account
                    </>
                  )}
                </button>

                <div className="pt-2 text-center">
                  <span className="text-sm text-slate-500 dark:text-gray-400">
                    Already have an account?{' '}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      clearForm();
                      setView('login');
                    }}
                    className="text-sm font-bold text-slate-700 hover:text-[#202124] dark:text-gray-300 dark:hover:text-white"
                  >
                    Sign In
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4 py-8 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-slate-500 dark:border-admin-border dark:bg-admin-canvas dark:text-gray-300">
                  <UserRoundPlus size={32} />
                </div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-white">
                  Registration Disabled
                </h3>
                <p className="mx-auto max-w-xs text-sm text-slate-500 dark:text-gray-400">
                  New member registrations are currently closed by the administrator. Please contact
                  the site owner if you need access.
                </p>
                <button
                  type="button"
                  onClick={() => setView('login')}
                  className="inline-flex items-center gap-2 font-bold text-slate-700 hover:text-[#202124] hover:underline dark:text-gray-300 dark:hover:text-white"
                >
                  <ArrowLeft size={16} /> Back to Sign In
                </button>
              </div>
            ))}

          {/* === REGISTRATION SUCCESS VIEW === */}
          {view === 'register-success' && registrationResult && (
            <div className="space-y-5 py-3 text-center" aria-live="polite">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300">
                <ShieldCheck size={32} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white">
                  {registrationResult.emailSent ? 'Check Your Email' : 'Account Created'}
                </h3>
                <p className="mx-auto max-w-sm text-sm leading-6 text-slate-600 dark:text-gray-300">
                  {registrationResult.message}
                </p>
                {registrationResult.emailSent && (
                  <p className="text-xs text-slate-500 dark:text-gray-400">
                    Check your inbox and spam folder before signing in.
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  clearForm();
                  setView('login');
                }}
                className={`${primaryButtonClass} py-4 shadow-lg shadow-slate-900/10`}
              >
                <ArrowLeft size={18} /> Back to Sign In
              </button>
            </div>
          )}

          {/* === FORGOT VIEW === */}
          {view === 'forgot' && (
            <form onSubmit={handleResetSubmit} className="space-y-6">
              <div className="space-y-2 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-[#202124] dark:border-admin-border dark:bg-admin-canvas dark:text-gray-100">
                  <Mail size={28} />
                </div>
                <p className="text-sm text-slate-600 dark:text-gray-400">
                  Enter your email to receive recovery instructions.
                </p>
              </div>
              <input
                id="login-600"
                name="login600"
                aria-label="Email Address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                placeholder="you@example.com"
                required
              />
              <button
                type="submit"
                disabled={loading}
                className={`${primaryButtonClass} py-3.5 shadow-lg shadow-slate-900/10`}
              >
                {loading ? 'Sending...' : 'Send Recovery Link'}
              </button>
              <button
                type="button"
                onClick={() => {
                  clearForm();
                  setView('login');
                }}
                className="flex w-full items-center justify-center gap-2 text-sm text-slate-500 transition-colors hover:text-slate-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <ArrowLeft size={16} /> Back to Login
              </button>
            </form>
          )}

          {/* === RESET PASSWORD VIEW (From Email) === */}
          {view === 'reset' && (
            <form onSubmit={handleNewPasswordSubmit} className="space-y-4">
              <div className="mb-4 text-center">
                <h3 className="text-lg font-bold text-slate-700 dark:text-white">
                  Set New Password
                </h3>
                <p className="text-sm text-slate-500 dark:text-gray-400">
                  Create a strong password for your account.
                </p>
              </div>

              <div>
                <span className={labelClass}>New Password</span>
                <input
                  aria-label="New Password"
                  id="login-640"
                  name="login640"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass.replace('py-3.5', 'py-3')}
                  placeholder="Min 8 characters"
                  required
                />
              </div>
              <div>
                <span className={labelClass}>Confirm Password</span>
                <input
                  id="login-651"
                  name="login651"
                  aria-label="Confirm Password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={inputClass.replace('py-3.5', 'py-3')}
                  placeholder="Repeat password"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`${primaryButtonClass} py-3.5 shadow-lg shadow-slate-900/10`}
              >
                {loading ? 'Resetting...' : 'Update Password'}
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="space-y-2 border-t border-slate-200 bg-slate-50 p-4 text-center dark:border-admin-border dark:bg-admin-inset">
          <a
            href={BASE_PATH}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 transition-colors hover:text-[#202124] dark:text-gray-300 dark:hover:text-white"
          >
            <House size={16} />
            Back to Site
          </a>
          <p className="flex items-center justify-center gap-1 text-xs text-slate-500 dark:text-gray-400">
            Protected by{' '}
            <span className="flex items-center gap-1 font-semibold text-slate-700 dark:text-gray-300">
              <ShieldCheck size={12} />
              VonGuard
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};
export default VpLogin;
