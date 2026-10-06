import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { latestGrades } from "../../domain/attempts";
import type {
  Attempt,
  FeedbackEvent,
  Grade,
  AttemptInput,
  Letter,
  QuestionRevision,
  StudySession,
} from "../../content/types";
import { db } from "../../storage/db";
import {
  completeAssessment,
  completeStudySession,
  revealFeedback,
  saveDraft,
  submitAttempt,
} from "../../storage/study-service";
import { useStudy, now, errorMessage } from "../../ui/AppContext";
import { Notice, PageHeader, formatTime } from "../../ui/FormControls";
import { AssetFigure } from "../../ui/AssetFigure";
import { MathText } from "../../ui/MathText";
import { QuestionContent } from "../../ui/QuestionContent";
import { FeedbackPanel } from "./FeedbackPanel";
import { useActiveTimer } from "./useActiveTimer";
const newInput = (sessionId: string, q: QuestionRevision): AttemptInput => ({
  submissionId: crypto.randomUUID(),
  sessionId,
  questionId: q.id,
  questionRevision: q.revision,
  response: null,
  confidence: "medium",
  guessed: false,
  doubt: false,
  usedHint: false,
  consulted: false,
  activeMs: 0,
});
export function PracticePage() {
  const { sessionId = "" } = useParams();
  const app = useStudy();
  const [session, setSession] = useState<StudySession>(),
    [questions, setQuestions] = useState<QuestionRevision[]>([]),
    [index, setIndex] = useState(0),
    [input, setInput] = useState<AttemptInput>(),
    [attempts, setAttempts] = useState<Attempt[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [paused, setPaused] = useState(false),
    [target, setTarget] = useState(10),
    [clock, setClock] = useState(Date.now()),
    [exposed, setExposed] = useState<
      Record<string, { question: QuestionRevision; grade: Grade }>
    >({});
  const exposureTokens = useRef(new Map<string, string>());
  const exposureToken = (id: string) => {
    if (!exposureTokens.current.has(id))
      exposureTokens.current.set(id, crypto.randomUUID());
    return exposureTokens.current.get(id)!;
  };
  const expose = async (saved: Attempt) => {
    const event: FeedbackEvent = await revealFeedback(
      db,
      saved.id,
      now(),
      exposureToken(saved.id),
    );
    const revision = event.questionRevision ?? saved.questionRevision;
    const view = await db.transaction(
      "r",
      [db.questionSnapshots, db.grades],
      async () => {
        const question = await db.questionSnapshots.get([
          saved.questionId,
          revision,
        ]);
        const decisions = (
          await db.grades.where("attemptId").equals(saved.id).toArray()
        ).filter(
          (grade) =>
            grade.questionRevision === revision &&
            Date.parse(grade.at) <= Date.parse(event.at),
        );
        const grade = latestGrades(decisions).get(saved.id);
        if (!question || !grade)
          throw new Error(
            "A revisão da correção registrada não está disponível.",
          );
        return { question, grade };
      },
    );
    // Freeze what this exposure recorded; a concurrent regrade needs another opening.
    setExposed((old) => ({ ...old, [saved.id]: view }));
  };
  const queue = useRef<Promise<void>>(Promise.resolve()),
    retryPayload = useRef<AttemptInput | null>(null),
    checkpoint = useRef<{
      input: AttemptInput;
      baseMs: number;
      writable: boolean;
      deadlineAt: string | null;
    } | null>(null),
    autoFinishAttempted = useRef<string | null>(null);
  const q = questions[index],
    blockingAssessment = app.history.sessions.find(
      (s) =>
        s.mode === "assessment" &&
        s.status === "active" &&
        s.id !== sessionId &&
        s.questions.some((item) => item.id === questions[index]?.id),
    ),
    attempt = attempts.find((a) => a.questionId === q?.id),
    isAssessment = session?.mode === "assessment",
    expired = !!session?.deadlineAt && clock >= Date.parse(session.deadlineAt),
    active =
      session?.status === "active" &&
      !attempt &&
      !expired &&
      !blockingAssessment;
  const timer = useActiveTimer({
    enabled: !!active,
    running: true,
    targetMs: isAssessment || target === 0 ? null : target * 60000,
  });
  const baseMs = useRef(0);
  if (input?.questionId === q?.id && input?.sessionId === sessionId && input) {
    checkpoint.current = {
      input,
      baseMs: baseMs.current,
      writable: !!active && !busy,
      deadlineAt: session?.deadlineAt ?? null,
    };
  }
  const persist = (value: AttemptInput, at = now()) => {
    queue.current = queue.current
      .then(() => saveDraft(db, value, at))
      .catch((e) => setError(`Rascunho não salvo: ${errorMessage(e)}`));
    return queue.current;
  };
  const flushCheckpoint = (
    questionId?: string,
    checkpointSessionId?: string,
  ) => {
    const current = checkpoint.current;
    const at = now();
    if (
      !current?.writable ||
      (questionId && current.input.questionId !== questionId) ||
      (checkpointSessionId &&
        current.input.sessionId !== checkpointSessionId) ||
      (current.deadlineAt && Date.parse(at) >= Date.parse(current.deadlineAt))
    )
      return;
    const value = {
      ...current.input,
      activeMs: current.baseMs + timer.getActiveMs(),
    };
    void persist(value, at);
  };
  useEffect(() => {
    const hidden = () => {
      if (document.visibilityState === "hidden") flushCheckpoint();
    };
    const pagehide = () => flushCheckpoint();
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("pagehide", pagehide);
    return () => {
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("pagehide", pagehide);
    };
  }, []);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const s = await db.sessions.get(sessionId);
        if (!s) throw new Error("Sessão não encontrada neste dispositivo.");
        const qs = await Promise.all(
          s.questions.map((r) => db.questionSnapshots.get([r.id, r.revision])),
        );
        if (qs.some((q) => !q))
          throw new Error("O conteúdo desta sessão não está disponível.");
        const ats = await db.attempts
          .where("sessionId")
          .equals(sessionId)
          .toArray();
        if (alive) {
          setSession(s);
          setQuestions(qs as QuestionRevision[]);
          setAttempts(ats);
          setIndex(
            Math.max(
              0,
              s.questions.findIndex(
                (r) => !ats.some((a) => a.questionId === r.id),
              ),
            ),
          );
        }
      } catch (e) {
        if (alive) setError(errorMessage(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [sessionId]);
  useEffect(() => {
    if (!q) return;
    let alive = true;
    setInput(undefined);
    retryPayload.current = null;
    setExposed({});
    exposureTokens.current.clear();
    checkpoint.current = null;
    timer.reset();
    if (session?.mode === "assessment" || !paused) timer.start();
    (async () => {
      await queue.current;
      const draft = await db.drafts.get([sessionId, q.id]);
      if (alive) {
        const value = attempts.find((a) => a.questionId === q.id) ??
          draft ?? {
            ...newInput(sessionId, q),
            consulted: session?.purpose === "guided",
          };
        baseMs.current = value.activeMs;
        setInput(value);
      }
    })().catch((e) => setError(errorMessage(e)));
    return () => {
      flushCheckpoint(q.id, sessionId);
      alive = false;
    };
  }, [q?.id, sessionId]);
  useEffect(() => {
    const id = setInterval(() => setClock(Date.now()), 500);
    return () => clearInterval(id);
  }, []);
  const update = (patch: Partial<AttemptInput>) => {
    if (!input || input.questionId !== q?.id || !active || busy) return;
    retryPayload.current = null;
    const value = {
      ...input,
      ...patch,
      activeMs: baseMs.current + timer.getActiveMs(),
    };
    setInput(value);
    void persist(value);
  };
  useEffect(() => {
    if (!active || !input || input.questionId !== q?.id || busy || paused)
      return;
    void persist({ ...input, activeMs: baseMs.current + timer.getActiveMs() });
  }, [Math.floor(timer.activeMs / 5000)]);
  const finish = async () => {
    if (!session || busy) return;
    setBusy(true);
    setError("");
    try {
      await queue.current;
      if (input && active && !expired)
        await saveDraft(
          db,
          { ...input, activeMs: baseMs.current + timer.getActiveMs() },
          now(),
        );
      const completed = await completeAssessment(db, session.id, now());
      setSession(completed);
      setAttempts(
        await db.attempts.where("sessionId").equals(session.id).toArray(),
      );
      await app.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    if (
      expired &&
      session?.status === "active" &&
      isAssessment &&
      !loading &&
      !busy &&
      autoFinishAttempted.current !== session.id
    ) {
      autoFinishAttempted.current = session.id;
      void finish();
    }
  }, [expired, session?.status, session?.id, loading, busy]);
  const submit = async (skip = false) => {
    if (!input || input.questionId !== q?.id || !active || busy) return;
    if (!skip && input.response === null) {
      setError("Escolha uma alternativa ou use “Pular questão”.");
      return;
    }
    setBusy(true);
    setError("");
    timer.pause();
    try {
      await queue.current;
      const payload = retryPayload.current ?? {
        ...input,
        response: skip ? null : input.response,
        activeMs: baseMs.current + timer.getActiveMs(),
      };
      retryPayload.current = payload;
      const saved = await submitAttempt(db, payload, now());
      setInput(saved);
      setAttempts((old) => [...old.filter((a) => a.id !== saved.id), saved]);
      if (!isAssessment) {
        await expose(saved);
        if (
          questions.every(
            (item) =>
              item.id === saved.questionId ||
              attempts.some((a) => a.questionId === item.id),
          )
        ) {
          setSession(await completeStudySession(db, sessionId, now()));
        }
      }
      await app.refresh();
    } catch (e) {
      setError(`A correção continua fechada. ${errorMessage(e)}`);
      timer.start();
    } finally {
      setBusy(false);
    }
  };
  const reveal = async (newExposure = false) => {
    if (!attempt || busy) return;
    setBusy(true);
    try {
      if (newExposure) exposureTokens.current.delete(attempt.id);
      await expose(attempt);
      await app.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const next = () => {
    setIndex((i) => i + 1);
    setPaused(false);
    timer.start();
  };
  const togglePause = () => {
    if (paused) {
      timer.start();
      setPaused(false);
    } else {
      timer.pause();
      setPaused(true);
      if (input)
        void persist({
          ...input,
          activeMs: baseMs.current + timer.getActiveMs(),
        });
    }
  };
  const feedbackView = exposed[attempt?.id ?? ""];
  const latestGrade = feedbackView?.grade;
  const currentGrade = latestGrades(
    app.history.grades.filter((g) => Date.parse(g.at) <= clock),
  ).get(attempt?.id ?? "");
  const correctionChanged =
    !!feedbackView &&
    !!currentGrade &&
    currentGrade.id !== feedbackView.grade.id;
  const feedbackQuestion = feedbackView?.question ?? q;
  const feedbackVisible =
    !!attempt &&
    (!isAssessment || session?.status === "completed") &&
    !blockingAssessment &&
    !!feedbackView;
  if (loading) return <p role="status">Abrindo sessão salva…</p>;
  if (!session || !q)
    return (
      <>
        <PageHeader title="Sessão indisponível" />
        <Notice kind="error">{error || "Não encontramos esta questão."}</Notice>
        <Link to="/questions">Voltar ao acervo</Link>
      </>
    );
  return (
    <div className="practice-page">
      <PageHeader
        eyebrow={
          isAssessment
            ? session.purpose === "benchmark"
              ? "Avaliação com itens inéditos"
              : "Simulado parcial"
            : session.purpose === "guided"
              ? "Prática guiada"
              : "Tentativa independente"
        }
        title={`Questão ${index + 1} de ${questions.length}`}
      >
        <p>
          UDESC {q.edition} · questão {q.originalNumber} · {q.period}
        </p>
      </PageHeader>
      {error && <Notice kind="error">{error}</Notice>}
      {session.purpose === "guided" && (
        <Notice>
          Esta prática segue o apoio do caderno e será registrada como consulta.
          Um acerto aqui não conta como evidência independente de retenção.
        </Notice>
      )}
      {blockingAssessment && (
        <Notice>
          A correção desta questão fica fechada até encerrar o simulado em
          andamento.{" "}
          <Link to={`/assessment/${blockingAssessment.id}`}>
            Retomar simulado
          </Link>
        </Notice>
      )}
      <div className="session-toolbar">
        {isAssessment ? (
          <p aria-live="off">
            Tempo restante:{" "}
            <strong>
              {formatTime(Math.max(0, Date.parse(session.deadlineAt!) - clock))}
            </strong>
          </p>
        ) : (
          <>
            <p>
              Tempo ativo:{" "}
              <strong>{formatTime(baseMs.current + timer.activeMs)}</strong>
            </p>
            <button type="button" onClick={togglePause} disabled={!active}>
              {paused ? "Retomar" : "Pausar"}
            </button>
            <label className="inline-field">
              Aviso em{" "}
              <select
                value={target}
                onChange={(e) => setTarget(Number(e.target.value))}
              >
                <option value={0}>Sem aviso</option>
                <option value={5}>5 min</option>
                <option value={10}>10 min</option>
                <option value={20}>20 min</option>
                <option value={30}>30 min</option>
              </select>
            </label>
          </>
        )}
      </div>
      {timer.reminderReached && !isAssessment && (
        <Notice>
          Você atingiu o tempo escolhido. Faça uma pausa quando precisar; a
          questão continua aberta.
        </Notice>
      )}
      {session.status === "completed" && (
        <Notice kind="success">
          {isAssessment
            ? "Simulado encerrado. Respostas salvas; correções disponíveis por questão."
            : "Treino encerrado. Tentativas salvas neste dispositivo."}
        </Notice>
      )}
      <QuestionContent question={q} revealTopic={feedbackVisible} />
      {input && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <fieldset disabled={!active || busy || paused}>
            <legend className="sr-only">Alternativas</legend>
            <div className="alternatives">
              {q.options.map((option) => (
                <label
                  className={`alternative ${input.response === option.letter ? "selected" : ""}`}
                  key={option.letter}
                >
                  <input
                    type="radio"
                    name="response"
                    checked={input.response === option.letter}
                    onChange={() =>
                      update({ response: option.letter as Letter })
                    }
                  />
                  <span className="letter">{option.letter}</span>
                  <span className="preserve-lines">
                    {option.text.split(/\n\s*\n/).map((block, blockIndex) => (
                      <span className="option-block" key={blockIndex}>
                        <MathText text={block} />
                        {q.assets
                          .filter(
                            (a) =>
                              a.anchor.target === "option" &&
                              a.anchor.optionLetter === option.letter &&
                              a.anchor.afterBlock === blockIndex,
                          )
                          .map((a) => (
                            <AssetFigure key={a.path} asset={a} />
                          ))}
                      </span>
                    ))}
                  </span>
                </label>
              ))}
            </div>
            <div className="attempt-context">
              <h2>Registro da tentativa</h2>
              <label className="field">
                Confiança antes da correção
                <select
                  value={input.confidence}
                  onChange={(e) =>
                    update({
                      confidence: e.target.value as AttemptInput["confidence"],
                    })
                  }
                >
                  <option value="low">Baixa — ainda tenho dúvida</option>
                  <option value="medium">Média</option>
                  <option value="high">Alta</option>
                </select>
              </label>
              <div className="checks">
                <label>
                  <input
                    type="checkbox"
                    checked={input.guessed}
                    onChange={(e) => update({ guessed: e.target.checked })}
                  />
                  Marquei por chute
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={input.doubt}
                    onChange={(e) => update({ doubt: e.target.checked })}
                  />
                  Tenho dúvida
                </label>
                {!isAssessment && (
                  <>
                    <label>
                      <input
                        type="checkbox"
                        checked={input.usedHint}
                        onChange={(e) => update({ usedHint: e.target.checked })}
                      />
                      Usei uma dica
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={input.consulted}
                        disabled={session.purpose === "guided"}
                        onChange={(e) => update({ consulted: e.target.checked })}
                      />
                      Consultei material
                    </label>
                  </>
                )}
              </div>
            </div>
          </fieldset>
          {active && (
            <div className="actions">
              <button
                className="primary"
                disabled={busy || paused}
                type="submit"
              >
                {busy ? "Salvando…" : "Registrar resposta"}
              </button>
              <button
                type="button"
                disabled={busy || paused}
                onClick={() => void submit(true)}
              >
                Pular questão
              </button>
            </div>
          )}
        </form>
      )}
      {attempt && !feedbackVisible && (
        <Notice>
          {isAssessment && session.status === "active"
            ? "Resposta registrada. A correção fica fechada até encerrar o simulado."
            : "Tentativa registrada. Abra a correção quando quiser."}
          {(!isAssessment || session.status === "completed") &&
            !blockingAssessment && (
              <button
                disabled={busy}
                type="button"
                onClick={() => void reveal()}
              >
                Ver correção
              </button>
            )}
        </Notice>
      )}
      {feedbackVisible && attempt && (
        <FeedbackPanel
          attempt={attempt}
          grade={latestGrade}
          question={feedbackQuestion}
        />
      )}
      {feedbackVisible && correctionChanged && (
        <Notice>
          Há uma decisão mais recente para esta tentativa. A correção acima
          corresponde à revisão que você abriu.
          <button disabled={busy} onClick={() => void reveal(true)}>
            Abrir correção atualizada
          </button>
        </Notice>
      )}
      {feedbackVisible && (
        <Link to={`/notebook?question=${q.id}`}>
          Registrar causa e anotação no caderno
        </Link>
      )}
      <div className="actions">
        {attempt && index < questions.length - 1 && (
          <button className="primary" disabled={busy || !input} onClick={next}>
            Próxima questão
          </button>
        )}
        {isAssessment && session.status === "active" && (
          <button disabled={busy} onClick={() => void finish()}>
            Encerrar simulado
          </button>
        )}
        {(!isAssessment || session.status === "completed") &&
          index === questions.length - 1 && (
            <Link className="button" to="/">
              Voltar ao plano de hoje
            </Link>
          )}
      </div>
      {isAssessment && (
        <nav aria-label="Questões do simulado" className="question-index">
          {questions.map((item, i) => (
            <button
              type="button"
              disabled={busy || input?.questionId !== q.id}
              aria-current={i === index ? "step" : undefined}
              key={item.id}
              onClick={() => {
                setPaused(false);
                timer.start();
                setIndex(i);
              }}
            >
              {i + 1}
              {attempts.some((a) => a.questionId === item.id) ? " ✓" : ""}
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}
