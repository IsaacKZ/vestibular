import type { QuestionRevision } from "../content/types";
import { MathText } from "./MathText";
import { AssetFigure } from "./AssetFigure";
export function QuestionContent({
  question,
  revealTopic,
}: {
  question: QuestionRevision;
  revealTopic: boolean;
}) {
  const blocks = question.stem.split(/\n\s*\n/);
  return (
    <section className="question-content" aria-label="Enunciado">
      {revealTopic && <p className="muted">{question.topics.join(" · ")}</p>}
      {blocks.map((block, index) => (
        <div key={index}>
          <p className="question-text">
            <MathText text={block} />
          </p>
          {question.assets
            .filter(
              (a) =>
                a.anchor.target !== "option" && a.anchor.afterBlock === index,
            )
            .map((a) => (
              <AssetFigure key={a.path} asset={a} />
            ))}
        </div>
      ))}
    </section>
  );
}
