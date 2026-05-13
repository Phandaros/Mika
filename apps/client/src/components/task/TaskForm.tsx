import { useState, type FormEvent } from "react";
import { Priority, TaskStatus, type User } from "shared";
import { useCreateTask } from "../../hooks/useTasks";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  MK_SELECT_EMPTY_VALUE,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "../ui/select";
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
    const days = estimatedDays.trim() === "" ? null : Number(estimatedDays);
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
        <Select value={priority} onValueChange={(value) => setPriority(value as Priority)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.values(Priority).map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={assigneeId || MK_SELECT_EMPTY_VALUE}
          onValueChange={(value) => setAssigneeId(value === MK_SELECT_EMPTY_VALUE ? "" : value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Sem responsavel" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={MK_SELECT_EMPTY_VALUE}>Sem responsavel</SelectItem>
            {users.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <fieldset className="grid gap-3 rounded-md border border-border p-3">
        <legend className="px-1 text-sm font-semibold text-text-secondary">Data de conclusao</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
        </div>
        <Input
          type="number"
          min={0}
          step={0.25}
          value={estimatedDays}
          onChange={(event) => setEstimatedDays(event.target.value)}
          placeholder="Dias estimados (opcional)"
        />
      </fieldset>
      <Button type="submit" disabled={createTask.isPending}>
        Criar tarefa
      </Button>
    </form>
  );
}
