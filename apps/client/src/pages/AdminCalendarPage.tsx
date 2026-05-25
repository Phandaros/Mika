import { format } from "date-fns";
import { CalendarDays, Pencil, Plus, Trash2, X } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import type { CompanyHoliday } from "shared";
import { LoadingSpinner } from "../components/shared/LoadingSpinner";
import { Button } from "../components/ui/button";
import { DatePicker } from "../components/ui/date-picker";
import { Input } from "../components/ui/input";
import {
  useCompanyHolidays,
  useCreateCompanyHoliday,
  useDeleteCompanyHoliday,
  useUpdateCompanyHoliday
} from "../hooks/useCompanyHolidays";
import { dateOnlyToLocalDate, formatDateOnly } from "../lib/utils";

export function AdminCalendarPage() {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [editingHoliday, setEditingHoliday] = useState<CompanyHoliday | null>(null);
  const [showForm, setShowForm] = useState(false);
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  const { data: holidays = [], isLoading } = useCompanyHolidays(from, to);
  const createHoliday = useCreateCompanyHoliday();
  const updateHoliday = useUpdateCompanyHoliday();
  const deleteHoliday = useDeleteCompanyHoliday();

  const groupedHolidays = useMemo(
    () =>
      [...holidays].sort((a, b) => a.date.localeCompare(b.date)).map((holiday) => ({
        ...holiday,
        weekday: dateOnlyToLocalDate(holiday.date) ? format(dateOnlyToLocalDate(holiday.date)!, "EEE") : ""
      })),
    [holidays]
  );

  async function handleSubmit(payload: { date: string; name: string }) {
    if (editingHoliday) {
      await updateHoliday.mutateAsync({ id: editingHoliday.id, payload });
      toast.success("Feriado atualizado");
    } else {
      await createHoliday.mutateAsync(payload);
      toast.success("Feriado criado");
    }

    setShowForm(false);
    setEditingHoliday(null);
  }

  async function handleDelete(holiday: CompanyHoliday) {
    const confirmed = window.confirm(`Excluir "${holiday.name}"?`);
    if (!confirmed) {
      return;
    }

    await deleteHoliday.mutateAsync(holiday.id);
    toast.success("Feriado removido");
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-col justify-between gap-4 border-b border-border pb-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-semibold uppercase text-brand-orange">Administracao</p>
          <h1 className="mt-1 text-3xl font-bold text-text-primary">Calendario corporativo</h1>
          <p className="mt-2 max-w-2xl text-sm text-text-secondary">
            Feriados cadastrados aqui aparecem na carga de trabalho e nao recebem dias estimados.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            inputMode="numeric"
            value={String(year)}
            onChange={(event) => {
              const nextYear = Number(event.target.value);
              if (Number.isFinite(nextYear)) {
                setYear(nextYear);
              }
            }}
            className="h-10 w-28"
            aria-label="Ano"
          />
          <Button
            onClick={() => {
              setEditingHoliday(null);
              setShowForm(true);
            }}
          >
            <Plus size={16} />
            Novo feriado
          </Button>
        </div>
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <div className="overflow-hidden rounded-md border border-border bg-surface-card">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead className="bg-surface">
              <tr className="text-left text-text-secondary">
                <th className="p-3">Data</th>
                <th className="p-3">Nome</th>
                <th className="p-3">Dia</th>
                <th className="p-3 text-right">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {groupedHolidays.map((holiday) => (
                <tr key={holiday.id} className="border-t border-border">
                  <td className="p-3 font-semibold text-text-primary">{formatDateOnly(holiday.date, "dd/MM/yyyy")}</td>
                  <td className="p-3 text-text-secondary">{holiday.name}</td>
                  <td className="p-3 text-text-muted">{holiday.weekday}</td>
                  <td className="p-3">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="secondary"
                        className="h-9 px-3"
                        onClick={() => {
                          setEditingHoliday(holiday);
                          setShowForm(true);
                        }}
                        title="Editar feriado"
                      >
                        <Pencil size={15} />
                      </Button>
                      <Button
                        variant="danger"
                        className="h-9 px-3"
                        disabled={deleteHoliday.isPending}
                        onClick={() => void handleDelete(holiday)}
                        title="Excluir feriado"
                      >
                        <Trash2 size={15} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!groupedHolidays.length ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-sm text-text-muted">
                    <CalendarDays className="mx-auto mb-3 h-8 w-8 text-text-muted" />
                    Nenhum feriado cadastrado para {year}.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}

      {showForm ? (
        <HolidayModal
          holiday={editingHoliday}
          loading={createHoliday.isPending || updateHoliday.isPending}
          onClose={() => {
            setShowForm(false);
            setEditingHoliday(null);
          }}
          onSubmit={handleSubmit}
        />
      ) : null}
    </div>
  );
}

function HolidayModal({
  holiday,
  loading,
  onClose,
  onSubmit
}: {
  holiday: CompanyHoliday | null;
  loading: boolean;
  onClose: () => void;
  onSubmit: (payload: { date: string; name: string }) => Promise<void>;
}) {
  const [date, setDate] = useState(holiday?.date ?? "");
  const [name, setName] = useState(holiday?.name ?? "");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!date) {
      toast.error("Informe a data do feriado");
      return;
    }

    await onSubmit({ date, name });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-black/80 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <section className="w-full max-w-md rounded-md border border-border bg-surface p-5 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold text-text-primary">{holiday ? "Editar feriado" : "Novo feriado"}</h2>
          <Button variant="ghost" className="h-9 w-9 px-0" onClick={onClose} title="Fechar">
            <X size={18} />
          </Button>
        </div>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <DatePicker value={date} onValueChange={(value) => setDate(value ?? "")} placeholder="Data do feriado" />
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome do feriado" required />
          <Button type="submit" disabled={loading}>
            {holiday ? "Salvar feriado" : "Criar feriado"}
          </Button>
        </form>
      </section>
    </div>
  );
}
