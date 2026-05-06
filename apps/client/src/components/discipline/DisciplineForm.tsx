import { useState, type FormEvent } from "react";
import { DEFAULT_DISCIPLINES, DisciplineStatus, DisciplineType, type User } from "shared";
import { useCreateDiscipline } from "../../hooks/useDisciplines";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Select } from "../ui/select";

interface DisciplineFormProps {
  projectId: string;
  users: User[];
}

export function DisciplineForm({ projectId, users }: DisciplineFormProps) {
  const createDiscipline = useCreateDiscipline(projectId);
  const [type, setType] = useState<DisciplineType>(DisciplineType.HYDRAULIC);
  const [name, setName] = useState(DEFAULT_DISCIPLINES[0]?.name ?? "Hidraulico");
  const [responsibleId, setResponsibleId] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await createDiscipline.mutateAsync({
      name,
      type,
      status: DisciplineStatus.NOT_STARTED,
      responsibleId: responsibleId || null
    });
    setName("");
    setResponsibleId("");
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 rounded-md border border-border bg-surface-card p-4">
      <Select
        value={type}
        onChange={(event) => {
          const selectedType = event.target.value as DisciplineType;
          setType(selectedType);
          setName(DEFAULT_DISCIPLINES.find((discipline) => discipline.type === selectedType)?.name ?? "");
        }}
      >
        {DEFAULT_DISCIPLINES.map((discipline) => (
          <option key={discipline.type} value={discipline.type}>
            {discipline.name}
          </option>
        ))}
      </Select>
      <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome da disciplina" required />
      <Select value={responsibleId} onChange={(event) => setResponsibleId(event.target.value)}>
        <option value="">Sem responsavel</option>
        {users.map((user) => (
          <option key={user.id} value={user.id}>
            {user.name}
          </option>
        ))}
      </Select>
      <Button type="submit" disabled={createDiscipline.isPending}>
        Criar disciplina
      </Button>
    </form>
  );
}
