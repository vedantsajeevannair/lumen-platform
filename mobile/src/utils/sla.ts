/**
 * When a report is due, in the words a resident would use.
 *
 * Every complaint carries the hours its department has to resolve it, set
 * when the report was routed. Until now that number was only ever a type
 * declaration — the one thing a person most wants to know after filing was
 * sitting in the response and never shown.
 */

export type SlaState =
  | { kind: "none" }
  | { kind: "done"; label: string }
  | { kind: "due"; label: string; overdue: false }
  | { kind: "overdue"; label: string; overdue: true };

/** Whole days between two instants, rounded towards zero. */
function days(ms: number) {
  return Math.floor(ms / 86_400_000);
}

function hours(ms: number) {
  return Math.floor(ms / 3_600_000);
}

/**
 * `now` is a parameter so the result is testable; production passes nothing
 * and gets the real clock.
 */
export function slaState(
  complaint: {
    createdAt?: string | null;
    slaHours?: number | null;
    status?: string | null;
    closedAt?: string | null;
  },
  now: Date = new Date(),
): SlaState {
  const { createdAt, slaHours, status, closedAt } = complaint;

  // A report that was merged into another, or otherwise rejected, is not
  // being worked on by anyone — so it has no deadline to miss. Saying
  // "Overdue by 27 days" on one reads as neglect when the truth is that the
  // work is tracked under a different reference.
  if (status === "REJECTED" || status === "DUPLICATE") return { kind: "none" };

  // A finished report has no deadline left to report on; say when it closed
  // instead, which is the useful fact at that point.
  if (status === "CLOSED" || status === "RESOLVED") {
    if (!closedAt) return { kind: "done", label: "Completed" };
    const d = days(now.getTime() - new Date(closedAt).getTime());
    return {
      kind: "done",
      label: d <= 0 ? "Completed today" : d === 1 ? "Completed yesterday" : `Completed ${d} days ago`,
    };
  }

  if (!createdAt || !slaHours || slaHours <= 0) return { kind: "none" };

  const due = new Date(createdAt).getTime() + slaHours * 3_600_000;
  const left = due - now.getTime();

  if (left < 0) {
    const over = -left;
    const d = days(over);
    // Under a day, hours are what makes it feel real; past that, days do.
    // Clamp to one before pluralising, not after: a minute past the deadline
    // is "1 hour", and reading the unclamped 0 made it "1 hours".
    const h = Math.max(1, hours(over));
    const label =
      d >= 1
        ? `Overdue by ${d} ${d === 1 ? "day" : "days"}`
        : `Overdue by ${h} ${h === 1 ? "hour" : "hours"}`;
    return { kind: "overdue", label, overdue: true };
  }

  const d = days(left);
  const h = hours(left);
  const label =
    d >= 1
      ? `Due in ${d} ${d === 1 ? "day" : "days"}`
      : h >= 1
        ? `Due in ${h} ${h === 1 ? "hour" : "hours"}`
        : "Due within the hour";
  return { kind: "due", label, overdue: false };
}
