import { expect, test } from "vitest";
import { ProcessManager } from "./process";
import { Expr, s, __ } from "./expr";
import { TransactDB } from "./db";
import { Rec } from "./data";
import { EventSource } from "./event_source";
import { testUtils } from "./data/test_utils";
import { k, Value } from "./value";
import { rulePrimitives, rules } from "./data/primitives";

const OUT = "out";

function init() {
  const db = new TransactDB<Rec>();
  db.bulkInsert(rules);
  db.bulkInsert(testUtils);
  return ProcessManager.init(db, rulePrimitives);
}

function run(goal: Expr) {
  const p = init();
  const out: Value[] = [];
  const es = new EventSource<Value>();
  es.addEventListener((val) => out.push(val));
  p.addExternal(es, OUT);
  p.runExpr(goal);
  return out;
}

test("smoke test", () => {
  expect(run(s.send(OUT, 123))).toEqual([k(123)]);
});
