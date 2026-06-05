import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Role, type User } from "shared";
import { Avatar } from "../components/shared/Avatar";
import { LoadingSpinner } from "../components/shared/LoadingSpinner";
import { api } from "../lib/api";

interface UserResponse {
  user: User;
}

export function UserProfilePage() {
  const { userId } = useParams();
  const { data: user, isLoading } = useQuery({
    queryKey: ["users", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const response = await api.get<UserResponse>(`/users/${userId}`);
      return response.data.user;
    }
  });

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return <div className="text-text-secondary">Usuário não encontrado.</div>;
  }

  return (
    <div className="rounded-md border border-border bg-surface-card p-6">
      <div className="flex items-center gap-4">
        <Avatar name={user.name} imageUrl={user.avatarUrl} className="h-16 w-16 text-lg" />
        <div>
          <p className="text-sm font-semibold uppercase text-brand-orange">{roleLabel(user.role)}</p>
          <h1 className="mt-1 text-3xl font-bold text-text-primary">{user.name}</h1>
          <p className="mt-1 text-text-secondary">{user.email}</p>
        </div>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-md border border-border bg-brand-black p-4">
          <p className="text-xs font-semibold uppercase text-text-muted">Status</p>
          <p className="mt-2 font-semibold text-text-primary">{user.isActive ? "Ativo" : "Inativo"}</p>
        </div>
        <div className="rounded-md border border-border bg-brand-black p-4">
          <p className="text-xs font-semibold uppercase text-text-muted">Criado em</p>
          <p className="mt-2 font-semibold text-text-primary">{new Date(user.createdAt).toLocaleDateString("pt-BR")}</p>
        </div>
        <div className="rounded-md border border-border bg-brand-black p-4">
          <p className="text-xs font-semibold uppercase text-text-muted">Atualizado em</p>
          <p className="mt-2 font-semibold text-text-primary">{new Date(user.updatedAt).toLocaleDateString("pt-BR")}</p>
        </div>
      </div>
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
