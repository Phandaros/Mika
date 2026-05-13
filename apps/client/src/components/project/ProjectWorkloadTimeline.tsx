import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode
} from "react";
import {
  addDays,
  format,
  startOfDay
} from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { TaskStatus, type DisciplineType, type Task, type UpdateTaskRequest, type User } from "shared";
import type { UseMutationResult } from "@tanstack/react-query";
import { useGlobalWorkloadTasks, useProjectWorkloadTasks } from "../../hooks/useTasks";
import { cn } from "../../lib/utils";
import { Avatar } from "../shared/Avatar";
import { LoadingSpinner } from "../shared/LoadingSpinner";
import { Button } from "../ui/button";
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

type TaskWithDiscipline = Task & {
  discipline: {
    id: string;
    name: string;
    projectId: string;
    projectName?: string | null;
    type: DisciplineType;
  };
};

function toYmd(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  return value.slice(0, 10);
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

function buildDailyLoadsForTasks(tasks: Task[], dayKeys: string[]): number[] {
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

    const fullSpan = eachYmdInclusive(bounds.start, bounds.end);
    if (fullSpan.length === 0) {
      continue;
    }

    const per = task.estimatedDays / fullSpan.length;

    for (const ymd of eachYmdInclusive(clippedStartY, clippedEndY)) {
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
  const { users, isActive, onOpenTask, updateTask } = props;
  const today = startOfDay(new Date());
  const [unionFrom, setUnionFrom] = useState(() => format(addDays(today, -21), "yyyy-MM-dd"));
  const [unionTo, setUnionTo] = useState(() => format(addDays(today, 84), "yyyy-MM-dd"));
  const [showAllUsers, setShowAllUsers] = useState(false);
  const [undatedPanelOpen, setUndatedPanelOpen] = useState(false);
  const [dragPreview, setDragPreview] = useState<{ taskId: string; deltaDays: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pendingScrollAdjust = useRef(0);
  const scrollReady = useRef(false);

  useEffect(() => {
    const id = window.setTimeout(() => {
      scrollReady.current = true;
    }, 400);
    return () => window.clearTimeout(id);
  }, []);

  const projectQuery = useProjectWorkloadTasks(projectId, unionFrom, unionTo, isActive && mode === "project");
  const globalQuery = useGlobalWorkloadTasks(
    workloadScope ?? "general",
    unionFrom,
    unionTo,
    isActive && mode === "global"
  );

  const rawTasks = mode === "global" ? (globalQuery.data ?? []) : (projectQuery.data ?? []);
  const isLoading = mode === "global" ? globalQuery.isLoading : projectQuery.isLoading;
  const isFetching = mode === "global" ? globalQuery.isFetching : projectQuery.isFetching;

  const tasks = useMemo(() => {
    return rawTasks.filter((task) => {
      if (disciplineIdFilter.size === 0) {
        return true;
      }

      return disciplineIdFilter.has(task.disciplineId);
    }) as TaskWithDiscipline[];
  }, [rawTasks, disciplineIdFilter]);

  const days = useMemo(() => eachYmdInclusive(unionFrom, unionTo), [unionFrom, unionTo]);

  const dayCount = days.length;
  const timelineWidth = dayCount * DAY_W;

  const todayKey = format(today, "yyyy-MM-dd");
  const todayIdx = days.indexOf(todayKey);

  const datedTasks = useMemo(() => tasks.filter((t) => clientTaskBounds(t) !== null), [tasks]);
  const undatedTasks = useMemo(() => tasks.filter((t) => clientTaskBounds(t) === null), [tasks]);

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

  const hasUnassigned = datedTasks.some((t) => !t.assigneeId);

  const totalLoads = useMemo(() => buildDailyLoadsForTasks(datedTasks, days), [datedTasks, days]);

  const totalRowH = CHART_H + 8;

  const userLayouts = useMemo(
    () =>
      userRows.map((user) => {
        const rowTasks = datedTasks.filter((t) => t.assigneeId === user.id);
        const { positioned, lanes, rowH } = layoutRowTasks(rowTasks, unionFrom, unionTo);
        return { user, rowTasks, positioned, lanes, rowH };
      }),
    [datedTasks, unionFrom, unionTo, userRows]
  );

  const unassignedLayout = useMemo(() => {
    if (!hasUnassigned) {
      return null;
    }

    const rowTasks = datedTasks.filter((t) => !t.assigneeId);
    return layoutRowTasks(rowTasks, unionFrom, unionTo);
  }, [datedTasks, hasUnassigned, unionFrom, unionTo]);

  const extendLeft = useCallback(() => {
    const nextFrom = addCalendarDaysYmd(unionFrom, -EXTENSION_DAYS);
    pendingScrollAdjust.current += EXTENSION_DAYS * DAY_W;
    setUnionFrom(nextFrom);
  }, [unionFrom]);

  const extendRight = useCallback(() => {
    setUnionTo((current) => addCalendarDaysYmd(current, EXTENSION_DAYS));
  }, []);

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
      if (!box || !scrollReady.current) {
        return;
      }

      if (box.scrollLeft < SCROLL_EDGE) {
        extendLeft();
      }

      if (box.scrollLeft + box.clientWidth > box.scrollWidth - SCROLL_EDGE) {
        extendRight();
      }
    }

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [extendLeft, extendRight]);

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

    void updateTask.mutateAsync({ id, payload: { startDate: ymd, dueDate: ymd } });
  }

  function handleBarPointerDown(
    ev: ReactPointerEvent<HTMLButtonElement>,
    task: TaskWithDiscipline,
    bounds: { start: string; end: string }
  ) {
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
      void updateTask
        .mutateAsync({
          id: task.id,
          payload: { startDate: newStart, dueDate: newEnd }
        })
        .finally(() => {
          setDragPreview((current) => (current?.taskId === task.id ? null : current));
        });
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
  }

  function renderBars(
    positioned: PositionedTask[],
    lanes: number[],
    loads: number[],
    rowKey: string
  ): ReactNode {
    return (
      <>
        <div className="absolute left-0 top-1">
          <MiniLoadChart loads={loads} height={CHART_H} />
        </div>
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
            <button
              key={`${rowKey}-${p.task.id}`}
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
          );
        })}
        {loads.map((load, i) =>
          load > 0 ? (
            <span
              key={`${rowKey}-cap-${i}`}
              className="pointer-events-none absolute text-[9px] text-text-muted"
              style={{ left: i * DAY_W + 2, top: 2, width: DAY_W - 4 }}
            >
              {load >= 10 ? load.toFixed(0) : load.toFixed(1)}
            </span>
          ) : null
        )}
      </>
    );
  }

  return (
    <div className="w-full min-w-0 max-w-full space-y-3 overflow-x-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-text-secondary">
          <input
            type="checkbox"
            checked={showAllUsers}
            onChange={(event) => setShowAllUsers(event.target.checked)}
            className="rounded border-border"
          />
          Mostrar toda a equipe
        </label>
        <div className="flex flex-wrap items-center gap-2">
          {undatedTasks.length ? (
            <Button
              type="button"
              variant="secondary"
              className="text-xs"
              onClick={() => setUndatedPanelOpen(true)}
            >
              Sem datas ({undatedTasks.length})
            </Button>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            className="text-xs"
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
        </div>
      </div>

      {isLoading && !rawTasks.length ? (
        <LoadingSpinner />
      ) : (
        <div className="relative w-full min-w-0 max-w-full overflow-hidden rounded-md border border-border bg-bg-1">
          {isFetching ? (
            <div className="absolute right-2 top-2 z-40 text-xs text-text-muted">Atualizando…</div>
          ) : null}

          <div className="flex w-full min-w-0 max-w-full">
            <div className="z-30 shrink-0 border-r border-border bg-bg-2" style={{ width: NAME_COL, paddingTop: HEADER_H }}>
              <div
                className="flex items-center border-b border-border px-3 text-xs font-semibold text-text-secondary"
                style={{ height: totalRowH }}
              >
                Total (dias est.)
              </div>
              {userLayouts.map(({ user, rowH }) => (
                <div
                  key={user.id}
                  className="flex items-center gap-2 border-b border-border px-3 py-2"
                  style={{ height: rowH }}
                >
                  <Avatar name={user.name} imageUrl={user.avatarUrl} className="h-8 w-8 shrink-0" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-text-primary">{user.name}</p>
                    <p className="truncate text-xs text-text-muted">{user.role}</p>
                  </div>
                </div>
              ))}
              {unassignedLayout ? (
                <div
                  className="flex items-center border-b border-border px-3 py-2 text-sm font-medium text-text-secondary"
                  style={{ height: unassignedLayout.rowH }}
                >
                  Sem responsável
                </div>
              ) : null}
            </div>

            <div
              ref={scrollRef}
              className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden"
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
                    const prevDay = idx > 0 ? days[idx - 1] : undefined;
                    const showMonth =
                      idx === 0 ||
                      (prevDay !== undefined && d.slice(0, 7) !== prevDay.slice(0, 7));

                    return (
                      <div
                        key={d}
                        style={{ width: DAY_W, minWidth: DAY_W }}
                        className={cn(
                          "flex flex-col items-center justify-center border-r border-border-subtle text-[10px] text-text-muted",
                          isToday && "bg-surface-hover text-text-primary"
                        )}
                      >
                        {showMonth ? (
                          <span className="text-[9px] uppercase text-text-muted">
                            {format(parseYmdToLocalNoon(d), "MMM", { locale: ptBR })}
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
                      <MiniLoadChart loads={totalLoads} height={CHART_H} />
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

                  {userLayouts.map(({ user, positioned, lanes, rowH, rowTasks }) => {
                    const loads = buildDailyLoadsForTasks(rowTasks, days);
                    return (
                      <div key={user.id} className="flex border-b border-border-subtle">
                        <div className="relative" style={{ width: timelineWidth, minWidth: timelineWidth, height: rowH }}>
                          {renderBars(positioned, lanes, loads, user.id)}
                        </div>
                      </div>
                    );
                  })}

                  {unassignedLayout ? (
                    <div className="flex border-b border-border-subtle">
                      <div
                        className="relative"
                        style={{
                          width: timelineWidth,
                          minWidth: timelineWidth,
                          height: unassignedLayout.rowH
                        }}
                      >
                        {renderBars(
                          unassignedLayout.positioned,
                          unassignedLayout.lanes,
                          buildDailyLoadsForTasks(
                            datedTasks.filter((t) => !t.assigneeId),
                            days
                          ),
                          "unassigned"
                        )}
                      </div>
                    </div>
                  ) : null}

                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
    </div>
  );
}
