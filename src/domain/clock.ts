import type { Instant, StudyDate } from "../content/types";

const DAY_MS = 86_400_000;
function dateMs(date: StudyDate): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
    throw new Error("Data de estudo inválida.");
  const ms = Date.parse(`${date}T00:00:00Z`);
  if (
    !Number.isFinite(ms) ||
    new Date(ms).toISOString().slice(0, 10) !== date
  ) {
    throw new Error("Data de estudo inexistente.");
  }
  return ms;
}
export function studyDate(at: Instant, timezone: string): StudyDate {
  const instant = new Date(at);
  if (!Number.isFinite(instant.getTime()))
    throw new Error("Instante inválido.");
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function dayDistance(from: StudyDate, to: StudyDate): number {
  return (dateMs(to) - dateMs(from)) / DAY_MS;
}
export const daysBetween = dayDistance;
export function addStudyDays(date: StudyDate, days: number): StudyDate {
  if (!Number.isInteger(days))
    throw new Error("Intervalo de revisão deve usar dias inteiros.");
  return new Date(dateMs(date) + days * DAY_MS).toISOString().slice(0, 10);
}
