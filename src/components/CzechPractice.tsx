import { useEffect, useRef, useState } from 'react';
import { puzzles } from '../content/animals';
import { getSize, sizes } from '../domain/categories';
import {
  createSpellingAttempt,
  currentWord,
  spellingComplete,
  submitSpelling,
} from '../domain/spelling';
import type { Progress } from '../storage/progress';
import type { Messages } from '../i18n/en';
import { useWordAudio } from '../useWordAudio';
import { Modal } from './Modal';
import { PixelArt, PixelGrid } from './PixelArt';

export function CzechPractice({
  progress,
  store,
  activeId,
  onSelect,
  onHome,
  suspended,
  t,
}: {
  progress: Progress;
  store: (progress: Progress) => boolean;
  activeId: string | null;
  onSelect: (id: string) => void;
  onHome: () => void;
  suspended: boolean;
  t: Messages;
}) {
  const [restart, setRestart] = useState(false);
  const [round, setRound] = useState(0);
  const [latest, setLatest] = useState<string>();
  const progressRef = useRef(progress);
  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);
  const heading = useRef<HTMLHeadingElement>(null);
  const collection = progress.czech;
  const puzzle = puzzles.find(({ id }) => id === activeId);
  const attempt = activeId ? collection?.attempts[activeId] : undefined;
  const complete = attempt ? spellingComplete(attempt) : false;
  const current = attempt ? currentWord(attempt) : undefined;
  useEffect(() => {
    if (!activeId || complete) heading.current?.focus({ preventScroll: true });
  }, [activeId, complete]);

  function open(id: string, replay = false) {
    const selected = puzzles.find((item) => item.id === id);
    if (!selected) throw new TypeError('Unknown puzzle.');
    const previous = progressRef.current;
    const czech = previous.czech ?? { attempts: {}, completed: [] };
    if (replay || !czech.attempts[id]) {
      const next = {
        ...previous,
        czech: {
          ...czech,
          attempts: {
            ...czech.attempts,
            [id]: createSpellingAttempt(selected),
          },
        },
      };
      progressRef.current = next;
      store(next);
    }
    setLatest(undefined);
    setRound((value) => value + 1);
    onSelect(id);
  }

  function check(answer: string, pixelId: string): boolean {
    const previous = progressRef.current;
    const czech = previous.czech;
    const saved = activeId ? czech?.attempts[activeId] : undefined;
    if (!saved || !czech || !activeId) return false;
    const next = submitSpelling(saved, answer, pixelId);
    if (next === saved) return false;
    const updated: Progress = {
      ...previous,
      czech: {
        attempts: { ...czech.attempts, [activeId]: next },
        completed: spellingComplete(next)
          ? [...new Set([...czech.completed, activeId])]
          : czech.completed,
      },
    };
    progressRef.current = updated;
    store(updated);
    setLatest(pixelId);
    return true;
  }

  if (!puzzle || !attempt)
    return (
      <section className="gallery" aria-labelledby="czech-gallery-title">
        <div className="hero">
          <span className="eyebrow">{t.spellingLevel}</span>
          <h1 id="czech-gallery-title" ref={heading} tabIndex={-1}>
            {t.galleryTitle}
          </h1>
          <p>{t.galleryIntro}</p>
        </div>
        <div className="collection-heading">
          <h2>{t.collection}</h2>
          <span>
            {collection?.completed.length ?? 0} / {puzzles.length} {t.friends}
          </span>
        </div>
        {sizes.map((size) => (
          <section
            className="difficulty-group"
            key={size}
            aria-labelledby={`czech-size-${size}`}
          >
            <h2 id={`czech-size-${size}`}>{t[size]}</h2>
            <div className="picture-gallery">
              {puzzles
                .filter((item) => getSize(item) === size)
                .sort((a, b) => a.pixels.length - b.pixels.length)
                .map((item) => {
                  const saved = collection?.attempts[item.id];
                  const done = saved && spellingComplete(saved);
                  return (
                    <button
                      className={`picture-card picture-${item.id}`}
                      key={item.id}
                      onClick={() => open(item.id)}
                      aria-label={`${t[item.name]} · ${done ? t.completed : saved ? t.continue : t.start}`}
                    >
                      <div className="card-art">
                        {collection?.completed.includes(item.id) && (
                          <span
                            className="discovery-badge"
                            aria-label={t.completed}
                          >
                            ✓
                          </span>
                        )}
                        <span className="art-halo" />
                        <PixelArt puzzle={item} />
                      </div>
                      <div className="card-copy">
                        <span className="card-level">
                          {item.pixels.length} {t.spellingWords}
                        </span>
                        <h3>{t[item.name]}</h3>
                        <div className="card-action">
                          <span>
                            {done ? t.completed : saved ? t.continue : t.start}
                          </span>
                          <span aria-hidden="true">↗</span>
                        </div>
                        {saved && !done && (
                          <progress
                            value={saved.solved.length}
                            max={item.pixels.length}
                            aria-label={`${t[item.name]}: ${t.filled}`}
                          />
                        )}
                      </div>
                    </button>
                  );
                })}
            </div>
          </section>
        ))}
      </section>
    );
  if (complete)
    return (
      <section className="completion" aria-labelledby="czech-complete-title">
        <span className="eyebrow">
          {t.completed} · {t[puzzle.name]}
        </span>
        <h1 id="czech-complete-title" ref={heading} tabIndex={-1}>
          {t.completeTitle}
        </h1>
        <div
          className={`celebration-art picture-${puzzle.id}`}
          role="img"
          aria-label={`${t.fullGrid}: ${t[puzzle.name]}`}
        >
          <PixelArt puzzle={puzzle} />
        </div>
        <p>{t.completeBody}</p>
        <div className="button-row">
          <button className="primary" onClick={onHome}>
            {t.gallery}
          </button>
          <button className="secondary" onClick={() => open(puzzle.id, true)}>
            {t.replay}
          </button>
        </div>
      </section>
    );
  return (
    <section className="game" aria-labelledby="czech-game-title">
      <div className="game-nav">
        <button className="back-button" onClick={onHome}>
          ← {t.gallery}
        </button>
        <span className="level-pill">{t.spellingLevel}</span>
      </div>
      <h1 id="czech-game-title">{t[puzzle.name]}</h1>
      <div className="game-layout">
        <div className="picture-panel">
          <PixelGrid
            puzzle={puzzle}
            solved={attempt.solved}
            latest={latest}
            activeRow={
              progress.showRowHints && current
                ? Number(current.pixelId.split(':')[0])
                : undefined
            }
            t={t}
          />
          <p className="picture-caption" role="status">
            {latest ? t.correct : t.gentle}
          </p>
        </div>
        {current && (
          <WordRound
            key={`${round}-${current.pixelId}`}
            wordId={current.wordId}
            onCheck={(answer) => check(answer, current.pixelId)}
            suspended={suspended || restart}
            t={t}
          />
        )}
      </div>
      <button
        className="text-button restart-button"
        onClick={(event) => {
          event.currentTarget.focus();
          setRestart(true);
        }}
      >
        {t.restart}
      </button>
      {restart && (
        <Modal
          title={t.restartTitle}
          closeLabel={t.cancel}
          onClose={() => setRestart(false)}
        >
          <p>{t.restartBody}</p>
          <button
            className="primary"
            onClick={() => {
              open(puzzle.id, true);
              setRestart(false);
            }}
          >
            {t.confirm}
          </button>
        </Modal>
      )}
    </section>
  );
}

function WordRound({
  wordId,
  onCheck,
  suspended,
  t,
}: {
  wordId: string;
  onCheck: (answer: string) => boolean;
  suspended: boolean;
  t: Messages;
}) {
  const [answer, setAnswer] = useState('');
  const [retry, setRetry] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const listenButton = useRef<HTMLButtonElement>(null);
  const locked = useRef(false);
  const audio = useWordAudio(wordId, suspended);
  const playing = audio.status === 'loading' || audio.status === 'playing';
  useEffect(() => {
    listenButton.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    if (audio.status === 'heard' && !suspended)
      input.current?.focus({ preventScroll: true });
  }, [audio.status, suspended]);
  function insert(letter: string) {
    const field = input.current;
    if (!field) return;
    const start = field.selectionStart ?? answer.length;
    const end = field.selectionEnd ?? start;
    const next = answer.slice(0, start) + letter + answer.slice(end);
    if (next.length > 40) return;
    setAnswer(next);
    setRetry(false);
    field.focus();
    requestAnimationFrame(() => field.setSelectionRange(start + 1, start + 1));
  }
  return (
    <form
      className="equation-panel spelling-panel"
      onSubmit={(event) => {
        event.preventDefault();
        if (
          locked.current ||
          suspended ||
          playing ||
          !audio.heard ||
          !answer.trim()
        )
          return;
        locked.current = true;
        if (!onCheck(answer)) {
          locked.current = false;
          setRetry(true);
          input.current?.focus();
        }
      }}
    >
      <span className="eyebrow">{t.spellingSolve}</span>
      <div className="listen-controls">
        <button
          ref={listenButton}
          className="primary"
          type="button"
          disabled={playing || suspended}
          onClick={() => audio.listen()}
        >
          {audio.heard ? t.listenAgain : t.listen}
        </button>
        <button
          className="secondary"
          type="button"
          disabled={playing || suspended}
          onClick={() => audio.listen(true)}
        >
          {t.listenSlowly}
        </button>
      </div>
      <p
        className="audio-status"
        role={audio.status === 'error' ? 'alert' : 'status'}
      >
        {audio.status === 'error'
          ? t.audioError
          : audio.status === 'loading'
            ? t.audioLoading
            : audio.status === 'playing'
              ? t.audioPlaying
              : audio.heard
                ? t.spellingGentle
                : t.listenFirst}
      </p>
      <label className="spelling-answer">
        <span>{t.spellingAnswer}</span>
        <input
          ref={input}
          lang="cs"
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={40}
          value={answer}
          disabled={suspended}
          aria-describedby="spelling-hint spelling-feedback"
          onChange={(event) => {
            setAnswer(event.target.value);
            setRetry(false);
          }}
        />
      </label>
      <p className="spelling-hint" id="spelling-hint">
        {t.spellingHint}
      </p>
      <div className="accent-keys" role="group" aria-label={t.accentLetters}>
        {Array.from('áčďéěíňóřšťúůýž').map((letter) => (
          <button
            key={letter}
            type="button"
            lang="cs"
            disabled={suspended}
            aria-label={`${t.insertLetter} ${letter}`}
            onClick={() => insert(letter)}
          >
            {letter}
          </button>
        ))}
      </div>
      <p id="spelling-feedback" className="feedback" role="status">
        {retry ? t.spellingRetry : ''}
      </p>
      <button
        className="primary check-button"
        type="submit"
        disabled={suspended || playing || !audio.heard || !answer.trim()}
      >
        {t.check}
      </button>
    </form>
  );
}
