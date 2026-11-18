import { useState } from 'react';
import type { FormEvent } from 'react';
import type { User } from '../../types';
import { useApp } from '../../context/AppContext';

export function LoginScreen({ onLoginSuccess }: { onLoginSuccess: (user: User) => void }) {
  const { login } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const result = await login(email, password);
    setBusy(false);
    if (result.success && result.user) onLoginSuccess(result.user);
    else setError(result.message || 'Gagal masuk.');
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-4 text-white">
      <form className="w-full max-w-sm space-y-5 rounded-2xl border border-slate-700 bg-slate-900 p-7 shadow-xl" onSubmit={submit}>
        <h1 className="text-xl font-bold">1010Group Warehouse</h1>
        <label className="block text-sm">Email kerja
          <input required type="email" autoComplete="username" value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2.5" />
        </label>
        <label className="block text-sm">Password
          <input required type="password" autoComplete="current-password" value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2.5" />
        </label>
        {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
        <button disabled={busy} className="w-full rounded bg-amber-500 py-2.5 font-bold text-slate-950 disabled:opacity-60">
          {busy ? 'Memeriksa…' : 'Masuk'}
        </button>
      </form>
    </main>
  );
}
