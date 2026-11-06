import React from "react";
import { ArrowUp } from "lucide-react";

const SHOW_AFTER_PX = 600;

/** Floating bottom-right button that returns to the top of the long single-page landing site. */
export const BackToTopButton: React.FC = () => {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > SHOW_AFTER_PX);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  const handleClick = () => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Back to top"
      className="fixed bottom-4 right-4 z-40 flex size-11 items-center justify-center rounded-full bg-secondary text-white shadow-lg transition-colors hover:bg-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:bottom-6 sm:right-6"
    >
      <ArrowUp className="size-5" aria-hidden="true" />
    </button>
  );
};
