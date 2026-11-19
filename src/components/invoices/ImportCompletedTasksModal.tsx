"use client";

import React from "react";
import { CheckSquare, ListChecks } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Workspace";
import { formatCents, formatDateDisplay } from "@/lib/format";
import type { ClientWithStats, Currency } from "@/types/billing";
import type { TaskItem } from "@/types/tasks";

interface ImportCompletedTasksModalProps {
  activeDraftClientObj?: ClientWithStats | null;
  clientMode: "existing" | "new";
  clientName: string;
  newCurrency: Currency;
  allUnbilledTasks: TaskItem[];
  clientFilteredUnbilledTasks: TaskItem[];
  displayedImportTasks: TaskItem[];
  importTasksShowAllClients: boolean;
  setImportTasksShowAllClients: React.Dispatch<React.SetStateAction<boolean>>;
  selectedImportTaskIds: string[];
  importTaskFees: Record<string, string>;
  setImportTaskFees: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  getTaskDefaultFee: (task: TaskItem) => string;
  onToggleTask: (task: TaskItem) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onImportSelected: () => void;
  onClose: () => void;
}

export function ImportCompletedTasksModal({
  activeDraftClientObj,
  clientMode,
  clientName,
  newCurrency,
  allUnbilledTasks,
  clientFilteredUnbilledTasks,
  displayedImportTasks,
  importTasksShowAllClients,
  setImportTasksShowAllClients,
  selectedImportTaskIds,
  importTaskFees,
  setImportTaskFees,
  getTaskDefaultFee,
  onToggleTask,
  onSelectAll,
  onDeselectAll,
  onImportSelected,
  onClose,
}: ImportCompletedTasksModalProps) {
  return (
    <Dialog onClose={onClose} width={680}>
      <div className="app-dialog-header">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-accent-faint text-accent flex items-center justify-center">
            <ListChecks className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-content-neutral-900">
              Import Completed Tasks
            </h3>
            <p className="text-xs text-content-neutral-400">
              Select unbilled completed deliverables to add as line items and
              link to this invoice.
            </p>
          </div>
        </div>
      </div>

      <div className="app-dialog-body">
        <div className="app-dialog-section p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-line-neutral-100">
            <div className="flex items-center gap-2">
              {(activeDraftClientObj ||
                (clientMode === "new" && clientName.trim())) && (
                <button
                  type="button"
                  onClick={() =>
                    setImportTasksShowAllClients((prev) => !prev)
                  }
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors cursor-pointer ${
                    !importTasksShowAllClients
                      ? "bg-accent/10 border-accent/30 text-accent"
                      : "bg-surface-neutral-100 border-line-neutral-200 text-content-neutral-600 hover:text-content-neutral-900"
                  }`}
                >
                  {importTasksShowAllClients
                    ? `Showing all clients (${allUnbilledTasks.length}) · Filter by ${activeDraftClientObj?.name || clientName.trim()}`
                    : `Filtered: ${activeDraftClientObj?.name || clientName.trim()} (${clientFilteredUnbilledTasks.length}) · Show all clients`}
                </button>
              )}
            </div>

            {displayedImportTasks.length > 0 && (
              <div className="flex items-center gap-1.5">
                <Button
                  variant="ghost"
                  size="small"
                  type="button"
                  onClick={onSelectAll}
                  className="text-xs h-7 px-2.5"
                >
                  Select All ({displayedImportTasks.length})
                </Button>
                <Button
                  variant="ghost"
                  size="small"
                  type="button"
                  onClick={onDeselectAll}
                  disabled={selectedImportTaskIds.length === 0}
                  className="text-xs h-7 px-2.5"
                >
                  Deselect All
                </Button>
              </div>
            )}
          </div>

          {displayedImportTasks.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <CheckSquare className="w-8 h-8 text-content-neutral-300 mx-auto" />
              <p className="text-sm font-semibold text-content-neutral-700">
                No unbilled completed tasks found
              </p>
              <p className="text-xs text-content-neutral-400 max-w-md mx-auto">
                {!importTasksShowAllClients && allUnbilledTasks.length > 0
                  ? `No completed unbilled tasks match "${activeDraftClientObj?.name || clientName.trim()}", but ${allUnbilledTasks.length} completed task(s) exist across other clients.`
                  : "Move tasks to the Done column on the Kanban board to import them into an invoice."}
              </p>
              {!importTasksShowAllClients && allUnbilledTasks.length > 0 && (
                <div className="pt-2">
                  <Button
                    variant="secondary"
                    size="small"
                    type="button"
                    onClick={() => setImportTasksShowAllClients(true)}
                  >
                    Show All Clients ({allUnbilledTasks.length})
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2 max-h-[52vh] overflow-y-auto pr-1">
              {displayedImportTasks.map((task) => {
                const isChecked = selectedImportTaskIds.includes(task.id);
                const feeVal =
                  importTaskFees[task.id] ?? getTaskDefaultFee(task);
                const loggedHours =
                  task.activeMilliseconds && task.activeMilliseconds > 0
                    ? (task.activeMilliseconds / 3600000).toFixed(1)
                    : null;

                return (
                  <div
                    key={task.id}
                    onClick={() => onToggleTask(task)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isChecked
                        ? "border-accent bg-accent/5 ring-1 ring-accent/25"
                        : "border-line-neutral-200 bg-surface-neutral-50/60 hover:border-line-neutral-300"
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="mt-0.5 w-4 h-4 rounded text-accent focus:ring-accent cursor-pointer shrink-0"
                        aria-label={`Select task ${task.title}`}
                      />
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-content-neutral-900 truncate">
                            {task.title}
                          </span>
                          <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-surface border border-line-neutral-200 text-content-neutral-600">
                            {task.category}
                          </span>
                          {task.clientName && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-accent/10 text-accent">
                              {task.clientName}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-content-neutral-400">
                          <span>
                            Completed:{" "}
                            {task.completedAt
                              ? formatDateDisplay(task.completedAt)
                              : task.dueDate || "Done"}
                          </span>
                          {loggedHours && <span>Logged: {loggedHours}h</span>}
                          {task.outsourceBudget ? (
                            <span>
                              Est. Budget:{" "}
                              {formatCents(
                                Math.round(task.outsourceBudget * 100),
                                task.currency || newCurrency,
                              )}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div
                      className="flex items-center gap-2 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <label className="text-[10px] uppercase font-bold text-content-neutral-400">
                        Fee ({newCurrency})
                      </label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        aria-label={`Fee for ${task.title}`}
                        value={feeVal}
                        onChange={(e) => {
                          const val = e.target.value;
                          setImportTaskFees((prev) => ({
                            ...prev,
                            [task.id]: val,
                          }));
                          if (!isChecked) {
                            onToggleTask(task);
                          }
                        }}
                        className="ui-field w-28 px-2.5 py-1 text-xs text-right font-mono"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="app-dialog-footer">
        <Button variant="secondary" type="button" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          type="button"
          disabled={selectedImportTaskIds.length === 0}
          onClick={onImportSelected}
        >
          Import Selected Tasks ({selectedImportTaskIds.length})
        </Button>
      </div>
    </Dialog>
  );
}
