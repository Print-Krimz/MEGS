import React, { useEffect, useRef, useState } from "react";
import { formatCountdown } from "../../hooks/useCountdown";

const spoken = (seconds: number) =>
  seconds >= 60 ? `${Math.ceil(seconds / 60)} minutes` : `${seconds} seconds`;

/**
 * Shows the time left as mm:ss. The visible timer is silent for screen readers; a separate
 * status line speaks only when the countdown starts, at 1 minute, at 10 seconds and at zero.
 */
export const CountdownText: React.FC<{ seconds: number }> = ({ seconds }) => {
  const [announcement, setAnnouncement] = useState("");
  const started = useRef(false);

  useEffect(() => {
    if (!started.current) {
      started.current = true;
      if (seconds > 0) setAnnouncement(`${spoken(seconds)} left`);
    } else if (seconds === 60 || seconds === 10) {
      setAnnouncement(`${spoken(seconds)} left`);
    } else if (seconds <= 0) {
      setAnnouncement("Time is up");
    }
  }, [seconds]);

  return (
    <>
      <span role="timer" aria-live="off" className="font-medium tabular-nums">
        {formatCountdown(seconds)}
      </span>
      <span role="status" className="sr-only">
        {announcement}
      </span>
    </>
  );
};

/** Hint under a code field: time left, or what to do once the code has run out. */
export const OtpExpiryHint: React.FC<{ expired: boolean; seconds: number }> = ({ expired, seconds }) =>
  expired ? (
    <>This code has expired. Send a new code.</>
  ) : (
    <>
      Code expires in <CountdownText seconds={seconds} />
    </>
  );
