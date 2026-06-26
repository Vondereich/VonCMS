/* Client helper to run grecaptcha.execute and POST token to a verify endpoint.
   Usage:
     import { verifyWithEndpoint } from '../services/recaptchaClient';
     const res = await verifyWithEndpoint('https://your-worker.example.com', 'submit');
       if (res.success) { // ok }
*/

declare const grecaptcha: any; // global from Google API script

export async function executeRecaptcha(siteKey: string, action = 'submit'): Promise<string> {
  if (typeof grecaptcha === 'undefined' || !grecaptcha.ready) {
    throw new Error('grecaptcha is not loaded on the page');
  }
  return new Promise((resolve, reject) => {
    try {
      grecaptcha.ready(() => {
        grecaptcha
          .execute(siteKey, { action })
          .then((token: string) => resolve(token))
          .catch((err: any) => reject(err));
      });
    } catch (e) {
      reject(e);
    }
  });
}

export async function verifyWithEndpoint(endpointUrl: string, siteKey: string, action = 'submit') {
  const token = await executeRecaptcha(siteKey, action);
  const res = await fetch(endpointUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, action }),
  });
  return res.json();
}

export default { executeRecaptcha, verifyWithEndpoint };
