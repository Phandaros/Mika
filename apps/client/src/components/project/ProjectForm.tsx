import { useState, type FormEvent } from "react";
import { ProjectStatus } from "shared";
import { useCreateProject } from "../../hooks/useProjects";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Select } from "../ui/select";
import { Textarea } from "../ui/textarea";

interface ProjectFormProps {
  onCreated?: () => void;
}

export function ProjectForm({ onCreated }: ProjectFormProps) {
  const createProject = useCreateProject();
  const [name, setName] = useState("");
  const [client, setClient] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<ProjectStatus>(ProjectStatus.ACTIVE);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await createProject.mutateAsync({
      name,
      client: client || null,
      description: description || null,
      status
    });
    setName("");
    setClient("");
    setDescription("");
    setStatus(ProjectStatus.ACTIVE);
    onCreated?.();
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 rounded-md border border-border bg-surface-card p-4">
      <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome do projeto" required />
      <Input value={client} onChange={(event) => setClient(event.target.value)} placeholder="Cliente" />
      <Textarea
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        placeholder="Descricao"
      />
      <Select value={status} onChange={(event) => setStatus(event.target.value as ProjectStatus)}>
        {Object.values(ProjectStatus).map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </Select>
      <Button type="submit" disabled={createProject.isPending}>
        Criar projeto
      </Button>
    </form>
  );
}
