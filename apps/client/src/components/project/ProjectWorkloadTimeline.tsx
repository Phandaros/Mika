import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type WheelEvent as ReactWheelEvent
} from "react";
import {
  addDays,
  format,
  getDay,
  startOfDay
} from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { Priority, TaskStatus, type DisciplineType, type Task, type UpdateTaskRequest, type User } from "shared";
import type { UseMutationResult } from "@tanstack/react-query";
import { CheckCircle2, Copy, Eye, Filter, Group, Hash, MoreHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useCompanyHolidays } from "../../hooks/useCompanyHolidays";
import { useDeleteTask, useGlobalWorkloadTaskChunks, useProjectWorkloadTaskChunks } from "../../hooks/useTasks";
import { cn, toDateOnly } from "../../lib/utils";
import { Avatar } from "../shared/Avatar";
import { PriorityOptionPill, priorityColors, StatusOptionPill, taskStatusColors } from "../shared/statusVisuals";
import { Button } from "../ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from "../ui/context-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { SearchableSelect } from "../ui/searchable-select";
import { WORKLOAD_TASK_DRAG_MIME, WorkloadUndatedPanel } from "./WorkloadUndatedPanel";

const DAY_W = 44;
const HEADER_H = 40;
const CHART_H = 34;
const BAR_H = 22;
const BAR_GAP = 2;
const LANE_STRIDE = BAR_H + BAR_GAP;
const NAME_COL = 192;
const EXTENSION_DAYS = 28;
const SCROLL_EDGE = 100;
const ALL_FILTER_VALUE = "__all__";

type TaskWithDiscipline = Task & {
  discipline: {
    id: string;
    name: string;
    projectId: string;
    projectName?: string | null;
    type: DisciplineType;
  };
};

type PendingTaskMove = {
  startDate: string | null;
  dueDate: string | null;
};

type WorkloadGrouping = "assignee" | "section";
type CompletionFilter = "open" | "completed" | "all";

type WorkloadRow = {
  id: string;
  label: string;
  sublabel?: string;
  avatarName?: string;
  avatarUrl?: string | null;
  rowTasks: TaskWithDiscipline[];
  positioned: PositionedTask[];
  lanes: number[];
  rowH: number;
};

function toYmd(value: string | null | undefined): string | null {
  return toDateOnly(value);
}

const MS_PER_DAY = 86400000;

function ymdToUtcMs(ymd: string): number {
  const parts = ymd.split("-").map(Number);
  const y = parts[0] ?? 0;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  return Date.UTC(y, m - 1, d);
}

function utcMsToYmd(ms: number): string {
  const dt = new Date(ms);
  const y = dt.getUTCFullYear();
  const mo = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const da = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

/** Soma dias no calendario gregoriano; `ymd` e `YYYY-MM-DD` (data civil, sem fuso). */
function addCalendarDaysYmd(ymd: string, delta: number): string {
  return utcMsToYmd(ymdToUtcMs(ymd) + delta * MS_PER_DAY);
}

function diffCalendarDaysYmd(a: string, b: string): number {
  return Math.round((ymdToUtcMs(a) - ymdToUtcMs(b)) / MS_PER_DAY);
}

function eachYmdInclusive(from: string, to: string): string[] {
  if (from > to) {
    return [];
  }

  const out: string[] = [];
  let cur = from;
  while (cur <= to) {
    out.push(cur);
    cur = addCalendarDaysYmd(cur, 1);
  }

  return out;
}

function ymdMin(a: string, b: string): string {
  return a <= b ? a : b;
}

function ymdMax(a: string, b: string): string {
  return a >= b ? a : b;
}

/** So para rotulos do cabecalho (mes/dia no fuso local, meio-dia local evita borda de DST). */
function parseYmdToLocalNoon(ymd: string): Date {
  const parts = ymd.split("-").map(Number);
  const y = parts[0] ?? 0;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

export function clientTaskBounds(task: Task): { start: string; end: string } | null {
  const start = toYmd(task.startDate);
  const due = toYmd(task.dueDate);
  const effectiveStart = start ?? due;
  const effectiveEnd = due ?? start;

  if (!effectiveStart) {
    return null;
  }

  const end = effectiveEnd ?? effectiveStart;
  const orderedStart = effectiveStart <= end ? effectiveStart : end;
  const orderedEnd = effectiveStart <= end ? end : effectiveStart;
  return { start: orderedStart, end: orderedEnd };
}

function statusColorVar(status: string): string {
  switch (status) {
    case TaskStatus.BACKLOG:
      return "var(--color-status-backlog)";
    case TaskStatus.TODO:
      return "var(--color-status-todo)";
    case TaskStatus.IN_PROGRESS:
      return "var(--color-status-in-progress)";
    case TaskStatus.IN_REVIEW:
      return "var(--color-status-in-review)";
    case TaskStatus.DONE:
      return "var(--color-status-done)";
    default:
      return "var(--color-status-todo)";
  }
}

function barLabelText(task: TaskWithDiscipline, mode: "project" | "global"): string {
  const pn = task.discipline?.projectName;
  if (mode === "global" && pn) {
    return `[${pn}] ${task.title}`;
  }

  return task.title;
}

function clipToViewport(
  bounds: { start: string; end: string },
  viewFrom: string,
  viewTo: string
): { startIdx: number; endIdx: number } | null {
  if (bounds.start > viewTo || bounds.end < viewFrom) {
    return null;
  }

  const clippedStart = ymdMax(bounds.start, viewFrom);
  const clippedEnd = ymdMin(bounds.end, viewTo);
  if (clippedStart > clippedEnd) {
    return null;
  }

  const startIdx = diffCalendarDaysYmd(clippedStart, viewFrom);
  const endIdx = diffCalendarDaysYmd(clippedEnd, viewFrom);
  return { startIdx, endIdx };
}

function buildDailyLoadsForTasks(tasks: Task[], dayKeys: string[], nonWorkingDays: Set<string>): number[] {
  if (dayKeys.length === 0) {
    return [];
  }

  const loads = dayKeys.map(() => 0);
  const dayIndex = new Map(dayKeys.map((d, i) => [d, i]));
  const rangeStartYmd = dayKeys[0] ?? "";
  const rangeEndYmd = dayKeys[dayKeys.length - 1] ?? "";

  for (const task of tasks) {
    const bounds = clientTaskBounds(task);
    if (!bounds || task.estimatedDays == null || task.estimatedDays <= 0) {
      continue;
    }

    const clippedStartY = ymdMax(bounds.start, rangeStartYmd);
    const clippedEndY = ymdMin(bounds.end, rangeEndYmd);

    if (clippedStartY > clippedEndY) {
      continue;
    }

    const workDaysInFullSpan = eachYmdInclusive(bounds.start, bounds.end).filter((ymd) => !nonWorkingDays.has(ymd));
    if (workDaysInFullSpan.length === 0) {
      continue;
    }

    const per = task.estimatedDays / workDaysInFullSpan.length;

    for (const ymd of eachYmdInclusive(clippedStartY, clippedEndY)) {
      if (nonWorkingDays.has(ymd)) {
        continue;
      }

      const idx = dayIndex.get(ymd);
      if (idx !== undefined) {
        const current = loads[idx] ?? 0;
        loads[idx] = current + per;
      }
    }
  }

  return loads;
}

function MiniLoadChart({ loads, height }: { loads: number[]; height: number }) {
  const width = loads.length * DAY_W;
  const maxVal = Math.max(0.0001, ...loads);
  const points = loads
    .map((load, i) => {
      const v = load ?? 0;
      const x = i * DAY_W + DAY_W / 2;
      const y = height - 4 - (v / maxVal) * (height - 8);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} className="text-text-muted" aria-hidden>
      <polyline fill="none" stroke="currentColor" strokeWidth="1.5" points={points} />
    </svg>
  );
}

function assignLanes(items: Array<{ startIdx: number; endIdx: number }>): number[] {
  const sorted = items
    .map((item, index) => ({ ...item, index }))
    .sort((a, b) => a.startIdx - b.startIdx || b.endIdx - a.endIdx);
  const laneEnds: number[] = [];
  const lanes = new Array(items.length).fill(0);

  for (const item of sorted) {
    let lane = 0;
    while (lane < laneEnds.length && (laneEnds[lane] ?? -1) >= item.startIdx) {
      lane += 1;
    }

    if (lane === laneEnds.length) {
      laneEnds.push(item.endIdx);
    } else {
      laneEnds[lane] = item.endIdx;
    }

    lanes[item.index] = lane;
  }

  return lanes;
}

type PositionedTask = {
  task: TaskWithDiscipline;
  clip: { startIdx: number; endIdx: number };
};

function layoutRowTasks(rowTasks: TaskWithDiscipline[], unionFrom: string, unionTo: string): {
  positioned: PositionedTask[];
  lanes: number[];
  rowH: number;
} {
  const positioned: PositionedTask[] = [];

  for (const task of rowTasks) {
    const bounds = clientTaskBounds(task);
    if (!bounds) {
      continue;
    }

    const clip = clipToViewport(bounds, unionFrom, unionTo);
    if (!clip) {
      continue;
    }

    positioned.push({ task, clip });
  }

  const lanes = assignLanes(positioned.map((p) => p.clip));
  const maxLane = lanes.length ? Math.max(...lanes) : -1;
  const lanesHeight = Math.max(1, maxLane + 1) * LANE_STRIDE;
  const rowH = CHART_H + lanesHeight + 8;
  return { positioned, lanes, rowH };
}

type BaseTimelineProps = {
  users: User[];
  isActive: boolean;
  onOpenTask: (task: TaskWithDiscipline) => void;
  onTaskUpdated?: (task: TaskWithDiscipline) => void;
  updateTask: UseMutationResult<Task, Error, { id: string; payload: UpdateTaskRequest }>;
};

export type ProjectWorkloadTimelineProps = BaseTimelineProps &
  (
    | { mode?: "project"; projectId: string; disciplineIdFilter: Set<string> }
    | { mode: "global"; workloadScope: "general" | "civil" | "electrical" }
  );

export function ProjectWorkloadTimeline(props: ProjectWorkloadTimelineProps) {
  let projectId: string | undefined;
  let workloadScope: "general" | "civil" | "electrical" | undefined;
  let disciplineIdFilter: Set<string>;

  if (props.mode === "global") {
    projectId = undefined;
    workloadScope = props.workloadScope;
    disciplineIdFilter = new Set();
  } else {
    projectId = props.projectId;
    workloadScope = undefined;
    disciplineIdFilter = props.disciplineIdFilter;
  }

  const mode = props.mode === "global" ? "global" : "project";
  const { users, isActive, onOpenTask, onTaskUpdated, updateTask } = props;
  const today = startOfDay(new Date());
  const [unionFrom, setUnionFrom] = useState(() => format(addDays(today, -21), "yyyy-MM-dd"));
  const [unionTo, setUnionTo] = useState(() => format(addDays(today, 84), "yyyy-MM-dd"));
  const [showAllUsers, setShowAllUsers] = useState(false);
  const [undatedPanelOpen, setUndatedPanelOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [abbreviatedDays, setAbbreviatedDays] = useState(true);
  const [showEstimatedDays, setShowEstimatedDays] = useState(true);
  const [grouping, setGrouping] = useState<WorkloadGrouping>("assignee");
  const [statusFilter, setStatusFilter] = useState<string>(ALL_FILTER_VALUE);
  const [priorityFilter, setPriorityFilter] = useState<string>(ALL_FILTER_VALUE);
  const [assigneeFilter, setAssigneeFilter] = useState<string>(ALL_FILTER_VALUE);
  const [sectionFilter, setSectionFilter] = useState<string>(ALL_FILTER_VALUE);
  const [completionFilter, setCompletionFilter] = useState<CompletionFilter>("open");
  const [dragPreview, setDragPreview] = useState<{ taskId: string; deltaDays: number } | null>(null);
  const [pendingTaskMoves, setPendingTaskMoves] = useState<Record<string, PendingTaskMove>>({});
  const [taskPendingDelete, setTaskPendingDelete] = useState<TaskWithDiscipline | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pendingScrollAdjust = useRef(0);
  const scrollReady = useRef(false);
  const extendingLeft = useRef(false);
  const extendingRight = useRef(false);
  const deleteTask = useDeleteTask(projectId);

  useEffect(() => {
    const id = window.setTimeout(() => {
      scrollReady.current = true;
    }, 400);
    return () => window.clearTimeout(id);
  }, []);

  const projectQuery = useProjectWorkloadTaskChunks(projectId, unionFrom, unionTo, isActive && mode === "project");
  const globalQuery = useGlobalWorkloadTaskChunks(
    workloadScope ?? "general",
    unionFrom,
    unionTo,
    isActive && mode === "global"
  );
  const holidaysQuery = useCompanyHolidays(unionFrom, unionTo, isActive);

  const rawTasks = mode === "global" ? globalQuery.data : projectQuery.data;
  const isFetching = (mode === "global" ? globalQuery.isFetching : projectQuery.isFetching) || holidaysQuery.isFetching;

  const timelineTasks = useMemo(
    () =>
      rawTasks.map((task) => {
        const pendingMove = pendingTaskMoves[task.id];
        return pendingMove ? { ...task, ...pendingMove } : task;
      }),
    [pendingTaskMoves, rawTasks]
  );

  useEffect(() => {
    if (Object.keys(pendingTaskMoves).length === 0) {
      return;
    }

    setPendingTaskMoves((current) => {
      let changed = false;
      const next = { ...current };

      for (const task of rawTasks) {
        const pendingMove = current[task.id];
        if (!pendingMove) {
          continue;
        }

        const rawStart = toYmd(task.startDate);
        const rawDue = toYmd(task.dueDate);
        if (rawStart === pendingMove.startDate && rawDue === pendingMove.dueDate) {
          delete next[task.id];
          changed = true;
        }
      }

      return changed ? next : current;
    });
  }, [pendingTaskMoves, rawTasks]);

  const tasks = useMemo(() => {
    return timelineTasks.filter((task) => {
      if (disciplineIdFilter.size === 0) {
        return true;
      }

      return disciplineIdFilter.has(task.disciplineId);
    }) as TaskWithDiscipline[];
  }, [timelineTasks, disciplineIdFilter]);

  const days = useMemo(() => eachYmdInclusive(unionFrom, unionTo), [unionFrom, unionTo]);
  const holidayMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const holiday of holidaysQuery.data ?? []) {
      map.set(holiday.date, holiday.name);
    }
    return map;
  }, [holidaysQuery.data]);
  const nonWorkingDays = useMemo(() => {
    const set = new Set<string>();
    for (const day of days) {
      const weekDay = getDay(parseYmdToLocalNoon(day));
      if (weekDay === 0 || weekDay === 6 || holidayMap.has(day)) {
        set.add(day);
      }
    }
    return set;
  }, [days, holidayMap]);
  const sectionOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const task of tasks) {
      const label =
        mode === "global" && task.discipline.projectName
          ? `${task.discipline.projectName} / ${task.discipline.name}`
          : task.discipline.name;
      map.set(task.disciplineId, label);
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
  }, [mode, tasks]);
  const assigneeOptions = useMemo(() => {
    const ids = new Set(tasks.map((task) => task.assigneeId).filter((id): id is string => Boolean(id)));
    return users
      .filter((user) => ids.has(user.id))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [tasks, users]);
  const filteredTasks = useMemo(
    () =>
      tasks.filter((task) => {
        if (sectionFilter !== ALL_FILTER_VALUE && task.disciplineId !== sectionFilter) {
          return false;
        }

        if (assigneeFilter !== ALL_FILTER_VALUE && task.assigneeId !== assigneeFilter) {
          return false;
        }

        if (statusFilter !== ALL_FILTER_VALUE && task.status !== statusFilter) {
          return false;
        }

        if (priorityFilter !== ALL_FILTER_VALUE && task.priority !== priorityFilter) {
          return false;
        }

        if (completionFilter === "completed") {
          return task.completed;
        }

        if (completionFilter === "open") {
          return !task.completed;
        }

        return true;
      }),
    [assigneeFilter, completionFilter, priorityFilter, sectionFilter, statusFilter, tasks]
  );

  const dayCount = days.length;
  const timelineWidth = dayCount * DAY_W;

  const todayKey = format(today, "yyyy-MM-dd");
  const todayIdx = days.indexOf(todayKey);

  const datedTasks = useMemo(() => filteredTasks.filter((t) => clientTaskBounds(t) !== null), [filteredTasks]);
  const undatedTasks = useMemo(() => filteredTasks.filter((t) => clientTaskBounds(t) === null), [filteredTasks]);

  const assigneeIdsWithTasks = useMemo(() => {
    const set = new Set<string>();
    for (const t of datedTasks) {
      if (t.assigneeId) {
        set.add(t.assigneeId);
      }
    }

    return set;
  }, [datedTasks]);

  const userRows = useMemo(() => {
    const base = showAllUsers ? users : users.filter((u) => assigneeIdsWithTasks.has(u.id));
    return [...base].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [assigneeIdsWithTasks, showAllUsers, users]);

  const totalLoads = useMemo(
    () => buildDailyLoadsForTasks(datedTasks, days, nonWorkingDays),
    [datedTasks, days, nonWorkingDays]
  );

  const totalRowH = CHART_H + 8;

  const workloadRows = useMemo<WorkloadRow[]>(() => {
    if (grouping === "section") {
      const map = new Map<string, { label: string; sublabel?: string; tasks: TaskWithDiscipline[] }>();
      for (const task of datedTasks) {
        const key = task.disciplineId;
        const current = map.get(key);
        const label = task.discipline.name;
        const sublabel = task.discipline.projectName ?? undefined;
        if (current) {
          current.tasks.push(task);
        } else {
          map.set(key, { label, sublabel, tasks: [task] });
        }
      }

      return [...map.entries()]
        .sort((a, b) => a[1].label.localeCompare(b[1].label, "pt-BR"))
        .map(([id, row]) => {
          const { positioned, lanes, rowH } = layoutRowTasks(row.tasks, unionFrom, unionTo);
          return {
            id,
            label: row.label,
            sublabel: row.sublabel,
            rowTasks: row.tasks,
            positioned,
            lanes,
            rowH
          };
        });
    }

    const rows: WorkloadRow[] = userRows.map((user) => {
      const rowTasks = datedTasks.filter((t) => t.assigneeId === user.id);
      const { positioned, lanes, rowH } = layoutRowTasks(rowTasks, unionFrom, unionTo);
      return {
        id: user.id,
        label: user.name,
        sublabel: user.role,
        avatarName: user.name,
        avatarUrl: user.avatarUrl,
        rowTasks,
        positioned,
        lanes,
        rowH
      };
    });

    const unassignedTasks = datedTasks.filter((t) => !t.assigneeId);
    if (unassignedTasks.length) {
      const { positioned, lanes, rowH } = layoutRowTasks(unassignedTasks, unionFrom, unionTo);
      rows.push({
        id: "unassigned",
        label: "Sem responsavel",
        rowTasks: unassignedTasks,
        positioned,
        lanes,
        rowH
      });
    }

    return rows;
  }, [datedTasks, grouping, unionFrom, unionTo, userRows]);

  const extendLeft = useCallback(() => {
    if (extendingLeft.current) {
      return;
    }

    extendingLeft.current = true;
    const nextFrom = addCalendarDaysYmd(unionFrom, -EXTENSION_DAYS);
    pendingScrollAdjust.current += EXTENSION_DAYS * DAY_W;
    setUnionFrom(nextFrom);
  }, [unionFrom]);

  const extendRight = useCallback(() => {
    if (extendingRight.current) {
      return;
    }

    extendingRight.current = true;
    setUnionTo((current) => addCalendarDaysYmd(current, EXTENSION_DAYS));
  }, []);

  useEffect(() => {
    extendingLeft.current = false;
  }, [unionFrom]);

  useEffect(() => {
    extendingRight.current = false;
  }, [unionTo]);

  const maybeExtendTimeline = useCallback(
    (box: HTMLDivElement, direction: "left" | "right" | "both") => {
      if (!scrollReady.current) {
        return;
      }

      const atLeftEdge = box.scrollLeft < SCROLL_EDGE;
      const atRightEdge = box.scrollLeft + box.clientWidth > box.scrollWidth - SCROLL_EDGE;

      if ((direction === "left" || direction === "both") && atLeftEdge) {
        extendLeft();
      }

      if ((direction === "right" || direction === "both") && atRightEdge) {
        extendRight();
      }
    },
    [extendLeft, extendRight]
  );

  useLayoutEffect(() => {
    const el = scrollRef.current;
    const delta = pendingScrollAdjust.current;

    if (el && delta !== 0) {
      el.scrollLeft += delta;
      pendingScrollAdjust.current = 0;
    }
  }, [unionFrom, rawTasks]);

  useEffect(() => {
    const el = scrollRef.current;

    if (!el) {
      return undefined;
    }

    function onScroll() {
      const box = scrollRef.current;
      if (!box) {
        return;
      }

      maybeExtendTimeline(box, "both");
    }

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [maybeExtendTimeline]);

  function handleTimelineWheel(event: ReactWheelEvent<HTMLDivElement>) {
    const box = event.currentTarget;
    const shiftHorizontalDelta = event.shiftKey && Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : 0;
    const horizontalDelta = shiftHorizontalDelta || event.deltaX;

    if (horizontalDelta === 0) {
      return;
    }

    if (shiftHorizontalDelta !== 0) {
      event.preventDefault();
      box.scrollLeft += shiftHorizontalDelta;
    }

    maybeExtendTimeline(box, horizontalDelta < 0 ? "left" : "right");
  }

  function handleTimelineDragOver(event: DragEvent<HTMLDivElement>) {
    if (!Array.from(event.dataTransfer.types).includes(WORKLOAD_TASK_DRAG_MIME)) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }

  function handleTimelineDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const id = event.dataTransfer.getData(WORKLOAD_TASK_DRAG_MIME);
    if (!id || days.length === 0) {
      return;
    }

    const box = scrollRef.current;
    if (!box) {
      return;
    }

    const rect = box.getBoundingClientRect();
    const x = event.clientX - rect.left + box.scrollLeft;
    const idx = Math.floor(x / DAY_W);
    if (idx < 0 || idx >= days.length) {
      return;
    }

    const ymd = days[idx];
    if (!ymd) {
      return;
    }

    setPendingTaskMoves((current) => ({
      ...current,
      [id]: { startDate: ymd, dueDate: ymd }
    }));

    void updateTask
      .mutateAsync({ id, payload: { startDate: ymd, dueDate: ymd } })
      .then((updatedTask) => {
        const originalTask = tasks.find((task) => task.id === updatedTask.id);
        if (originalTask) {
          onTaskUpdated?.(mergeTimelineTask(originalTask, updatedTask));
        }
      })
      .catch(() => {
        setPendingTaskMoves((current) => removePendingTaskMove(current, id));
      });
  }

  function handleBarPointerDown(
    ev: ReactPointerEvent<HTMLButtonElement>,
    task: TaskWithDiscipline,
    bounds: { start: string; end: string }
  ) {
    if (ev.button !== 0) {
      return;
    }

    ev.preventDefault();
    ev.stopPropagation();
    const pointerId = ev.pointerId;
    const originX = ev.clientX;
    let deltaDays = 0;
    let moved = false;

    function onMove(e: PointerEvent) {
      if (e.pointerId !== pointerId) {
        return;
      }

      const next = Math.round((e.clientX - originX) / DAY_W);
      if (Math.abs(e.clientX - originX) > 4) {
        moved = true;
      }

      if (next !== deltaDays) {
        deltaDays = next;
        setDragPreview({ taskId: task.id, deltaDays: next });
      }
    }

    function finish(e: PointerEvent) {
      if (e.pointerId !== pointerId) {
        return;
      }

      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);

      if (e.type === "pointercancel") {
        setDragPreview(null);
        return;
      }

      if (!moved) {
        setDragPreview(null);
        onOpenTask(task);
        return;
      }

      if (deltaDays === 0) {
        setDragPreview(null);
        return;
      }

      const newStart = addCalendarDaysYmd(bounds.start, deltaDays);
      const newEnd = addCalendarDaysYmd(bounds.end, deltaDays);
      setPendingTaskMoves((current) => ({
        ...current,
        [task.id]: { startDate: newStart, dueDate: newEnd }
      }));
      setDragPreview(null);
      void updateTask
        .mutateAsync({
          id: task.id,
          payload: { startDate: newStart, dueDate: newEnd }
        })
        .then((updatedTask) => {
          onTaskUpdated?.(mergeTimelineTask(task, updatedTask));
        })
        .catch(() => {
          setDragPreview(null);
          setPendingTaskMoves((current) => removePendingTaskMove(current, task.id));
        });
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
  }

  function taskLink(task: TaskWithDiscipline): string {
    const projectForLink = task.discipline?.projectId;
    const path = projectForLink ? `/projects/${projectForLink}?task=${task.id}` : `/tasks/${task.id}`;
    return `${window.location.origin}${path}`;
  }

  async function copyTaskLink(task: TaskWithDiscipline) {
    await window.navigator.clipboard.writeText(taskLink(task));
    toast.success("Link da tarefa copiado");
  }

  async function toggleTaskCompleted(task: TaskWithDiscipline) {
    const updatedTask = await updateTask.mutateAsync({
      id: task.id,
      payload: { completed: !task.completed }
    });
    onTaskUpdated?.(mergeTimelineTask(task, updatedTask));
    toast.success(task.completed ? "Tarefa reaberta" : "Tarefa concluida");
  }

  async function confirmDeleteTask() {
    if (!taskPendingDelete) {
      return;
    }

    const task = taskPendingDelete;
    await deleteTask.mutateAsync(task.id);
    setTaskPendingDelete(null);
    toast.success("Tarefa excluida");
  }

  function renderNonWorkingBands(rowHeight: number, rowKey: string): ReactNode {
    return days.map((day, index) => {
      if (!nonWorkingDays.has(day)) {
        return null;
      }

      const holidayName = holidayMap.get(day);
      return (
        <div
          key={`${rowKey}-non-working-${day}`}
          className={cn(
            "pointer-events-none absolute top-0 z-[1] border-r border-border-subtle",
            holidayName ? "bg-brand-orange/10" : "bg-white/[0.035]"
          )}
          title={holidayName ?? "Final de semana"}
          style={{ left: index * DAY_W, width: DAY_W, height: rowHeight }}
        />
      );
    });
  }

  function renderBars(
    positioned: PositionedTask[],
    lanes: number[],
    loads: number[],
    rowKey: string
  ): ReactNode {
    return (
      <>
        {showEstimatedDays ? (
        <div className="absolute left-0 top-1 z-[3]">
          <MiniLoadChart loads={loads} height={CHART_H} />
        </div>
        ) : null}
        {positioned.map((p, i) => {
          const { startIdx, endIdx } = p.clip;
          const lane = lanes[i] ?? 0;
          const offsetDays = dragPreview?.taskId === p.task.id ? dragPreview.deltaDays : 0;
          const span = endIdx - startIdx + 1;
          const left = (startIdx + offsetDays) * DAY_W + 2;
          const width = span * DAY_W - 4;

          if (width <= 0 || left + width < 0 || left > timelineWidth) {
            return null;
          }

          return (
            <ContextMenu key={`${rowKey}-${p.task.id}`}>
              <ContextMenuTrigger asChild>
                <button
                  type="button"
                  title={barLabelText(p.task, mode)}
                  style={{
                    position: "absolute",
                    left,
                    width,
                    top: CHART_H + 4 + lane * LANE_STRIDE,
                    height: BAR_H,
                    backgroundColor: statusColorVar(p.task.status),
                    opacity: p.task.completed ? 0.45 : 1
                  }}
                  className={cn(
                    "z-[6] cursor-grab overflow-hidden rounded-md border border-border px-1 text-left text-[11px] font-medium text-white shadow-sm active:cursor-grabbing",
                    dragPreview?.taskId === p.task.id && "ring-2 ring-brand-orange"
                  )}
                  onPointerDown={(e) => {
                    const b = clientTaskBounds(p.task);
                    if (!b) {
                      return;
                    }

                    handleBarPointerDown(e, p.task, b);
                  }}
                >
                  <span className="line-clamp-1">{barLabelText(p.task, mode)}</span>
                </button>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem onSelect={() => onOpenTask(p.task)}>
                  <Eye className="h-4 w-4" />
                  Abrir detalhes da tarefa
                </ContextMenuItem>
                <ContextMenuItem onSelect={() => void toggleTaskCompleted(p.task)}>
                  <CheckCircle2 className="h-4 w-4" />
                  {p.task.completed ? "Marcar como nao concluida" : "Marcar como concluida"}
                </ContextMenuItem>
                <ContextMenuItem onSelect={() => void copyTaskLink(p.task)}>
                  <Copy className="h-4 w-4" />
                  Copiar link da tarefa
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem variant="destructive" onSelect={() => setTaskPendingDelete(p.task)}>
                  <Trash2 className="h-4 w-4" />
                  Excluir a tarefa
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          );
        })}
        {showEstimatedDays ? loads.map((load, i) =>
          load > 0 ? (
            <span
              key={`${rowKey}-cap-${i}`}
              className="pointer-events-none absolute text-[9px] text-text-muted"
              style={{ left: i * DAY_W + 2, top: 2, width: DAY_W - 4 }}
            >
              {load >= 10 ? load.toFixed(0) : load.toFixed(1)}
            </span>
          ) : null
        ) : null}
      </>
    );
  }

  return (
    <div className="w-full min-w-0 max-w-full space-y-3 overflow-x-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-bg-1 px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            className="h-8 px-3 text-xs"
            onClick={() => {
              const t = startOfDay(new Date());
              setUnionFrom(format(addDays(t, -21), "yyyy-MM-dd"));
              setUnionTo(format(addDays(t, 84), "yyyy-MM-dd"));
              requestAnimationFrame(() => {
                if (scrollRef.current && todayIdx >= 0) {
                  scrollRef.current.scrollLeft = Math.max(0, todayIdx * DAY_W - scrollRef.current.clientWidth / 2);
                }
              });
            }}
          >
            Hoje
          </Button>
          <Button
            type="button"
            variant={abbreviatedDays ? "primary" : "secondary"}
            className="h-8 px-3 text-xs"
            onClick={() => setAbbreviatedDays((value) => !value)}
          >
            Dias abreviados
          </Button>
          <Button
            type="button"
            variant={filtersOpen ? "primary" : "secondary"}
            className="h-8 px-3 text-xs"
            onClick={() => setFiltersOpen((value) => !value)}
          >
            <Filter size={14} />
            Filtrar
          </Button>
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            <Group size={14} />
            <SearchableSelect
              value={grouping}
              options={[
                { value: "assignee", label: "Responsavel" },
                { value: "section", label: "Secao" }
              ]}
              triggerClassName="h-8 w-[150px] text-xs"
              searchPlaceholder="Buscar agrupamento..."
              onValueChange={(value) => setGrouping(value as WorkloadGrouping)}
            />
          </div>
          <Button
            type="button"
            variant={showEstimatedDays ? "primary" : "secondary"}
            className="h-8 px-3 text-xs"
            onClick={() => setShowEstimatedDays((value) => !value)}
          >
            <Hash size={14} />
            Dias estimados
          </Button>
          <Button type="button" variant="secondary" className="h-8 px-3 text-xs" title="Opcoes">
            <MoreHorizontal size={14} />
            Opcoes
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {grouping === "assignee" ? (
            <label className="flex cursor-pointer items-center gap-2 text-xs text-text-secondary">
              <input
                type="checkbox"
                checked={showAllUsers}
                onChange={(event) => setShowAllUsers(event.target.checked)}
                className="rounded border-border"
              />
              Mostrar toda a equipe
            </label>
          ) : null}
          {undatedTasks.length ? (
            <Button
              type="button"
              variant="secondary"
              className="h-8 px-3 text-xs"
              onClick={() => setUndatedPanelOpen(true)}
            >
              Sem datas ({undatedTasks.length})
            </Button>
          ) : null}
        </div>
      </div>

      {filtersOpen ? (
        <div className="grid gap-2 rounded-md border border-border bg-bg-1 p-3 sm:grid-cols-2 lg:grid-cols-5">
          <SearchableSelect
            value={sectionFilter}
            options={[
              { value: ALL_FILTER_VALUE, label: "Todas as secoes" },
              ...sectionOptions.map(([id, label]) => ({ value: id, label }))
            ]}
            triggerClassName="h-9 text-xs"
            searchPlaceholder="Buscar secao..."
            onValueChange={setSectionFilter}
          />
          <SearchableSelect
            value={assigneeFilter}
            options={[
              { value: ALL_FILTER_VALUE, label: "Todos os responsaveis" },
              ...assigneeOptions.map((user) => ({ value: user.id, label: user.name, description: user.email }))
            ]}
            triggerClassName="h-9 text-xs"
            searchPlaceholder="Buscar responsavel..."
            onValueChange={setAssigneeFilter}
          />
          <SearchableSelect
            value={statusFilter}
            options={[
              { value: ALL_FILTER_VALUE, label: "Todos os status" },
              ...Object.values(TaskStatus).map((status) => ({
                value: status,
                label: status,
                color: taskStatusColors[status],
                render: <StatusOptionPill label={status} color={taskStatusColors[status]} />
              }))
            ]}
            triggerClassName="h-9 text-xs"
            searchPlaceholder="Buscar status..."
            onValueChange={setStatusFilter}
          />
          <SearchableSelect
            value={priorityFilter}
            options={[
              { value: ALL_FILTER_VALUE, label: "Todas as prioridades" },
              ...Object.values(Priority).map((priority) => ({
                value: priority,
                label: priority,
                color: priorityColors[priority],
                render: <PriorityOptionPill priority={priority} />
              }))
            ]}
            triggerClassName="h-9 text-xs"
            searchPlaceholder="Buscar prioridade..."
            onValueChange={setPriorityFilter}
          />
          <SearchableSelect
            value={completionFilter}
            options={[
              { value: "open", label: "Abertas" },
              { value: "completed", label: "Concluidas" },
              { value: "all", label: "Todas" }
            ]}
            triggerClassName="h-9 text-xs"
            searchPlaceholder="Buscar conclusao..."
            onValueChange={(value) => setCompletionFilter(value as CompletionFilter)}
          />
        </div>
      ) : null}

      <div className="relative w-full min-w-0 max-w-full overflow-hidden rounded-md border border-border bg-bg-1">
          {isFetching ? (
            <div className="absolute right-2 top-2 z-40 text-xs text-text-muted">Atualizando...</div>
          ) : null}

          <div className="flex w-full min-w-0 max-w-full">
            <div className="z-30 shrink-0 border-r border-border bg-bg-2" style={{ width: NAME_COL, paddingTop: HEADER_H }}>
              <div
                className="flex items-center border-b border-border px-3 text-xs font-semibold text-text-secondary"
                style={{ height: totalRowH }}
              >
                Total (dias est.)
              </div>
              {workloadRows.map((row) => (
                <div
                  key={row.id}
                  className="flex items-center gap-2 border-b border-border px-3 py-2"
                  style={{ height: row.rowH }}
                >
                  {row.avatarName ? (
                    <Avatar name={row.avatarName} imageUrl={row.avatarUrl} className="h-8 w-8 shrink-0" />
                  ) : (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-surface-card text-xs font-bold text-text-secondary">
                      #
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-text-primary">{row.label}</p>
                    {row.sublabel ? <p className="truncate text-xs text-text-muted">{row.sublabel}</p> : null}
                  </div>
                </div>
              ))}
            </div>

            <div
              ref={scrollRef}
              data-testid="workload-timeline-scroll"
              className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden overscroll-x-contain"
              onWheel={handleTimelineWheel}
              onDragOver={handleTimelineDragOver}
              onDrop={handleTimelineDrop}
            >
              <div className="relative" style={{ width: timelineWidth }}>
                <div
                  className="sticky top-0 z-20 flex border-b border-border bg-bg-2"
                  style={{ width: timelineWidth, height: HEADER_H }}
                >
                  {days.map((d, idx) => {
                    const isToday = d === todayKey;
                    const holidayName = holidayMap.get(d);
                    const weekDay = getDay(parseYmdToLocalNoon(d));
                    const isNonWorking = weekDay === 0 || weekDay === 6 || Boolean(holidayName);
                    const prevDay = idx > 0 ? days[idx - 1] : undefined;
                    const showMonth =
                      idx === 0 ||
                      (prevDay !== undefined && d.slice(0, 7) !== prevDay.slice(0, 7));

                    return (
                      <div
                        key={d}
                        style={{ width: DAY_W, minWidth: DAY_W }}
                        title={holidayName ?? (isNonWorking ? "Final de semana" : undefined)}
                        className={cn(
                          "flex flex-col items-center justify-center border-r border-border-subtle text-[10px] text-text-muted",
                          isNonWorking && "bg-white/[0.04]",
                          holidayName && "bg-brand-orange/10",
                          isToday && "bg-surface-hover text-text-primary"
                        )}
                      >
                        {showMonth ? (
                          <span className="text-[9px] uppercase text-text-muted">
                            {format(parseYmdToLocalNoon(d), "MMM", { locale: ptBR })}
                          </span>
                        ) : !abbreviatedDays ? (
                          <span className="text-[9px] uppercase text-text-muted">
                            {format(parseYmdToLocalNoon(d), "EEE", { locale: ptBR })}
                          </span>
                        ) : (
                          <span className="h-[12px]" />
                        )}
                        <span className="font-semibold text-text-secondary">{format(parseYmdToLocalNoon(d), "d")}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="relative">
                  {todayIdx >= 0 && todayIdx < dayCount ? (
                    <div
                      className="pointer-events-none absolute bottom-0 top-0 z-[4] w-px bg-[var(--color-status-todo)]"
                      style={{ left: todayIdx * DAY_W + DAY_W / 2 }}
                    />
                  ) : null}

                  <div className="flex border-b border-border-subtle">
                    <div
                      className="relative"
                      style={{ width: timelineWidth, minWidth: timelineWidth, height: totalRowH }}
                    >
                      {renderNonWorkingBands(totalRowH, "total")}
                      {showEstimatedDays ? <MiniLoadChart loads={totalLoads} height={CHART_H} /> : null}
                      {showEstimatedDays ? totalLoads.map((load, i) =>
                        load > 0 ? (
                          <span
                            key={`tot-cap-${i}`}
                            className="pointer-events-none absolute text-[9px] text-text-muted"
                            style={{ left: i * DAY_W + 2, top: 2, width: DAY_W - 4 }}
                          >
                            {load >= 10 ? load.toFixed(0) : load.toFixed(1)}
                          </span>
                        ) : null
                      ) : null}
                    </div>
                  </div>

                  {workloadRows.map((row) => {
                    const loads = buildDailyLoadsForTasks(row.rowTasks, days, nonWorkingDays);
                    return (
                      <div key={row.id} className="flex border-b border-border-subtle">
                        <div className="relative" style={{ width: timelineWidth, minWidth: timelineWidth, height: row.rowH }}>
                          {renderNonWorkingBands(row.rowH, row.id)}
                          {renderBars(row.positioned, row.lanes, loads, row.id)}
                        </div>
                      </div>
                    );
                  })}

                </div>
              </div>
            </div>
          </div>
        </div>

      <WorkloadUndatedPanel
        open={undatedPanelOpen}
        onClose={() => setUndatedPanelOpen(false)}
        tasks={undatedTasks}
        labelForTask={(task) => barLabelText(task, mode)}
        statusColorFor={statusColorVar}
        onOpenTask={(task) => {
          setUndatedPanelOpen(false);
          onOpenTask(task);
        }}
      />
      <Dialog open={Boolean(taskPendingDelete)} onOpenChange={(open) => !open && setTaskPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir tarefa</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-text-secondary">
            Esta acao remove a tarefa "{taskPendingDelete?.title}" do projeto. Nao e possivel desfazer pela interface.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setTaskPendingDelete(null)}>
              Cancelar
            </Button>
            <Button variant="danger" disabled={deleteTask.isPending} onClick={() => void confirmDeleteTask()}>
              Excluir
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function mergeTimelineTask(currentTask: TaskWithDiscipline, updatedTask: Task): TaskWithDiscipline {
  return {
    ...currentTask,
    ...updatedTask,
    discipline: updatedTask.discipline
      ? {
          ...currentTask.discipline,
          ...updatedTask.discipline,
          type: updatedTask.discipline.type ?? currentTask.discipline.type
        }
      : currentTask.discipline,
    comments: updatedTask.comments ?? currentTask.comments
  };
}

function removePendingTaskMove(
  current: Record<string, PendingTaskMove>,
  taskId: string
): Record<string, PendingTaskMove> {
  if (!(taskId in current)) {
    return current;
  }

  const next = { ...current };
  delete next[taskId];
  return next;
}
