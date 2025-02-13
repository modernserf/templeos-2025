import { expect, test } from "vitest";
import { Process } from "./process";
import { Exception, v } from "./value";

function init() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return Process.init({} as any, 0);
}

test("context", () => {
  const s = init();
  const ns = s.setContext("foo", v(1));
  expect(ns.getContext("foo")).toEqual(v(1));

  expect(() => {
    const s = init();
    s.setContext("foo", v(1));
    s.getContext("foo");
  }).toThrow(Exception);
});
