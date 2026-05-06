import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="grid min-h-96 place-items-center text-center">
      <div>
        <p className="text-sm font-semibold uppercase text-brand-orange">404</p>
        <h1 className="mt-2 text-3xl font-bold text-text-primary">Pagina nao encontrada</h1>
        <Link
          to="/"
          className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-brand-orange px-4 text-sm font-semibold text-brand-white transition hover:bg-orange-600"
        >
          Voltar ao dashboard
        </Link>
      </div>
    </div>
  );
}
