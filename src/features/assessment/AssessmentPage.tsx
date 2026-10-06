import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { Subject } from "../../content/types";
import { subjects, subjectLabels } from "../../content/constants";
import {
  assessmentPool,
  selectAssessment,
  type AssessmentConfig,
} from "../../domain/assessment";
import { db } from "../../storage/db";
import { startSession } from "../../storage/study-service";
import { useStudy, now, errorMessage } from "../../ui/AppContext";
import { Notice, PageHeader } from "../../ui/FormControls";
export function AssessmentPage() {
  const app = useStudy(),
    navigate = useNavigate();
  const [count, setCount] = useState(10),
    [minutes, setMinutes] = useState(30),
    [selected, setSelected] = useState<Subject[]>([...subjects]),
    [edition, setEdition] = useState(""),
    [purpose, setPurpose] = useState<"practice" | "benchmark">("practice"),
    [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard" | "">(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const assessedIds = new Set(
    app.history.sessions
      .filter((s) => s.mode === "assessment" && s.status === "active")
      .flatMap((s) => s.questions.map((q) => q.id)),
  );
  const available = app.catalogue.filter((q) => !assessedIds.has(q.id));
  const config: AssessmentConfig = {
    count,
    durationMinutes: minutes,
    subjects: selected,
    edition: edition || null,
    purpose,
    difficulty: difficulty || null,
  };
  const pool = assessmentPool(available, config, app.history);
  const start = async () => {
    setBusy(true);
    setError("");
    try {
      const questions = selectAssessment(
        available,
        config,
        Date.now(),
        app.history,
      );
      const session = await startSession(
        db,
        { questions, mode: "assessment", purpose, durationMs: minutes * 60000 },
        now(),
      );
      await app.refresh();
      navigate(`/assessment/${session.id}`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Link className="back-link" to="/questions">
        ← Questões
      </Link>
      <PageHeader eyebrow="Avaliação com prazo" title="Simulado parcial">
        <p>
          Uma seleção das cinco matérias do acervo. Não é a prova completa nem
          uma reprodução da duração oficial.
        </p>
      </PageHeader>
      {error && <Notice kind="error">{error}</Notice>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void start();
        }}
      >
        <div className="filters">
          <label className="field">
            Finalidade
            <select
              value={purpose}
              onChange={(e) => setPurpose(e.target.value as typeof purpose)}
            >
              <option value="practice">Prática com prazo</option>
              <option value="benchmark">Avaliação reservada inédita</option>
            </select>
          </label>
          <label className="field">
            Dificuldade declarada
            <select
              value={difficulty}
              onChange={(e) =>
                setDifficulty(e.target.value as typeof difficulty)
              }
            >
              <option value="">Todas as dificuldades</option>
              <option value="easy">Fácil</option>
              <option value="medium">Média</option>
              <option value="hard">Difícil</option>
            </select>
          </label>
          <label className="field">
            Quantidade de questões
            <input
              type="number"
              min={1}
              max={70}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
            />
          </label>
          <label className="field">
            Duração em minutos
            <input
              type="number"
              min={1}
              max={240}
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
            />
          </label>
          <label className="field">
            Edição
            <select
              value={edition}
              onChange={(e) => setEdition(e.target.value)}
            >
              <option value="">Todas as edições</option>
              {[...new Set(app.catalogue.map((q) => q.edition))].map((e) => (
                <option key={e}>{e}</option>
              ))}
            </select>
          </label>
        </div>
        <fieldset>
          <legend>Matérias incluídas</legend>
          <div className="checks">
            {subjects.map((s) => (
              <label key={s}>
                <input
                  type="checkbox"
                  checked={selected.includes(s)}
                  onChange={(e) =>
                    setSelected(
                      e.target.checked
                        ? [...selected, s]
                        : selected.filter((x) => x !== s),
                    )
                  }
                />
                {subjectLabels[s]}
              </label>
            ))}
          </div>
        </fieldset>
        <p>
          {pool.length}{" "}
          {purpose === "benchmark"
            ? "questões reservadas inéditas"
            : "questões prontas"}{" "}
          nesta seleção.
        </p>
        {purpose === "benchmark" && (
          <p className="small">
            Usa apenas questões reservadas com habilidades conferidas e
            dificuldade declarada. Iniciar uma avaliação retira esses itens da
            seleção inédita, mesmo sem responder. A dificuldade é uma
            classificação humana, sem calibração estatística.
          </p>
        )}
        {pool.length < count && (
          <Notice>
            {purpose === "benchmark"
              ? "Questões reservadas inéditas insuficientes"
              : "Questões prontas insuficientes"}{" "}
            para {count} itens.
            {purpose === "benchmark"
              ? " A seleção não será completada com questões já vistas. Reduza a quantidade ou ajuste os filtros."
              : " O início fica bloqueado até haver conteúdo conferido na quantidade escolhida."}
          </Notice>
        )}
        <p className="small">
          Durante o simulado, respostas e rascunhos são salvos neste
          dispositivo. Correções ficam fechadas até o encerramento. O prazo
          continua após sair ou recarregar a página.
        </p>
        <button
          className="primary"
          type="submit"
          disabled={
            busy ||
            pool.length < count ||
            !selected.length ||
            count < 1 ||
            minutes < 1
          }
        >
          {purpose === "benchmark"
            ? "Iniciar avaliação reservada"
            : "Iniciar simulado parcial"}
        </button>
      </form>
    </>
  );
}
