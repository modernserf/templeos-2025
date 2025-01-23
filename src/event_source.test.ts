import { vi, expect, test } from "vitest";
import { EventSource } from "./event_source";

test("event source", () => {
  const es = new EventSource();
  const l1 = vi.fn();
  const l2 = vi.fn();
  const l3 = vi.fn();

  es.addEventListener(l1);
  const removeL2 = es.addEventListener(l2);
  es.addEventListener(l3);

  es.notifyEventListeners();

  expect(l1).toHaveBeenCalled();
  expect(l2).toHaveBeenCalled();
  expect(l3).toHaveBeenCalled();

  removeL2();

  l1.mockClear();
  l2.mockClear();
  l3.mockClear();

  es.notifyEventListeners();

  expect(l1).toHaveBeenCalled();
  expect(l2).not.toHaveBeenCalled();
  expect(l3).toHaveBeenCalled();
});
