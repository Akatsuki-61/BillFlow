import type { TaskItem, TaskPriority } from "../types/tasks";

const priorityOrder: Record<TaskPriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export function compareBoardTasks(
  a: Pick<TaskItem, "priority" | "boardPosition">,
  b: Pick<TaskItem, "priority" | "boardPosition">,
) {
  return (
    priorityOrder[a.priority] - priorityOrder[b.priority] ||
    (a.boardPosition ?? Number.MAX_SAFE_INTEGER) -
      (b.boardPosition ?? Number.MAX_SAFE_INTEGER)
  );
}
