import { resolveOrigin } from './stripe';

function fromAddress() {
  return process.env.EMAIL_FROM || '';
}

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && fromAddress());
}

export function buildLoginUrl(origin, token) {
  const base = (origin || '').replace(/\/$/, '') || 'http://localhost:3000';
  return `${base}/api/auth/callback?token=${encodeURIComponent(token)}`;
}

export async function sendMagicLinkEmail({ to, loginUrl }) {
  const key = process.env.RESEND_API_KEY;
  const from = fromAddress();
  if (!key || !from) {
    return { sent: false, reason: 'not_configured' };
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to,
      subject: 'Log in to your Mindscale Echo workspace',
      text: [
        'Use this link to open your Mindscale Echo workspace. It expires in 30 minutes and can be used once.',
        '',
        loginUrl,
        '',
        'If you did not request this, you can ignore the email.',
      ].join('\n'),
      html: `
        <p>Use this link to open your Mindscale Echo workspace. It expires in 30 minutes and can be used once.</p>
        <p><a href="${loginUrl}">Open your workspace</a></p>
        <p style="color:#666;font-size:13px">If you did not request this, you can ignore the email.</p>
      `,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error('[email] Resend failed:', res.status, detail.slice(0, 300));
    return { sent: false, reason: 'provider' };
  }

  return { sent: true };
}

export function siteOrigin(request) {
  return resolveOrigin(request);
}
