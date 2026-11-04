import { cx } from './cx';
import { Icon } from './Icon';
import './BottomNav.css';

export function BottomNav({ active, onChange }: { active: string; onChange?: (id: string) => void }) {
  const items = [
    { id: 'matchs', label: 'Matchs' },
    { id: 'classement', label: 'Classement' },
    { id: 'profil', label: 'Profil' }
  ];
  return (
    <nav className="pr-nav" aria-label="Navigation principale">
      {items.map((it) => {
        const on = it.id === active;
        return (
          <button
            key={it.id}
            type="button"
            className={cx('pr-nav-item', on && 'pr-nav-on')}
            aria-current={on ? 'page' : undefined}
            onClick={onChange ? () => onChange(it.id) : undefined}
          >
            <Icon name={it.id} />
            <span>{it.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
