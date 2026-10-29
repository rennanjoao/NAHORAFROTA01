/** Mac/iPhone/iPad mostram ⌘ nos atalhos; os demais, Ctrl. */
export const isMac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
