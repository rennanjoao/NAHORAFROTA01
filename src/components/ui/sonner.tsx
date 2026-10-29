import { useEffect } from "react";
import { Toaster as Sonner, toast } from "sonner";
import { usePreferences } from "@/components/theme/PreferencesProvider";

type ToasterProps = React.ComponentProps<typeof Sonner>;

// O Sonner 1.7 nao deixa traduzir o rotulo do botao de fechar ("Close toast").
const CLOSE_LABEL = "Fechar aviso";

const Toaster = ({ ...props }: ToasterProps) => {
  const { resolvedTheme } = usePreferences();

  useEffect(() => {
    const label = () =>
      document
        .querySelectorAll<HTMLButtonElement>("[data-sonner-toast] [data-close-button]")
        .forEach((button) => button.getAttribute("aria-label") !== CLOSE_LABEL && button.setAttribute("aria-label", CLOSE_LABEL));
    const observer = new MutationObserver(label);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return (
    <Sonner
      theme={resolvedTheme}
      position="top-center"
      duration={3500}
      closeButton
      containerAriaLabel="Notificações"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:rounded-xl group-[.toaster]:bg-popover group-[.toaster]:text-popover-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:text-sm",
          description: "group-[.toast]:text-muted-foreground group-[.toast]:text-[0.8125rem]",
          closeButton:
            "group-[.toast]:h-7 group-[.toast]:w-7 group-[.toast]:border-border group-[.toast]:bg-popover group-[.toast]:text-muted-foreground hover:group-[.toast]:text-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          success: "[&_[data-icon]]:text-success",
          error: "[&_[data-icon]]:text-destructive",
          warning: "[&_[data-icon]]:text-warning",
          info: "[&_[data-icon]]:text-info",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
