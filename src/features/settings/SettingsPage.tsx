import { fitDailyPlan } from "../today/fitDailyPlan";
import { studyDate } from "../../domain/clock";
import { useEffect, useState } from "react";
import type { Settings } from "../../content/types";
import { db } from "../../storage/db";
import { saveSettings, updateDailyPlan } from "../../storage/study-service";
import { useStudy, errorMessage, now } from "../../ui/AppContext";
import { Notice, PageHeader } from "../../ui/FormControls";
import { BackupPanel } from "./BackupPanel";
const weekdays = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];
export function SettingsPage() {
  const app = useStudy();
  const [draft, setDraft] = useState(app.settings),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => setDraft(app.settings), [app.settings]);
  const save = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await saveSettings(db, draft);
      const date = studyDate(now(), draft.timezone),
        savedPlan = app.plans.find((p) => p.date === date);
      if (savedPlan)
        await updateDailyPlan(db, fitDailyPlan(savedPlan, draft), draft);
      await app.refresh();
      setMessage(
        "Rotina salva. Os intervalos serão usados nos próximos retornos.",
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageHeader eyebrow="Rotina e dados locais" title="Configurações" />
      {error && <Notice kind="error">{error}</Notice>}
      {message && <Notice kind="success">{message}</Notice>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="filters">
          <label className="field">
            Tempo diário
            <select
              value={draft.dailyMinutes}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  dailyMinutes: Number(
                    e.target.value,
                  ) as Settings["dailyMinutes"],
                })
              }
            >
              {[30, 60, 90, 120].map((n) => (
                <option key={n} value={n}>
                  {n} minutos
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Data-alvo da prova
            <input
              type="date"
              value={draft.targetExamDate}
              onChange={(e) =>
                setDraft({ ...draft, targetExamDate: e.target.value })
              }
            />
          </label>
          <label className="field">
            Fuso horário
            <select
              value={draft.timezone}
              onChange={(e) => setDraft({ ...draft, timezone: e.target.value })}
            >
              <option value="America/Sao_Paulo">Brasil — São Paulo</option>
              <option value="America/Manaus">Brasil — Manaus</option>
              <option value="America/Rio_Branco">Brasil — Rio Branco</option>
              <option value="UTC">UTC</option>
            </select>
          </label>
        </div>
        <fieldset>
          <legend>Dias da rotina · até cinco por semana</legend>
          <div className="checks">
            {weekdays.map((day, index) => (
              <label key={day}>
                <input
                  type="checkbox"
                  checked={draft.studyWeekdays.includes(index)}
                  disabled={
                    !draft.studyWeekdays.includes(index) &&
                    draft.studyWeekdays.length >= 5
                  }
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      studyWeekdays: e.target.checked
                        ? [...draft.studyWeekdays, index].sort()
                        : draft.studyWeekdays.filter((d) => d !== index),
                    })
                  }
                />
                {day}
              </label>
            ))}
          </div>
        </fieldset>
        <section className="plain-section">
          <h2>Intervalos de revisão</h2>
          <p className="small">
            Parâmetros ajustáveis da rotina. Não representam um intervalo
            cientificamente ótimo para toda pessoa ou assunto.
          </p>
          <div className="filters">
            {(
              [
                {
                  key: "initialDays",
                  label: "Primeiro retorno (dias)",
                  min: 1,
                },
                {
                  key: "repeatDays",
                  label: "Retorno após evidência (dias)",
                  min: 1,
                },
                { key: "maintenanceDays", label: "Manutenção (dias)", min: 1 },
                {
                  key: "recoverySuccesses",
                  label: "Evidências para recuperar o item",
                  min: 2,
                },
                {
                  key: "minEvidenceDays",
                  label: "Distância mínima entre evidências (dias)",
                  min: 1,
                },
              ] as const
            ).map(({ key, label, min }) => (
              <label className="field" key={key}>
                {label}
                <input
                  type="number"
                  min={min}
                  max={key === "recoverySuccesses" ? 10 : 365}
                  value={draft.reviewPolicy[key]}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      reviewPolicy: {
                        ...draft.reviewPolicy,
                        [key]: Number(e.target.value),
                      },
                    })
                  }
                />
              </label>
            ))}
          </div>
        </section>
        <button className="primary" disabled={busy} type="submit">
          Salvar configurações
        </button>
      </form>
      <BackupPanel />
    </>
  );
}
