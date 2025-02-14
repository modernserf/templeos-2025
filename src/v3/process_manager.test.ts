import { expect, test } from "vitest";
import { rules, rulePrimitives } from "./rule_primitive";
import { ProcessManager } from "./process_manager";
import { TransactDB } from "../db";
import { Rec } from "../data";
import { s } from "./expr";
import { Exception } from "./value";

function init() {
  const db = new TransactDB<Rec>();
  db.bulkInsert(rules);

  return ProcessManager.init(db, rulePrimitives);
}

test("runExpr", () => {
  const pm = init();

  expect(() => {
    pm.runExpr(s.throw(s.error("hello")));
  }).toThrow(Exception);
});
