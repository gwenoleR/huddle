import type { ButtonHTMLAttributes } from 'react';
import { cx } from './cx';
import './Button.css';

export function Button({
  variant = 'primary',
  block,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost'; block?: boolean }) {
  return <button type="button" {...rest} className={cx('pr-btn', `pr-btn-${variant}`, block && 'pr-btn-block', className)} />;
}
