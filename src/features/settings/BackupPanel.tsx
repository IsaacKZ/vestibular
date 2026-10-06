import { useState } from "react";
import type { BackupEnvelope } from "../../storage/backup";
import { exportBackup, previewImport, mergeBackup } from "../../storage/backup";
import { db } from "../../storage/db";
import { useStudy, now, errorMessage } from "../../ui/AppContext";
import { Notice } from "../../ui/FormControls";
export function BackupPanel() {
  const app = useStudy();
  const [candidate, setCandidate] = useState<unknown>(),
    [preview, setPreview] =
      useState<Awaited<ReturnType<typeof previewImport>>>(),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const download = async () => {
    setBusy(true);
    setError("");
    try {
      const envelope = await exportBackup(db, now());
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(envelope, null, 2)], {
          type: "application/json",
        }),
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `caderno-udesc-${envelope.exportedAt.slice(0, 10)}.json`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage("Backup exportado. Guarde o arquivo fora deste dispositivo.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const inspect = async (file: File | undefined) => {
    setCandidate(undefined);
    setPreview(undefined);
    setMessage("");
    setError("");
    if (!file) return;
    setBusy(true);
    try {
      if (file.size > 32 * 1024 * 1024)
        throw new Error("Arquivo maior que 32 MB.");
      const json: unknown = JSON.parse(await file.text());
      const result = await previewImport(db, json);
      setCandidate(json);
      setPreview(result);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const merge = async () => {
    if (!preview?.valid || !candidate) return;
    setBusy(true);
    try {
      await mergeBackup(db, candidate as BackupEnvelope);
      await app.refresh();
      setMessage("Backup incorporado. O histórico existente foi preservado.");
      setCandidate(undefined);
      setPreview(undefined);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="plain-section">
      <h2>Backup e transferência</h2>
      <p>
        Seu histórico fica neste navegador. Não há sincronização automática;
        exporte antes de limpar dados ou trocar de dispositivo.
      </p>
      {error && <Notice kind="error">{error}</Notice>}
      {message && <Notice kind="success">{message}</Notice>}
      <button disabled={busy} onClick={() => void download()}>
        Exportar backup JSON
      </button>
      <label className="field">
        Escolher backup para conferir
        <input
          type="file"
          accept=".json,application/json"
          disabled={busy}
          onChange={(e) => void inspect(e.target.files?.[0])}
        />
      </label>
      {preview && (
        <div className="import-preview">
          <h3>Prévia da importação</h3>
          <p>
            {preview.added} registros novos · {preview.duplicates} registros já
            existentes · {preview.conflicts.length} conflitos
          </p>
          {preview.errors.length > 0 && (
            <ul>
              {preview.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
          {preview.conflicts.length > 0 && (
            <ul>
              {preview.conflicts.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
          {preview.valid ? (
            <>
              <p>
                Confirme para incorporar os novos registros em uma única
                operação.
              </p>
              <button disabled={busy} onClick={() => void merge()}>
                Confirmar importação do backup
              </button>
            </>
          ) : (
            <Notice kind="error">
              Este arquivo não pode ser importado. O histórico atual foi
              preservado.
            </Notice>
          )}
        </div>
      )}
    </section>
  );
}
