import { CheckCircle2, Download, Info, X } from "lucide-react";
import { useState } from "react";
import type { UpdaterState } from "../../hooks/useUpdater";
import { Button } from "../ui/button";
import { UpdateModal } from "./UpdateModal";

interface UpdateBannerProps {
  updater: UpdaterState;
}

export function UpdateBanner({ updater }: UpdateBannerProps) {
  const [modalOpen, setModalOpen] = useState(false);

  if (!updater.showBanner || !updater.updateInfo) {
    return null;
  }

  const isDownloading = updater.status === "downloading";
  const isReady = updater.status === "ready";

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-brand-orange bg-[#1a1a1a] px-4 py-2 text-brand-white shadow-2xl">
        <div className="mx-auto flex min-h-10 max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand-orange-muted text-brand-orange">
              {isReady ? <CheckCircle2 size={18} /> : <Download size={18} />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">
                {isDownloading
                  ? `Baixando atualizacao v${updater.updateInfo.version}...`
                  : isReady
                    ? `Mika v${updater.updateInfo.version} pronto para instalar`
                    : `Nova versao disponivel: Mika v${updater.updateInfo.version}`}
              </div>
              {isDownloading ? (
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full bg-brand-orange transition-all" style={{ width: `${updater.progress}%` }} />
                  </div>
                  <span className="w-10 text-right text-xs text-text-secondary">{updater.progress}%</span>
                </div>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="ghost" className="h-9 px-3 text-brand-white hover:bg-white/10" onClick={() => setModalOpen(true)}>
              <Info size={16} />
              Ver novidades
            </Button>
            {isReady || updater.status === "idle" ? (
              <Button className="h-9 px-3" onClick={updater.install}>
                <Download size={16} />
                {isReady ? "Instalar e Reiniciar" : "Baixar e Instalar"}
              </Button>
            ) : null}
            {!isDownloading ? (
              <Button variant="ghost" className="h-9 w-9 px-0 text-brand-white hover:bg-white/10" onClick={updater.dismiss} title="Depois">
                <X size={16} />
              </Button>
            ) : null}
          </div>
        </div>
      </div>
      <UpdateModal updater={updater} open={modalOpen} onOpenChange={setModalOpen} />
    </>
  );
}
