import "@testing-library/jest-dom";

// jsdom does not implement elementFromPoint, which input-otp calls for its password-manager badge check.
if (typeof document !== "undefined" && typeof document.elementFromPoint !== "function") {
  document.elementFromPoint = () => null;
}
