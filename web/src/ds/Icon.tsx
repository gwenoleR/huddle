const ICONS: Record<string, string[]> = {
  matchs: ['M4 20C4 11 11 4 20 4c0 9-7 16-16 16z', 'M9 15l6-6', 'M10.5 10.5l1.5 1.5', 'M12.5 8.5l1.5 1.5', 'M8.5 12.5l1.5 1.5'],
  classement: ['M7 4h10v4a5 5 0 0 1-10 0z', 'M7 6H4a3 3 0 0 0 3 4', 'M17 6h3a3 3 0 0 1-3 4', 'M12 13v4', 'M8 20h8', 'M9 17h6'],
  profil: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6']
};

export function Icon({ name, size = 24 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {(ICONS[name] ?? []).map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}
