const cookieName = '__Host-warehouse-session';
const cookie = (value, ttl) =>
  `${cookieName}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${ttl}`;
const fail = (message, status) => Response.json({ error: message }, { status });
const reply = (body, session) => Response.json(body, {
  headers: { 'Cache-Control': 'no-store', ...(session ? {
    'Set-Cookie': cookie(encodeURIComponent(JSON.stringify(session)), 60 * 60 * 24 * 7),
  } : {}) },
});
const call = async (env, path, { method = 'GET', body, token, admin = false } = {}) => {
  const key = admin ? env.SUPABASE_SERVICE_ROLE_KEY : env.SUPABASE_PUBLISHABLE_KEY;
  const res = await fetch(new URL(path, env.SUPABASE_URL), {
    method, headers: {
      apikey: key, 'Content-Type': 'application/json',
      ...(token || admin ? { Authorization: `Bearer ${token || key}` } : {}),
    }, body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, ok: res.ok, data: await res.json().catch(() => null) };
};
const rpc = (env, name, token, body = {}) =>
  call(env, '/rest/v1/rpc/' + name, { method: 'POST', token, body });
const sessionFrom = ({ access_token, refresh_token, expires_at, expires_in }) => ({
  access_token, refresh_token, expires_at: expires_at || Math.floor(Date.now() / 1000) + expires_in,
});
const upstreamError = (result) => fail(
  result.status >= 500 ? 'Layanan database sedang tidak tersedia.' :
  (result.data?.message || result.data?.msg || 'Permintaan ditolak.'),
  result.data?.code === '40001' ? 409 : result.status === 401 ? 401 :
  result.status === 403 || result.data?.code === '42501' ? 403 :
  result.status >= 500 ? 502 : 400,
);
const getCookie = (req) => {
  const raw = req.headers.get('Cookie')?.split('; ').find((part) => part.startsWith(cookieName + '='));
  try { return raw ? JSON.parse(decodeURIComponent(raw.slice(cookieName.length + 1))) : null; }
  catch { return null; }
};
const positions = ['Administrator', 'Outlet', 'Storage-Mailer', 'Storage Inbound',
  'Storage Outbond', 'Purchasing', 'Cost Control'];
const departments = ['Kitchen', 'Bar', 'Pastry', 'Floor & Operations'];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    try {
      if (request.method !== 'GET' && request.headers.get('Origin') !== url.origin) {
        return fail('Origin ditolak.', 403);
      }
      if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) {
        return fail('Konfigurasi Supabase belum lengkap.', 503);
      }
      if (request.method === 'POST' && url.pathname === '/api/login') {
        const { email, password } = await request.json();
        if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
          return fail('Masukkan email dan password.', 400);
        }
        const result = await call(env, '/auth/v1/token?grant_type=password', {
          method: 'POST', body: { email, password },
        });
        if (!result.ok) return fail(
          result.status === 429 ? 'Terlalu banyak percobaan. Silakan coba lagi nanti.' :
          result.status >= 500 ? 'Layanan masuk tidak tersedia.' : 'Email atau password tidak cocok.',
          result.status === 429 ? 429 : result.status >= 500 ? 502 : 401,
        );
        const session = sessionFrom(result.data);
        const profile = await rpc(env, 'warehouse_profile', session.access_token);
        if (!profile.ok) return upstreamError(profile);
        return reply({ user: profile.data }, session);
      }
      let session = getCookie(request);
      if (request.method === 'POST' && url.pathname === '/api/logout') {
        if (session?.access_token) {
          await call(env, '/auth/v1/logout?scope=local', {
            method: 'POST', token: session.access_token,
          }).catch(() => {});
        }
        return new Response(null, { status: 204, headers: { 'Set-Cookie': cookie('', 0), 'Cache-Control': 'no-store' } });
      }
      if (!session?.access_token || !session.refresh_token) return fail('Silakan masuk.', 401);
      let renewed;
      if (session.expires_at <= Math.floor(Date.now() / 1000) + 15) {
        const result = await call(env, '/auth/v1/token?grant_type=refresh_token', {
          method: 'POST', body: { refresh_token: session.refresh_token },
        });
        if (!result.ok) return upstreamError(result);
        renewed = session = sessionFrom(result.data);
      }
      const token = session.access_token;
      if (request.method === 'GET' && url.pathname === '/api/session') {
        const result = await rpc(env, 'warehouse_profile', token);
        return result.ok ? reply({ user: result.data }, renewed) : upstreamError(result);
      }
      if (request.method === 'GET' && url.pathname === '/api/records') {
        const result = await rpc(env, 'warehouse_snapshot', token);
        return result.ok ? reply(result.data, renewed) : upstreamError(result);
      }
      if (request.method === 'POST' && url.pathname === '/api/records') {
        const result = await rpc(env, 'warehouse_commit', token, await request.json());
        return result.ok ? reply(result.data, renewed) : upstreamError(result);
      }
      if (url.pathname === '/api/vendor-delivery' && request.method === 'POST') {
        const { poId, action, vendorName, attemptId, messageId, detail } = await request.json();
        if (typeof poId !== 'string' || !poId || !['list', 'claim', 'sent', 'failed', 'unknown'].includes(action) ||
            (action !== 'list' && (typeof vendorName !== 'string' || !vendorName || !isUUID(attemptId)))) {
          return fail('Data pengiriman email tidak valid.', 400);
        }
        const result = await rpc(env, 'warehouse_vendor_delivery', token, {
          po_key: poId, action, vendor_key: vendorName ?? null, attempt: attemptId ?? null,
          gmail_id: messageId ?? null, detail: detail ?? null,
        });
        return result.ok ? reply(result.data, renewed) : upstreamError(result);
      }
      if (url.pathname === '/api/users') {
        const profile = await rpc(env, 'warehouse_profile', token);
        if (!profile.ok) return upstreamError(profile);
        if (request.method === 'GET') {
          const result = await rpc(env, 'warehouse_users', token);
          return result.ok ? reply(result.data, renewed) : upstreamError(result);
        }
        if (request.method === 'PUT' && profile.data.position !== 'Administrator') {
          const { id, username, password } = await request.json();
          if (id !== profile.data.id) return fail('Akses ditolak.', 403);
          if (typeof username !== 'string' || !username.trim()) return fail('Nama wajib diisi.', 400);
          if (password !== undefined && (typeof password !== 'string' || password.length < 8)) {
            return fail('Password minimal 8 karakter.', 400);
          }
          if (password) {
            const change = await call(env, '/auth/v1/user', { method: 'PUT', token, body: { password } });
            if (!change.ok) return upstreamError(change);
          }
          const result = await rpc(env, 'warehouse_update_own_name', token, { display_name: username.trim() });
          return result.ok ? reply({ user: result.data }, renewed) : upstreamError(result);
        }
        if (profile.data.position !== 'Administrator') return fail('Akses ditolak.', 403);
        if (!env.SUPABASE_SERVICE_ROLE_KEY) return fail('Konfigurasi admin belum lengkap.', 503);
        const user = await request.json();
        if (request.method === 'DELETE') {
          if (!isUUID(user.id) || user.id === profile.data.id) return fail('Akun ini tidak dapat dihapus.', 400);
          const deleted = await call(env, '/auth/v1/admin/users/' + user.id, { method: 'DELETE', admin: true });
          return deleted.ok ? reply({ success: true }, renewed) : upstreamError(deleted);
        }
        if (request.method !== 'POST' && request.method !== 'PUT') return fail('Metode tidak tersedia.', 405);
        const creating = request.method === 'POST';
        if (typeof user.username !== 'string' || !user.username.trim() || typeof user.email !== 'string' ||
            !positions.includes(user.position) || (!creating && !isUUID(user.id)) ||
            (user.position === 'Outlet' && (typeof user.outletName !== 'string' || !user.outletName.trim() ||
             !departments.includes(user.department)))) {
          return fail('Data pengguna belum lengkap.', 400);
        }
        if (!creating && user.id === profile.data.id && user.position !== 'Administrator') {
          return fail('Peran administrator sendiri tidak dapat diubah.', 400);
        }
        if ((creating || user.password !== undefined) &&
            (typeof user.password !== 'string' || user.password.length < 8)) {
          return fail('Password minimal 8 karakter.', 400);
        }
        const auth = await call(env, '/auth/v1/admin/users' + (creating ? '' : '/' + user.id), {
          method: request.method, admin: true, body: {
            email: user.email.trim(), email_confirm: true, ...(user.password ? { password: user.password } : {}),
          },
        });
        if (!auth.ok) return upstreamError(auth);
        const row = {
          id: auth.data.id, email: auth.data.email, username: user.username.trim(),
          position: user.position,
          outlet_name: user.position === 'Outlet' ? user.outletName.trim() : null,
          department: user.position === 'Outlet' ? user.department : null,
        };
        // The signed-in administrator's token authorizes the profile write inside Postgres.
        const result = await rpc(env, 'warehouse_save_user', token, { profile: row });
        if (!result.ok) {
          if (creating) {
            await call(env, '/auth/v1/admin/users/' + auth.data.id, {
              method: 'DELETE', admin: true,
            }).catch(() => {});
          }
          return upstreamError(result);
        }
        return reply({ user: result.data }, renewed);
      }
      return fail('Halaman tidak ditemukan.', 404);
    } catch (error) {
      console.error('Warehouse API failed', error?.name);
      return fail('Permintaan tidak dapat diproses. Coba lagi.', 502);
    }
  },
};

function isUUID(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
}
