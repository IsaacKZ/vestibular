import type { DailyPlan, Settings } from "../../content/types";

export function fitDailyPlan(plan: DailyPlan, settings: Settings): DailyPlan {
  const budget = Math.min(120, settings.dailyMinutes);
  let minutes = 0;
  const selected = new Set<string>();
  const deferred = new Set(plan.deferredQuestionIds);
  const admit = (task: DailyPlan["tasks"][number]) => {
    if (selected.size >= 12 || minutes + task.minutes > budget) {
      deferred.add(task.questionId);
      return;
    }
    selected.add(task.questionId);
    deferred.delete(task.questionId);
    minutes += task.minutes;
  };
  // Reserve capacity for returns before considering new material.
  for (const task of plan.tasks) {
    if (task.reason !== "new") admit(task);
  }
  const deferredReview = plan.tasks.some(
    (task) => task.reason === "review" && !selected.has(task.questionId),
  );
  for (const task of plan.tasks) {
    if (task.reason !== "new") continue;
    if (deferredReview) deferred.add(task.questionId);
    else admit(task);
  }
  return {
    ...plan,
    tasks: plan.tasks.filter((task) => selected.has(task.questionId)),
    deferredQuestionIds: [...deferred],
  };
}
