import { useEffect, useState } from "react";

const DESKTOP_QUERY = "(min-width: 1024px)";

const readDesktop = () => {
  if (typeof window === "undefined") return true;
  if (typeof window.matchMedia === "function") return window.matchMedia(DESKTOP_QUERY).matches;
  return window.innerWidth >= 1024;
};

/** True from 1024px: the resume sits beside the content. Below that it opens in a drawer. */
export const useIsDesktop = (): boolean => {
  const [isDesktop, setIsDesktop] = useState(readDesktop);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (typeof window.matchMedia !== "function") {
      const onResize = () => setIsDesktop(window.innerWidth >= 1024);
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    }
    const query = window.matchMedia(DESKTOP_QUERY);
    const onChange = () => setIsDesktop(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return isDesktop;
};
