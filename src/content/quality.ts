import type { Blocker, QuestionRevision } from "./types";

const letters = ["A", "B", "C", "D", "E"];
const hasText = (s: string | undefined): boolean => Boolean(s?.trim());

export function hasVerifiedKey(q: QuestionRevision): boolean {
  return Boolean(
    q.key?.verified &&
    letters.includes(q.key.letter) &&
    hasText(q.key.source) &&
    hasText(q.key.location) &&
    hasText(q.key.reviewer) &&
    hasText(q.key.revision),
  );
}

export function hasVerifiedAnnulment(q: QuestionRevision): boolean {
  return Boolean(
    q.annulment?.verified &&
    hasText(q.annulment.source) &&
    hasText(q.annulment.location) &&
    hasText(q.annulment.reviewer) &&
    hasText(q.annulment.revision),
  );
}

/** Only local content paths are publishable. Reject encoded paths and traversal. */
export function isSafeAssetPath(path: string): boolean {
  return (
    /^content\/assets\/[A-Za-z0-9_./-]+$/.test(path) &&
    !path
      .split("/")
      .some((part) => part === "." || part === ".." || part === "") &&
    !path.includes("\\")
  );
}

function validAsset(
  asset: QuestionRevision["assets"][number],
  q: QuestionRevision,
): boolean {
  const targetText =
    asset.anchor.target === "option"
      ? q.options.find((o) => o.letter === asset.anchor.optionLetter)?.text
      : q.stem;
  const blockCount =
    targetText === undefined ? 0 : targetText.split(/\n\s*\n/).length;
  return (
    asset.verified &&
    isSafeAssetPath(asset.path) &&
    /\.(?:svg|png|jpe?g|webp|avif|gif)$/i.test(asset.path) &&
    hasText(asset.alt) &&
    hasText(asset.source) &&
    Number.isInteger(asset.anchor.afterBlock) &&
    asset.anchor.afterBlock >= 0 &&
    asset.anchor.afterBlock < blockCount &&
    (asset.anchor.target === "option"
      ? letters.includes(asset.anchor.optionLetter ?? "")
      : asset.anchor.optionLetter === null)
  );
}

export function getBlockers(q: QuestionRevision): Blocker[] {
  const blockers: Blocker[] = [];
  if (q.quality.ocr) blockers.push("ocr");
  if (q.quality.uncertain) blockers.push("uncertain");
  if (!q.quality.textComplete || !hasText(q.stem))
    blockers.push("missing_text");
  const completeOptions =
    q.options.length === 5 &&
    new Set(q.options.map((o) => o.letter)).size === 5 &&
    q.options.every(
      (o) =>
        letters.includes(o.letter) &&
        (hasText(o.text) ||
          q.assets.some(
            (a) =>
              a.anchor.target === "option" &&
              a.anchor.optionLetter === o.letter &&
              validAsset(a, q),
          )),
    );
  if (!completeOptions) blockers.push("missing_options");
  if (!q.skills.length || !q.skills.every(hasText))
    blockers.push("missing_skills");
  if (!q.quality.assetsComplete || q.assets.some((a) => !validAsset(a, q)))
    blockers.push("missing_assets");
  if (
    !q.quality.reviewed ||
    !q.quality.taxonomyReviewed ||
    !q.topics.length ||
    !q.topics.every(hasText) ||
    !hasText(q.quality.reviewer) ||
    !q.quality.reviewedAt ||
    !Number.isFinite(Date.parse(q.quality.reviewedAt)) ||
    !hasText(q.source.originalPdf) ||
    !Number.isInteger(q.source.page) ||
    (q.source.page ?? 0) < 1
  )
    blockers.push("unreviewed");
  if (!hasVerifiedKey(q) && !hasVerifiedAnnulment(q))
    blockers.push("missing_key");
  if (
    !q.explanation?.reviewed ||
    !hasText(q.explanation.text) ||
    !hasText(q.explanation.author) ||
    !hasText(q.explanation.source) ||
    !hasText(q.explanation.reviewer) ||
    !["official", "prepared"].includes(q.explanation.authorKind)
  )
    blockers.push("missing_explanation");
  if (q.quality.annulled || q.annulment !== null) blockers.push("annulled");
  return blockers;
}

export const isReady = (q: QuestionRevision): boolean =>
  getBlockers(q).length === 0;

export const canPractice = (q: QuestionRevision): boolean =>
  isReady(q) && !q.assessmentOnly;

export function contentAvailability(items: readonly QuestionRevision[]) {
  const ready = items.filter(isReady);
  const practiceReady = ready.filter(canPractice).length;
  return {
    ready: ready.length,
    practiceReady,
    reservedReady: ready.length - practiceReady,
    blockedForTraining: items.length - practiceReady,
  };
}
