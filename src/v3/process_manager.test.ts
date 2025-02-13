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

// TODO

// const ipm: IProcessManager = {
//   db: new Map<string, Rec>([
//     ["=", { rule__params: l($.left, $.right) }],
//     ["zero", { rule__params: l($.value), rule__body: s("=", $.value, 0) }],
//     ["not_a_rule", { foo: 1 }],
//     [
//       "calls_zero",
//       { rule__params: l($.value), rule__body: s("zero", $.value) },
//     ],
//     [
//       "ignores_rest_params",
//       {
//         rule__params: l($.value),
//         rule__rest_params: __,
//         rule__body: s("calls_zero", $.value),
//       },
//     ],
//   ]),
//   primitives: {
//     "=": function* (state, left, right) {
//       if (state.unify(left, right)) yield state.result();
//     },
//   },
//   send() {},
//   sendAsync() {},
//   spawn() {
//     throw new Error("not implemented");
//   },
// };

// test("eval", () => {
//   const i = init();

//   expectGen(i.eval(box("=", [k(1), k(1)]))).toMatchObject([i.result()]);

//   expectGen(i.eval(box("zero", [k(0)]))).toMatchObject([i.result()]);

//   expectGen(i.eval(box("calls_zero", [k(0)]))).toMatchObject([i.result()]);

//   expectGen(i.eval(box("=", [k(1), k(2)]))).toMatchObject([]);
//   expectGen(i.eval(box("zero", [k(1)]))).toMatchObject([]);

//   expectGenThrow(i.eval(k(1)), "expected box");
//   expectGenThrow(i.eval(box("does_not_exist", [])), "unknown rule");
//   expectGenThrow(i.eval(box("not_a_rule", [])), "invalid rule");
//   expectGenThrow(i.eval(box("=", [k(0), k(0), k(0)])), "wrong args");
// });

// test("eval rest params", () => {
//   const i = init();

//   expectGen(
//     i.eval(box("ignores_rest_params", [k(0), k(1), k(2), k(3)])),
//   ).toMatchObject([i.result()]);
// });
