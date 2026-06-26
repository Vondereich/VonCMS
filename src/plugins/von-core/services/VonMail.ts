import { SiteSettings } from '../../../types';

export interface MailPayload {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

const getTransportOptions = (settings: SiteSettings) => {
  const envHost = process.env['SMTP_HOST'];
  const envPort = process.env['SMTP_PORT'];
  const envUser = process.env['SMTP_USER'];
  const envPass = process.env['SMTP_PASS'];
  const envSecure = (process.env['SMTP_SECURE'] || 'false') === 'true';

  // `settings.emailSmtp` is a simple string in current types; use it as host when present.
  const host = envHost || (settings as any).emailSmtp || '';
  const port = parseInt(envPort || '', 10) || undefined;
  const user = envUser || undefined;
  const pass = envPass || undefined;
  const secure = envSecure;

  if (!host) return null;
  return { host, port, secure, auth: user ? { user, pass } : undefined } as any;
};

export const sendEmail = async (
  payload: MailPayload,
  settings: SiteSettings
): Promise<{ success: boolean; message: string }> => {
  const transportOpts = getTransportOptions(settings);

  if (!transportOpts) {
    console.warn('VonMail: SMTP not configured (no host). Falling back to console-simulated send.');

    return { success: true, message: 'Simulated send (no SMTP configured).' };
  }

  // dynamically require nodemailer to avoid compile-time dependency if it's not installed
  let nodemailer: any;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    nodemailer = require('nodemailer');
  } catch (e) {
    console.warn('VonMail: nodemailer not installed; falling back to simulated send.');

    return { success: true, message: 'Simulated send (nodemailer missing).' };
  }

  try {
    const transporter = nodemailer.createTransport(transportOpts);
    const from =
      (settings as any).emailFrom || process.env['SMTP_FROM'] || `no-reply@${transportOpts.host}`;

    if (transporter.verify) await transporter.verify();

    const info = await transporter.sendMail({
      from,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    });

    return {
      success: true,
      message: `Message queued: ${info && info.messageId ? info.messageId : 'ok'}`,
    };
  } catch (err: any) {
    console.error('VonMail send error:', err?.message || err);
    return { success: false, message: err?.message || 'Unknown error' };
  }
};

export const sendPasswordReset = async (email: string, settings: SiteSettings) => {
  const siteName = settings.siteName || 'Site';
  return sendEmail(
    {
      to: email,
      subject: `[${siteName}] Reset Your Password`,
      text: `You requested a password reset for ${siteName}.`,
    },
    settings
  );
};

export const sendWelcomeEmail = async (email: string, username: string, settings: SiteSettings) => {
  const siteName = settings.siteName || 'Site';
  return sendEmail(
    {
      to: email,
      subject: `Welcome to ${siteName}!`,
      text: `Hello ${username}, welcome to ${siteName}.`,
    },
    settings
  );
};

export default { sendEmail, sendPasswordReset, sendWelcomeEmail };
