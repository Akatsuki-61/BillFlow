"use client";

import React, { useState } from "react";
import { X, Calendar, Clock, MapPin, Link2, CheckSquare, Trash2, Video, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Workspace";
import { MotionSurface } from "@/components/ui/MotionSurface";
import { useData } from "@/lib/data/DataProvider";
import {
  normalizeAndAutoFixDate,
  normalizeAndAutoFixTimeRange,
} from "@/lib/local-calendar";
import type {
  CalendarEventItem,
  NewCalendarEventInput,
  EventCategory,
  EventColor,
} from "@/types/calendar";

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventToEdit?: CalendarEventItem | null;
  initialDate?: string;
  initialTaskId?: string;
  onSaved?: (message: string) => void;
}

const CATEGORY_OPTIONS: { id: EventCategory; label: string; icon: string }[] = [
  { id: "meeting", label: "Client Meeting", icon: "👥" },
  { id: "milestone", label: "Project Milestone", icon: "🚩" },
  { id: "review", label: "Deliverable Review", icon: "🔍" },
  { id: "deadline", label: "Hard Deadline", icon: "⏰" },
  { id: "reminder", label: "Follow-up / Reminder", icon: "🔔" },
  { id: "general", label: "General Event", icon: "📅" },
];

const COLOR_OPTIONS: { id: EventColor; label: string; bgClass: string; borderClass: string }[] = [
  { id: "blue", label: "Blue", bgClass: "bg-surface-blue-500", borderClass: "border-line-blue-400" },
  { id: "emerald", label: "Emerald", bgClass: "bg-surface-emerald-500", borderClass: "border-line-emerald-400" },
  { id: "purple", label: "Purple", bgClass: "bg-surface-purple-500", borderClass: "border-line-purple-400" },
  { id: "amber", label: "Amber", bgClass: "bg-surface-amber-500", borderClass: "border-line-amber-400" },
  { id: "rose", label: "Rose", bgClass: "bg-surface-rose-500", borderClass: "border-line-rose-400" },
  { id: "cyan", label: "Cyan", bgClass: "bg-surface-cyan-500", borderClass: "border-line-cyan-400" },
];

function EventForm({
  onClose,
  eventToEdit,
  initialDate,
  initialTaskId,
  onSaved,
}: EventModalProps) {
  const { clients, tasks, createEvent, updateEvent, deleteEvent } = useData();

  const [title, setTitle] = useState(eventToEdit?.title || "");
  const [description, setDescription] = useState(eventToEdit?.description || "");
  const [startDate, setStartDate] = useState(() =>
    normalizeAndAutoFixDate(eventToEdit?.startDate || initialDate)
  );
  const [endDate, setEndDate] = useState(eventToEdit?.endDate || "");
  const [startTime, setStartTime] = useState(eventToEdit ? eventToEdit.startTime || "" : "10:00");
  const [endTime, setEndTime] = useState(eventToEdit ? eventToEdit.endTime || "" : "11:00");
  const [isAllDay, setIsAllDay] = useState(eventToEdit?.isAllDay || false);
  const [category, setCategory] = useState<EventCategory>(eventToEdit?.category || "meeting");
  const [color, setColor] = useState<EventColor>(eventToEdit?.color || "blue");
  const [clientId, setClientId] = useState(eventToEdit?.clientId || "");
  const [taskId, setTaskId] = useState(eventToEdit?.taskId || initialTaskId || "");
  const [location, setLocation] = useState(eventToEdit?.location || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Please provide an event title");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Internal silent auto-fixing of dates, time ranges, and Task <-> Client links
      const fixedStart = normalizeAndAutoFixDate(startDate);
      let fixedEnd = endDate ? normalizeAndAutoFixDate(endDate, fixedStart) : null;
      if (fixedEnd && fixedEnd < fixedStart) {
        fixedEnd = fixedStart;
      }
      const fixedTimes = normalizeAndAutoFixTimeRange(startTime, endTime, isAllDay);

      const selectedTask = tasks.find((t) => t.id === taskId);
      const resolvedClientId = clientId || selectedTask?.clientId || "";
      const selectedClient = clients.find((c) => c.id === resolvedClientId);

      const input: NewCalendarEventInput = {
        title: title.trim(),
        description: description.trim(),
        startDate: fixedStart,
        endDate: fixedEnd,
        startTime: fixedTimes.startTime,
        endTime: fixedTimes.endTime,
        isAllDay: fixedTimes.isAllDay,
        category,
        color,
        clientId: resolvedClientId || null,
        clientName: selectedClient?.name || selectedTask?.clientName || null,
        taskId: taskId || null,
        taskTitle: selectedTask?.title || null,
        location: location.trim() || null,
      };

      if (eventToEdit) {
        await updateEvent(eventToEdit.id, input);
        onSaved?.(`Updated event "${title.trim()}"`);
      } else {
        await createEvent(input);
        onSaved?.(`Created event "${title.trim()}"`);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save event");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!eventToEdit) return;
    if (!confirm(`Are you sure you want to delete "${eventToEdit.title}"?`)) return;

    setSaving(true);
    try {
      await deleteEvent(eventToEdit.id);
      onSaved?.(`Deleted event "${eventToEdit.title}"`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete event");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="event-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
    >
      <MotionSurface
        kind="panel"
        className="w-full max-w-lg bg-surface border border-line-neutral-200/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-line-neutral-200/70 bg-surface-neutral-50/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-accent-soft text-accent">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 id="event-modal-title" className="text-base font-semibold text-content-neutral-900">
                {eventToEdit ? "Edit Calendar Event" : "Schedule New Event"}
              </h2>
              <p className="text-xs text-content-neutral-500">
                Track meetings, consulting sessions, deadlines, and milestone reviews.
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close dialog">
            <X className="w-4 h-4 text-content-neutral-500" />
          </Button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div role="alert" className="p-3 text-xs rounded-xl bg-surface-red-50 text-content-red-700 border border-line-red-200">
              {error}
            </div>
          )}

          {/* Event Title */}
          <div>
            <label htmlFor="event-title" className="block text-xs font-semibold uppercase tracking-wider text-content-neutral-600 mb-1.5">
              Event Title *
            </label>
            <input
              id="event-title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Client Kickoff Call, Architecture Review, AI Demo..."
              className="ui-field w-full px-3.5 py-2 text-sm border border-line-neutral-200/90 rounded-xl text-content-neutral-900 placeholder:text-content-neutral-400 focus:outline-none focus:border-accent"
            />
          </div>

          {/* Category & Color */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label htmlFor="event-category" className="block text-xs font-semibold uppercase tracking-wider text-content-neutral-600 mb-1.5">
                Category
              </label>
              <select
                id="event-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as EventCategory)}
                className="ui-field w-full px-3.5 py-2 text-sm border border-line-neutral-200/90 rounded-xl text-content-neutral-800 bg-surface focus:outline-none focus:border-accent cursor-pointer"
              >
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.icon} {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-content-neutral-600 mb-1.5">
                Badge Color
              </label>
              <div className="flex items-center gap-2 pt-1">
                {COLOR_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    title={opt.label}
                    onClick={() => setColor(opt.id)}
                    className={`w-6 h-6 rounded-full ${opt.bgClass} transition-transform ${
                      color === opt.id ? "scale-125 ring-2 ring-accent ring-offset-2" : "opacity-70 hover:opacity-100"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Date & Time Settings */}
          <div className="p-3.5 rounded-xl border border-line-neutral-200/80 bg-surface-neutral-50/40 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-content-neutral-800 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-accent" /> Date &amp; Schedule
              </span>
              <label className="flex items-center gap-2 text-xs text-content-neutral-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isAllDay}
                  onChange={(e) => setIsAllDay(e.target.checked)}
                  className="rounded text-accent focus:ring-accent"
                />
                All-day event
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="event-start-date" className="block text-xs text-content-neutral-500 mb-1">
                  Start Date *
                </label>
                <input
                  id="event-start-date"
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="ui-field w-full px-3 py-1.5 text-sm border border-line-neutral-200/90 rounded-xl text-content-neutral-800 bg-surface focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label htmlFor="event-end-date" className="block text-xs text-content-neutral-500 mb-1">
                  End Date (Optional)
                </label>
                <input
                  id="event-end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="ui-field w-full px-3 py-1.5 text-sm border border-line-neutral-200/90 rounded-xl text-content-neutral-800 bg-surface focus:outline-none focus:border-accent"
                />
              </div>
            </div>

            {!isAllDay && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label htmlFor="event-start-time" className="block text-xs text-content-neutral-500 mb-1">
                    Start Time
                  </label>
                  <input
                    id="event-start-time"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="ui-field w-full px-3 py-1.5 text-sm border border-line-neutral-200/90 rounded-xl text-content-neutral-800 bg-surface focus:outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label htmlFor="event-end-time" className="block text-xs text-content-neutral-500 mb-1">
                    End Time
                  </label>
                  <input
                    id="event-end-time"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="ui-field w-full px-3 py-1.5 text-sm border border-line-neutral-200/90 rounded-xl text-content-neutral-800 bg-surface focus:outline-none focus:border-accent"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Links: Connect with Client & Kanban Task */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label htmlFor="event-task" className="block text-xs font-semibold uppercase tracking-wider text-content-neutral-600 mb-1.5 flex items-center gap-1.5">
                <CheckSquare className="w-3.5 h-3.5 text-accent" /> Link Kanban Task
              </label>
              <select
                id="event-task"
                value={taskId}
                onChange={(e) => {
                  const newTid = e.target.value;
                  setTaskId(newTid);
                  if (newTid) {
                    const task = tasks.find((t) => t.id === newTid);
                    if (task?.clientId && !clientId) {
                      setClientId(task.clientId);
                    }
                  }
                }}
                className="ui-field w-full px-3.5 py-2 text-sm border border-line-neutral-200/90 rounded-xl text-content-neutral-800 bg-surface focus:outline-none focus:border-accent cursor-pointer truncate"
              >
                <option value="">No linked task</option>
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    [{t.status.toUpperCase()}] {t.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="event-client" className="block text-xs font-semibold uppercase tracking-wider text-content-neutral-600 mb-1.5 flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5 text-accent" /> Link Client
              </label>
              <select
                id="event-client"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="ui-field w-full px-3.5 py-2 text-sm border border-line-neutral-200/90 rounded-xl text-content-neutral-800 bg-surface focus:outline-none focus:border-accent cursor-pointer truncate"
              >
                <option value="">No client assigned</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Location / Meeting URL */}
          <div>
            <label htmlFor="event-location" className="block text-xs font-semibold uppercase tracking-wider text-content-neutral-600 mb-1.5 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-accent" /> Location or Video Link
            </label>
            <div className="relative">
              <input
                id="event-location"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Google Meet URL, Zoom link, or client headquarters..."
                className="ui-field w-full pl-9 pr-3.5 py-2 text-sm border border-line-neutral-200/90 rounded-xl text-content-neutral-900 placeholder:text-content-neutral-400 focus:outline-none focus:border-accent"
              />
              <Video className="w-4 h-4 text-content-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Description & Notes */}
          <div>
            <label htmlFor="event-desc" className="block text-xs font-semibold uppercase tracking-wider text-content-neutral-600 mb-1.5">
              Description &amp; Agenda Notes
            </label>
            <textarea
              id="event-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Meeting agenda, topics to discuss, or prep items..."
              className="ui-field w-full px-3.5 py-2 text-sm border border-line-neutral-200/90 rounded-xl text-content-neutral-900 placeholder:text-content-neutral-400 focus:outline-none focus:border-accent resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-line-neutral-200/70">
            {eventToEdit ? (
              <Button
                type="button"
                variant="danger"
                size="small"
                onClick={handleDelete}
                disabled={saving}
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </Button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={saving}>
                {saving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Syncing...</span>
                  </>
                ) : eventToEdit ? (
                  "Update Event"
                ) : (
                  "Create Event"
                )}
              </Button>
            </div>
          </div>
        </form>
      </MotionSurface>
    </div>
  );
}

export default function EventModal(props: EventModalProps) {
  if (!props.isOpen) return null;
  return <EventForm key={props.eventToEdit?.id || `${props.initialDate}-${props.initialTaskId}`} {...props} />;
}
