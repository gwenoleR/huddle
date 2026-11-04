import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '../ds';
import { api, type RecapDto } from '../lib/api';
import { keys } from '../lib/queries';
import { drawRecap, RECAP_H, RECAP_W } from '../lib/recapImage';
import { BackLink, Loading } from './shared';

/** Récap de la semaine : image générée sur le téléphone, partagée via le menu Partager du système. */
export function Recap({ week, notify }: { week?: number; notify: (m: string) => void }) {
  const q = useQuery({ queryKey: keys.recap(week), queryFn: () => api<RecapDto>(week ? `/recap?week=${week}` : '/recap') });
  const data = q.data ?? null;
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [drawError, setDrawError] = useState<string | null>(null);
  const error = q.error?.message ?? drawError;

  // L'image est préparée à l'avance : le partage doit partir directement du toucher sur le bouton.
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
      await navigator.share({ files: [file], title: `Prono · ${data.label}` });
    } catch (e) {
      if ((e as Error).name !== 'AbortError') notify('Partage impossible, enregistre l’image à la place.');
    }
  }

  return (
    <div className="screen-inner">
      <header style={{ padding: '16px 8px 0', display: 'flex', alignItems: 'center' }}>
        <BackLink href="#/classement" label="Classement" />
      </header>
      <main className="stack" style={{ gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="eyebrow">À envoyer dans le groupe</span>
          <h1 className="h1">Récap {data ? `· ${data.label}` : 'de la semaine'}</h1>
        </div>

        {error && <p className="error-box card">{error}</p>}
        {!error && !url && <Loading />}
        {url && (
          <img
            src={url}
            alt={`Récap de la ${data?.label.toLowerCase()} : podium, classement général et boulette`}
            width={RECAP_W}
            height={RECAP_H}
            style={{ width: '100%', height: 'auto', borderRadius: 'var(--radius-lg)', border: '1px solid var(--line)' }}
          />
        )}
        {data && !data.complete && (
          <p className="muted small" style={{ margin: 0 }}>
            Semaine pas finie : {data.finals} matchs joués sur {data.total}. Le récap se complète au fil des matchs.
          </p>
        )}

        {url && canShare && (
          <Button block onClick={share}>
            Partager
          </Button>
        )}
        {url && (
          <a className={canShare ? 'pr-btn pr-btn-secondary pr-btn-block' : 'pr-btn pr-btn-primary pr-btn-block'} href={url} download={file?.name} style={centered}>
            Enregistrer l’image
          </a>
        )}
      </main>
    </div>
  );
}

const centered = { display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' } as const;
