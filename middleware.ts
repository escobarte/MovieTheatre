import { NextResponse, type NextFetchEvent, type NextRequest } from 'next/server';
import type { NextAuthRequest } from 'next-auth';

import { auth, authBypassed, isAllowedEmail } from '@/auth';

/**
 * Закрыт весь сайт, включая чтение и все /api (SPEC 1.1). Без входа
 * пропускаются только вход, статика Next.js и то, без чего не установится
 * PWA: манифест и иконки.
 */
function isPublic(pathname: string): boolean {
  return (
    pathname === '/vhod' ||
    pathname.startsWith('/vhod/') ||
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/_next/static/') ||
    pathname.startsWith('/_next/image') ||
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt' ||
    pathname === '/manifest.webmanifest' ||
    pathname.startsWith('/icon') ||
    pathname.startsWith('/apple-icon')
  );
}

// Второй параметр нужен типам: с ним auth() выбирает перегрузку middleware,
// а не обработчика роута.
const guarded = auth((req: NextAuthRequest, _event: NextFetchEvent) => {
  const { pathname, search } = req.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();
  // Email сверяется и здесь: старая сессия не переживёт смену ALLOWED_EMAIL.
  if (isAllowedEmail(req.auth?.user?.email)) return NextResponse.next();

  if (pathname === '/api' || pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const login = new URL('/vhod', req.nextUrl.origin);
  login.searchParams.set('callbackUrl', pathname + search);
  return NextResponse.redirect(login);
});

export default function middleware(req: NextRequest, event: NextFetchEvent) {
  if (authBypassed()) return NextResponse.next();
  return guarded(req, event);
}

export const config = {
  // Статику не гоняем через middleware вовсе; остальное отсеивает isPublic.
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|manifest\\.webmanifest|icon|apple-icon).*)',
  ],
};
