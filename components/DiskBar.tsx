import type { Disk } from './DisksProvider';

/**
 * Заполнение диска — одно на «Диски», страницу диска и «Статистику», чтобы
 * они не расходились. Доля = занято / объём (сводка /api/disks), в границах
 * 0–1. Полоса --sky, при ≥ 90% — --orange; красный не используется, он отдан
 * действиям (6.4, 6.5).
 */
export function diskShare(disk: Pick<Disk, 'usedGb' | 'sizeGb'>): number {
  if (!(disk.sizeGb > 0)) return 0;
  return Math.min(Math.max(disk.usedGb / disk.sizeGb, 0), 1);
}

export function DiskBar({
  disk,
  className = '',
}: {
  disk: Pick<Disk, 'usedGb' | 'sizeGb'>;
  className?: string;
}) {
  const share = diskShare(disk);

  return (
    <span className={`block h-[6px] overflow-hidden rounded-pill bg-surface-3 ${className}`}>
      <span
        className="block h-full rounded-pill"
        style={{ width: `${share * 100}%`, background: share >= 0.9 ? 'var(--orange)' : 'var(--sky)' }}
      />
    </span>
  );
}
