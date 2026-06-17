import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek
} from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import type { Task } from "shared";
import { TaskContextMenu } from "./TaskContextMenu";
import {
  CALENDAR_BAR_GAP,
  CALENDAR_BAR_H,
  CALENDAR_DAY_HEADER_H,
  chunkDays,
  layoutWeekBars,
  taskDateRange,
  type RangedTask
} from "../../lib/calendarTaskLayout";
import { statusTimelineStyle } from "../../lib/taskTimelineStyle";
import { cn } from "../../lib/utils";
import { workloadTaskDisplayLabel } from "../../lib/workloadTaskLabel";

const WEEKDAY_LABELS = ["SEG", "TER", "QUA", "QUI", "SEX", "SAB", "DOM"];
const WEEK_OPTIONS = { weekStartsOn: 1 as const };
const INITIAL_MONTHS_BUFFER = 3;
const EXTENSION_MONTHS = 2;
const SCROLL_EDGE = 120;

export type TaskWithProject = Task & {
  discipline: {
    id: string;
    name: string;
    projectId: string;
    projectName: string;
  };
};

export type MyTasksCalendarViewHandle = {
  scrollToToday: () => void;
  scrollByMonths: (delta: number) => void;
};

type MyTasksCalendarViewProps = {
  tasks: TaskWithProject[];
  onOpenTask: (task: TaskWithProject) => void;
  onVisibleMonthChange: (month: Date) => void;
};

function eachMonthInRange(rangeStart: Date, rangeEnd: Date): Date[] {
  const months: Date[] = [];
  let current = startOfMonth(rangeStart);
  const last = startOfMonth(rangeEnd);

  while (current <= last) {
    months.push(current);
    current = addMonths(current, 1);
  }

  return months;
}

function monthWeeks(month: Date): Date[][] {
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), WEEK_OPTIONS),
    end: endOfWeek(endOfMonth(month), WEEK_OPTIONS)
  });

  return chunkDays(days);
}

export const MyTasksCalendarView = forwardRef<MyTasksCalendarViewHandle, MyTasksCalendarViewProps>(
  function MyTasksCalendarView({ tasks, onOpenTask, onVisibleMonthChange }, ref) {
    const today = useMemo(() => new Date(), []);
    const [rangeStartMonth, setRangeStartMonth] = useState(() =>
      startOfMonth(addMonths(today, -INITIAL_MONTHS_BUFFER))
    );
    const [rangeEndMonth, setRangeEndMonth] = useState(() =>
      endOfMonth(addMonths(today, INITIAL_MONTHS_BUFFER))
    );

    const scrollRef = useRef<HTMLDivElement | null>(null);
    const monthHeaderRefs = useRef<Map<string, HTMLElement>>(new Map());
    const extendingTop = useRef(false);
    const extendingBottom = useRef(false);
    const prevScrollHeight = useRef(0);
    const initialScrollDone = useRef(false);
    const scrollReady = useRef(false);

    const rangedTasks = useMemo<RangedTask<TaskWithProject>[]>(
      () =>
        tasks.flatMap((task) => {
          const range = taskDateRange(task);
          return range ? [{ task, ...range }] : [];
        }),
      [tasks]
    );

    const months = useMemo(
      () => eachMonthInRange(rangeStartMonth, rangeEndMonth),
      [rangeStartMonth, rangeEndMonth]
    );

    const extendTop = useCallback(() => {
      if (extendingTop.current) {
        return;
      }

      extendingTop.current = true;
      const el = scrollRef.current;
      if (el) {
        prevScrollHeight.current = el.scrollHeight;
      }

      setRangeStartMonth((current) => addMonths(current, -EXTENSION_MONTHS));
    }, []);

    const extendBottom = useCallback(() => {
      if (extendingBottom.current) {
        return;
      }

      extendingBottom.current = true;
      setRangeEndMonth((current) => endOfMonth(addMonths(startOfMonth(current), EXTENSION_MONTHS)));
    }, []);

    useLayoutEffect(() => {
      const el = scrollRef.current;
      if (el && extendingTop.current) {
        const delta = el.scrollHeight - prevScrollHeight.current;
        if (delta > 0) {
          el.scrollTop += delta;
        }
        extendingTop.current = false;
      }
    }, [rangeStartMonth]);

    useLayoutEffect(() => {
      extendingBottom.current = false;
    }, [rangeEndMonth]);

    const maybeExtendRange = useCallback(
      (box: HTMLDivElement) => {
        if (!scrollReady.current) {
          return;
        }

        const atTop = box.scrollTop < SCROLL_EDGE;
        const atBottom = box.scrollTop + box.clientHeight > box.scrollHeight - SCROLL_EDGE;

        if (atTop) {
          extendTop();
        }

        if (atBottom) {
          extendBottom();
        }
      },
      [extendTop, extendBottom]
    );

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

        maybeExtendRange(box);
      }

      el.addEventListener("scroll", onScroll, { passive: true });
      return () => el.removeEventListener("scroll", onScroll);
    }, [maybeExtendRange]);

    useEffect(() => {
      const root = scrollRef.current;
      if (!root) {
        return undefined;
      }

      const observer = new IntersectionObserver(
        (entries) => {
          const visible = entries
            .filter((entry) => entry.isIntersecting)
            .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

          const monthKey = visible?.target.getAttribute("data-month");
          if (monthKey) {
            onVisibleMonthChange(new Date(monthKey));
          }
        },
        { root, threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] }
      );

      for (const element of monthHeaderRefs.current.values()) {
        observer.observe(element);
      }

      return () => observer.disconnect();
    }, [months, onVisibleMonthChange]);

    useLayoutEffect(() => {
      if (initialScrollDone.current) {
        return;
      }

      const el = scrollRef.current;
      const todayWeek = el?.querySelector<HTMLElement>('[data-today-week="true"]');
      if (todayWeek) {
        todayWeek.scrollIntoView({ block: "center" });
        initialScrollDone.current = true;
        scrollReady.current = true;
      }
    }, [months, rangedTasks]);

    useImperativeHandle(
      ref,
      () => ({
        scrollToToday() {
          const el = scrollRef.current;
          const todayWeek = el?.querySelector<HTMLElement>('[data-today-week="true"]');
          if (todayWeek) {
            todayWeek.scrollIntoView({ block: "center", behavior: "smooth" });
          }
        },
        scrollByMonths(delta: number) {
          const el = scrollRef.current;
          if (!el) {
            return;
          }

          const headers = [...el.querySelectorAll<HTMLElement>("[data-month-header]")];
          if (headers.length === 0) {
            return;
          }

          const scrollTop = el.scrollTop + 48;
          let currentIdx = 0;
          for (let index = 0; index < headers.length; index += 1) {
            if (headers[index]!.offsetTop <= scrollTop) {
              currentIdx = index;
            }
          }

          const target = headers[Math.max(0, Math.min(headers.length - 1, currentIdx + delta))];
          if (target) {
            el.scrollTo({ top: Math.max(0, target.offsetTop - 8), behavior: "smooth" });
          }
        }
      }),
      []
    );

    return (
      <div className="overflow-hidden rounded-md border border-border bg-bg-2 text-sm">
        <div className="sticky top-0 z-20 grid grid-cols-7 border-b border-border bg-bg-1">
          {WEEKDAY_LABELS.map((day) => (
            <div
              key={day}
              className="border-r border-border-subtle px-3 py-2 text-[11px] font-medium uppercase tracking-widest text-text-muted last:border-r-0"
            >
              {day}
            </div>
          ))}
        </div>

        <div
          ref={scrollRef}
          className="max-h-[calc(100dvh-280px)] overflow-y-auto overscroll-y-contain"
          data-testid="my-tasks-calendar-scroll"
        >
          {months.map((month) => {
            const monthKey = month.toISOString();
            const weeks = monthWeeks(month);

            return (
              <section key={monthKey} data-month-block={format(month, "yyyy-MM")}>
                <div
                  ref={(element) => {
                    if (element) {
                      monthHeaderRefs.current.set(monthKey, element);
                    } else {
                      monthHeaderRefs.current.delete(monthKey);
                    }
                  }}
                  data-month-header
                  data-month={monthKey}
                  className="sticky top-0 z-10 border-b border-border-subtle bg-bg-1 px-3 py-2 text-[13px] font-semibold capitalize text-text-primary"
                >
                  {format(month, "MMMM yyyy", { locale: ptBR })}
                </div>

                {weeks.map((week) => {
                  const weekStart = week[0]!;
                  const weekEnd = week[week.length - 1]!;
                  const containsToday = week.some((day) => isSameDay(day, today));
                  const { bars, rowHeight } = layoutWeekBars(rangedTasks, weekStart, weekEnd);

                  return (
                    <div
                      key={weekStart.toISOString()}
                      data-today-week={containsToday ? "true" : undefined}
                      className="relative border-b border-border-subtle last:border-b-0"
                      style={{ minHeight: rowHeight }}
                    >
                      <div className="grid grid-cols-7" style={{ height: CALENDAR_DAY_HEADER_H }}>
                        {week.map((day) => (
                          <div
                            key={day.toISOString()}
                            className={cn(
                              "border-r border-border-subtle px-2 py-2 last:border-r-0",
                              isSameDay(day, today) && "bg-bg-3"
                            )}
                          >
                            <span
                              className={cn(
                                "text-[13px] font-semibold",
                                isSameMonth(day, month) ? "text-text-primary" : "text-text-muted"
                              )}
                            >
                              {format(day, "d")}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="pointer-events-none absolute inset-x-0 bottom-0 top-9">
                        {bars.map((bar) => {
                          const { task } = bar.rangedTask;
                          const colSpan = bar.endCol - bar.startCol + 1;
                          const label = workloadTaskDisplayLabel(task, "global");

                          return (
                            <TaskContextMenu
                              key={`${task.id}:${weekStart.toISOString()}:${bar.lane}`}
                              task={task}
                              projectId={task.discipline.projectId}
                              onOpen={onOpenTask}
                              fallbackLinkPath="/my-tasks"
                            >
                              <button
                                type="button"
                                onClick={() => onOpenTask(task)}
                                title={label.fullLabel}
                                className={cn(
                                  "pointer-events-auto absolute flex min-w-0 flex-col items-start justify-center overflow-hidden rounded-md border px-2 text-left shadow-sm outline-none transition-[transform,opacity,box-shadow] duration-150 ease-out-expo hover:-translate-y-px hover:shadow-md focus-visible:ring-2 focus-visible:ring-brand-orange focus-visible:ring-offset-1 focus-visible:ring-offset-bg-1",
                                  bar.startsBeforeWeek ? "rounded-l-none" : "rounded-l-md",
                                  bar.endsAfterWeek ? "rounded-r-none" : "rounded-r-md"
                                )}
                                style={{
                                  left: `calc(${bar.startCol} * (100% / 7) + 2px)`,
                                  width: `calc(${colSpan} * (100% / 7) - 4px)`,
                                  top: bar.lane * (CALENDAR_BAR_H + CALENDAR_BAR_GAP),
                                  height: CALENDAR_BAR_H,
                                  ...statusTimelineStyle(task.status),
                                  opacity: task.completed ? 0.45 : 1
                                }}
                              >
                                <span className="w-full truncate text-[11px] font-semibold leading-none">
                                  {label.taskTitle}
                                </span>
                                {label.projectName ? (
                                  <span className="mt-0.5 w-full truncate text-[9px] font-medium leading-none text-text-secondary/80">
                                    {label.projectName}
                                  </span>
                                ) : null}
                              </button>
                            </TaskContextMenu>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </section>
            );
          })}
        </div>
      </div>
    );
  }
);

MyTasksCalendarView.displayName = "MyTasksCalendarView";
