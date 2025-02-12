import { expect, test } from "vitest";
import { Interpreter, ProcessNext } from "./interpreter";
import { State } from "./state2";
import { box, Exception } from "./value2";
import { k } from "./state";
import { $, __, l, s } from "./expr";
import { Rec } from "./data";

function init() {
  return Interpreter.init(
    new Map<string, Rec>([
      ["=", { rule__params: l($.left, $.right) }],
      ["zero", { rule__params: l($.value), rule__body: s("=", $.value, 0) }],
      ["not_a_rule", { foo: 1 }],
      [
        "calls_zero",
        { rule__params: l($.value), rule__body: s("zero", $.value) },
      ],
      [
        "ignores_rest_params",
        {
          rule__params: l($.value),
          rule__rest_params: __,
          rule__body: s("calls_zero", $.value),
        },
      ],
    ]),
    {
      "=": function* (state, left, right) {
        state.unify(left, right);
        yield { tag: "result", state };
      },
    },
  );
}

function expectGen(gen: Generator<ProcessNext>, message?: string) {
  return expect(Array.from(gen), message);
}

function expectGenThrow(gen: Generator<ProcessNext>, message?: string) {
  expect(() => {
    Array.from(gen);
  }, message).toThrow(Exception);
}

test("eval", () => {
  const i = init();
  const state = State.init(0);

  expectGen(i.eval(state, box("=", [k(1), k(1)]))).toMatchObject([
    { tag: "result", state },
  ]);

  expectGen(i.eval(state, box("zero", [k(0)]))).toMatchObject([
    { tag: "result", state },
  ]);

  expectGen(i.eval(state, box("calls_zero", [k(0)]))).toMatchObject([
    { tag: "result", state },
  ]);

  expectGen(i.eval(state, box("=", [k(1), k(2)]))).toMatchObject([]);
  expectGen(i.eval(state, box("zero", [k(1)]))).toMatchObject([]);

  expectGenThrow(i.eval(state, k(1)), "expected box");
  expectGenThrow(i.eval(state, box("does_not_exist", [])), "unknown rule");
  expectGenThrow(i.eval(state, box("not_a_rule", [])), "invalid rule");
  expectGenThrow(i.eval(state, box("=", [k(0), k(0), k(0)])), "wrong args");
});

test("eval rest params", () => {
  const i = init();
  const state = State.init(0);

  expectGen(
    i.eval(state, box("ignores_rest_params", [k(0), k(1), k(2), k(3)])),
  ).toMatchObject([{ tag: "result", state }]);
});
