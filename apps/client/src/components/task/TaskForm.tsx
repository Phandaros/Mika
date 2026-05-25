import { useState, type FormEvent } from "react";
import { Priority, TaskStatus, type User } from "shared";
import { useCreateTask } from "../../hooks/useTasks";
import { PriorityOptionPill, priorityColors } from "../shared/statusVisuals";
import { Button } from "../ui/button";
import { DateRangePicker } from "../ui/date-picker";
import { DecimalInput, parseDecimalInput } from "../ui/decimal-input";
import { Input } from "../ui/input";
import { SearchableSelect } from "../ui/searchable-select";
import { Textarea } from "../ui/textarea";

interface TaskFormProps {
  projectId: string;
  disciplineId: string;
  users: User[];
}

export function TaskForm({ projectId, disciplineId, users }: TaskFormProps) {
  const createTask = useCreateTask(projectId, disciplineId);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>(Priority.MEDIUM);
  const [assigneeId, setAssigneeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [estimatedDays, setEstimatedDays] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const days = parseDecimalInput(estimatedDays);
    await createTask.mutateAsync({
      title,
      description: description || null,
      status: TaskStatus.BACKLOG,
      priority,
      assigneeId: assigneeId || null,
      startDate: startDate || null,
      dueDate: dueDate || null,
      estimatedDays: days === null || Number.isNaN(days) ? null : days
    });
    setTitle("");
    setDescription("");
    setAssigneeId("");
    setStartDate("");
    setDueDate("");
    setEstimatedDays("");
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 rounded-md border border-border bg-surface-card p-4">
      <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Titulo da tarefa" required />
      <Textarea
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        placeholder="Descrição"
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <SearchableSelect
          value={priority}
          options={Object.values(Priority).map((option) => ({
            value: option,
            label: option,
            color: priorityColors[option],
            render: <PriorityOptionPill priority={option} />
          }))}
          onValueChange={(value) => setPriority(value as Priority)}
        />
        <SearchableSelect
          value={assigneeId || "none"}
          options={[
            { value: "none", label: "Sem responsável" },
            ...users.map((user) => ({ value: user.id, label: user.name, description: user.email, avatarUrl: user.avatarUrl }))
          ]}
          searchPlaceholder="Buscar responsável..."
          onValueChange={(value) => setAssigneeId(value === "none" ? "" : value)}
        />
      </div>
      <fieldset className="grid gap-3 rounded-md border border-border p-3">
        <legend className="px-1 text-sm font-semibold text-text-secondary">Data de conclusão</legend>
        <DateRangePicker
          startDate={startDate}
          endDate={dueDate}
          onStartDateChange={(value) => setStartDate(value ?? "")}
          onEndDateChange={(value) => setDueDate(value ?? "")}
        />
        <DecimalInput
          value={estimatedDays}
          onValueChange={setEstimatedDays}
          placeholder="Dias estimados (opcional)"
        />
      </fieldset>
      <Button type="submit" disabled={createTask.isPending}>
        Criar tarefa
      </Button>
    </form>
  );
}
