import { test } from "vitest";
import { initProcessManager } from ".";
import { EventSource } from "../event_source";
import { box, k, Value } from "../value";

test("hosted tests", async () => {
  const p = initProcessManager();
  const e = new EventSource<Value>();
  const out = p.addExternal(e);

  await new Promise((resolve) => {
    p.spawn(box("test__run_all", [k(out)]));

    e.addEventListener(resolve);
  });
});
