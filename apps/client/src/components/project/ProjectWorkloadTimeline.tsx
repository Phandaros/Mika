import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type CSSProperties,
  type ReactNode
} from "react";
import {
  addDays,
  format,
  getDay,
  startOfDay
} from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { Priority, Role, TaskStatus, type DisciplineType, type Task, type UpdateTaskRequest, type User } from "shared";
import type { UseMutationResult } from "@tanstack/react-query";
import { Filter, Group, Hash, MoreHorizontal, Plus } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { useCompanyHolidays } from "../../hooks/useCompanyHolidays";
import { useGlobalWorkloadTaskChunks, useProjectWorkloadTaskChunks } from "../../hooks/useTasks";
import { canManageTasks } from "../../lib/permissions";
import { cn, toDateOnly } from "../../lib/utils";
import { workloadTaskLabel } from "../../lib/workloadTaskLabel";
import { useUiStore } from "../../store/uiStore";
import { Avatar } from "../shared/Avatar";
import { taskStatusLabels } from "../shared/Chip";
import { PriorityOptionPill, priorityColors, StatusOptionPill, taskStatusColors } from "../shared/statusVisuals";
import { TaskContextMenu } from "../task/TaskContextMenu";
import { Button } from "../ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger
} from "../ui/context-menu";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { SearchableSelect } from "../ui/searchable-select";
import { WORKLOAD_TASK_DRAG_MIME, WorkloadUndatedPanel } from "./WorkloadUndatedPanel";

const DAY_W = 44;
const HEADER_H = 40;
const CHART_H = 26;
const BAR_H = 22;
const BAR_GAP = 2;
const LANE_STRIDE = BAR_H + BAR_GAP;
const NAME_COL = 192;
const ROW_Y_PAD = 8;
const CHART_GAP = 4;
const EXTENSION_DAYS = 28;
const SCROLL_EDGE = 100;
const SMOOTH_WHEEL_FRICTION = 0.82;
const SMOOTH_WHEEL_MIN_VELOCITY = 0.35;
const SMOOTH_WHEEL_VELOCITY_SCALE = 1 - SMOOTH_WHEEL_FRICTION;
const ALL_FILTER_VALUE = "__all__";
const WEEKDAY_LABELS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SAB"];

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
  assigneeId?: string | null;
};

type DragPreview = {
  taskId: string;
  kind: "move" | "resize-start" | "resize-end";
  startDate: string;
  dueDate: string;
  deltaDays: number;
  pixelOffset: number;
  pixelOffsetY: number;
  targetAssigneeId: string | null;
  targetRowOffset: number;
};

type UndatedDropPreview = {
  taskId: string;
  startDate: string;
  dueDate: string;
  targetAssigneeId: string | null;
};

type QueuedTaskMove = {
  task: TaskWithDiscipline;
  payload: UpdateTaskRequest;
  visual: PendingTaskMove;
};

type TaskMoveQueueEntry = {
  inFlight: QueuedTaskMove | null;
  pending: QueuedTaskMove | null;
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

type EmptyCellContext = {
  rowId: string;
  date: string;
  assigneeId: string | null;
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

/** Soma dias no calendário gregoriano; `ymd` e `YYYY-MM-DD` (data civil, sem fuso). */
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

/** Só para rótulos do cabeçalho (mês/dia no fuso local, meio-dia local evita borda de DST). */
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
    case TaskStatus.TODO:
      return "var(--color-status-todo)";
    case TaskStatus.ON_SCHEDULE:
      return "var(--color-status-on-schedule)";
    case TaskStatus.OVERDUE:
      return "var(--color-status-overdue)";
    case TaskStatus.IN_PROGRESS:
      return "var(--color-status-in-progress)";
    case TaskStatus.AWAITING_REVIEW:
      return "var(--color-status-awaiting-review)";
    case TaskStatus.IN_ANALYSIS:
      return "var(--color-status-in-analysis)";
    case TaskStatus.AWAITING_DEFINITION:
      return "var(--color-status-awaiting-definition)";
    case TaskStatus.FINISHED:
      return "var(--color-status-finished)";
    default:
      return "var(--color-status-todo)";
  }
}

function statusTimelineStyle(status: string): CSSProperties {
  switch (status) {
    case TaskStatus.TODO:
      return tokenTimelineStyle("--status-todo-bg", "--status-todo-text");
    case TaskStatus.ON_SCHEDULE:
      return tokenTimelineStyle("--status-scheduled-bg", "--status-scheduled-text");
    case TaskStatus.OVERDUE:
      return tokenTimelineStyle("--status-late-bg", "--status-late-text");
    case TaskStatus.IN_PROGRESS:
      return tokenTimelineStyle("--status-inprogress-bg", "--status-inprogress-text");
    case TaskStatus.AWAITING_REVIEW:
      return tokenTimelineStyle("--status-review-bg", "--status-review-text");
    case TaskStatus.IN_ANALYSIS:
      return tokenTimelineStyle("--status-analysis-bg", "--status-analysis-text");
    case TaskStatus.AWAITING_DEFINITION:
      return tokenTimelineStyle("--status-waiting-bg", "--status-waiting-text");
    case TaskStatus.FINISHED:
      return tokenTimelineStyle("--status-done-bg", "--status-done-text");
    default:
      return tokenTimelineStyle("--status-todo-bg", "--status-todo-text");
  }
}

function tokenTimelineStyle(bg: string, text: string): CSSProperties {
  return {
    backgroundColor: `var(${bg})`,
    color: `var(${text})`,
    borderColor: `var(${bg})`
  };
}

function roleLabel(role: User["role"]): string {
  const labels: Record<Role, string> = {
    [Role.ADMIN]: "Gerente",
    [Role.COORDINATOR]: "Coordenador",
    [Role.DESIGNER]: "Projetista",
    [Role.INTERN]: "Estagiário"
  };

  return labels[role] ?? role;
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

function layoutRowTasks(rowTasks: TaskWithDiscipline[], unionFrom: string, unionTo: string, includeLoadChart: boolean): {
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
  const chartHeight = includeLoadChart ? CHART_H + CHART_GAP : 0;
  const rowH = ROW_Y_PAD * 2 + chartHeight + lanesHeight;
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
  const { user } = useAuth();
  const canManage = canManageTasks(user);
  const openTaskCreate = useUiStore((state) => state.openTaskCreate);
  const today = startOfDay(new Date());
  const [unionFrom, setUnionFrom] = useState(() => format(addDays(today, -21), "yyyy-MM-dd"));
  const [unionTo, setUnionTo] = useState(() => format(addDays(today, 84), "yyyy-MM-dd"));
  const [showAllUsers, setShowAllUsers] = useState(false);
  const [undatedPanelOpen, setUndatedPanelOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showEstimatedDays, setShowEstimatedDays] = useState(true);
  const [grouping, setGrouping] = useState<WorkloadGrouping>("assignee");
  const [statusFilter, setStatusFilter] = useState<string>(ALL_FILTER_VALUE);
  const [priorityFilter, setPriorityFilter] = useState<string>(ALL_FILTER_VALUE);
  const [assigneeFilter, setAssigneeFilter] = useState<string>(ALL_FILTER_VALUE);
  const [sectionFilter, setSectionFilter] = useState<string>(ALL_FILTER_VALUE);
  const [completionFilter, setCompletionFilter] = useState<CompletionFilter>("all");
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const [draggingUndatedTaskId, setDraggingUndatedTaskId] = useState<string | null>(null);
  const [undatedDropPreview, setUndatedDropPreview] = useState<UndatedDropPreview | null>(null);
  const [pendingTaskMoves, setPendingTaskMoves] = useState<Record<string, PendingTaskMove>>({});
  const [emptyCellContext, setEmptyCellContext] = useState<EmptyCellContext | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pendingScrollAdjust = useRef(0);
  const scrollReady = useRef(false);
  const smoothWheelVelocity = useRef(0);
  const smoothWheelFrame = useRef<number | null>(null);
  const smoothWheelIntent = useRef(0);
  const extendingLeft = useRef(false);
  const extendingRight = useRef(false);
  const taskMoveQueues = useRef<Record<string, TaskMoveQueueEntry>>({});
  const draggingUndatedTaskIdRef = useRef<string | null>(null);

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
        const rawAssigneeId = task.assigneeId ?? null;
        const pendingAssigneeId = pendingMove.assigneeId ?? rawAssigneeId;
        if (
          rawStart === pendingMove.startDate &&
          rawDue === pendingMove.dueDate &&
          rawAssigneeId === pendingAssigneeId
        ) {
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
  const undatedTasks = useMemo(
    () => filteredTasks.filter((t) => clientTaskBounds(t) === null && !t.completed),
    [filteredTasks]
  );

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

  const totalRowH = showEstimatedDays ? CHART_H + ROW_Y_PAD * 2 : 0;

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
          const { positioned, lanes, rowH } = layoutRowTasks(row.tasks, unionFrom, unionTo, showEstimatedDays);
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
      const { positioned, lanes, rowH } = layoutRowTasks(rowTasks, unionFrom, unionTo, showEstimatedDays);
      return {
        id: user.id,
        label: user.name,
        sublabel: roleLabel(user.role),
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
      const { positioned, lanes, rowH } = layoutRowTasks(unassignedTasks, unionFrom, unionTo, showEstimatedDays);
      rows.push({
        id: "unassigned",
        label: "Sem responsável",
        rowTasks: unassignedTasks,
        positioned,
        lanes,
        rowH
      });
    }

    return rows;
  }, [datedTasks, grouping, showEstimatedDays, unionFrom, unionTo, userRows]);

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

  useEffect(() => {
    const el = scrollRef.current;

    if (!el) {
      return undefined;
    }

    const box = el;

    function onWheel(event: WheelEvent) {
      const shouldTranslateShiftWheel = event.shiftKey && Math.abs(event.deltaY) > Math.abs(event.deltaX);

      if (!shouldTranslateShiftWheel) {
        cancelSmoothWheelScroll();
        if (event.deltaX !== 0) {
          maybeExtendTimeline(box, event.deltaX < 0 ? "left" : "right");
        }
        return;
      }

      if (event.deltaY === 0) {
        return;
      }

      if (event.cancelable) {
        event.preventDefault();
      }

      if (smoothWheelFrame.current === null) {
        smoothWheelIntent.current = 0;
      }
      smoothWheelIntent.current += event.deltaY;
      smoothWheelVelocity.current += event.deltaY * SMOOTH_WHEEL_VELOCITY_SCALE;

      maybeExtendTimeline(box, event.deltaY < 0 ? "left" : "right");
      scheduleSmoothWheelScroll();
    }

    box.addEventListener("wheel", onWheel, { passive: false });
    return () => box.removeEventListener("wheel", onWheel);
  }, [maybeExtendTimeline]);

  useEffect(() => {
    return () => {
      if (smoothWheelFrame.current !== null) {
        window.cancelAnimationFrame(smoothWheelFrame.current);
      }
    };
  }, []);

  function clampTimelineScroll(box: HTMLDivElement, value: number) {
    const max = Math.max(0, box.scrollWidth - box.clientWidth);
    return Math.min(Math.max(0, value), max);
  }

  function clearSmoothWheelFrame() {
    smoothWheelVelocity.current = 0;
    smoothWheelFrame.current = null;
    smoothWheelIntent.current = 0;
  }

  function cancelSmoothWheelScroll() {
    if (smoothWheelFrame.current !== null) {
      window.cancelAnimationFrame(smoothWheelFrame.current);
    }
    clearSmoothWheelFrame();
  }

  function runSmoothWheelScroll() {
    const box = scrollRef.current;
    const velocity = smoothWheelVelocity.current;

    if (!box) {
      clearSmoothWheelFrame();
      return;
    }

    if (Math.abs(velocity) < SMOOTH_WHEEL_MIN_VELOCITY) {
      maybeExtendTimeline(box, smoothWheelIntent.current < 0 ? "left" : "right");
      clearSmoothWheelFrame();
      return;
    }

    const direction = velocity < 0 ? "left" : "right";
    const nextScrollLeft = clampTimelineScroll(box, box.scrollLeft + velocity);

    box.scrollLeft = nextScrollLeft;
    maybeExtendTimeline(box, direction);

    const hitEdge =
      (velocity < 0 && nextScrollLeft <= 0) || (velocity > 0 && nextScrollLeft >= box.scrollWidth - box.clientWidth);

    smoothWheelVelocity.current = hitEdge ? 0 : velocity * SMOOTH_WHEEL_FRICTION;
    smoothWheelFrame.current = window.requestAnimationFrame(runSmoothWheelScroll);
  }

  function scheduleSmoothWheelScroll() {
    if (smoothWheelFrame.current !== null) {
      return;
    }

    smoothWheelFrame.current = window.requestAnimationFrame(runSmoothWheelScroll);
  }

  function clearUndatedDrag() {
    draggingUndatedTaskIdRef.current = null;
    setDraggingUndatedTaskId(null);
    setUndatedDropPreview(null);
  }

  function handleUndatedDragStart(taskId: string) {
    if (!canManage) {
      return;
    }

    draggingUndatedTaskIdRef.current = taskId;
    setDraggingUndatedTaskId(taskId);
  }

  function handleUndatedDragEnd() {
    clearUndatedDrag();
  }

  function handleTimelineDragOver(event: DragEvent<HTMLDivElement>) {
    const taskId = draggingUndatedTaskIdRef.current;
    const types = Array.from(event.dataTransfer.types);
    const isUndatedDrag = taskId !== null || types.includes(WORKLOAD_TASK_DRAG_MIME);

    if (!isUndatedDrag || !canManage) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";

    if (!taskId) {
      return;
    }

    const ymd = timelineDateAtClientX(event.clientX);
    if (!ymd) {
      setUndatedDropPreview(null);
      return;
    }

    const task = tasks.find((item) => item.id === taskId);
    const targetRow = workloadRowAtClientY(event.clientY);
    const targetAssigneeId =
      grouping === "assignee" && targetRow ? targetRow.assigneeId : (task?.assigneeId ?? null);

    setUndatedDropPreview({
      taskId,
      startDate: ymd,
      dueDate: ymd,
      targetAssigneeId
    });
  }

  function handleTimelineDragLeave(event: DragEvent<HTMLDivElement>) {
    if (!draggingUndatedTaskIdRef.current) {
      return;
    }

    const related = event.relatedTarget;
    if (related instanceof Node && event.currentTarget.contains(related)) {
      return;
    }

    setUndatedDropPreview(null);
  }

  function samePendingTaskMove(a: PendingTaskMove | undefined, b: PendingTaskMove): boolean {
    return (
      a?.startDate === b.startDate &&
      a.dueDate === b.dueDate &&
      (a.assigneeId ?? null) === (b.assigneeId ?? null)
    );
  }

  function removePendingTaskMoveIfCurrent(taskId: string, expected: PendingTaskMove) {
    setPendingTaskMoves((current) =>
      samePendingTaskMove(current[taskId], expected) ? removePendingTaskMove(current, taskId) : current
    );
  }

  function setQueuedTaskMove(taskId: string, visual: PendingTaskMove) {
    setPendingTaskMoves((current) => ({
      ...current,
      [taskId]: visual
    }));
  }

  function queueTaskMove(task: TaskWithDiscipline, payload: UpdateTaskRequest, visual: PendingTaskMove) {
    setQueuedTaskMove(task.id, visual);
    const currentEntry = taskMoveQueues.current[task.id] ?? { inFlight: null, pending: null };
    const move: QueuedTaskMove = { task, payload, visual };

    if (currentEntry.inFlight) {
      taskMoveQueues.current[task.id] = { ...currentEntry, pending: move };
      return;
    }

    taskMoveQueues.current[task.id] = { inFlight: move, pending: null };
    void flushTaskMoveQueue(task.id);
  }

  async function flushTaskMoveQueue(taskId: string) {
    const entry = taskMoveQueues.current[taskId];
    const move = entry?.inFlight;
    if (!entry || !move) {
      return;
    }

    try {
      const updatedTask = await updateTask.mutateAsync({ id: taskId, payload: move.payload });
      onTaskUpdated?.(mergeTimelineTask(move.task, updatedTask));
      removePendingTaskMoveIfCurrent(taskId, move.visual);
    } catch {
      const latestEntry = taskMoveQueues.current[taskId];
      if (!latestEntry?.pending) {
        removePendingTaskMoveIfCurrent(taskId, move.visual);
      }
    } finally {
      const latestEntry = taskMoveQueues.current[taskId];
      if (latestEntry?.pending) {
        taskMoveQueues.current[taskId] = { inFlight: latestEntry.pending, pending: null };
        void flushTaskMoveQueue(taskId);
      } else if (latestEntry) {
        delete taskMoveQueues.current[taskId];
      }
    }
  }

  function handleTimelineDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();

    const id =
      draggingUndatedTaskIdRef.current ||
      event.dataTransfer.getData(WORKLOAD_TASK_DRAG_MIME) ||
      event.dataTransfer.getData("text/plain");
    clearUndatedDrag();

    if (!canManage || !id || days.length === 0) {
      return;
    }

    const ymd = timelineDateAtClientX(event.clientX);
    if (!ymd) {
      return;
    }

    const task = tasks.find((item) => item.id === id);
    if (!task) {
      return;
    }

    const targetRow = workloadRowAtClientY(event.clientY);
    const payload: UpdateTaskRequest = { startDate: ymd, dueDate: ymd };
    const visual: PendingTaskMove = { startDate: ymd, dueDate: ymd };

    if (grouping === "assignee" && targetRow) {
      payload.assigneeId = targetRow.assigneeId;
      visual.assigneeId = targetRow.assigneeId;
    }

    queueTaskMove(task, payload, visual);
  }

  function assigneeIdForRow(rowId: string): string | null {
    return rowId === "unassigned" ? null : rowId;
  }

  function timelineDateAtClientX(clientX: number): string | null {
    const box = scrollRef.current;
    if (!box) {
      return null;
    }

    const rect = box.getBoundingClientRect();
    const x = clientX - rect.left + box.scrollLeft;
    const idx = Math.floor(x / DAY_W);
    return days[idx] ?? null;
  }

  function handleEmptyRowContextMenu(event: ReactMouseEvent<HTMLDivElement>, row: WorkloadRow) {
    if (event.target instanceof Element && event.target.closest("[data-workload-task-bar='true']")) {
      return;
    }

    const date = timelineDateAtClientX(event.clientX);
    if (!date) {
      setEmptyCellContext(null);
      return;
    }

    setEmptyCellContext({
      rowId: row.id,
      date,
      assigneeId: grouping === "assignee" ? assigneeIdForRow(row.id) : null
    });
  }

  function createTaskFromEmptyCell() {
    if (!emptyCellContext) {
      return;
    }

    openTaskCreate({
      projectId,
      assigneeId: emptyCellContext.assigneeId,
      startDate: emptyCellContext.date,
      dueDate: emptyCellContext.date,
      sectionScope: workloadScope ?? "general"
    });
  }

  function workloadRowAtClientY(clientY: number): { assigneeId: string | null; rowTop: number } | null {
    if (grouping !== "assignee") {
      return null;
    }

    const box = scrollRef.current;
    if (!box) {
      return null;
    }

    const y = clientY - box.getBoundingClientRect().top;
    let rowTop = HEADER_H + totalRowH;

    for (const row of workloadRows) {
      const rowBottom = rowTop + row.rowH;
      if (y >= rowTop && y < rowBottom) {
        return { assigneeId: assigneeIdForRow(row.id), rowTop };
      }
      rowTop = rowBottom;
    }

    return null;
  }

  function handleBarPointerDown(
    ev: ReactPointerEvent<HTMLElement>,
    task: TaskWithDiscipline,
    bounds: { start: string; end: string },
    kind: DragPreview["kind"] = "move"
  ) {
    if (ev.button !== 0) {
      return;
    }

    if (!canManage) {
      return;
    }

    ev.preventDefault();
    ev.stopPropagation();
    const pointerId = ev.pointerId;
    const originX = ev.clientX;
    const originY = ev.clientY;
    const originRow = workloadRowAtClientY(originY);
    const originRowTop = originRow?.rowTop ?? 0;
    const originalAssigneeId = task.assigneeId ?? null;
    let targetStartDate = bounds.start;
    let targetDueDate = bounds.end;
    let targetAssigneeId = originalAssigneeId;
    let targetRowOffset = 0;
    let moved = false;

    function onMove(e: PointerEvent) {
      if (e.pointerId !== pointerId) {
        return;
      }

      const pixelOffset = e.clientX - originX;
      const pixelOffsetY = e.clientY - originY;
      const next = Math.round(pixelOffset / DAY_W);
      const box = scrollRef.current;
      if (box) {
        maybeExtendTimeline(box, kind === "resize-start" ? "left" : kind === "resize-end" ? "right" : "both");
      }

      if (kind === "move") {
        const targetRow = workloadRowAtClientY(e.clientY);
        if (targetRow) {
          targetAssigneeId = targetRow.assigneeId;
          targetRowOffset = targetRow.rowTop - originRowTop;
        }
      }

      if (Math.abs(pixelOffset) > 4 || Math.abs(pixelOffsetY) > 4) {
        moved = true;
      }

      if (moved) {
        if (kind === "resize-start") {
          targetStartDate = ymdMin(addCalendarDaysYmd(bounds.start, next), bounds.end);
          targetDueDate = bounds.end;
        } else if (kind === "resize-end") {
          targetStartDate = bounds.start;
          targetDueDate = ymdMax(addCalendarDaysYmd(bounds.end, next), bounds.start);
        } else {
          targetStartDate = addCalendarDaysYmd(bounds.start, next);
          targetDueDate = addCalendarDaysYmd(bounds.end, next);
        }

        setDragPreview({
          taskId: task.id,
          kind,
          startDate: targetStartDate,
          dueDate: targetDueDate,
          deltaDays: next,
          pixelOffset,
          pixelOffsetY: kind === "move" ? pixelOffsetY : 0,
          targetAssigneeId,
          targetRowOffset
        });
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

      const assigneeChanged = targetAssigneeId !== originalAssigneeId;

      if (targetStartDate === bounds.start && targetDueDate === bounds.end && !assigneeChanged) {
        setDragPreview(null);
        return;
      }

      const payload: UpdateTaskRequest = { startDate: targetStartDate, dueDate: targetDueDate };
      if (assigneeChanged) {
        payload.assigneeId = targetAssigneeId;
      }
      setDragPreview(null);
      queueTaskMove(task, payload, {
        startDate: targetStartDate,
        dueDate: targetDueDate,
        ...(assigneeChanged ? { assigneeId: targetAssigneeId } : {})
      });
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
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
            holidayName ? "bg-brand-orange/10" : "bg-[rgba(244,244,245,0.035)]"
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
    const chartSlotHeight = showEstimatedDays ? CHART_H + CHART_GAP : 0;
    const barTop = ROW_Y_PAD + chartSlotHeight;

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
          const activeDragPreview = dragPreview?.taskId === p.task.id ? dragPreview : null;
          const previewAssigneeChanged =
            activeDragPreview !== null && activeDragPreview.targetAssigneeId !== (p.task.assigneeId ?? null);
          const span = endIdx - startIdx + 1;
          const left = startIdx * DAY_W + 2;
          const width = span * DAY_W - 4;
          const previewClip = activeDragPreview
            ? clipToViewport({ start: activeDragPreview.startDate, end: activeDragPreview.dueDate }, unionFrom, unionTo)
            : null;
          const previewLeft = previewClip ? previewClip.startIdx * DAY_W + 2 : left;
          const previewWidth = previewClip ? (previewClip.endIdx - previewClip.startIdx + 1) * DAY_W - 4 : width;
          const isMovingTask = activeDragPreview?.kind === "move";

          if (width <= 0 || left + width < 0 || left > timelineWidth) {
            return null;
          }

          return (
            <Fragment key={`${rowKey}-${p.task.id}`}>
              {activeDragPreview && previewClip && (activeDragPreview.deltaDays !== 0 || previewAssigneeChanged) ? (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute z-[5] rounded-md border border-dashed bg-[var(--color-brand-orange-muted)]"
                  style={{
                    left: previewLeft,
                    width: previewWidth,
                    top: barTop + lane * LANE_STRIDE + activeDragPreview.targetRowOffset,
                    height: BAR_H,
                    borderColor: "var(--color-brand-orange)",
                    transition:
                      "left 120ms var(--ease-out-expo), top 120ms var(--ease-out-expo), opacity 120ms var(--ease-out-expo)"
                  }}
                />
              ) : null}
              <TaskContextMenu
                task={p.task}
                projectId={projectId}
                onOpen={onOpenTask}
                onContextMenu={() => setEmptyCellContext(null)}
              >
                <button
                  type="button"
                  data-workload-task-bar="true"
                  title={workloadTaskLabel(p.task, mode)}
                  style={{
                    position: "absolute",
                    left,
                    width,
                    top: barTop + lane * LANE_STRIDE,
                    height: BAR_H,
                    ...statusTimelineStyle(p.task.status),
                    opacity: p.task.completed && !activeDragPreview ? 0.45 : 1,
                    transform: activeDragPreview && isMovingTask
                      ? `translate3d(${activeDragPreview.pixelOffset}px, ${activeDragPreview.pixelOffsetY - 2}px, 0) scale(1.025)`
                      : undefined,
                    transition: activeDragPreview
                      ? "opacity 120ms var(--ease-out-expo), box-shadow 120ms var(--ease-out-expo), border-color 120ms var(--ease-out-expo)"
                      : "transform 180ms var(--ease-out-expo), opacity 120ms var(--ease-out-expo), box-shadow 160ms var(--ease-out-expo), border-color 120ms var(--ease-out-expo)",
                    willChange: activeDragPreview ? "transform" : undefined
                  }}
                  className={cn(
                    "z-[6] cursor-grab select-none overflow-hidden rounded-md border px-3 text-left text-[11px] font-semibold shadow-sm outline-none active:cursor-grabbing",
                    "transition-[transform,opacity,box-shadow,border-color] duration-150 ease-out-expo hover:-translate-y-px hover:shadow-md focus-visible:ring-2 focus-visible:ring-brand-orange focus-visible:ring-offset-1 focus-visible:ring-offset-bg-1",
                    activeDragPreview &&
                      "z-[18] cursor-grabbing border-brand-orange shadow-2xl ring-2 ring-brand-orange"
                  )}
                  onPointerDown={(e) => {
                    const b = clientTaskBounds(p.task);
                    if (!b) {
                      return;
                    }

                    handleBarPointerDown(e, p.task, b);
                  }}
                >
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-0 left-0 z-[2] w-2 cursor-ew-resize bg-white/10 opacity-0 transition hover:opacity-100"
                    onPointerDown={(e) => {
                      const b = clientTaskBounds(p.task);
                      if (!b) {
                        return;
                      }

                      handleBarPointerDown(e, p.task, b, "resize-start");
                    }}
                  />
                  <span className="line-clamp-1">{workloadTaskLabel(p.task, mode)}</span>
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-0 right-0 z-[2] w-2 cursor-ew-resize bg-white/10 opacity-0 transition hover:opacity-100"
                    onPointerDown={(e) => {
                      const b = clientTaskBounds(p.task);
                      if (!b) {
                        return;
                      }

                      handleBarPointerDown(e, p.task, b, "resize-end");
                    }}
                  />
                </button>
              </TaskContextMenu>
            </Fragment>
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

  const highlightedAssigneeId = dragPreview?.targetAssigneeId ?? undatedDropPreview?.targetAssigneeId;

  function renderUndatedDropGhost(row: WorkloadRow): ReactNode {
    if (
      grouping !== "assignee" ||
      !undatedDropPreview ||
      assigneeIdForRow(row.id) !== undatedDropPreview.targetAssigneeId
    ) {
      return null;
    }

    const previewClip = clipToViewport(
      { start: undatedDropPreview.startDate, end: undatedDropPreview.dueDate },
      unionFrom,
      unionTo
    );
    if (!previewClip) {
      return null;
    }

    const chartSlotHeight = showEstimatedDays ? CHART_H + CHART_GAP : 0;
    const barTop = ROW_Y_PAD + chartSlotHeight;
    const left = previewClip.startIdx * DAY_W + 2;
    const width = (previewClip.endIdx - previewClip.startIdx + 1) * DAY_W - 4;

    if (width <= 0) {
      return null;
    }

    const draggingTask = tasks.find((item) => item.id === undatedDropPreview.taskId);

    return (
      <div
        aria-hidden="true"
        className="pointer-events-none absolute z-[5] overflow-hidden rounded-md border border-dashed bg-[var(--color-brand-orange-muted)] px-3 text-[11px] font-semibold text-text-primary"
        style={{
          left,
          width,
          top: barTop,
          height: BAR_H,
          borderColor: "var(--color-brand-orange)"
        }}
      >
        <span className="line-clamp-1">
          {draggingTask ? workloadTaskLabel(draggingTask, mode) : "Nova tarefa"}
        </span>
      </div>
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
              cancelSmoothWheelScroll();
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
          <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
            <PopoverTrigger asChild>
              <Button type="button" variant={filtersOpen ? "primary" : "secondary"} className="h-8 px-3 text-xs">
                <Filter size={14} />
                Filtrar
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="grid w-[min(920px,calc(100vw-32px))] gap-2 p-3 sm:grid-cols-2 lg:grid-cols-5">
              <SearchableSelect
                value={sectionFilter}
                options={[
                  { value: ALL_FILTER_VALUE, label: "Todas as seções" },
                  ...sectionOptions.map(([id, label]) => ({ value: id, label }))
                ]}
                triggerClassName="h-9 text-xs"
                searchPlaceholder="Buscar seção..."
                onValueChange={setSectionFilter}
              />
              <SearchableSelect
                value={assigneeFilter}
                options={[
                  { value: ALL_FILTER_VALUE, label: "Todos os responsáveis" },
                  ...assigneeOptions.map((user) => ({
                    value: user.id,
                    label: user.name,
                    description: user.email,
                    avatarUrl: user.avatarUrl
                  }))
                ]}
                triggerClassName="h-9 text-xs"
                searchPlaceholder="Buscar responsável..."
                onValueChange={setAssigneeFilter}
              />
              <SearchableSelect
                value={statusFilter}
                options={[
                  { value: ALL_FILTER_VALUE, label: "Todos os status" },
                  ...Object.values(TaskStatus).map((status) => ({
                    value: status,
                    label: taskStatusLabels[status],
                    color: taskStatusColors[status],
                    render: <StatusOptionPill label={taskStatusLabels[status]} color={taskStatusColors[status]} />
                  }))
                ]}
                triggerClassName="h-9 text-xs"
                searchPlaceholder="Buscar status..."
                showSelectionIndicator={false}
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
                  { value: "all", label: "Todas" },
                  { value: "open", label: "Abertas" },
                  { value: "completed", label: "Concluídas" }
                ]}
                triggerClassName="h-9 text-xs"
                searchPlaceholder="Buscar conclusão..."
                onValueChange={(value) => setCompletionFilter(value as CompletionFilter)}
              />
            </PopoverContent>
          </Popover>
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            <Group size={14} />
            <SearchableSelect
              value={grouping}
              options={[
                { value: "assignee", label: "Responsável" },
                { value: "section", label: "Seção" }
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
          <Button type="button" variant="secondary" className="h-8 px-3 text-xs" title="Opções">
            <MoreHorizontal size={14} />
            Opções
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

      <div className="relative w-full min-w-0 max-w-full overflow-hidden rounded-md border border-border bg-bg-1">
          {isFetching ? (
            <div className="absolute right-2 top-2 z-40 text-xs text-text-muted">Atualizando...</div>
          ) : null}

          <div className="flex w-full min-w-0 max-w-full">
            <div className="z-30 shrink-0 border-r border-border bg-bg-2" style={{ width: NAME_COL }}>
              <div className="border-b border-border bg-bg-2" style={{ height: HEADER_H }} />
              {showEstimatedDays ? (
                <div
                  className="flex items-center border-b border-border-subtle px-3 text-xs font-semibold text-text-secondary"
                  style={{ height: totalRowH }}
                >
                  Total (dias est.)
                </div>
              ) : null}
              {workloadRows.map((row) => {
                const chartSlotHeight = showEstimatedDays ? CHART_H + CHART_GAP : 0;

                return (
                  <div
                    key={row.id}
                    className={cn(
                      "border-b border-border-subtle transition-colors duration-150 hover:bg-surface-hover",
                      highlightedAssigneeId === assigneeIdForRow(row.id) && "bg-[var(--color-brand-orange-muted)]"
                    )}
                    style={{ height: row.rowH, paddingTop: chartSlotHeight }}
                  >
                    <div className="flex h-full items-center gap-2 px-3 py-2">
                      {row.avatarName ? (
                        <Avatar name={row.avatarName} imageUrl={row.avatarUrl} className="h-8 w-8 shrink-0" />
                      ) : (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-surface-card text-xs font-bold text-text-secondary">
                          #
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-text-primary">{row.label}</p>
                        {row.sublabel ? <p className="truncate text-xs text-text-muted">{row.sublabel}</p> : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div
              ref={scrollRef}
              data-testid="workload-timeline-scroll"
              className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden overscroll-x-contain"
              onPointerDownCapture={cancelSmoothWheelScroll}
              onDragOverCapture={handleTimelineDragOver}
              onDragLeave={handleTimelineDragLeave}
              onDropCapture={handleTimelineDrop}
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
                          isNonWorking && "bg-[rgba(244,244,245,0.04)]",
                          holidayName && "bg-brand-orange/10",
                          isToday && "bg-bg-3 text-text-primary"
                        )}
                      >
                        <span className="h-2.5 text-[9px] font-medium leading-none uppercase text-text-muted">
                          {showMonth ? format(parseYmdToLocalNoon(d), "MMM", { locale: ptBR }) : ""}
                        </span>
                        <span className="text-[9px] font-medium leading-none uppercase text-text-muted">
                          {WEEKDAY_LABELS[weekDay]}
                        </span>
                        <span className={cn("font-semibold leading-none text-text-secondary", isToday && "text-text-primary")}>
                          {format(parseYmdToLocalNoon(d), "d")}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="relative">
                  {todayIdx >= 0 && todayIdx < dayCount ? (
                    <div
                      className="pointer-events-none absolute bottom-0 top-0 z-[4] w-px bg-[var(--color-brand-orange)] opacity-60"
                      style={{ left: todayIdx * DAY_W + DAY_W / 2 }}
                    />
                  ) : null}

                  {showEstimatedDays ? (
                    <div className="flex border-b border-border-subtle">
                      <div
                        className="relative"
                        style={{ width: timelineWidth, minWidth: timelineWidth, height: totalRowH }}
                      >
                        {renderNonWorkingBands(totalRowH, "total")}
                        <div className="absolute left-0 top-1">
                          <MiniLoadChart loads={totalLoads} height={CHART_H} />
                        </div>
                        {totalLoads.map((load, i) =>
                          load > 0 ? (
                            <span
                              key={`tot-cap-${i}`}
                              className="pointer-events-none absolute text-[9px] text-text-muted"
                              style={{ left: i * DAY_W + 2, top: 2, width: DAY_W - 4 }}
                            >
                              {load >= 10 ? load.toFixed(0) : load.toFixed(1)}
                            </span>
                          ) : null
                        )}
                      </div>
                    </div>
                  ) : null}

                  {workloadRows.map((row) => {
                    const loads = buildDailyLoadsForTasks(row.rowTasks, days, nonWorkingDays);
                    return (
                      <ContextMenu key={row.id}>
                        <ContextMenuTrigger asChild>
                          <div
                            className={cn(
                              "flex border-b border-border-subtle transition-colors duration-150 hover:bg-surface-hover",
                              highlightedAssigneeId === assigneeIdForRow(row.id) && "bg-[var(--color-brand-orange-muted)]"
                            )}
                            onContextMenu={(event) => handleEmptyRowContextMenu(event, row)}
                          >
                            <div className="relative" style={{ width: timelineWidth, minWidth: timelineWidth, height: row.rowH }}>
                              {renderNonWorkingBands(row.rowH, row.id)}
                              {renderUndatedDropGhost(row)}
                              {renderBars(row.positioned, row.lanes, loads, row.id)}
                            </div>
                          </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent>
                          <ContextMenuItem disabled={!canManage || emptyCellContext?.rowId !== row.id} onSelect={createTaskFromEmptyCell}>
                            <Plus className="h-4 w-4" />
                            Criar tarefa aqui
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
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
        labelForTask={(task) => workloadTaskLabel(task, mode)}
        statusColorFor={statusColorVar}
        canDrag={canManage}
        assigneeGrouping={grouping === "assignee"}
        onDragStart={handleUndatedDragStart}
        onDragEnd={handleUndatedDragEnd}
        onOpenTask={(task) => {
          setUndatedPanelOpen(false);
          onOpenTask(task);
        }}
      />
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
