import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';

/**
 * Вход (SPEC 1.1): Google, один допущенный адрес, сессия JWT без базы.
 * AUTH_SECRET, AUTH_GOOGLE_ID и AUTH_GOOGLE_SECRET Auth.js читает из env сам.
 */

/**
 * Проверка входа выключена только на preview-деплоях Vercel (их закрывает
 * защита самого Vercel, а вход там не работает — redirect URI один, боевой)
 * и в `next dev`. Во всех остальных случаях, включая непонятные, — включена.
 * В обходе auth() не вызывается вовсе: без AUTH_SECRET Auth.js падает.
 */
export function authBypassed(): boolean {
  return process.env.VERCEL_ENV === 'preview' || process.env.NODE_ENV === 'development';
}

/** Пустой или не заданный ALLOWED_EMAIL не пускает никого. */
export function isAllowedEmail(email: string | null | undefined): boolean {
  const allowed = process.env.ALLOWED_EMAIL?.trim().toLowerCase();
  if (!allowed || !email) return false;
  return email.trim().toLowerCase() === allowed;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: 'jwt' },
  providers: [Google],
  pages: { signIn: '/vhod', error: '/vhod' },
  callbacks: {
    signIn({ account, profile }) {
      if (account?.provider !== 'google') return false;
      return profile?.email_verified === true && isAllowedEmail(profile.email);
    },
  },
});
