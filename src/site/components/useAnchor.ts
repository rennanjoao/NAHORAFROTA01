import { useLocation } from "react-router-dom";

/** Âncoras das seções: "#planos" na própria landing, "/#planos" em qualquer outra página. */
export function useAnchor() {
  const { pathname } = useLocation();
  return (id: string) => (pathname === "/" || pathname === "/site" ? `#${id}` : `/#${id}`);
}
