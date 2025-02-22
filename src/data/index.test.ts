import { test } from "vitest";
import { initProcessManager } from ".";
import { $, __, f, l, s, seq } from "../expr";
import { EventSource } from "../event_source";
import { Value } from "../value";

test("hosted tests", async () => {
  const p = initProcessManager();
  const e = new EventSource<Value>();
  const out = p.addExternal(e);

  await new Promise((resolve) => {
    p.runExpr(
      seq(
        s.collect_item_in(
          __,
          __,
          seq(
            f.test__group($.test, $.group),
            s.box_tag_list($.call, $.test, l()),
            s.log($.group, $.test),
            s.try_error_catch($.call, $.e, seq(s.log($.e), s.throw($.e))),
          ),
        ),
        s.send(out, l()),
      ),
    );
    e.addEventListener(resolve);
  });
});
