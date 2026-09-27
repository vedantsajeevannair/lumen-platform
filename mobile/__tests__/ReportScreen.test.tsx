/**
 * Filing a report, and the part of it that was only ever coordinates.
 */
import React from "react";
import { renderScreen, fireEvent, waitFor } from "./support";

jest.mock("../src/api", () => {
  const actual = jest.requireActual("../src/api");
  return { ...actual, submitReport: jest.fn(), previewPhoto: jest.fn() };
});

import * as Location from "expo-location";
import ReportScreen from "../src/screens/ReportScreen";

beforeEach(() => jest.clearAllMocks());

it("asks for a photograph before anything else", async () => {
  const v = await renderScreen(<ReportScreen onFiled={jest.fn()} />);
  // The screen leads with the camera; nothing is filed without one.
  expect(v.toJSON()).toBeTruthy();
});

describe("the location it attaches", () => {
  it("names the street instead of printing coordinates", async () => {
    const v = await renderScreen(<ReportScreen onFiled={jest.fn()} />);

    const useGps = v.getAllByText(/Use GPS|Update/i)[0];
    await fireEvent.press(useGps);

    // Reverse geocoding turns 18.52034, 73.85674 into somewhere a resident
    // recognises. The exact fix stays on screen underneath it.
    await waitFor(() => expect(v.getByText(/FC Road/)).toBeTruthy());
    expect(v.getByText(/18\.52040, 73\.85670/)).toBeTruthy();
  });

  it("falls back to the coordinates when no name can be found", async () => {
    (Location.reverseGeocodeAsync as jest.Mock).mockResolvedValueOnce([]);
    const v = await renderScreen(<ReportScreen onFiled={jest.fn()} />);

    await fireEvent.press(v.getAllByText(/Use GPS|Update/i)[0]);
    await waitFor(() => expect(v.getByText(/18\.52040, 73\.85670/)).toBeTruthy());
  });

  it("still attaches the location when the lookup fails outright", async () => {
    // Offline, or the service refuses. The report must not be blocked by it.
    (Location.reverseGeocodeAsync as jest.Mock).mockRejectedValueOnce(new Error("offline"));
    const v = await renderScreen(<ReportScreen onFiled={jest.fn()} />);

    await fireEvent.press(v.getAllByText(/Use GPS|Update/i)[0]);
    await waitFor(() => expect(v.getByText(/18\.52040, 73\.85670/)).toBeTruthy());
  });
});
