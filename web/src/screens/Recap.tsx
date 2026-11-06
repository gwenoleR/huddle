import { useEffect, useState } from 'react';
import { Button } from '../ds';
import { useRecap } from '../lib/data';
import { drawRecap, RECAP_H, RECAP_W } from '../lib/recapImage';
import { BackLink, Loading } from './shared';
import { config, t } from '../lib/i18n';

/** Weekly recap: image generated on the phone, shared through the system Share menu. */
export function Recap({ week, notify }: { week?: number; notify: (m: string) => void }) {
  const q = useRecap(week);
  const data = q.data ?? null;
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [drawError, setDrawError] = useState<string | null>(null);
  const error = q.error?.message ?? drawError;

  // The image is prepared in advance: sharing must start directly from the tap on the button.
  useEffect(() => {
    if (!data) return;
    let objectUrl: string | null = null;
    drawRecap(data)
      .then((blob) => {
        const f = new File([blob], `prono-${data.label.toLowerCase().replace(/\s+/g, '-')}.png`, { type: 'image/png' });
        objectUrl = URL.createObjectURL(f);
        setFile(f);
        setUrl(objectUrl);
      })
      .catch((e) => setDrawError(e.message));
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [data]);

  const canShare = !!file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });

  async function share() {
    if (!file || !data) return;
    try {
      await navigator.share({ files: [file], title: t.recap.shareTitle(config.appShortName, data.label) });
    } catch (e) {
      if ((e as Error).name !== 'AbortError') notify(t.recap.shareFailed);
    }
  }

  return (
    <div className="screen-inner">
      <header style={{ padding: '16px 8px 0', display: 'flex', alignItems: 'center' }}>
        <BackLink href="#/standings" label={t.leaderboard.title} />
      </header>
      <main className="stack" style={{ gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="eyebrow">{t.recap.eyebrow}</span>
          <h1 className="h1">{t.recap.title(data?.label ?? null)}</h1>
        </div>

        {error && <p className="error-box card">{error}</p>}
        {!error && !url && <Loading />}
        {url && (
          <img
            src={url}
            alt={t.recap.imageAlt(data?.label ?? '')}
            width={RECAP_W}
            height={RECAP_H}
            style={{ width: '100%', height: 'auto', borderRadius: 'var(--radius-lg)', border: '1px solid var(--line)' }}
          />
        )}
        {data && !data.complete && (
          <p className="muted small" style={{ margin: 0 }}>
            {t.recap.incomplete(data.finals, data.total)}
          </p>
        )}

        {url && canShare && (
          <Button block onClick={share}>
            {t.recap.share}
          </Button>
        )}
        {url && (
          <a className={canShare ? 'pr-btn pr-btn-secondary pr-btn-block' : 'pr-btn pr-btn-primary pr-btn-block'} href={url} download={file?.name} style={centered}>
            {t.recap.save}
          </a>
        )}
      </main>
    </div>
  );
}

const centered = { display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' } as const;
