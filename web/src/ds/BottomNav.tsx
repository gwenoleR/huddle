import { cx } from './cx';
import { Icon, type IconName } from './Icon';
import './BottomNav.css';
import { t } from '../lib/i18n';

export function BottomNav({ active, onChange }: { active: string; onChange?: (id: string) => void }) {
  const items: { id: IconName; label: string }[] = [
    { id: 'matches', label: t.ds.nav.matches },
    { id: 'standings', label: t.ds.nav.standings },
    { id: 'profile', label: t.ds.nav.profile }
  ];
  return (
    <nav className="pr-nav" aria-label={t.ds.navLabel}>
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
