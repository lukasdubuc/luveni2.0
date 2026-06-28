import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * Pill-capsule toasts. Sonner's own DOM wrappers win in CSS specificity
 * over Tailwind, so the actual pill shape + sizing is enforced globally
 * via [data-sonner-toast] rules in styles.css. Here we just configure
 * behavior (position, duration, colors).
 */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      position="bottom-center"
      gap={6}
      visibleToasts={3}
      offset={24}
      richColors
      duration={2400}
      {...props}
    />
  );
};

export { Toaster };
