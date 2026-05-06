import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Role, type CreateUserRequest, type User } from "shared";
import { Avatar } from "../components/shared/Avatar";
import { LoadingSpinner } from "../components/shared/LoadingSpinner";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { api } from "../lib/api";
import { queryClient } from "../lib/queryClient";

interface UsersResponse {
  users: User[];
}

interface UserResponse {
  user: User;
}

export function UsersPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>(Role.DESIGNER);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const response = await api.get<UsersResponse>("/users");
      return response.data.users;
    }
  });

  const createUser = useMutation({
    mutationFn: async (payload: CreateUserRequest) => {
      const response = await api.post<UserResponse>("/users", payload);
      return response.data.user;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    }
  });

  const deactivateUser = useMutation({
    mutationFn: async (userId: string) => {
      await api.delete(`/users/${userId}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    }
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await createUser.mutateAsync({ name, email, password, role });
    setName("");
    setEmail("");
    setPassword("");
    setRole(Role.DESIGNER);
  }

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="grid gap-6">
      <div>
        <p className="text-sm font-semibold uppercase text-brand-orange">Admin</p>
        <h1 className="mt-1 text-3xl font-bold text-text-primary">Usuarios</h1>
      </div>
      <form onSubmit={handleSubmit} className="grid gap-3 rounded-md border border-border bg-surface-card p-4 lg:grid-cols-5">
        <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome" required />
        <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" required />
        <Input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Senha"
          required
        />
        <Select value={role} onChange={(event) => setRole(event.target.value as Role)}>
          {Object.values(Role).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
        <Button type="submit" disabled={createUser.isPending}>
          Criar
        </Button>
      </form>
      <div className="overflow-hidden rounded-md border border-border">
        <table className="w-full min-w-[720px] border-collapse bg-surface-card text-sm">
          <thead className="bg-surface">
            <tr className="text-left text-text-secondary">
              <th className="p-3">Usuario</th>
              <th className="p-3">Email</th>
              <th className="p-3">Role</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Acoes</th>
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
                <td className="p-3 text-text-secondary">{user.role}</td>
                <td className="p-3 text-text-secondary">{user.isActive ? "Ativo" : "Inativo"}</td>
                <td className="p-3 text-right">
                  <Button
                    variant="danger"
                    disabled={!user.isActive || deactivateUser.isPending}
                    onClick={() => void deactivateUser.mutateAsync(user.id)}
                  >
                    Desativar
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
