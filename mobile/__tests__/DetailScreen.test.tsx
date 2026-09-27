/**
 * The report a resident opens, and the four things it now tells them that it
 * used to keep to itself: when it is due, who has it, why it was rejected,
 * and that they can say it is not actually fixed.
 *
 * The network is mocked, so these are about the screen. Whether the server
 * really answers this way is checked in backendContract.test.ts.
 */
import React from "react";
import { renderScreen, fireEvent, waitFor } from "./support";

jest.mock("../src/api", () => {
  const actual = jest.requireActual("../src/api");
  return { ...actual, complaint: jest.fn(), reopenComplaint: jest.fn() };
});

import { complaint, reopenComplaint } from "../src/api";

const HOURS = 3_600_000;
const base = {
  id: "c1",
  ref: "CMP-10442",
  title: "Open manhole on Whitefield Main Road",
  status: "ASSIGNED",
  category: "Open Manhole",
  civicCategory: "WATER",
  severityScore: 80,
  priority: "HIGH",
  address: "Whitefield Main Road",
  zone: "East Zone",
  lat: 12.97,
  lng: 77.59,
  createdAt: new Date(Date.now() - 5 * 24 * HOURS).toISOString(),
  slaHours: 48,
  department: { name: "Water Supply" },
  images: [],
  events: [],
};

const show = (extra: Record<string, unknown> = {}) =>
  (complaint as jest.Mock).mockResolvedValue({ ...base, ...extra });

beforeEach(() => jest.clearAllMocks());

describe("when it is due", () => {
  it("says how far overdue a late report is", async () => {
    show();
    const v = await renderScreen(<DetailScreen refCode="CMP-10442" onBack={jest.fn()} />);
    await waitFor(() => expect(v.getByText(/Overdue by 3 days/)).toBeTruthy());
  });

  it("counts down while there is still time", async () => {
    show({ createdAt: new Date(Date.now() - 6 * HOURS).toISOString(), slaHours: 48 });
    const v = await renderScreen(<DetailScreen refCode="CMP-10442" onBack={jest.fn()} />);
    await waitFor(() => expect(v.getByText(/Due in 1 day/)).toBeTruthy());
  });

  it("claims no deadline for a report merged into another", async () => {
    // Nobody is working on it, so it cannot be late.
    show({ status: "REJECTED", duplicateOf: { ref: "CMP-10490", title: "Same manhole" } });
    const v = await renderScreen(<DetailScreen refCode="CMP-10442" onBack={jest.fn()} />);
    await waitFor(() => expect(v.getByText(/Merged with an earlier report/)).toBeTruthy());
    expect(v.queryByText(/Overdue/)).toBeNull();
    expect(v.queryByText(/Due in/)).toBeNull();
  });
});

describe("who has it", () => {
  it("names the engineer rather than only saying Assigned", async () => {
    show({ engineer: { id: "e1", name: "Amit Sharma", code: "ENG-1001", zone: "North Zone" } });
    const v = await renderScreen(<DetailScreen refCode="CMP-10442" onBack={jest.fn()} />);
    await waitFor(() => expect(v.getByText("Amit Sharma")).toBeTruthy());
    expect(v.getByText(/ENG-1001/)).toBeTruthy();
  });

  it("shows nothing at all when no one is assigned yet", async () => {
    show({ status: "SUBMITTED", engineer: null });
    const v = await renderScreen(<DetailScreen refCode="CMP-10442" onBack={jest.fn()} />);
    await waitFor(() => expect(v.getByText(/CMP-10442/)).toBeTruthy());
    expect(v.queryByText(/Being handled by/i)).toBeNull();
  });
});

describe("a report merged into another", () => {
  it("explains the rejection and offers the report being worked on", async () => {
    const onOpenRef = jest.fn();
    show({ status: "REJECTED", duplicateOf: { ref: "CMP-10490", title: "Same manhole" } });
    const v = await renderScreen(
      <DetailScreen refCode="CMP-10442" onBack={jest.fn()} onOpenRef={onOpenRef} />,
    );
    // The reference appears twice — in the explanation and on the link.
    await waitFor(() => expect(v.getByText("Open CMP-10490")).toBeTruthy());
    await fireEvent.press(v.getByText("Open CMP-10490"));
    expect(onOpenRef).toHaveBeenCalledWith("CMP-10490");
  });

  it("counts other residents when theirs were merged into this one", async () => {
    show({ duplicates: [{ ref: "A", title: "a" }, { ref: "B", title: "b" }] });
    const v = await renderScreen(<DetailScreen refCode="CMP-10442" onBack={jest.fn()} />);
    await waitFor(() =>
      expect(v.getByText(/2 other residents have reported this/)).toBeTruthy());
  });
});

describe("saying it is not actually fixed", () => {
  it("offers nothing while the report is still open", async () => {
    show({ status: "ASSIGNED" });
    const v = await renderScreen(<DetailScreen refCode="CMP-10442" onBack={jest.fn()} />);
    await waitFor(() => expect(v.getByText(/CMP-10442/)).toBeTruthy());
    expect(v.queryByText("Still a problem")).toBeNull();
  });

  it("asks once the report is closed", async () => {
    show({ status: "CLOSED", closedAt: new Date().toISOString() });
    const v = await renderScreen(<DetailScreen refCode="CMP-10442" onBack={jest.fn()} />);
    await waitFor(() => expect(v.getByText("Is this actually fixed?")).toBeTruthy());
  });

  it("will not send an empty reason", async () => {
    show({ status: "CLOSED", closedAt: new Date().toISOString() });
    const v = await renderScreen(<DetailScreen refCode="CMP-10442" onBack={jest.fn()} />);
    await waitFor(() => expect(v.getByText("Still a problem")).toBeTruthy());
    await fireEvent.press(v.getByText("Still a problem"));
    await fireEvent.press(v.getByText("Reopen report"));
    expect(reopenComplaint).not.toHaveBeenCalled();
  });

  it("sends the reason and shows the report as it comes back", async () => {
    show({ status: "CLOSED", closedAt: new Date().toISOString() });
    (reopenComplaint as jest.Mock).mockResolvedValue({ ok: true, status: "SUBMITTED" });

    const v = await renderScreen(<DetailScreen refCode="CMP-10442" onBack={jest.fn()} />);
    await waitFor(() => expect(v.getByText("Still a problem")).toBeTruthy());
    await fireEvent.press(v.getByText("Still a problem"));

    const box = await v.findByPlaceholderText(/The pothole was filled/);
    await fireEvent.changeText(box, "The cover is missing again");

    // What the screen re-reads after reopening.
    show({ status: "SUBMITTED", events: [] });
    await fireEvent.press(v.getByText("Reopen report"));

    await waitFor(() =>
      expect(reopenComplaint).toHaveBeenCalledWith("CMP-10442", "The cover is missing again"));
    await waitFor(() => expect(v.queryByText("Is this actually fixed?")).toBeNull());
  });
});

import DetailScreen from "../src/screens/DetailScreen";
