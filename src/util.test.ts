import { expect, test } from "vitest";
import { deepEqual } from "./util";

test("deep equal", () => {
  expect(deepEqual(1, 1)).toBe(true);
  expect(deepEqual(1, 2)).toBe(false);
  expect(deepEqual(1, "1")).toBe(false);
  expect(deepEqual(false, false)).toBe(true);
  expect(deepEqual(null, null)).toBe(true);
  expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
  expect(deepEqual([1, 2, 3], [1, 2, 4])).toBe(false);
  expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
  expect(deepEqual({ foo: 1, bar: 2 }, { foo: 1, bar: 2 })).toBe(true);
  expect(deepEqual({ foo: 1, bar: 2 }, { foo: 1, bar: 3 })).toBe(false);
  expect(deepEqual({ foo: 1, bar: 2 }, { foo: 1, bar: 2, baz: 3 })).toBe(false);
});
