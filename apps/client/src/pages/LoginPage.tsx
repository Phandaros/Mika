import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import logoUrl from "../assets/logo.svg";
import { useAuth } from "../hooks/useAuth";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";

export function LoginPage() {
  const navigate = useNavigate();
  const { login, user } = useAuth();
  const [email, setEmail] = useState("admin@mkengenharia.eng.br");
  const [password, setPassword] = useState("admin123");
  const [loading, setLoading] = useState(false);

  if (user) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    try {
      await login(email, password);
      navigate("/", { replace: true });
    } catch {
      toast.error("Credenciais invalidas");
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
        <form onSubmit={handleSubmit} className="mt-8 grid gap-4">
          <label className="grid gap-2 text-sm font-semibold text-text-secondary">
            Email
            <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-text-secondary">
            Senha
            <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </label>
          <Button type="submit" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </section>
    </main>
  );
}
