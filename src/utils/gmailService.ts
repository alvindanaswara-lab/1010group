import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
} from 'firebase/auth';


const SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
];

function gmailAuth() {
  const apiKey = import.meta.env.VITE_GMAIL_FIREBASE_API_KEY;
  const authDomain = import.meta.env.VITE_GMAIL_FIREBASE_AUTH_DOMAIN;
  const projectId = import.meta.env.VITE_GMAIL_FIREBASE_PROJECT_ID;
  if (!apiKey || !authDomain || !projectId) return null;
  const app = getApps().find((app) => app.name === 'gmail-vendor') ??
    initializeApp({ apiKey, authDomain, projectId }, 'gmail-vendor');
  return getAuth(app);
}

// Flag to indicate if we are in the middle of a sign-in flow.
let isSigningIn = false;
// Cache the access token in memory only (never in localStorage or sessionStorage).
let cachedAccessToken: string | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  const auth = gmailAuth();
  if (!auth) { onAuthFailure?.(); return () => {}; }
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    const auth = gmailAuth();
    if (!auth) throw new Error('Integrasi Gmail belum dikonfigurasi.');
    const provider = new GoogleAuthProvider();
    SCOPES.forEach((scope) => provider.addScope(scope));
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Gagal mendapatkan access token Gmail dari Google Auth.');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const getCurrentGoogleUser = (): User | null => {
  return gmailAuth()?.currentUser ?? null;
};

export const logoutGoogle = async () => {
  await gmailAuth()?.signOut();
  cachedAccessToken = null;
};

export interface GmailMessageSummary {
  id: string;
  threadId: string;
  snippet: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  bodyText: string;
  labelIds: string[];
}

export interface SendGmailOptions {
  to: string;
  cc?: string;
  deliveryAttemptId?: string;
  subject: string;
  body: string;
  attachment?: {
    fileName: string;
    mimeType: string;
    base64Data: string;
  };
}

function encodeBase64Url(str: string): string {
  const utf8Bytes = new TextEncoder().encode(str);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < utf8Bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...utf8Bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function encodeMimeHeader(text: string): string {
  if (/^[\x00-\x7F]*$/.test(text)) {
    return text;
  }
  const utf8Bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < utf8Bytes.length; i++) {
    binary += String.fromCharCode(utf8Bytes[i]);
  }
  return `=?UTF-8?B?${btoa(binary)}?=`;
}

function vendorMessageId(attemptId: string): string {
  if (!/^[0-9a-f-]{36}$/i.test(attemptId)) throw new Error('ID pengiriman tidak valid.');
  return 'warehouse-' + attemptId + '@warehouse.1010group.invalid';
}

function buildRawMimeMessage(options: SendGmailOptions): string {
  if ([options.to, options.cc, options.subject, options.attachment?.fileName].some(
    (value) => value && /[\r\n]/.test(value)
  )) throw new Error('Format alamat, subjek, atau nama lampiran tidak valid.');

  const boundary = `boundary_1010group_${Date.now().toString(16)}`;
  const headers: string[] = [
    `To: ${options.to.trim()}`,
  ];
  if (options.cc && options.cc.trim()) {
    headers.push(`Cc: ${options.cc.trim()}`);
  }
  headers.push(`Subject: ${encodeMimeHeader(options.subject)}`);
  if (options.deliveryAttemptId) headers.push('Message-ID: <' + vendorMessageId(options.deliveryAttemptId) + '>');
  headers.push('MIME-Version: 1.0');

  if (options.attachment && options.attachment.base64Data) {
    headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
    const cleanBase64 = options.attachment.base64Data.replace(/\r?\n/g, '');
    const wrappedBase64 = cleanBase64.match(/.{1,76}/g)?.join('\r\n') || cleanBase64;

    const mimeParts = [
      headers.join('\r\n'),
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: 8bit',
      '',
      options.body,
      '',
      `--${boundary}`,
      `Content-Type: ${options.attachment.mimeType}; name="${options.attachment.fileName}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${options.attachment.fileName}"`,
      '',
      wrappedBase64,
      `--${boundary}--`,
    ];
    return encodeBase64Url(mimeParts.join('\r\n'));
  } else {
    headers.push('Content-Type: text/plain; charset="UTF-8"');
    const fullMessage = `${headers.join('\r\n')}\r\n\r\n${options.body}`;
    return encodeBase64Url(fullMessage);
  }
}

export class GmailDeliveryError extends Error {
  constructor(message: string, readonly retryable: boolean) { super(message); }
}

export async function findSentVendorEmail(attemptId: string): Promise<string | null> {
  const token = await getAccessToken();
  if (!token) throw new Error('Hubungkan akun Gmail yang digunakan untuk mengirim.');
  const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
  url.searchParams.set('q', 'in:sent rfc822msgid:' + vendorMessageId(attemptId));
  url.searchParams.set('maxResults', '2');
  const response = await fetch(url, {
    headers: { Authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error('Tidak dapat memeriksa folder Terkirim.');
  const { messages } = await response.json() as { messages?: { id: string }[] };
  if (messages?.length === 1) return messages[0].id;
  if (messages && messages.length > 1) throw new Error('Lebih dari satu pesan ditemukan. Periksa folder Terkirim.');
  return null;
}

export async function sendGmailMessage(
  options: SendGmailOptions
): Promise<{ id: string; threadId: string }> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('UNAUTHENTICATED');
  }

  const raw = buildRawMimeMessage(options);
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new GmailDeliveryError(
      errData?.error?.message || 'Gmail menolak pengiriman (HTTP ' + res.status + ').',
      [400, 401, 403, 404, 429].includes(res.status),
    );
  }

  return res.json();
}

export async function createGmailDraft(
  options: SendGmailOptions
): Promise<{ id: string }> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('UNAUTHENTICATED');
  }

  const raw = buildRawMimeMessage(options);
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message: { raw } }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new GmailDeliveryError(
      errData?.error?.message || `Gagal menyimpan draf Gmail (HTTP ${res.status})`,
      [400, 401, 403, 404, 429].includes(res.status),
    );
  }

  return res.json();
}

function decodeBase64UrlText(data: string): string {
  try {
    const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
    const pad = base64.length % 4;
    const padded = pad ? base64 + '='.repeat(4 - pad) : base64;
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    return '';
  }
}

function extractPlainTextFromPayload(payload: any): string {
  if (!payload) return '';
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return decodeBase64UrlText(payload.body.data);
  }
  if (Array.isArray(payload.parts)) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return decodeBase64UrlText(part.body.data);
      }
    }
    for (const part of payload.parts) {
      const nested = extractPlainTextFromPayload(part);
      if (nested) return nested;
    }
  }
  return '';
}

export async function listGmailMessages(
  query = '',
  maxResults = 12
): Promise<GmailMessageSummary[]> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('UNAUTHENTICATED');
  }

  const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
  url.searchParams.set('maxResults', String(maxResults));
  if (query.trim()) {
    url.searchParams.set('q', query.trim());
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(
      errData?.error?.message || `Gagal memuat pesan Gmail (HTTP ${res.status})`
    );
  }

  const data = await res.json();
  const messages: Array<{ id: string; threadId: string }> = data.messages || [];
  if (messages.length === 0) return [];

  const details = await Promise.all(
    messages.map(async (m) => {
      const detailRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=full`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!detailRes.ok) return null;
      const d = await detailRes.json();
      const headers: Array<{ name: string; value: string }> = d.payload?.headers || [];
      const getHeader = (name: string) =>
        headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

      const bodyText = extractPlainTextFromPayload(d.payload) || d.snippet || '';

      return {
        id: d.id,
        threadId: d.threadId,
        snippet: d.snippet || '',
        subject: getHeader('Subject') || '(Tanpa Subjek)',
        from: getHeader('From') || '-',
        to: getHeader('To') || '-',
        date: getHeader('Date') || '',
        bodyText,
        labelIds: d.labelIds || [],
      } as GmailMessageSummary;
    })
  );

  return details.filter((item): item is GmailMessageSummary => item !== null);
}

export async function trashGmailMessage(messageId: string): Promise<void> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('UNAUTHENTICATED');
  }

  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/trash`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(
      errData?.error?.message || `Gagal memindahkan pesan ke Trash (HTTP ${res.status})`
    );
  }
}
