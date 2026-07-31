import { CircleAlert, CircleCheck, Database } from 'lucide-react';

import { checkDb } from '@/lib/db/health';

// Проверка базы делается на каждый запрос, а не на сборке.
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const health = await checkDb();

  if (health.ok) {
    console.log('[db] Turso отвечает. Таблицы:', health.tables.join(', ') || '— нет —');
  } else {
    console.error('[db] Turso недоступен:', health.error);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-[720px] flex-col justify-center gap-8 px-6 py-16">
      <div>
        <span className="text-[15px] font-bold tracking-[.1em] uppercase">Movie_Theatre</span>
        <div className="mt-1 h-[2px] w-9 bg-red" />
      </div>

      <section className="rounded-lg bg-surface p-5">
        <h1 className="flex items-center gap-2 text-[17px] font-bold">
          <Database size={18} strokeWidth={1.5} className="text-red" />
          Проверка базы
        </h1>

        {health.ok ? (
          <>
            <p className="mt-3 flex items-center gap-2 text-text-2">
              <CircleCheck size={16} strokeWidth={1.5} />
              Turso отвечает.
            </p>
            <p className="mt-4 text-[11px] font-medium tracking-[.1em] text-text-4 uppercase">
              Таблицы
            </p>
            {health.tables.length > 0 ? (
              <ul className="mt-2 flex flex-wrap gap-2">
                {health.tables.map((name) => (
                  <li
                    key={name}
                    className="rounded-pill bg-surface-3 px-[15px] py-[7px] text-text-2"
                  >
                    {name}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-text-3">Пусто — миграция ещё не применена.</p>
            )}
          </>
        ) : (
          <>
            <p className="mt-3 flex items-center gap-2 text-text-2">
              <CircleAlert size={16} strokeWidth={1.5} />
              База не отвечает.
            </p>
            <p className="mt-2 font-mono text-[11.5px] break-words text-text-3">{health.error}</p>
          </>
        )}
      </section>

      <p className="text-text-3">
        Этап 1 — каркас. Экраны появятся на третьем этапе.
      </p>
    </main>
  );
}
