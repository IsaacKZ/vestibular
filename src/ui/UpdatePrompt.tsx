export function UpdatePrompt({
  sessionActive,
  onApply,
}: {
  sessionActive: boolean;
  onApply: () => void;
}) {
  return (
    <aside className="update-prompt" role="status">
      <p>
        {sessionActive
          ? "Uma atualização está pronta. Encerre a sessão antes de atualizar."
          : "Uma atualização está pronta para este app."}
      </p>
      <button disabled={sessionActive} onClick={onApply}>
        Atualizar app
      </button>
    </aside>
  );
}
