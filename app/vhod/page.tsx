import { AlertCircle, LogIn } from 'lucide-react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { auth, authBypassed, isAllowedEmail, signIn } from '@/auth';

export const metadata: Metadata = { title: 'Вход · MOVIE_THEATRE' };

type Params = { callbackUrl?: string | string[]; error?: string | string[] };

/** Только относительный путь этого сайта — иначе открытый редирект. */
function safeCallback(value: Params['callbackUrl']): string {
  const url = Array.isArray(value) ? value[0] : value;
  if (!url || !url.startsWith('/') || url.startsWith('//') || url.startsWith('/\\')) return '/';
  if (url === '/vhod' || url.startsWith('/vhod?') || url.startsWith('/vhod/')) return '/';
  return url;
}

/**
 * Вход (SPEC 1.1). Своя страница и для входа, и для ошибок Auth.js: при отказе
 * в signIn Auth.js возвращает сюда с ?error=AccessDenied. Шапки сайта нет —
 * её не рисует SiteShell на этом адресе.
 */
export default async function LoginPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const redirectTo = safeCallback(params.callbackUrl);

  if (!authBypassed()) {
    const session = await auth();
    if (isAllowedEmail(session?.user?.email)) redirect('/');
  }

  const error = Array.isArray(params.error) ? params.error[0] : params.error;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-[18px] text-center">
      <h1 className="text-[15px] font-bold tracking-[.1em] whitespace-nowrap">
        MOVIE<span className="text-red">_</span>THEATRE
      </h1>
      <p className="mt-3 text-[13px] text-text-2">Личный каталог. Вход только для владельца.</p>

      {error && (
        <p role="alert" className="mt-6 flex max-w-[420px] items-start gap-[7px] text-left text-text-2">
          <AlertCircle size={15} strokeWidth={1.5} className="mt-[2px] shrink-0 text-orange" />
          {error === 'AccessDenied'
            ? 'Этот аккаунт не допущен. Войди тем адресом, который указан как владелец.'
            : 'Вход не удался. Попробуй ещё раз.'}
        </p>
      )}

      <form
        className={error ? 'mt-4' : 'mt-6'}
        action={async () => {
          'use server';
          await signIn('google', { redirectTo });
        }}
      >
        <button
          type="submit"
          className="inline-flex items-center gap-[7px] rounded-pill bg-red px-[18px] py-[9px] text-[12.5px] font-medium text-white transition-colors duration-[120ms] hover:bg-red-hover"
        >
          <LogIn size={15} strokeWidth={1.5} />
          Войти через Google
        </button>
      </form>
    </main>
  );
}
