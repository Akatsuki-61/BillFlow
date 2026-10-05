"use client";
import { useEffect, useEffectEvent, useState } from "react";
import { useData } from "@/lib/data/DataProvider";
import type { TaskItem } from "@/types/tasks";
import type { TaskHistoryEntry } from "@/types/workflow";

const duration = (milliseconds: number) => {
  const minutes = Math.floor(milliseconds / 60000);
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
};
export default function TaskTiming({ task }: { task: TaskItem }) {
  const { workflow } = useData();
  const [now, setNow] = useState(() => Date.now());
  const [history, setHistory] = useState<TaskHistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const load = useEffectEvent(() => workflow.tasks.history(task.id));
  useEffect(() => {
    let current = true;
    load().then(rows => { if (current) { setHistory(rows); setError(null); } }).catch(e => { if (current) setError(e instanceof Error ? e.message : "History unavailable"); });
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => { current = false; clearInterval(timer); };
  }, [task.id, task.updatedAt]);
  const active = (task.activeMilliseconds || 0) + (task.activeSince ? Math.max(0, now - Date.parse(task.activeSince)) : 0);
  const elapsed = Math.max(0, (task.completedAt ? Date.parse(task.completedAt) : now) - Date.parse(task.createdAt));
  return <div className="mt-4 space-y-2 text-sm text-content-neutral-600">
    <p>Elapsed: {duration(elapsed)} · In progress: {duration(active)}</p>
    <p>Started: {task.startedAt ? new Date(task.startedAt).toLocaleString() : "Not started"}</p>
    <p>Completed: {task.completedAt ? new Date(task.completedAt).toLocaleString() : "Not completed"}</p>
    <details><summary>Status history</summary>{error && <p role="alert">{error}</p>}<ul>{history.map(entry => <li key={entry.id}>{entry.fromStatus || "Created"} → {entry.toStatus} · {new Date(entry.occurredAt).toLocaleString()}</li>)}</ul></details>
  </div>;
}
