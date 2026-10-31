import "@testing-library/jest-dom";

// jsdom does not implement elementFromPoint, which input-otp calls for its password-manager badge check.
if (typeof document !== "undefined" && typeof document.elementFromPoint !== "function") {
  document.elementFromPoint = () => null;
}

// jsdom does not implement matchMedia, which camera-capture.ts calls. Default to "no match" with no-op listeners.
if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
