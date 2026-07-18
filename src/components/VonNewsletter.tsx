import React, { useState } from 'react';
import { Mail, Send, Check, X, Loader2 } from 'lucide-react';
import { NewsletterSettings } from '../types';
import { BASE_PATH } from '../config/site.config';
import { vonFetch } from '../utils/api';

// Theme colors for custom theme overrides
interface ThemeColors {
  surface?: string;
  surfaceAlt?: string;
  border?: string;
  text?: string;
  textSecondary?: string;
}

interface VonNewsletterProps {
  settings?: NewsletterSettings;
  variant?: 'footer' | 'sidebar' | 'inline';
  accentColor?: string;
  themeColors?: ThemeColors; // Optional theme color overrides
}

const defaultSettings: NewsletterSettings = {
  enabled: false,
  title: 'Subscribe to Newsletter',
  description: 'Get the latest updates delivered to your inbox.',
  buttonText: 'Subscribe',
  successMessage: 'Thank you for subscribing!',
  position: 'footer',
};

const VonNewsletter: React.FC<VonNewsletterProps> = ({
  settings = defaultSettings,
  variant = 'footer',
  accentColor = '#00D1D1',
  themeColors,
}) => {
  const [email, setEmail] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  // Don't render if not enabled
  if (!settings?.enabled) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      setStatus('error');
      setMessage('Please enter your email');
      return;
    }

    setStatus('loading');

    try {
      const res = await vonFetch(`${BASE_PATH}api/newsletter_subscribe.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), hp_field: honeypot }),
      });

      const data = await res.json();

      if (data.success) {
        setStatus('success');
        setMessage(settings.successMessage || data.message);
        setEmail('');
        setHoneypot('');
        // Reset after 5 seconds
        setTimeout(() => {
          setStatus('idle');
          setMessage('');
        }, 5000);
      } else {
        setStatus('error');
        setMessage(data.error || 'Subscription failed');
        setTimeout(() => setStatus('idle'), 3000);
      }
    } catch (error) {
      setStatus('error');
      setMessage('Network error. Please try again.');
      setTimeout(() => setStatus('idle'), 3000);
    }
  };

  // Footer variant - horizontal layout
  if (variant === 'footer') {
    return (
      <div
        className="newsletter-widget py-8 px-6 rounded-2xl max-w-3xl mx-auto"
        style={
          themeColors
            ? {
                backgroundColor: themeColors.surface || 'transparent',
                borderColor: themeColors.border,
                color: themeColors.text,
              }
            : { background: `linear-gradient(135deg, ${accentColor}15, ${accentColor}05)` }
        }
      >
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: accentColor }}
            >
              <Mail size={24} className="text-white" />
            </div>
            <div>
              <h3
                className={`text-lg font-bold ${themeColors ? '' : 'text-zinc-800 dark:text-white'}`}
                style={{ color: themeColors?.text }}
              >
                {settings.title}
              </h3>
              <p
                className={`text-sm ${themeColors ? '' : 'text-zinc-500 dark:text-zinc-400'}`}
                style={{ color: themeColors?.textSecondary }}
              >
                {settings.description}
              </p>
            </div>
          </div>

          {status === 'success' ? (
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
              <Check size={18} /> {message}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-1 max-w-md gap-2">
              <input
                aria-label="Hp Field"
                type="text"
                name="hp_field"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
                style={{ position: 'absolute', left: '-9999px', opacity: 0, height: 0, width: 0 }}
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
              />
              <input
                aria-label="Email"
                id="newsletter-footer-email"
                name="email"
                autoComplete="email"
                type="email"
                maxLength={255}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className={`flex-1 px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 ${themeColors ? '' : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-white'}`}
                style={
                  themeColors
                    ? ({
                        backgroundColor: themeColors.surfaceAlt || 'transparent',
                        borderColor: themeColors.border,
                        color: themeColors.text,
                        '--tw-ring-color': accentColor,
                      } as React.CSSProperties)
                    : ({ '--tw-ring-color': accentColor } as React.CSSProperties)
                }
                disabled={status === 'loading'}
              />
              <button
                type="submit"
                disabled={status === 'loading'}
                className="px-6 py-2.5 rounded-xl text-white font-medium text-sm flex items-center gap-2 transition-all hover:opacity-90 disabled:opacity-50 flex-shrink-0"
                style={{ background: accentColor }}
              >
                {status === 'loading' ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Send size={18} />
                )}
                {settings.buttonText}
              </button>
            </form>
          )}
        </div>

        {status === 'error' && (
          <div className="mt-4 flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
            <X size={16} /> {message}
          </div>
        )}
      </div>
    );
  }

  // Sidebar variant - vertical layout
  return (
    <div
      className={`newsletter-widget p-6 rounded-xl border ${themeColors ? '' : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800'}`}
      style={
        themeColors
          ? {
              backgroundColor: themeColors.surface,
              borderColor: themeColors.border,
              border: `1px solid ${themeColors.border}`,
            }
          : {}
      }
    >
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ background: accentColor }}
        >
          <Mail size={20} className="text-white" />
        </div>
        <h3 className="font-bold text-zinc-800 dark:text-white">{settings.title}</h3>
      </div>

      <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">{settings.description}</p>

      {status === 'success' ? (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-sm">
          <Check size={18} /> {message}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            aria-label="Hp Field"
            type="text"
            name="hp_field"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
            style={{ position: 'absolute', left: '-9999px', opacity: 0, height: 0, width: 0 }}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
          />
          <input
            aria-label="Email"
            id="newsletter-sidebar-email"
            name="email"
            autoComplete="email"
            type="email"
            maxLength={255}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            className={`w-full px-4 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 ${themeColors ? '' : 'border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-800 dark:text-white'}`}
            style={
              themeColors
                ? ({
                    backgroundColor: themeColors.surfaceAlt,
                    borderColor: themeColors.border,
                    color: themeColors.text,
                    '--tw-ring-color': accentColor,
                  } as React.CSSProperties)
                : ({ '--tw-ring-color': accentColor } as React.CSSProperties)
            }
            disabled={status === 'loading'}
          />
          <button
            type="submit"
            disabled={status === 'loading'}
            className="w-full py-2.5 rounded-lg text-white font-medium text-sm flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-50"
            style={{ background: accentColor }}
          >
            {status === 'loading' ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Send size={18} />
            )}
            {settings.buttonText}
          </button>
        </form>
      )}

      {status === 'error' && (
        <div className="mt-3 flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
          <X size={16} /> {message}
        </div>
      )}
    </div>
  );
};

export default VonNewsletter;
