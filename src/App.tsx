import { useEffect, useRef, useState } from 'react';
import { puzzles } from './content/animals';
import { difficulties, getDifficulty, getSize } from './domain/categories';
import {
  createAttempt,
  currentExercise,
  deferExercise,
  isComplete,
  submitAnswer,
} from './domain/game';
import { PixelArt, PixelGrid } from './components/PixelArt';
import { Modal } from './components/Modal';
import { detectLanguage, messages } from './i18n';
import {
  emptyProgress,
  loadProgress,
  saveProgress,
  resetAllProgress,
  resetPuzzle,
} from './storage/progress';
import type { Language, LoadResult, Progress } from './storage/progress';
import { usePwa } from './pwa/usePwa';
import { analyticsEnabled, trackPuzzle } from './analytics';
import { usePuzzleTime } from './usePuzzleTime';
import { CzechPractice } from './components/CzechPractice';
import { practiceMessages } from './i18n/practice';

function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'SecurityError')
      return null;
    throw error;
  }
}

function initialProgress(): LoadResult {
  const language = detectLanguage(navigator.languages ?? [navigator.language]);
  const storage = browserStorage();
  return storage
    ? loadProgress(storage, language)
    : { progress: emptyProgress(language), notice: 'unavailable' };
}

const puzzleGroups = difficulties.map((difficulty) => ({
  difficulty,
  puzzles: puzzles
    .filter((puzzle) => getDifficulty(puzzle) === difficulty)
    .sort((a, b) => a.pixels.length - b.pixels.length),
}));

export function App() {
  const [initial] = useState(initialProgress);
  const [progress, setProgress] = useState(initial.progress);
  const progressRef = useRef(progress);
  const [notice, setNotice] = useState(initial.notice);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState<
    'retry' | 'range' | 'correct' | 'practiceCorrect' | 'retryOnly' | null
  >(null);
  const [latest, setLatest] = useState<string>();
  const [pendingExercise, setPendingExercise] = useState<{
    exercise: NonNullable<ReturnType<typeof currentExercise>>;
    review: boolean;
  }>();
  const pending = pendingExercise !== undefined;
  const locked = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [modal, setModal] = useState<
    'help' | 'settings' | 'restart' | 'reset' | null
  >(null);
  const modalOpen = useRef(false);
  const [persistent, setPersistent] = useState<
    'persisted' | 'notPersisted' | 'persistError' | null
  >(null);
  const [updateDismissed, setUpdateDismissed] = useState(false);
  const [updateBlocked, setUpdateBlocked] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const answerRef = useRef<HTMLInputElement>(null);
  const pwa = usePwa();
  const subject = progress.subject ?? 'math';
  const t = practiceMessages(messages[progress.language], subject);
  const puzzle = puzzles.find((item) => item.id === activeId);
  const attempt = activeId ? progress.attempts[activeId] : undefined;
  const complete = attempt ? isComplete(attempt) : false;
  usePuzzleTime(
    subject === 'math' && attempt && !complete && modal === null
      ? activeId
      : null,
  );
  const current =
    pendingExercise?.exercise ??
    (attempt ? currentExercise(attempt) : undefined);
  const reviewing =
    pendingExercise?.review ?? attempt?.reviewPixelId !== undefined;
  const activeRow =
    current && progress.showRowHints && !reviewing
      ? Number(current.pixelId.split(':')[0])
      : undefined;
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && navigator.standalone === true);

  useEffect(() => {
    document.documentElement.lang = progress.language;
  }, [progress.language]);
  useEffect(() => {
    modalOpen.current = modal !== null;
  }, [modal]);
  useEffect(() => {
    if (activeId && !complete)
      answerRef.current?.focus({ preventScroll: true });
    else heading.current?.focus({ preventScroll: true });
  }, [activeId, complete]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function persist(next: Progress): boolean {
    const storage = browserStorage();
    const ok = storage !== null && saveProgress(storage, next).ok;
    if (!ok) setNotice('unavailable');
    else
      setNotice((previous) => (previous === 'unavailable' ? null : previous));
    return ok;
  }
  function store(next: Progress) {
    progressRef.current = next;
    setProgress(next);
    return persist(next);
  }
  function clearInteraction() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    locked.current = false;
    setPendingExercise(undefined);
    setAnswer('');
    setFeedback(null);
    setLatest(undefined);
  }
  function openPuzzle(id: string, replay = false) {
    const selected = puzzles.find((item) => item.id === id);
    if (!selected) throw new Error('Unknown puzzle.');
    clearInteraction();
    const previous = progressRef.current;
    if (replay || !previous.attempts[id]) {
      store({
        ...previous,
        attempts: { ...previous.attempts, [id]: createAttempt(selected) },
      });
      trackPuzzle('Puzzle started', id);
    }
    setActiveId(id);
  }
  function goHome() {
    clearInteraction();
    setActiveId(null);
  }
  function changeLanguage(language: Language) {
    store({ ...progressRef.current, language });
  }
  function editAnswer(value: string) {
    if (locked.current) return;
    const digits = value.replace(/[^0-9]/g, '').slice(0, 2);
    setAnswer(digits === '' ? '' : String(Number(digits)));
    setFeedback(null);
  }
  function checkAnswer() {
    if (locked.current || !attempt || !current || !answer || !activeId) return;
    const answered = submitAnswer(attempt, answer, current.pixelId);
    const correct = answered !== attempt;
    const next = correct ? answered : deferExercise(attempt, current.pixelId);
    const revealed = next.solved.length > attempt.solved.length;
    locked.current = true;
    setPendingExercise({ exercise: current, review: reviewing });
    setFeedback(
      correct
        ? revealed
          ? 'correct'
          : 'practiceCorrect'
        : next === attempt
          ? 'retryOnly'
          : Number(answer) < 1 || Number(answer) > 20
            ? 'range'
            : 'retry',
    );
    setLatest(revealed ? current.pixelId : undefined);
    const previous = progressRef.current;
    store({
      ...previous,
      attempts: { ...previous.attempts, [activeId]: next },
      completed: isComplete(next)
        ? [...new Set([...previous.completed, activeId])]
        : previous.completed,
    });
    if (revealed && isComplete(next)) trackPuzzle('Puzzle completed', activeId);
    timer.current = setTimeout(
      () => {
        locked.current = false;
        setPendingExercise(undefined);
        setAnswer('');
        setFeedback(null);
        setLatest(undefined);
        if (!modalOpen.current)
          answerRef.current?.focus({ preventScroll: true });
      },
      correct ? 650 : 900,
    );
  }
  async function update() {
    if (!persist(progressRef.current)) {
      setUpdateBlocked(true);
      return;
    }
    setUpdateBlocked(false);
    await pwa.acceptUpdate();
  }
  async function requestPersistence() {
    try {
      const granted = await navigator.storage.persist();
      setPersistent(granted ? 'persisted' : 'notPersisted');
    } catch {
      setPersistent('persistError');
    }
  }
  function confirmReset() {
    if (modal === 'reset') {
      store(resetAllProgress(progressRef.current));
      goHome();
    } else if (modal === 'restart' && activeId) {
      const next = resetPuzzle(progressRef.current, activeId);
      progressRef.current = next;
      openPuzzle(activeId, true);
    }
    setModal(null);
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <button className="brand" onClick={goHome} aria-label={t.homeLabel}>
          <span className="brand-icon" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </span>
          Mathogram
          <span className="brand-dot" aria-hidden="true">
            .
          </span>
        </button>
        <div className="header-actions">
          <button
            className="language-toggle"
            onClick={() =>
              changeLanguage(progress.language === 'en' ? 'cs' : 'en')
            }
            aria-label={`${t.language}: ${progress.language === 'en' ? 'Čeština' : 'English'}`}
          >
            {progress.language === 'en' ? 'Česky' : 'English'}
          </button>
          <button
            className="header-tool"
            onClick={(event) => {
              event.currentTarget.focus();
              setModal('settings');
            }}
          >
            <span className="header-tool-icon" aria-hidden="true">
              ⚙
            </span>
            {t.settings}
          </button>
          <button
            className="header-tool"
            onClick={(event) => {
              event.currentTarget.focus();
              setModal('help');
            }}
          >
            <span className="header-tool-icon" aria-hidden="true">
              ?
            </span>
            {t.help}
          </button>
        </div>
      </header>
      <nav className="subject-switch" aria-label={t.subject}>
        {(['math', 'czech'] as const).map((value) => (
          <button
            key={value}
            aria-pressed={subject === value}
            onClick={() => {
              if (subject === value) return;
              goHome();
              store({ ...progressRef.current, subject: value });
            }}
          >
            {t[value]}
          </button>
        ))}
      </nav>

      {notice && (
        <div className="notice" role="alert">
          {t[notice]}
        </div>
      )}
      {pwa.error && (
        <div className="notice" role="alert">
          {t.cacheError} <button onClick={pwa.retry}>{t.retryOffline}</button>
        </div>
      )}
      {pwa.waiting && !updateDismissed && (
        <aside className="update-banner" aria-label={t.updateTitle}>
          <div>
            <strong>{t.updateTitle}</strong>
            <p>{t.updateBody}</p>
          </div>
          <div className="button-row">
            <button
              className="primary"
              onClick={() => {
                void update();
              }}
            >
              {t.update}
            </button>
            <button
              className="secondary"
              onClick={() => setUpdateDismissed(true)}
            >
              {t.later}
            </button>
          </div>
          {updateBlocked && <p role="alert">{t.updateBlocked}</p>}
        </aside>
      )}

      <main>
        {subject === 'czech' ? (
          <CzechPractice
            progress={progress}
            store={store}
            activeId={activeId}
            onSelect={setActiveId}
            onHome={goHome}
            suspended={modal !== null}
            t={t}
          />
        ) : !puzzle || !attempt ? (
          <section className="gallery" aria-labelledby="gallery-title">
            <div className="hero">
              <span className="hero-spark spark-one" aria-hidden="true">
                ✦
              </span>
              <span className="eyebrow">{t.tagline}</span>
              <h1 id="gallery-title" tabIndex={-1} ref={heading}>
                {t.galleryTitle}
              </h1>
              <p>{t.galleryIntro}</p>
              <span className="hero-spark spark-two" aria-hidden="true">
                ✧
              </span>
            </div>
            <div className="collection-heading">
              <h2>{t.collection}</h2>
              <span>
                <span aria-hidden="true">✦ </span>
                {progress.completed.length} / {puzzles.length} {t.friends}
              </span>
            </div>
            {puzzleGroups.map((group) => (
              <section
                className="difficulty-group"
                key={group.difficulty}
                aria-labelledby={`difficulty-${group.difficulty}`}
              >
                <h2 id={`difficulty-${group.difficulty}`}>
                  {t[group.difficulty]}
                </h2>
                <div className="picture-gallery">
                  {group.puzzles.map((animal) => {
                    const saved = progress.attempts[animal.id];
                    const done = saved && isComplete(saved);
                    const badge = progress.completed.includes(animal.id);
                    return (
                      <button
                        key={animal.id}
                        className={`picture-card picture-${animal.id}`}
                        onClick={() => openPuzzle(animal.id)}
                        aria-label={`${t[animal.name]} · ${done ? t.completed : saved ? t.continue : t.start}`}
                        aria-describedby={`category-${animal.id}`}
                      >
                        <div className="card-art">
                          <span className="picture-number" aria-hidden="true">
                            {String(puzzles.indexOf(animal) + 1).padStart(
                              2,
                              '0',
                            )}
                          </span>
                          {badge && (
                            <span
                              className="discovery-badge"
                              aria-label={t.completed}
                            >
                              ✓
                            </span>
                          )}
                          <span className="art-halo" />
                          <PixelArt puzzle={animal} />
                          <span className="card-spark" aria-hidden="true">
                            ✦
                          </span>
                        </div>
                        <div className="card-copy">
                          <span
                            className="card-level"
                            id={`category-${animal.id}`}
                          >
                            {t[getDifficulty(animal)]} · {t[getSize(animal)]}
                            <span className="card-exercises">
                              {animal.pixels.length} {t.exercises}
                            </span>
                          </span>
                          <h3>{t[animal.name]}</h3>
                          <div className="card-action">
                            <span>
                              {done
                                ? t.completed
                                : saved
                                  ? t.continue
                                  : t.start}
                            </span>
                            <span aria-hidden="true">{done ? '✓' : '↗'}</span>
                          </div>
                          {saved && !done && (
                            <progress
                              value={saved.solved.length}
                              max={animal.pixels.length}
                              aria-label={`${t[animal.name]}: ${t.filled}`}
                            />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
            <p className="gallery-note">
              <span aria-hidden="true">♡ </span>
              {t.gentle}
            </p>
          </section>
        ) : complete ? (
          <section className="completion" aria-labelledby="complete-title">
            <span className="eyebrow">
              {t.completed} · {t[puzzle.name]}
            </span>
            <h1 id="complete-title" ref={heading} tabIndex={-1}>
              {t.completeTitle}
            </h1>
            <div
              className={`celebration-art picture-${puzzle.id}`}
              role="img"
              aria-label={`${t.fullGrid}: ${t[puzzle.name]}`}
            >
              <span className="celebrate-star star-left" aria-hidden="true">
                ✦
              </span>
              <PixelArt puzzle={puzzle} />
              <span className="celebrate-star star-right" aria-hidden="true">
                ✧
              </span>
            </div>
            <p>{t.completeBody}</p>
            <div className="button-row">
              <button className="primary" onClick={goHome}>
                {t.gallery}
              </button>
              <button
                className="secondary"
                onClick={() => openPuzzle(puzzle.id, true)}
              >
                {t.replay}
              </button>
            </div>
          </section>
        ) : (
          <section className="game" aria-labelledby="game-title">
            <div className="game-nav">
              <button className="back-button" onClick={goHome}>
                <span aria-hidden="true">←</span> {t.gallery}
              </button>
              <span className="level-pill">{t[getDifficulty(puzzle)]}</span>
            </div>
            <h1 id="game-title">{t[puzzle.name]}</h1>
            <div className="game-layout">
              <div className="picture-panel">
                <PixelGrid
                  puzzle={puzzle}
                  solved={attempt.solved}
                  activeRow={activeRow}
                  latest={latest}
                  t={t}
                />
                <p className="picture-caption">
                  {reviewing ? t.practiceHint : t.playHint}
                </p>
              </div>
              <form
                className="equation-panel"
                onSubmit={(event) => {
                  event.preventDefault();
                  checkAnswer();
                }}
                onKeyDown={(event) => {
                  if (event.ctrlKey || event.metaKey || event.altKey) return;
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    if (!event.repeat) checkAnswer();
                  } else if (
                    event.target !== answerRef.current &&
                    /^[0-9]$/.test(event.key)
                  ) {
                    event.preventDefault();
                    editAnswer(answer + event.key);
                  } else if (
                    event.target !== answerRef.current &&
                    event.key === 'Backspace'
                  ) {
                    event.preventDefault();
                    editAnswer(answer.slice(0, -1));
                  }
                }}
              >
                <div className="equation-heading">
                  <span className="eyebrow">
                    {reviewing ? t.practice : t.solve}
                  </span>
                  {activeRow !== undefined && (
                    <span className="row-pill">
                      {t.row}{' '}
                      <strong>{String.fromCharCode(64 + activeRow)}</strong>
                    </span>
                  )}
                </div>
                <div
                  className={`sum-line${puzzle.threeNumbers ? ' three-number-sum' : ''}`}
                  aria-live="off"
                >
                  <span data-testid="equation">
                    {current?.equation.a}{' '}
                    {current?.equation.op === '-' ? '−' : '+'}{' '}
                    {current?.equation.b}
                    {current?.equation.op2 !== undefined && (
                      <>
                        {' '}
                        {current.equation.op2 === '-' ? '−' : '+'}{' '}
                        {current.equation.d}
                      </>
                    )}
                  </span>
                  <span className="equals" aria-hidden="true">
                    =
                  </span>
                  <label
                    className={`answer-wrap ${feedback === 'retry' || feedback === 'range' || feedback === 'retryOnly' ? 'answer-retry' : ''}`}
                  >
                    <span className="sr-only">{t.answer}</span>
                    <input
                      ref={answerRef}
                      type="text"
                      inputMode="none"
                      autoComplete="off"
                      pattern="[0-9]*"
                      maxLength={2}
                      value={answer}
                      readOnly={pending}
                      onChange={(event) => editAnswer(event.target.value)}
                      aria-describedby="game-feedback"
                    />
                  </label>
                </div>
                <div
                  id="game-feedback"
                  className={`feedback ${feedback === 'correct' || feedback === 'practiceCorrect' ? 'positive' : ''}`}
                  role="status"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  {feedback ? (
                    <>
                      {t[feedback]}
                      {feedback === 'correct' && latest && progress.showRowHints
                        ? ` ${t.coordinate} ${String.fromCharCode(64 + Number(latest.split(':')[0]))}${latest.split(':')[1]}.`
                        : ''}
                    </>
                  ) : (
                    <span>{t.gentle}</span>
                  )}
                </div>
                <div className="keypad">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
                    <button
                      key={digit}
                      type="button"
                      disabled={pending}
                      onClick={() => editAnswer(answer + digit)}
                    >
                      {digit}
                    </button>
                  ))}
                  <span className="keypad-decoration" aria-hidden="true">
                    ✿
                  </span>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => editAnswer(answer + '0')}
                  >
                    0
                  </button>
                  <button
                    type="button"
                    className="erase-button"
                    disabled={pending || !answer}
                    aria-label={t.erase}
                    onClick={() => editAnswer(answer.slice(0, -1))}
                  >
                    ⌫
                  </button>
                </div>
                <button
                  className="primary check-button"
                  type="submit"
                  disabled={pending || !answer}
                >
                  {t.check}
                  <span aria-hidden="true">✓</span>
                </button>
              </form>
            </div>
            <button
              className="text-button restart-button"
              onClick={(event) => {
                event.currentTarget.focus();
                setModal('restart');
              }}
            >
              {t.restart}
            </button>
          </section>
        )}
      </main>
      <footer className="app-footer">
        <span
          className={`connection-status ${pwa.ready ? 'is-ready' : ''}`}
          role="status"
        >
          {pwa.offline ? t.offline : pwa.ready ? t.offlineReady : t.tagline}
        </span>
        <span>{notice === 'unavailable' ? '' : t.saved}</span>
      </footer>
      {modal && (
        <Modal
          title={
            modal === 'help'
              ? t.help
              : modal === 'settings'
                ? t.settings
                : modal === 'reset'
                  ? t.resetTitle
                  : t.restartTitle
          }
          onClose={() => setModal(null)}
          closeLabel={
            modal === 'help' || modal === 'settings' ? t.close : t.cancel
          }
        >
          {modal === 'help' ? (
            <>
              <h3>{t.howTitle}</h3>
              <p>{t.howBody}</p>
              {subject === 'math' ? (
                <p>{t.threeNumbersHelp}</p>
              ) : (
                <p>{t.audioHelp}</p>
              )}
              <p>{t.gentle}</p>
              {!standalone && (
                <>
                  <h3>{t.installTitle}</h3>
                  <p>{t.installBody}</p>
                </>
              )}
              <p>{t.offlineHelp}</p>
            </>
          ) : modal === 'settings' ? (
            <>
              <label className="language-setting">
                {t.language}
                <select
                  value={progress.language}
                  onChange={(event) =>
                    changeLanguage(event.target.value === 'cs' ? 'cs' : 'en')
                  }
                >
                  <option value="en">English</option>
                  <option value="cs">Čeština</option>
                </select>
              </label>
              <label className="hint-setting">
                <input
                  type="checkbox"
                  checked={progress.showRowHints}
                  aria-describedby="row-hints-help"
                  onChange={(event) =>
                    store({
                      ...progressRef.current,
                      showRowHints: event.target.checked,
                    })
                  }
                />
                {t.showRowHints}
              </label>
              <p id="row-hints-help">{t.rowHintsHelp}</p>
              <h3>{t.storageTitle}</h3>
              <p>{t.storageBody}</p>
              {analyticsEnabled && (
                <>
                  <h3>{t.analyticsTitle}</h3>
                  <p>{t.analyticsBody}</p>
                  <a href="https://docs.umami.is/docs/faq" rel="noreferrer">
                    {t.analyticsPolicy}
                  </a>
                </>
              )}
              {typeof navigator.storage?.persist === 'function' && (
                <button
                  className="secondary"
                  onClick={() => {
                    void requestPersistence();
                  }}
                >
                  {t.persist}
                </button>
              )}
              {persistent && <p role="status">{t[persistent]}</p>}
              {pwa.waiting && (
                <>
                  <button
                    className="secondary"
                    onClick={() => {
                      void update();
                    }}
                  >
                    {t.update}
                  </button>
                  {updateBlocked && <p role="alert">{t.updateBlocked}</p>}
                </>
              )}
              <button
                className="text-button danger"
                onClick={() => setModal('reset')}
              >
                {t.resetAll}
              </button>
            </>
          ) : (
            <>
              <p>{modal === 'reset' ? t.resetBody : t.restartBody}</p>
              <button className="primary" onClick={confirmReset}>
                {t.confirm}
              </button>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
