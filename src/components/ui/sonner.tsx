import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * Capsule-style toasts that match the site theme: pill-shaped, monospace,
 * theme-aware, low-obstruction. Status is shown with a small accent dot
 * (emerald/rose/amber) rather than a full coloured box.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      position="bottom-center"
      gap={8}
      toastOptions={{
        unstyled: true,
        duration: 3500,
        classNames: {
          toast:
            "flex items-center gap-2.5 w-fit max-w-[92vw] mx-auto px-4 py-2.5 rounded-full " +
            "bg-background/85 backdrop-blur-xl border border-border " +
            "shadow-[0_8px_30px_rgba(0,0,0,0.18)] text-foreground " +
            "font-mono text-[11px] tracking-wide",
          title: "font-medium leading-tight",
          description: "text-muted-foreground text-[10px]",
          icon: "shrink-0 [&>svg]:w-3.5 [&>svg]:h-3.5",
          success: "[&_[data-icon]>svg]:text-emerald-500",
          error: "[&_[data-icon]>svg]:text-rose-500",
          warning: "[&_[data-icon]>svg]:text-amber-500",
          actionButton:
            "ml-1 px-2.5 py-1 rounded-full bg-primary text-background text-[10px] font-medium",
          cancelButton:
            "ml-1 px-2.5 py-1 rounded-full bg-muted text-muted-foreground text-[10px]",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
