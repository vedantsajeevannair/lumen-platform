/* Runs after the test framework is up, so it can reach into react-native. */
const { Alert } = require("react-native");

/**
 * React refuses to treat act() as active without this, and a setState from an
 * effect that resolved a tick late is then reported as happening outside act
 * — which corrupts the renderer for every later test in the file.
 */
global.IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Answer alerts instead of leaving them open.
 *
 * A screen that asks for confirmation by returning a promise that resolves on
 * a button press will otherwise never finish under jest. Dismissing with the
 * first button is what a person tapping "Cancel" does; a test that cares can
 * override this.
 */
jest.spyOn(Alert, "alert").mockImplementation((_t, _m, buttons) => {
  buttons?.[0]?.onPress?.();
});

beforeEach(() => Alert.alert.mockClear());
