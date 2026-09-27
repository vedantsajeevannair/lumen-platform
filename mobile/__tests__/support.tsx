import React from "react";
import {
  act, cleanup, render as rtlRender, type RenderOptions,
} from "@testing-library/react-native";

/**
 * Render a screen the way the app renders it.
 *
 * Await it, and await every fireEvent too. Under React 19 both are
 * asynchronous, and a missing await does not fail where it was written — it
 * leaves an act() scope open, and the *next* screen in the file comes back as
 * an empty shell whose every query fails for no visible reason.
 */
export async function renderScreen(ui: React.ReactElement, options?: RenderOptions) {
  let view!: Awaited<ReturnType<typeof rtlRender>>;
  await act(async () => {
    view = await rtlRender(ui, options);
    // These screens ask the keystore and the location service about
    // themselves as they mount, then call setState with the answer. Letting
    // that land here keeps it inside an act() scope.
    await new Promise((resolve) => setImmediate(resolve));
  });
  return view;
}

afterEach(async () => {
  await cleanup();
});

export * from "@testing-library/react-native";
