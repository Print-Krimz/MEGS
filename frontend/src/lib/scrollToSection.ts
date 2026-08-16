/**
 * Smoothly scrolls to an on-page section by its ID or href with header offset.
 */
export const scrollToSection = (
  e: React.MouseEvent<HTMLElement>,
  href: string,
  offset = 70
) => {
  if (href.startsWith("#")) {
    e.preventDefault();
    const targetId = href.substring(1);
    const targetElement = document.getElementById(targetId);
    if (targetElement) {
      const elementPosition = targetElement.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });
      window.history.pushState(null, "", href);
    }
  }
};
