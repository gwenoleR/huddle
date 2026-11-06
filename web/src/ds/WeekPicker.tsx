import { cx } from './cx';
import './WeekPicker.css';
import { t } from '../lib/i18n';

export function WeekPicker({
  weeks,
  value,
  onChange
}: {
  weeks: { id: number; label: string }[];
  value: number;
  onChange?: (id: number) => void;
}) {
  return (
    <nav className="pr-weeks" aria-label={t.ds.weekPickerLabel}>
      {weeks.map((w) => {
        const on = w.id === value;
        return (
          <button
            key={w.id}
            type="button"
            className={cx('pr-week', on && 'pr-week-on')}
            aria-current={on ? 'true' : undefined}
            data-week={w.id}
            onClick={onChange ? () => onChange(w.id) : undefined}
          >
            {w.label}
          </button>
        );
      })}
    </nav>
  );
}
