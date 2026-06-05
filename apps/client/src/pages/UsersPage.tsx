import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Pencil, Plus, X } from "lucide-react";
import { Role, type CreateUserRequest, type UpdateUserRequest, type User } from "shared";
import { Avatar } from "../components/shared/Avatar";
import { LoadingSpinner } from "../components/shared/LoadingSpinner";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { SearchableSelect } from "../components/ui/searchable-select";
import { useCreateUser, useDeactivateUser, useUpdateUser, useUsers } from "../hooks/useUsers";

const ROLE_OPTIONS = [Role.ADMIN, Role.COORDINATOR, Role.DESIGNER, Role.INTERN].map((role) => ({
  value: role,
  label: roleLabel(role)
}));

export function UsersPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: users = [], isLoading } = useUsers();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deactivateUser = useDeactivateUser();

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setShowCreateModal(true);
    }
  }, [searchParams]);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  async function handleCreate(payload: CreateUserRequest) {
    await createUser.mutateAsync(payload);
    closeCreateModal(searchParams, setSearchParams, setShowCreateModal);
    toast.success("Usuário criado");
  }

  async function handleUpdate(userId: string, payload: UpdateUserRequest) {
    await updateUser.mutateAsync({ userId, payload });
    setEditingUser(null);
    toast.success("Usuário atualizado");
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-col justify-between gap-4 border-b border-border pb-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-semibold uppercase text-brand-orange">Administração</p>
          <h1 className="mt-1 text-3xl font-bold text-text-primary">Usuários</h1>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus size={16} />
          Criar usuário
        </Button>
      </div>

      {showCreateModal ? (
        <UserModal title="Criar usuário" onClose={() => closeCreateModal(searchParams, setSearchParams, setShowCreateModal)}>
          <CreateUserForm onSubmit={handleCreate} loading={createUser.isPending} />
        </UserModal>
      ) : null}

      {editingUser ? (
        <UserModal title="Editar usuário" onClose={() => setEditingUser(null)}>
          <EditUserForm user={editingUser} onSubmit={handleUpdate} loading={updateUser.isPending} />
        </UserModal>
      ) : null}

      <div className="overflow-hidden rounded-md border border-border">
        <table className="w-full min-w-[820px] border-collapse bg-surface-card text-sm">
          <thead className="bg-surface">
            <tr className="text-left text-text-secondary">
              <th className="p-3">Usuário</th>
              <th className="p-3">Email</th>
              <th className="p-3">Cargo</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t border-border">
                <td className="p-3">
                  <Link to={`/users/${user.id}`} className="flex items-center gap-3 font-semibold text-text-primary">
                    <Avatar name={user.name} imageUrl={user.avatarUrl} />
                    {user.name}
                  </Link>
                </td>
                <td className="p-3 text-text-secondary">{user.email}</td>
                <td className="p-3 text-text-secondary">{roleLabel(user.role)}</td>
                <td className="p-3 text-text-secondary">{user.isActive ? "Ativo" : "Inativo"}</td>
                <td className="p-3">
                  <div className="flex justify-end gap-2">
                    <Button variant="secondary" className="h-9" onClick={() => setEditingUser(user)}>
                      <Pencil size={15} />
                      Editar
                    </Button>
                    <Button
                      variant="danger"
                      className="h-9"
                      disabled={!user.isActive || deactivateUser.isPending}
                      onClick={() => void deactivateUser.mutateAsync(user.id)}
                    >
                      Desativar
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CreateUserForm({ onSubmit, loading }: { onSubmit: (payload: CreateUserRequest) => Promise<void>; loading: boolean }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>(Role.DESIGNER);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit({ name, email, password, role });
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <FieldLabel label="Nome">
        <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome" required />
      </FieldLabel>
      <FieldLabel label="Email">
        <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" required />
      </FieldLabel>
      <FieldLabel label="Senha inicial">
        <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Senha inicial" required />
      </FieldLabel>
      <FieldLabel label="Cargo">
        <SearchableSelect value={role} options={ROLE_OPTIONS} searchPlaceholder="Buscar cargo..." onValueChange={(value) => setRole(value as Role)} />
      </FieldLabel>
      <Button type="submit" disabled={loading}>
        Criar usuário
      </Button>
    </form>
  );
}

function EditUserForm({
  user,
  onSubmit,
  loading
}: {
  user: User;
  onSubmit: (userId: string, payload: UpdateUserRequest) => Promise<void>;
  loading: boolean;
}) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>(user.role);
  const [isActive, setIsActive] = useState(user.isActive);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload: UpdateUserRequest = {
      name,
      email,
      role,
      isActive
    };

    if (password.trim()) {
      payload.password = password;
    }

    await onSubmit(user.id, payload);
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <FieldLabel label="Nome">
        <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome" required />
      </FieldLabel>
      <FieldLabel label="Email">
        <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" required />
      </FieldLabel>
      <FieldLabel label="Nova senha">
        <Input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Deixe em branco para manter"
          minLength={6}
        />
      </FieldLabel>
      <FieldLabel label="Cargo">
        <SearchableSelect value={role} options={ROLE_OPTIONS} searchPlaceholder="Buscar cargo..." onValueChange={(value) => setRole(value as Role)} />
      </FieldLabel>
      <label className="flex items-center justify-between rounded-md border border-border bg-brand-black px-3 py-2 text-sm text-text-primary">
        <span>Status ativo</span>
        <input
          type="checkbox"
          className="h-4 w-4 accent-brand-orange"
          checked={isActive}
          onChange={(event) => setIsActive(event.target.checked)}
        />
      </label>
      <Button type="submit" disabled={loading}>
        Salvar alterações
      </Button>
    </form>
  );
}

function FieldLabel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-2 text-sm font-medium text-text-secondary">
      <span>{label}</span>
      {children}
    </label>
  );
}

function UserModal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-black/80 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <section className="w-full max-w-md rounded-md border border-border bg-surface p-5 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold text-text-primary">{title}</h2>
          <Button variant="ghost" className="h-9 w-9 px-0" onClick={onClose} title="Fechar">
            <X size={18} />
          </Button>
        </div>
        {children}
      </section>
    </div>
  );
}

function roleLabel(role: Role): string {
  const labels: Record<Role, string> = {
    [Role.ADMIN]: "Gerente",
    [Role.COORDINATOR]: "Coordenador",
    [Role.DESIGNER]: "Projetista",
    [Role.INTERN]: "Estagiário"
  };

  return labels[role];
}

function closeCreateModal(
  searchParams: URLSearchParams,
  setSearchParams: (params: URLSearchParams, options?: { replace?: boolean }) => void,
  setShowCreateModal: (value: boolean) => void
) {
  const nextParams = new URLSearchParams(searchParams);
  nextParams.delete("new");
  setSearchParams(nextParams, { replace: true });
  setShowCreateModal(false);
}
