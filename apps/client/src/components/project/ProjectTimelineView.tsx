import {
  addDays,
  format,
  getDate,
  getDay,
  isWeekend
} from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import {
  CalendarClock,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  FileQuestion,
  Maximize2,
  Minus,
  NotebookPen,
  Plus,
  UsersRound
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties
} from "react";
import type { ProjectTimelineEventDto, Section, Task } from "shared";
import { useCompanyHolidays } from "../../hooks/useCompanyHolidays";
import { useProjectTimelineEvents } from "../../hooks/useProjectDocuments";
import {
  anchoredTimelineScrollLeft,
  centeredTimelineScrollLeft,
  fitTimelineScale,
  nextTimelineScale,
  packTimelineLanes,
  projectTimelineRange,
  taskTimelineGeometry,
  timelineDateIndex,
  timelineHeaderDensity,
  validTimelineDateOnly,
  type TimelineLaneItem,
  type TimelineTaskGeometry
} from "../../lib/projectTimeline";
import { statusTimelineStyle } from "../../lib/taskTimelineStyle";
import { cn, dateOnlyToLocalDate, formatDateOnly } from "../../lib/utils";
import { Button } from "../ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from "../ui/sheet";
import { Skeleton } from "../ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";

const NAME_COLUMN_WIDTH = 232;
const HEADER_HEIGHT = 48;
const EVENT_ROW_HEIGHT = 58;
const LANE_HEIGHT = 28;
const LANE_GAP = 5;
const ROW_PADDING = 8;
const COLLAPSED_ROW_HEIGHT = 42;
const EVENT_MARKER_SIZE = 24;
const TODAY_ZOOM = 44;
const MIN_TASK_LABEL_WIDTH = 132;
const MAX_TASK_LABEL_WIDTH = 260;
const TASK_LABEL_GAP = 6;

type ProjectTimelineViewProps = {
  projectId: string;
  sections: Section[];
  tasks: Task[];
  search: string;
  onOpenTask: (task: Task) => void;
  onOpenEvent: (event: ProjectTimelineEventDto) => void;
};

type SectionRow = {
  section: Section;
  items: TimelineLaneItem<TimelineTaskGeometry>[];
  laneCount: number;
  height: number;
  collapsed: boolean;
};

type EventGroup = {
  id: string;
  x: number;
  events: ProjectTimelineEventDto[];
};

export function ProjectTimelineView({
  projectId,
  sections,
  tasks,
  search,
  onOpenTask,
  onOpenEvent
}: ProjectTimelineViewProps) {
  const eventsQuery = useProjectTimelineEvents(projectId);
  const uniqueTasks = useMemo(() => [...new Map(tasks.map((task) => [task.id, task])).values()], [tasks]);
  const tasksById = useMemo(() => new Map(uniqueTasks.map((task) => [task.id, task])), [uniqueTasks]);
  const today = format(new Date(), "yyyy-MM-dd");
  const normalizedSearch = normalizeSearch(search);
  const events = useMemo(
    () => (eventsQuery.data ?? []).filter((event) => !normalizedSearch || normalizeSearch(event.title).includes(normalizedSearch)),
    [eventsQuery.data, normalizedSearch]
  );
  const geometries = useMemo(
    () => uniqueTasks.map((task) => taskTimelineGeometry(task, today)).filter((item): item is TimelineTaskGeometry => Boolean(item)),
    [today, uniqueTasks]
  );
  const undatedTasks = useMemo(() => uniqueTasks.filter((task) => !validTimelineDateOnly(task.startDate)), [uniqueTasks]);
  const range = useMemo(() => projectTimelineRange(geometries, events, today), [events, geometries, today]);
  const holidaysQuery = useCompanyHolidays(range.from, range.to);
  const holidayMap = useMemo(
    () => new Map((holidaysQuery.data ?? []).map((holiday) => [holiday.date, holiday.name])),
    [holidaysQuery.data]
  );

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const lastFittedViewportRef = useRef<{ width: number; from: string; to: string } | null>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [pixelsPerDay, setPixelsPerDay] = useState(1);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(() => new Set());
  const timelineViewportWidth = Math.max(1, viewportWidth - NAME_COLUMN_WIDTH);
  const fitScale = fitTimelineScale(timelineViewportWidth, range.dayCount);
  const timelineWidth = Math.max(timelineViewportWidth, range.dayCount * pixelsPerDay);
  const contentWidth = NAME_COLUMN_WIDTH + timelineWidth;

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) {
      return;
    }

    const updateWidth = () => setViewportWidth(element.clientWidth);
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (viewportWidth <= 0) {
      return;
    }

    const previous = lastFittedViewportRef.current;
    const rangeChanged = previous?.from !== range.from || previous?.to !== range.to;
    const viewportResized = !previous || Math.abs(previous.width - viewportWidth) > 24;
    if (!rangeChanged && !viewportResized) {
      return;
    }

    lastFittedViewportRef.current = { width: viewportWidth, from: range.from, to: range.to };
    setPixelsPerDay(fitScale);
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = 0;
      setScrollLeft(0);
    }
  }, [fitScale, range.from, range.to, viewportWidth]);

  useEffect(() => {
    const availableIds = new Set(sections.map((section) => section.id));
    setCollapsedSections((current) => new Set([...current].filter((id) => availableIds.has(id))));
  }, [sections]);

  const rows = useMemo<SectionRow[]>(() => sections.map((section) => {
    const collapsed = collapsedSections.has(section.id);
    const sectionGeometries = geometries.filter((geometry) => geometry.task.disciplineId === section.id);
    const items = packTimelineLanes(sectionGeometries, (geometry) => ({
      startIndex: timelineDateIndex(geometry.startDate, range.from),
      endIndex: timelineTaskVisualEndIndex(geometry, range.from, pixelsPerDay)
    }));
    const laneCount = items.length ? Math.max(...items.map((item) => item.lane)) + 1 : 0;
    return {
      section,
      items,
      laneCount,
      collapsed,
      height: collapsed ? COLLAPSED_ROW_HEIGHT : Math.max(COLLAPSED_ROW_HEIGHT, laneCount * (LANE_HEIGHT + LANE_GAP) + ROW_PADDING * 2)
    };
  }), [collapsedSections, geometries, pixelsPerDay, range.from, sections]);

  const bodyHeight = EVENT_ROW_HEIGHT + rows.reduce((sum, row) => sum + row.height, 0);
  const density = timelineHeaderDensity(pixelsPerDay);
  const visibleStartIndex = Math.max(0, Math.floor(scrollLeft / pixelsPerDay) - 5);
  const visibleEndIndex = Math.min(
    range.dayCount - 1,
    Math.ceil((scrollLeft + timelineViewportWidth) / pixelsPerDay) + 5
  );
  const visibleTicks = useMemo(
    () => timelineTicks(range.from, visibleStartIndex, visibleEndIndex, density, pixelsPerDay),
    [density, pixelsPerDay, range.from, visibleEndIndex, visibleStartIndex]
  );
  const nonWorkingBands = useMemo(() => {
    if (pixelsPerDay < 6) {
      return [];
    }
    const bands: Array<{ index: number; date: string; label: string | null }> = [];
    for (let index = visibleStartIndex; index <= visibleEndIndex; index += 1) {
      const date = dateAtIndex(range.from, index);
      const localDate = dateOnlyToLocalDate(date);
      const holiday = holidayMap.get(date) ?? null;
      if (holiday || (localDate && isWeekend(localDate))) {
        bands.push({ index, date, label: holiday });
      }
    }
    return bands;
  }, [holidayMap, pixelsPerDay, range.from, visibleEndIndex, visibleStartIndex]);
  const eventGroups = useMemo(
    () => groupTimelineEvents(events, range.from, pixelsPerDay),
    [events, pixelsPerDay, range.from]
  );
  const todayIndex = timelineDateIndex(today, range.from);

  function setZoom(nextScale: number, anchorX = timelineViewportWidth / 2) {
    const element = scrollRef.current;
    if (!element || nextScale === pixelsPerDay) {
      return;
    }
    const nextLeft = anchoredTimelineScrollLeft(element.scrollLeft, anchorX, pixelsPerDay, nextScale);
    setPixelsPerDay(nextScale);
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollLeft = nextLeft;
        setScrollLeft(nextLeft);
      }
    });
  }

  function zoom(direction: "in" | "out") {
    setZoom(nextTimelineScale(pixelsPerDay, direction, fitScale));
  }

  function fitTimeline() {
    lastFittedViewportRef.current = { width: viewportWidth, from: range.from, to: range.to };
    setPixelsPerDay(fitScale);
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollLeft = 0;
        setScrollLeft(0);
      }
    });
  }

  function focusToday() {
    const nextScale = Math.max(fitScale, TODAY_ZOOM);
    const nextLeft = centeredTimelineScrollLeft(todayIndex, timelineViewportWidth, nextScale);
    setPixelsPerDay(nextScale);
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollLeft = nextLeft;
        setScrollLeft(scrollRef.current.scrollLeft);
      }
    });
  }

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) {
      return;
    }

    const handleTimelineWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      const rect = element.getBoundingClientRect();
      const anchorX = Math.max(0, event.clientX - rect.left - NAME_COLUMN_WIDTH);
      const direction = event.deltaY < 0 ? "in" : "out";
      const nextScale = nextTimelineScale(pixelsPerDay, direction, fitScale);
      const nextLeft = anchoredTimelineScrollLeft(element.scrollLeft, anchorX, pixelsPerDay, nextScale);
      setPixelsPerDay(nextScale);
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollLeft = nextLeft;
          setScrollLeft(scrollRef.current.scrollLeft);
        }
      });
    };

    element.addEventListener("wheel", handleTimelineWheel, { capture: true, passive: false });
    return () => element.removeEventListener("wheel", handleTimelineWheel, { capture: true });
  }, [fitScale, pixelsPerDay]);

  function toggleSection(sectionId: string) {
    setCollapsedSections((current) => {
      const next = new Set(current);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }

  return (
    <TooltipProvider delayDuration={250}>
      <section className="flex min-w-0 flex-col gap-3" aria-label="Linha do tempo do projeto">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-bg-1 px-3 py-2">
          <div className="flex min-w-0 flex-wrap items-center gap-3 text-xs text-text-secondary">
            <span className="inline-flex items-center gap-2">
              <span className="size-2 rounded-full bg-brand-orange" />
              Hoje
            </span>
            <span className="inline-flex items-center gap-2">
              <NotebookPen aria-hidden="true" />
              Anotação
            </span>
            <span className="inline-flex items-center gap-2">
              <UsersRound aria-hidden="true" />
              Ata
            </span>
            {eventsQuery.isError ? <span className="text-[--status-late-text]">Eventos indisponíveis</span> : null}
          </div>

          <div className="flex items-center gap-2">
            {undatedTasks.length ? (
              <UndatedTasksSheet tasks={undatedTasks} onOpenTask={onOpenTask} />
            ) : null}
            <Button variant="secondary" className="h-8 px-3 text-xs" onClick={focusToday}>
              <CalendarDays data-icon="inline-start" aria-hidden="true" />
              Hoje
            </Button>
            <div className="flex items-center rounded-md border border-border bg-bg-2 p-0.5">
              <Button
                variant="ghost"
                className="size-7 px-0"
                aria-label="Diminuir zoom"
                title="Diminuir zoom"
                disabled={pixelsPerDay <= fitScale + 0.001}
                onClick={() => zoom("out")}
              >
                <Minus aria-hidden="true" />
              </Button>
              <Button variant="ghost" className="h-7 px-2 text-[11px]" onClick={fitTimeline}>
                <Maximize2 data-icon="inline-start" aria-hidden="true" />
                Ajustar
              </Button>
              <Button
                variant="ghost"
                className="size-7 px-0"
                aria-label="Aumentar zoom"
                title="Aumentar zoom"
                disabled={pixelsPerDay >= 47.999}
                onClick={() => zoom("in")}
              >
                <Plus aria-hidden="true" />
              </Button>
            </div>
          </div>
        </div>

        <div className="min-w-0 overflow-hidden rounded-md border border-border bg-bg-1">
          <div
            ref={scrollRef}
            data-testid="project-timeline-scroll"
            className="max-h-[calc(100dvh-258px)] min-h-[380px] min-w-0 overflow-auto overscroll-contain"
            onScroll={(event) => setScrollLeft(event.currentTarget.scrollLeft)}
          >
            <div className="relative" style={{ width: contentWidth, minWidth: contentWidth }}>
              <TimelineHeader
                width={contentWidth}
                timelineWidth={timelineWidth}
                ticks={visibleTicks}
                pixelsPerDay={pixelsPerDay}
                rangeFrom={range.from}
                density={density}
              />

              <div className="relative" style={{ height: bodyHeight }}>
                {nonWorkingBands.map((band) => (
                  <div
                    key={band.date}
                    className={cn(
                      "pointer-events-none absolute top-0 h-full bg-calendar-weekend",
                      band.label && "bg-calendar-holiday"
                    )}
                    title={band.label ?? undefined}
                    style={{ left: NAME_COLUMN_WIDTH + band.index * pixelsPerDay, width: pixelsPerDay }}
                  />
                ))}
                {todayIndex >= 0 && todayIndex < range.dayCount ? (
                  <div
                    className="pointer-events-none absolute top-0 h-full w-px bg-brand-orange/80"
                    style={{ left: NAME_COLUMN_WIDTH + todayIndex * pixelsPerDay + pixelsPerDay / 2 }}
                  />
                ) : null}

                <TimelineEventsRow
                  groups={eventGroups}
                  loading={eventsQuery.isLoading}
                  pixelsPerDay={pixelsPerDay}
                  timelineWidth={timelineWidth}
                  onOpenEvent={onOpenEvent}
                />

                <div style={{ marginTop: EVENT_ROW_HEIGHT }}>
                  {rows.map((row) => (
                    <TimelineSectionRow
                      key={row.section.id}
                      row={row}
                      pixelsPerDay={pixelsPerDay}
                      rangeFrom={range.from}
                      timelineWidth={timelineWidth}
                      tasksById={tasksById}
                      onOpenTask={onOpenTask}
                      onToggle={() => toggleSection(row.section.id)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
        <p className="text-[11px] text-text-muted">Use Ctrl + roda do mouse sobre a grade para aproximar ou afastar.</p>
      </section>
    </TooltipProvider>
  );
}

function TimelineHeader({
  width,
  timelineWidth,
  ticks,
  pixelsPerDay,
  rangeFrom,
  density
}: {
  width: number;
  timelineWidth: number;
  ticks: number[];
  pixelsPerDay: number;
  rangeFrom: string;
  density: "day" | "week" | "month";
}) {
  return (
    <div className="sticky top-0 z-30 flex border-b border-border bg-bg-2" style={{ width, height: HEADER_HEIGHT }}>
      <div
        className="sticky left-0 z-40 flex shrink-0 items-center border-r border-border bg-bg-2 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted"
        style={{ width: NAME_COLUMN_WIDTH }}
      >
        Seções
      </div>
      <div className="relative shrink-0" style={{ width: timelineWidth }}>
        {ticks.map((index) => {
          const date = dateAtIndex(rangeFrom, index);
          return (
            <div
              key={`${density}-${date}`}
              className={cn(
                "absolute inset-y-0 border-l border-border-subtle text-[10px] text-text-muted",
                density === "day" ? "flex flex-col items-center justify-center" : "px-1.5 pt-2"
              )}
              style={{
                left: index * pixelsPerDay,
                width: density === "day" ? pixelsPerDay : undefined
              }}
              title={format(requiredDate(date), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            >
              <span className="whitespace-nowrap font-semibold text-text-secondary">
                {formatTimelineTick(date, density)}
              </span>
              {density === "day" ? (
                <span className="mt-0.5 block max-w-full truncate whitespace-nowrap text-[9px] uppercase">
                  {format(requiredDate(date), "EEE", { locale: ptBR })}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TimelineEventsRow({
  groups,
  loading,
  pixelsPerDay,
  timelineWidth,
  onOpenEvent
}: {
  groups: EventGroup[];
  loading: boolean;
  pixelsPerDay: number;
  timelineWidth: number;
  onOpenEvent: (event: ProjectTimelineEventDto) => void;
}) {
  return (
    <div className="absolute left-0 top-0 flex border-b border-border-subtle" style={{ height: EVENT_ROW_HEIGHT }}>
      <div
        className="sticky left-0 z-20 flex shrink-0 items-center gap-2 border-r border-border bg-bg-2 px-3"
        style={{ width: NAME_COLUMN_WIDTH, height: EVENT_ROW_HEIGHT }}
      >
        <CalendarClock className="text-brand-orange" aria-hidden="true" />
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-text-primary">Eventos</p>
          <p className="truncate text-[10px] text-text-muted">Anotações e atas</p>
        </div>
      </div>
      <div className="relative shrink-0" style={{ width: timelineWidth, height: EVENT_ROW_HEIGHT }}>
        {loading ? <Skeleton className="absolute left-3 top-4 h-6 w-32" /> : null}
        {groups.map((group) => (
          <TimelineEventMarker
            key={group.id}
            group={group}
            compact={pixelsPerDay < 6}
            onOpenEvent={onOpenEvent}
          />
        ))}
      </div>
    </div>
  );
}

function TimelineEventMarker({
  group,
  compact,
  onOpenEvent
}: {
  group: EventGroup;
  compact: boolean;
  onOpenEvent: (event: ProjectTimelineEventDto) => void;
}) {
  if (group.events.length === 1) {
    const event = group.events[0];
    if (!event) {
      return null;
    }
    const Icon = event.type === "NOTE" ? NotebookPen : UsersRound;
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              "absolute top-4 flex size-6 -translate-x-1/2 items-center justify-center rounded-md border shadow-lg transition hover:-translate-y-0.5",
              event.type === "NOTE"
                ? "border-brand-orange/60 bg-brand-orange/15 text-brand-orange"
                : "border-[--status-analysis-text]/60 bg-[--status-analysis-bg] text-[--status-analysis-text]"
            )}
            style={{ left: group.x }}
            aria-label={`${event.title}, ${formatDateOnly(event.eventDate, "dd/MM/yyyy")}`}
            onClick={() => onOpenEvent(event)}
          >
            <Icon aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-72">
          <p className="font-semibold">{event.title}</p>
          <p className="mt-1 text-text-secondary">
            {event.type === "NOTE" ? "Anotação" : "Ata"} · {formatDateOnly(event.eventDate, "dd/MM/yyyy")}
          </p>
          {!compact ? <p className="mt-1 text-text-muted">por {event.author.name}</p> : null}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="absolute top-4 flex h-6 min-w-6 -translate-x-1/2 items-center justify-center rounded-md border border-brand-orange/60 bg-brand-orange/15 px-1.5 text-[10px] font-bold text-brand-orange shadow-lg transition hover:-translate-y-0.5"
          style={{ left: group.x }}
          aria-label={`${group.events.length} eventos próximos`}
        >
          {group.events.length}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(360px,calc(100vw-32px))] overflow-x-hidden p-2">
        <div className="flex max-h-72 flex-col gap-1 overflow-y-auto overflow-x-hidden">
          {group.events.map((event) => {
            const Icon = event.type === "NOTE" ? NotebookPen : UsersRound;
            return (
              <button
                key={`${event.type}-${event.id}`}
                type="button"
                className="flex min-w-0 items-start gap-2 rounded-md px-2 py-2 text-left transition hover:bg-surface-hover"
                onClick={() => onOpenEvent(event)}
              >
                <Icon className="mt-0.5 shrink-0 text-text-secondary" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold text-text-primary">{event.title}</span>
                  <span className="mt-0.5 block truncate text-[10px] text-text-muted">
                    {formatDateOnly(event.eventDate, "dd/MM/yyyy")} · {event.author.name}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function TimelineSectionRow({
  row,
  pixelsPerDay,
  rangeFrom,
  timelineWidth,
  tasksById,
  onOpenTask,
  onToggle
}: {
  row: SectionRow;
  pixelsPerDay: number;
  rangeFrom: string;
  timelineWidth: number;
  tasksById: Map<string, Task>;
  onOpenTask: (task: Task) => void;
  onToggle: () => void;
}) {
  return (
    <div className="flex border-b border-border-subtle" style={{ height: row.height }}>
      <button
        type="button"
        className="sticky left-0 z-20 flex shrink-0 items-center gap-2 border-r border-border bg-bg-1 px-3 text-left transition hover:bg-bg-3"
        style={{ width: NAME_COLUMN_WIDTH, height: row.height }}
        aria-expanded={!row.collapsed}
        onClick={onToggle}
      >
        {row.collapsed ? <ChevronRight aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold text-text-primary">{row.section.name}</span>
          <span className="mt-0.5 block text-[10px] text-text-muted">
            {row.items.length} {row.items.length === 1 ? "tarefa" : "tarefas"}
          </span>
        </span>
      </button>
      <div className="relative h-full shrink-0" style={{ width: timelineWidth }}>
        {!row.collapsed && row.items.length === 0 ? (
          <p className="absolute left-3 top-3 text-[11px] text-text-muted">Nenhuma tarefa com início neste filtro.</p>
        ) : null}
        {!row.collapsed ? row.items.map((positioned) => {
          const task = tasksById.get(positioned.item.task.id);
          if (!task) {
            return null;
          }
          return (
            <TimelineTaskBar
              key={task.id}
              geometry={positioned.item}
              lane={positioned.lane}
              startIndex={positioned.startIndex}
              endIndex={timelineDateIndex(positioned.item.endDate, rangeFrom)}
              pixelsPerDay={pixelsPerDay}
              onOpen={() => onOpenTask(task)}
            />
          );
        }) : null}
      </div>
    </div>
  );
}

function TimelineTaskBar({
  geometry,
  lane,
  startIndex,
  endIndex,
  pixelsPerDay,
  onOpen
}: {
  geometry: TimelineTaskGeometry;
  lane: number;
  startIndex: number;
  endIndex: number;
  pixelsPerDay: number;
  onOpen: () => void;
}) {
  const marker = geometry.kind !== "bar";
  const left = startIndex * pixelsPerDay;
  const naturalWidth = (endIndex - startIndex + 1) * pixelsPerDay;
  const width = Math.max(marker ? 18 : 6, naturalWidth - 4);
  const top = ROW_PADDING + lane * (LANE_HEIGHT + LANE_GAP);
  const desiredLabelWidth = timelineTaskLabelWidth(geometry.task.title);
  const labelFitsInside = !marker && desiredLabelWidth <= width;
  const labelLeft = labelFitsInside ? 0 : width + TASK_LABEL_GAP;
  const labelWidth = labelFitsInside ? width : desiredLabelWidth;
  const semanticStyle = statusTimelineStyle(geometry.task.status);
  const dateLabel = geometry.startDate === geometry.endDate
    ? formatDateOnly(geometry.startDate, "dd/MM/yyyy")
    : `${formatDateOnly(geometry.startDate, "dd/MM/yyyy")} – ${formatDateOnly(geometry.endDate, "dd/MM/yyyy")}`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          data-testid={`timeline-task-${geometry.task.id}`}
          className={cn(
            "group absolute min-w-0 overflow-visible text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange",
            marker ? "size-[18px]" : "rounded-md border shadow-sm hover:brightness-125"
          )}
          style={{
            ...(marker ? {} : semanticStyle),
            left: left + (marker ? pixelsPerDay / 2 - 9 : 2),
            top,
            width: marker ? undefined : width,
            height: marker ? undefined : LANE_HEIGHT,
            color: marker ? "var(--color-text-primary)" : semanticStyle.color
          } as CSSProperties}
          aria-label={`${geometry.task.title}, ${dateLabel}${geometry.warning ? `, ${geometry.warning}` : ""}`}
          onClick={onOpen}
        >
          {marker ? (
            <span
              aria-hidden="true"
              className="absolute inset-0 rotate-45 rounded-[4px] border shadow-sm transition group-hover:brightness-125"
              style={semanticStyle}
            />
          ) : null}
          <span
            className={cn(
              "pointer-events-none absolute inset-y-0 flex min-w-0 items-center overflow-hidden rounded-md text-[11px] font-semibold",
              labelFitsInside ? "px-2" : "px-0",
              marker && "text-text-primary"
            )}
            style={{ left: labelLeft, width: labelWidth }}
          >
            <span className="w-full truncate">{geometry.task.title}</span>
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-80">
        <p className="font-semibold">{geometry.task.title}</p>
        <p className="mt-1 text-text-secondary">{dateLabel}</p>
        {geometry.kind === "future-marker" ? <p className="mt-1 text-text-muted">Início futuro</p> : null}
        {geometry.warning ? <p className="mt-1 text-[--status-late-text]">{geometry.warning}</p> : null}
      </TooltipContent>
    </Tooltip>
  );
}

function timelineTaskLabelWidth(title: string): number {
  return Math.min(MAX_TASK_LABEL_WIDTH, Math.max(MIN_TASK_LABEL_WIDTH, Math.ceil(title.length * 6.4) + 28));
}

function timelineTaskVisualEndIndex(
  geometry: TimelineTaskGeometry,
  rangeFrom: string,
  pixelsPerDay: number
): number {
  const startIndex = timelineDateIndex(geometry.startDate, rangeFrom);
  const endIndex = timelineDateIndex(geometry.endDate, rangeFrom);
  const marker = geometry.kind !== "bar";
  const naturalWidth = Math.max(marker ? 18 : 6, (endIndex - startIndex + 1) * pixelsPerDay - 4);
  const labelWidth = timelineTaskLabelWidth(geometry.task.title);
  if (!marker && labelWidth <= naturalWidth) {
    return endIndex;
  }

  const visualWidth = naturalWidth + TASK_LABEL_GAP + labelWidth;
  return Math.max(endIndex, startIndex + Math.ceil(visualWidth / pixelsPerDay) - 1);
}

function UndatedTasksSheet({ tasks, onOpenTask }: { tasks: Task[]; onOpenTask: (task: Task) => void }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="secondary" className="h-8 px-3 text-xs">
          <FileQuestion data-icon="inline-start" aria-hidden="true" />
          Sem data ({tasks.length})
        </Button>
      </SheetTrigger>
      <SheetContent className="flex w-[min(440px,92vw)] max-w-none flex-col gap-0 border-border p-0">
        <SheetHeader className="border-b border-border px-5 py-4">
          <SheetTitle>Tarefas sem data de início</SheetTitle>
          <SheetDescription>Estas tarefas não receberam uma data inventada na linha do tempo.</SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden p-3">
          {tasks.map((task) => (
            <button
              key={task.id}
              type="button"
              className="flex min-w-0 flex-col gap-1 rounded-md border border-border-subtle px-3 py-2 text-left transition hover:bg-surface-hover"
              onClick={() => onOpenTask(task)}
            >
              <span className="truncate text-xs font-semibold text-text-primary">{task.title}</span>
              <span className="truncate text-[10px] text-text-muted">
                {task.discipline?.name ?? "Sem seção"}
                {task.startDate && !validTimelineDateOnly(task.startDate) ? " · início inválido" : ""}
                {validTimelineDateOnly(task.completedAt) ? ` · concluída em ${formatDateOnly(task.completedAt, "dd/MM/yyyy")}` : ""}
                {task.completedAt && !validTimelineDateOnly(task.completedAt) ? " · conclusão inválida" : ""}
              </span>
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function timelineTicks(
  rangeFrom: string,
  startIndex: number,
  endIndex: number,
  density: "day" | "week" | "month",
  pixelsPerDay: number
): number[] {
  const ticks: number[] = [];
  const monthStep = Math.max(1, Math.ceil(72 / (30.44 * pixelsPerDay)));
  for (let index = startIndex; index <= endIndex; index += 1) {
    const date = requiredDate(dateAtIndex(rangeFrom, index));
    const absoluteMonth = date.getFullYear() * 12 + date.getMonth();
    const show = density === "day" ||
      (density === "week" && getDay(date) === 1) ||
      (density === "month" && getDate(date) === 1 && absoluteMonth % monthStep === 0) ||
      index === 0;
    if (show) {
      ticks.push(index);
    }
  }
  return ticks;
}

function formatTimelineTick(date: string, density: "day" | "week" | "month"): string {
  const localDate = requiredDate(date);
  if (density === "day") {
    return format(localDate, "dd", { locale: ptBR });
  }
  if (density === "week") {
    return format(localDate, "dd MMM", { locale: ptBR });
  }
  return format(localDate, "MMM yy", { locale: ptBR });
}

function groupTimelineEvents(
  events: ProjectTimelineEventDto[],
  rangeFrom: string,
  pixelsPerDay: number
): EventGroup[] {
  const threshold = Math.max(EVENT_MARKER_SIZE + 4, pixelsPerDay * 0.7);
  const sorted = events
    .map((event) => ({ event, x: timelineDateIndex(event.eventDate, rangeFrom) * pixelsPerDay + pixelsPerDay / 2 }))
    .sort((left, right) => left.x - right.x || left.event.id.localeCompare(right.event.id));
  const groups: EventGroup[] = [];

  for (const entry of sorted) {
    const current = groups[groups.length - 1];
    if (current && entry.x - current.x < threshold) {
      current.events.push(entry.event);
      current.x = current.events.reduce(
        (sum, event) => sum + timelineDateIndex(event.eventDate, rangeFrom) * pixelsPerDay + pixelsPerDay / 2,
        0
      ) / current.events.length;
      current.id = current.events.map((event) => `${event.type}-${event.id}`).join("|");
    } else {
      groups.push({ id: `${entry.event.type}-${entry.event.id}`, x: entry.x, events: [entry.event] });
    }
  }

  return groups;
}

function dateAtIndex(rangeFrom: string, index: number): string {
  return format(addDays(requiredDate(rangeFrom), index), "yyyy-MM-dd");
}

function requiredDate(value: string): Date {
  const date = dateOnlyToLocalDate(value);
  if (!date) {
    throw new Error(`Data inválida na linha do tempo: ${value}`);
  }
  return date;
}

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}
