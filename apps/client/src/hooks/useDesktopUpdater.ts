import { useEffect } from "react";
import { toast } from "sonner";

const updateToastId = "desktop-update-downloaded";

export function useDesktopUpdater(): void {
  useEffect(() => {
    if (!window.mkProjetos?.isDesktop) {
      return undefined;
    }

    return window.mkProjetos.onUpdateEvent((updateEvent) => {
      if (updateEvent.type !== "downloaded") {
        return;
      }

      toast("Nova versão disponível. Reiniciar para atualizar.", {
        id: updateToastId,
        duration: Infinity,
        action: {
          label: "Reiniciar",
          onClick: () => {
            void window.mkProjetos?.restartAndInstallUpdate();
          }
        }
      });
    });
  }, []);
}
