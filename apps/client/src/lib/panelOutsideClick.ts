export const PANEL_OUTSIDE_CLICK_IGNORE_SELECTOR =
  '[data-mika-popover-content="true"], [data-radix-popper-content-wrapper], [data-mika-mention-suggestion="true"]';

export function isTargetInsidePanelPortal(target: Element): boolean {
  return Boolean(target.closest(PANEL_OUTSIDE_CLICK_IGNORE_SELECTOR));
}

export function isPointInsidePanelPortal(clientX: number, clientY: number): boolean {
  const portals = document.querySelectorAll(PANEL_OUTSIDE_CLICK_IGNORE_SELECTOR);

  for (const portal of portals) {
    const rect = portal.getBoundingClientRect();

    if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
      return true;
    }
  }

  return false;
}
