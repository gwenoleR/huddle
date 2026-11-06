import { useCallback, useEffect, useRef, useState } from 'react';
import { Avatar, Button } from '../ds';
import { api, ApiError, type Me, type PlayerLite } from '../lib/api';
import { config, t } from '../lib/i18n';

export function Login({ onLogged }: { onLogged: (me: Me) => void }) {
  const [players, setPlayers] = useState<PlayerLite[] | null>(null);
  const [who, setWho] = useState<PlayerLite | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Empty database (fresh install): create the group, its creator becomes the admin.
  const setup = players?.length === 0;

  useEffect(() => {
    api<PlayerLite[]>('/players')
      .then(setPlayers)
      .catch((e) => setError(e.message));
  }, []);

  if (who) return <PinStep player={who} setup={setup} onBack={() => setWho(null)} onLogged={onLogged} />;
  if (setup) return <SetupName onNext={(name) => setWho({ id: 0, name, hasPin: false })} />;

  return (
    <div className="app">
      <main className="login">
        <header style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="brand-line">{config.appName.toLocaleUpperCase(t.common.locale)}</span>
          <h1 className="display">{t.login.whoTitle}</h1>
          <p className="muted" style={{ margin: 0, fontSize: 15, fontWeight: 500 }}>
            {t.login.whoHelp}
          </p>
        </header>
        {error && <p className="error-box card">{error}</p>}
        <div className="grid-2" style={{ gap: 8 }}>
          {players?.map((p) => (
            <button key={p.id} type="button" className="who-btn" onClick={() => setWho(p)}>
              <Avatar name={p.name} />
              <span>{p.name}</span>
            </button>
          ))}
        </div>
        <p className="muted small" style={{ margin: 0 }}>
          {t.login.notInList}
        </p>
      </main>
    </div>
  );
}

/** Fresh install: the first name of whoever creates the group (their code comes right after). */
function SetupName({ onNext }: { onNext: (name: string) => void }) {
  const [name, setName] = useState('');
  const trimmed = name.trim();
  return (
    <div className="app">
      <main className="login">
        <header style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="brand-line">{config.appName.toLocaleUpperCase(t.common.locale)}</span>
          <h1 className="display">{t.login.setupTitle}</h1>
          <p className="muted" style={{ margin: 0, fontSize: 15, fontWeight: 500 }}>
            {t.login.setupHelp}
          </p>
        </header>
        <form
          style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
          onSubmit={(e) => {
            e.preventDefault();
            if (trimmed) onNext(trimmed);
          }}
        >
          <label className="muted small" htmlFor="setup-name">
            {t.login.setupName}
          </label>
          <input id="setup-name" className="field" value={name} onChange={(e) => setName(e.target.value)} maxLength={30} autoFocus autoComplete="given-name" />
          <Button type="submit" block disabled={!trimmed}>
            {t.login.next}
          </Button>
        </form>
      </main>
    </div>
  );
}

function PinStep({
  player,
  setup = false,
  onBack,
  onLogged
}: {
  player: PlayerLite;
  /** Group creation: the confirmed code creates the admin player. */
  setup?: boolean;
  onBack: () => void;
  onLogged: (me: Me) => void;
}) {
  const creating = !player.hasPin;
  const [pin, setPinState] = useState('');
  const pinRef = useRef('');
  const setPin = (v: string) => {
    pinRef.current = v;
    setPinState(v);
  };
  const [first, setFirst] = useState<string | null>(null); // creation: first code typed
  const [msg, setMsg] = useState<{ text: string; tone: 'error' | 'info' } | null>(null);
  const [shake, setShake] = useState(false);
  const [busy, setBusy] = useState(false);

  const fail = (text: string) => {
    setMsg({ text, tone: 'error' });
    setShake(true);
    setTimeout(() => setShake(false), 400);
    setPin('');
  };

  const submit = useCallback(
    async (code: string) => {
      if (creating && first === null) {
        setFirst(code);
        setPin('');
        setMsg({ text: t.login.retypeToConfirm, tone: 'info' });
        return;
      }
      if (creating && first !== code) {
        setFirst(null);
        return fail(t.login.pinMismatch);
      }
      setBusy(true);
      try {
        if (setup) await api('/setup', { method: 'POST', body: { name: player.name, pin: code } });
        else await api('/login', { method: 'POST', body: { playerId: player.id, pin: code } });
        onLogged(await api<Me>('/me'));
      } catch (e) {
        fail(e instanceof ApiError ? e.message : t.common.errors.unexpected);
      } finally {
        setBusy(false);
      }
    },
    [creating, first, player.id, player.name, setup, onLogged]
  );

  const press = useCallback(
    (k: string) => {
      if (busy) return;
      // Read the current value from a ref: two quick presses must not step on each other.
      const current = pinRef.current;
      if (k === 'del') {
        pinRef.current = current.slice(0, -1);
        return setPin(pinRef.current);
      }
      if (current.length >= 4) return;
      const next = current + k;
      pinRef.current = next;
      setPin(next);
      if (next.length === 4) setTimeout(() => submit(next), 120);
    },
    [busy, submit]
  );

  // Physical keyboard (computer): digits and backspace.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') press('del');
      else if (e.key === 'Escape') onBack();
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [press, onBack]);

  const title = creating ? (first === null ? t.login.choosePin : t.login.confirmPin) : t.login.hello(player.name);
  const sub = creating ? t.login.newPinHelp : t.login.pinHelp;

  return (
    <div className="app">
      <main className="login pin">
        <div style={{ alignSelf: 'stretch' }}>
          <button type="button" className="back" onClick={onBack}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M15 18l-6-6 6-6" />
            </svg>
            {setup ? t.login.changeName : t.login.notYou}
          </button>
        </div>
        <Avatar name={player.name} size="lg" me />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <h1 className="h1">{title}</h1>
          <p className="muted" style={{ margin: 0, fontSize: 15, fontWeight: 500 }}>
            {sub}
          </p>
        </div>
        <div className={`dots${shake ? ' shake' : ''}`} role="img" aria-label={t.login.pinProgress(pin.length)}>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={i < pin.length ? 'on' : undefined} />
          ))}
        </div>
        <p className="pin-msg" role="status" style={{ color: msg?.tone === 'error' ? 'var(--wrong)' : 'var(--ink-muted)' }}>
          {msg?.text ?? ''}
        </p>
        <div className="keypad">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((n) => (
            <button key={n} type="button" className="key" onClick={() => press(n)}>
              {n}
            </button>
          ))}
          <span />
          <button type="button" className="key" onClick={() => press('0')}>
            0
          </button>
          <button type="button" className="key key-text" aria-label={t.login.eraseLabel} onClick={() => press('del')}>
            {t.login.erase}
          </button>
        </div>
        <p className="muted small" style={{ margin: 0 }}>
          {t.login.staysLogged}
        </p>
      </main>
    </div>
  );
}
