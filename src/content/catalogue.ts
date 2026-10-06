import type { LearningHistory, QuestionRevision, Subject } from "./types";
import { isReady, canPractice } from "./quality";

export interface QuestionFilter {
  subject?: Subject;
  edition?: string;
  topics?: string[];
  skills?: string[];
  readiness?: "all" | "ready" | "blocked";
}

export function filterQuestions(
  items: QuestionRevision[],
  filter: QuestionFilter,
): QuestionRevision[] {
  return items.filter(
    (q) =>
      (!filter.subject || q.subject === filter.subject) &&
      (!filter.edition || q.edition === filter.edition) &&
      (!filter.topics?.length ||
        filter.topics.some((t) => q.topics.includes(t))) &&
      (!filter.skills?.length ||
        filter.skills.some((s) => q.skills.includes(s))) &&
      (!filter.readiness ||
        filter.readiness === "all" ||
        isReady(q) === (filter.readiness === "ready")),
  );
}

// Stable hashing avoids reliance on runtime-specific random state or input order.
function seededRank(text: string, seed: number): number {
  let hash = (2166136261 ^ (seed | 0)) >>> 0;
  for (const char of text)
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  return hash;
}

export function buildMixedList(
  items: QuestionRevision[],
  history: LearningHistory,
  count: number,
  seed: number,
): QuestionRevision[] {
  const limit = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  if (!limit) return [];
  const sorted = [...items].sort(
    (a, b) => a.id.localeCompare(b.id) || b.revision.localeCompare(a.revision),
  );
  const unique = new Map<string, QuestionRevision>();
  for (const q of sorted) if (!unique.has(q.id)) unique.set(q.id, q);
  const candidates = [...unique.values()].filter(canPractice);
  const seen = new Set(history.attempts.map((a) => a.questionId));
  const exactSubjects = new Set<Subject>(["matematica", "fisica", "quimica"]);
  const introducedSkills = new Set(
    items
      .filter((q) => seen.has(q.id))
      .flatMap((q) => q.skills.map((skill) => `${q.subject}:${skill}`)),
  );
  const groupKey = (q: QuestionRevision) => {
    const skill = exactSubjects.has(q.subject)
      ? q.skills.find((s) => introducedSkills.has(`${q.subject}:${s}`))
      : undefined;
    return `${q.subject}:${skill ? `skill:${skill}` : `topic:${q.topics[0]}`}`;
  };
  const introduced = new Set(items.filter((q) => seen.has(q.id)).map(groupKey));
  const groups = new Map<string, QuestionRevision[]>();
  for (const q of candidates) {
    const group = groupKey(q);
    groups.set(group, [...(groups.get(group) ?? []), q]);
  }
  const keys = [...groups.keys()].sort(
    (a, b) =>
      Number(introduced.has(b)) - Number(introduced.has(a)) ||
      seededRank(a, seed) - seededRank(b, seed) ||
      a.localeCompare(b),
  );
  for (const group of groups.values())
    group.sort(
      (a, b) =>
        Number(seen.has(a.id)) - Number(seen.has(b.id)) ||
        seededRank(a.id, seed) - seededRank(b.id, seed) ||
        a.id.localeCompare(b.id),
    );
  // Allocate across subjects and then rotate their groups before arranging the
  // list. Numerous biology topics must not crowd out another available subject.
  const selected = new Map<string, QuestionRevision[]>(
    keys.map((key) => [key, []]),
  );
  const bySubject = new Map<Subject, string[]>();
  for (const key of keys) {
    const subject = groups.get(key)![0].subject;
    bySubject.set(subject, [...(bySubject.get(subject) ?? []), key]);
  }
  const cursors = new Map([...bySubject.keys()].map((subject) => [subject, 0]));
  let selectedCount = 0;
  while (selectedCount < limit && keys.some((k) => groups.get(k)!.length)) {
    for (const [subject, subjectKeys] of bySubject) {
      const cursor = cursors.get(subject)!;
      for (let offset = 0; offset < subjectKeys.length; offset++) {
        const index = (cursor + offset) % subjectKeys.length;
        const key = subjectKeys[index],
          group = groups.get(key)!;
        if (!group.length) continue;
        selected.get(key)!.push(group.shift()!);
        selectedCount++;
        cursors.set(subject, index + 1);
        break;
      }
      if (selectedCount === limit) break;
    }
  }
  const result: QuestionRevision[] = [];
  let previous = "";
  while (result.length < selectedCount) {
    const available = keys.filter((key) => selected.get(key)!.length);
    const alternatives = available.filter((key) => key !== previous);
    const next = (alternatives.length ? alternatives : available).sort(
      (a, b) =>
        selected.get(b)!.length - selected.get(a)!.length ||
        keys.indexOf(a) - keys.indexOf(b),
    )[0];
    const group = selected.get(next)!;
    const take = group[0].subject === "biologia" ? group.length : 1;
    result.push(...group.splice(0, take));
    previous = next;
  }
  return result;
}
