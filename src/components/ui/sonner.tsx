import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * Apple-lock-screen-style toast: small floating capsule at the bottom,
 * blur backdrop, theme-aware, short-lived, low-obstruction. Status only
 * shows as a tiny accent dot on the left — no green/red boxes.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      position="bottom-center"
      gap={6}
      visibleToasts={3}
      offset={24}
      toastOptions={{
        unstyled: true,
        duration: 2200,
        classNames: {
          toast:
            "luveni-toast group flex items-center gap-2 w-fit max-w-[88vw] mx-auto " +
            "px-4 py-2 rounded-full font-mono text-[11px] tracking-wide leading-tight " +
            "border shadow-[0_10px_30px_-6px_rgba(0,0,0,0.18),0_1px_2px_rgba(0,0,0,0.04)] " +
            "transition-all backdrop-blur-2xl",
          title: "font-medium",
          description: "opacity-70 text-[10px]",
          icon: "hidden",
          actionButton:
            "ml-2 px-2.5 py-[3px] rounded-full bg-foreground text-background text-[10px] font-medium",
          cancelButton:
            "ml-2 px-2.5 py-[3px] rounded-full bg-muted text-muted-foreground text-[10px]",
        },
        style: {
          background: "color-mix(in srgb, var(--background) 80%, transparent)",
          color: "var(--foreground)",
          borderColor: "var(--border)",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
