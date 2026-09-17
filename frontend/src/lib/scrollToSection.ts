/**
 * Instantly triggers smooth scrolling to an on-page section by its ID or href.
 */
export const scrollToSection = (
  e?: React.MouseEvent<HTMLElement>,
  href?: string
) => {
  if (e) {
    e.preventDefault();
  }
  if (href && href.startsWith("#")) {
    const targetId = href.substring(1);
    const targetElement = document.getElementById(targetId);
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: "smooth" });
      window.history.pushState(null, "", href);
    }
  }
};
