import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import logoUrl from "../assets/logo.svg";
import { useAuth } from "../hooks/useAuth";
import { getSocketBaseUrl, updateDesktopServerUrl } from "../lib/runtimeConfig";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";

export function LoginPage() {
  const navigate = useNavigate();
  const { login, user } = useAuth();
  const [email, setEmail] = useState("");
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
      }

      await login(email, password);
      navigate("/", { replace: true });
    } catch {
      toast.error("Credenciais inválidas");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-brand-black px-4">
      <section className="w-full max-w-md rounded-md border border-border bg-surface p-8 shadow-2xl">
        <img src={logoUrl} alt="MK Projetos" className="mx-auto h-16 w-auto" />
        <div className="mt-8">
          <h1 className="text-2xl font-bold text-text-primary">Entrar no MK Projetos</h1>
          <p className="mt-2 text-sm text-text-secondary">Acesse projetos, disciplinas e tarefas da equipe.</p>
        </div>
        <form onSubmit={handleSubmit} className="mt-8 grid gap-4" autoComplete="off">
          {isDesktop ? (
            <label className="grid gap-2 text-sm font-semibold text-text-secondary">
              Servidor
              <Input
                value={serverUrl}
                onChange={(event) => setServerUrl(event.target.value)}
                placeholder="http://DESKTOP-TP1SBGH:3001"
                autoComplete="off"
                required
              />
            </label>
          ) : null}
          <label className="grid gap-2 text-sm font-semibold text-text-secondary">
            Email
            <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="off" required />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-text-secondary">
            Senha
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
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
