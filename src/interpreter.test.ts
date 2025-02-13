import { expect, test } from "vitest";
import { Interpreter, ProcessNext } from "./interpreter";
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
        if (state.unify(left, right)) yield state.result();
      },
    },
    0,
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

  expectGen(i.eval(box("=", [k(1), k(1)]))).toMatchObject([i.result()]);

  expectGen(i.eval(box("zero", [k(0)]))).toMatchObject([i.result()]);

  expectGen(i.eval(box("calls_zero", [k(0)]))).toMatchObject([i.result()]);

  expectGen(i.eval(box("=", [k(1), k(2)]))).toMatchObject([]);
  expectGen(i.eval(box("zero", [k(1)]))).toMatchObject([]);

  expectGenThrow(i.eval(k(1)), "expected box");
  expectGenThrow(i.eval(box("does_not_exist", [])), "unknown rule");
  expectGenThrow(i.eval(box("not_a_rule", [])), "invalid rule");
  expectGenThrow(i.eval(box("=", [k(0), k(0), k(0)])), "wrong args");
});

test("eval rest params", () => {
  const i = init();

  expectGen(
    i.eval(box("ignores_rest_params", [k(0), k(1), k(2), k(3)])),
  ).toMatchObject([i.result()]);
});
