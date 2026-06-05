import { useState, type FormEvent } from "react";
import axios from "axios";
import { Navigate, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import logoUrl from "../assets/logo.svg";
import { useAuth } from "../hooks/useAuth";
import { desktopServerPlaceholder, getSocketBaseUrl, updateDesktopServerUrl } from "../lib/runtimeConfig";
import { resetNotificationSocket } from "../lib/socket";
import { getLastLoginEmail } from "../store/authStore";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";

function loginErrorMessage(error: unknown, isDesktop: boolean): string {
  if (error instanceof TypeError) {
    return "Endereço do servidor inválido. Informe o IP ou nome do servidor.";
  }

  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return isDesktop
        ? "Não foi possível conectar ao servidor. Confira o IP ou nome informado."
        : "Não foi possível conectar ao servidor.";
    }

    if (error.response.status === 401) {
      return "Credenciais inválidas";
    }
  }

  return "Não foi possível entrar. Tente novamente.";
}

export function LoginPage() {
  const navigate = useNavigate();
  const { login, user } = useAuth();
  const [email, setEmail] = useState(() => getLastLoginEmail());
  const [password, setPassword] = useState("");
  const [serverUrl, setServerUrl] = useState(getSocketBaseUrl());
  const [loading, setLoading] = useState(false);
  const isDesktop = window.mkProjetos?.isDesktop === true;

  if (user) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    try {
      if (isDesktop) {
        await updateDesktopServerUrl(serverUrl);
        resetNotificationSocket();
      }

      await login(email, password);
      navigate("/", { replace: true });
    } catch (error) {
      toast.error(loginErrorMessage(error, isDesktop));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-bg-0 px-4">
      <section className="w-full max-w-md rounded-lg border border-border-subtle bg-bg-2 p-8 shadow-2xl">
        <img src={logoUrl} alt="Mika" className="mx-auto h-16 w-auto" />
        <div className="mt-8">
          <h1 className="text-2xl font-bold text-text-primary">Entrar no Mika</h1>
          <p className="mt-2 text-sm text-text-secondary">Acesse projetos, secoes e tarefas da equipe.</p>
        </div>
        <form onSubmit={handleSubmit} className="mt-8 grid gap-4" autoComplete="on">
          {isDesktop ? (
            <label className="grid gap-2 text-sm font-semibold text-text-secondary">
              Servidor
              <Input
                value={serverUrl}
                onChange={(event) => setServerUrl(event.target.value)}
                placeholder={desktopServerPlaceholder()}
                autoComplete="off"
                required
              />
            </label>
          ) : null}
          <label className="grid gap-2 text-sm font-semibold text-text-secondary">
            Email
            <Input
              type="email"
              name="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="username email"
              required
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-text-secondary">
            Senha
            <Input
              type="password"
              name="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <Button type="submit" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </section>
    </main>
  );
}
