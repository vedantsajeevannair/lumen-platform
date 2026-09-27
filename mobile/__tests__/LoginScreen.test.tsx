/**
 * Signing in, driven the way a person drives it: type, press, look.
 */
import React from "react";
import { renderScreen, fireEvent, waitFor } from "./support";

jest.mock("../src/api", () => {
  const actual = jest.requireActual("../src/api");
  return { ...actual, login: jest.fn(), register: jest.fn(), googleLogin: jest.fn() };
});

import { login } from "../src/api";
import LoginScreen from "../src/screens/LoginScreen";

const USER = { id: "u1", email: "ravi@example.com", name: "Ravi", role: "CITIZEN" };

beforeEach(() => jest.clearAllMocks());

async function fill(v: any, email: string, password: string) {
  await fireEvent.changeText(await v.findByPlaceholderText("you@example.com"), email);
  await fireEvent.changeText(await v.findByPlaceholderText("••••••••"), password);
}

it("shows the way in", async () => {
  const v = await renderScreen(<LoginScreen onSignedIn={jest.fn()} />);
  expect(v.getByText("Welcome back")).toBeTruthy();
  expect(v.getByText("Sign in")).toBeTruthy();
  expect(v.getByText("Create an account")).toBeTruthy();
});

it("sends exactly what was typed", async () => {
  (login as jest.Mock).mockResolvedValue(USER);
  const v = await renderScreen(<LoginScreen onSignedIn={jest.fn()} />);
  await fill(v, "ravi@example.com", "correct-horse");
  await fireEvent.press(v.getByText("Sign in"));
  await waitFor(() =>
    expect(login).toHaveBeenCalledWith("ravi@example.com", "correct-horse"));
});

it("hands the signed-in user back to the app", async () => {
  const onSignedIn = jest.fn();
  (login as jest.Mock).mockResolvedValue(USER);
  const v = await renderScreen(<LoginScreen onSignedIn={onSignedIn} />);
  await fill(v, "ravi@example.com", "correct-horse");
  await fireEvent.press(v.getByText("Sign in"));
  await waitFor(() => expect(onSignedIn).toHaveBeenCalledWith(USER));
});

it("says why a refused sign-in failed, in the server's words", async () => {
  (login as jest.Mock).mockRejectedValue({ status: 401, message: "Invalid email or password." });
  const onSignedIn = jest.fn();
  const v = await renderScreen(<LoginScreen onSignedIn={onSignedIn} />);
  await fill(v, "ravi@example.com", "wrong");
  await fireEvent.press(v.getByText("Sign in"));

  await waitFor(() => expect(v.getByText(/Invalid email or password/)).toBeTruthy());
  expect(onSignedIn).not.toHaveBeenCalled();
});

it("does not reach the network without an email", async () => {
  const v = await renderScreen(<LoginScreen onSignedIn={jest.fn()} />);
  await fill(v, "", "correct-horse");
  await fireEvent.press(v.getByText("Sign in"));
  await waitFor(() => expect(login).not.toHaveBeenCalled());
});
