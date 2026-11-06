import { useEffect, useRef, useState } from 'react';
import { Button } from '../ds';
import { useUpdateCheck } from '../lib/useUpdateCheck';
import { reloadLatest } from '../lib/version';
import { t } from '../lib/i18n';

/** Feuille « Nouvelle version » : proposée à l'ouverture dès que le serveur a été mis à jour. */
export function UpdatePrompt() {
  const { available, later } = useUpdateCheck();
  const ref = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (available && !dlg.open) dlg.showModal();
    if (!available && dlg.open) dlg.close();
  }, [available]);

  return (
    <dialog ref={ref} className="sheet" aria-labelledby="update-title" onClose={later} onClick={(e) => e.target === ref.current && later()}>
      <div className="sheet-body">
        <h2 id="update-title" className="h1" style={{ textAlign: 'center', margin: 0 }}>
          {t.app.updateTitle}
        </h2>
        <p className="muted" style={{ margin: 0, textAlign: 'center', fontSize: 15 }}>
          {t.app.updateText}
        </p>
        <Button
          block
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void reloadLatest();
          }}
        >
          {busy ? t.app.updating : t.app.update}
        </Button>
        <Button block variant="secondary" onClick={later}>
          {t.app.later}
        </Button>
      </div>
    </dialog>
  );
}
