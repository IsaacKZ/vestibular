import { useRef, useState, useEffect } from "react";
import type { QuestionRevision } from "../content/types";
export function AssetFigure({
  asset,
}: {
  asset: QuestionRevision["assets"][number];
}) {
  const [expanded, setExpanded] = useState(false),
    dialog = useRef<HTMLDialogElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  const close = () => {
    dialog.current?.close();
    setExpanded(false);
    trigger.current?.focus();
  };
  useEffect(() => {
    if (expanded) dialog.current?.showModal();
  }, [expanded]);
  const path = `/${asset.path.replace(/^\//, "")}`;
  return (
    <span className="asset-figure">
      <button
        ref={trigger}
        type="button"
        className="image-button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setExpanded(true);
        }}
        aria-label={`Ampliar: ${asset.alt}`}
      >
        <img src={path} alt={asset.alt} />
      </button>
      <span className="image-caption">{asset.alt}</span>
      {expanded && (
        <dialog
          ref={dialog}
          className="image-dialog"
          onCancel={(event) => {
            event.preventDefault();
            close();
          }}
          aria-label="Figura ampliada"
        >
          <button
            autoFocus
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              close();
            }}
          >
            Fechar figura
          </button>
          <img src={path} alt={asset.alt} />
        </dialog>
      )}
    </span>
  );
}
