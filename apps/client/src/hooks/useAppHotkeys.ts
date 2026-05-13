import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { tinykeys } from "tinykeys";
import { Role } from "shared";
import { useAuth } from "./useAuth";
import { useUiStore } from "../store/uiStore";

function typingTarget(active: Element | null): boolean {
  if (!(active instanceof HTMLElement)) {
    return false;
  }
  const tag = active.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || active.isContentEditable;
}

export function useAppHotkeys() {
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    const canUsers = user?.role === Role.ADMIN || user?.role === Role.COORDINATOR;

    const unsub = tinykeys(window, {
      Escape: (event) => {
        const { commandPaletteOpen, shortcutsDialogOpen, setCommandPaletteOpen, setShortcutsDialogOpen } = useUiStore.getState();
        if (commandPaletteOpen) {
          event.preventDefault();
          setCommandPaletteOpen(false);
        } else if (shortcutsDialogOpen) {
          event.preventDefault();
          setShortcutsDialogOpen(false);
        }
      },
      "$mod+k": (event) => {
        event.preventDefault();
        const { commandPaletteOpen, setCommandPaletteOpen } = useUiStore.getState();
        setCommandPaletteOpen(!commandPaletteOpen);
      },
      "Shift+/": (event) => {
        if (typingTarget(document.activeElement)) {
          return;
        }
        event.preventDefault();
        useUiStore.getState().setShortcutsDialogOpen(true);
      },
      "g p": (event) => {
        if (typingTarget(document.activeElement)) {
          return;
        }
        event.preventDefault();
        navigate("/projects");
      },
      "g t": (event) => {
        if (typingTarget(document.activeElement)) {
          return;
        }
        event.preventDefault();
        navigate("/my-tasks");
      },
      "g d": (event) => {
        if (typingTarget(document.activeElement)) {
          return;
        }
        event.preventDefault();
        navigate("/");
      },
      "g u": (event) => {
        if (!canUsers || typingTarget(document.activeElement)) {
          return;
        }
        event.preventDefault();
        navigate("/users");
      },
      c: (event) => {
        if (typingTarget(document.activeElement)) {
          return;
        }
        event.preventDefault();
        navigate("/my-tasks");
      }
    });

    return unsub;
  }, [navigate, user?.role]);
}
