import { test } from "vitest";
import { initProcessManager } from ".";
import { $, l, s, seq } from "../expr";

test("hosted tests", () => {
  const p = initProcessManager();

  // TODO: get all groups
  const testGroups = ["primitives", "core", "views"];

  for (const group of testGroups) {
    p.runExpr(
      seq(
        s.record_index_field($.test, group, "test__group"),
        s.box_tag_list($.call, $.test, l()),
        s.log($.test),
        s.try_error_catch($.call, $.e, seq(s.log($.e), s.throw($.e))),
      ),
    );
  }
});
