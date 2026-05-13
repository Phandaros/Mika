import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Plus, RotateCcw, X } from "lucide-react";
import { Role, type CreateUserRequest } from "shared";
import { Avatar } from "../components/shared/Avatar";
import { LoadingSpinner } from "../components/shared/LoadingSpinner";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  MK_SELECT_EMPTY_VALUE,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "../components/ui/select";
import { useCreateUser, useDeactivateUser, useResetUserPassword, useUsers } from "../hooks/useUsers";

export function UsersPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: users = [], isLoading } = useUsers();
  const createUser = useCreateUser();
  const deactivateUser = useDeactivateUser();
  const resetPassword = useResetUserPassword();

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

  async function handleResetPassword(userId: string) {
    const result = await resetPassword.mutateAsync(userId);
    toast.success(`Senha temporária: ${result.temporaryPassword}`, { duration: 10000 });
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

      <div className="overflow-hidden rounded-md border border-border">
        <table className="w-full min-w-[820px] border-collapse bg-surface-card text-sm">
          <thead className="bg-surface">
            <tr className="text-left text-text-secondary">
              <th className="p-3">Usuário</th>
              <th className="p-3">Email</th>
              <th className="p-3">Perfil</th>
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
                    <Button
                      variant="secondary"
                      className="h-9"
                      disabled={resetPassword.isPending}
                      onClick={() => void handleResetPassword(user.id)}
                    >
                      <RotateCcw size={15} />
                      Resetar senha
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
      <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome" required />
      <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" required />
      <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Senha inicial" required />
      <Select value={role} onValueChange={(value) => setRole(value as Role)}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.values(Role).map((option) => (
            <SelectItem key={option} value={option}>
              {roleLabel(option)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button type="submit" disabled={loading}>
        Criar usuário
      </Button>
    </form>
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
