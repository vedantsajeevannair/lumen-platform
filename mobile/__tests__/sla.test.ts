import { slaState } from "../src/utils/sla";

const AT = (iso: string) => new Date(iso);

/** Narrows away the "none" case so a test can read the label it expects. */
function label(state: ReturnType<typeof slaState>): string {
  if (state.kind === "none") throw new Error("expected a dated state, got none");
  return state.label;
}
const base = { createdAt: "2026-09-01T00:00:00.000Z", slaHours: 48, status: "SUBMITTED" };

describe("when a report is due", () => {
  it("counts down in days while there is more than a day left", () => {
    expect(label(slaState(base, AT("2026-09-01T01:00:00Z")))).toBe("Due in 1 day");
  });

  it("switches to hours inside the last day", () => {
    expect(label(slaState(base, AT("2026-09-02T18:00:00Z")))).toBe("Due in 6 hours");
  });

  it("says so plainly in the last hour rather than 'due in 0 hours'", () => {
    expect(label(slaState(base, AT("2026-09-02T23:30:00Z")))).toBe("Due within the hour");
  });

  it("reports overdue in hours just past the deadline", () => {
    const s = slaState(base, AT("2026-09-03T03:00:00Z"));
    expect(s.kind).toBe("overdue");
    expect(label(s)).toBe("Overdue by 3 hours");
  });

  it("never says 'overdue by 0 hours' the moment it lapses", () => {
    expect(label(slaState(base, AT("2026-09-03T00:01:00Z")))).toBe("Overdue by 1 hour");
  });

  it("reports overdue in days once a day has passed", () => {
    expect(label(slaState(base, AT("2026-09-05T00:00:00Z")))).toBe("Overdue by 2 days");
  });

  it("uses singular for one day, plural otherwise", () => {
    expect(label(slaState(base, AT("2026-09-04T00:00:00Z")))).toBe("Overdue by 1 day");
  });

  it("shows when a finished report was completed, not a deadline", () => {
    const done = { ...base, status: "CLOSED", closedAt: "2026-09-02T00:00:00.000Z" };
    expect(label(slaState(done, AT("2026-09-02T06:00:00Z")))).toBe("Completed today");
    expect(label(slaState(done, AT("2026-09-03T06:00:00Z")))).toBe("Completed yesterday");
    expect(label(slaState(done, AT("2026-09-06T00:00:00Z")))).toBe("Completed 4 days ago");
  });

  it("says nothing when the report was never given a target", () => {
    expect(slaState({ createdAt: base.createdAt, slaHours: null }).kind).toBe("none");
    expect(slaState({ createdAt: null, slaHours: 48 }).kind).toBe("none");
    expect(slaState({ createdAt: base.createdAt, slaHours: 0 }).kind).toBe("none");
  });
});
