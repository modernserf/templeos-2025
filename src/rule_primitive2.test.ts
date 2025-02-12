import { expect, test } from "vitest";
import {
  Interpreter,
  ProcessGen,
  ProcessNext,
  ProcessNextOf,
} from "./interpreter";
import { rules, rulePrimitives } from "./rule_primitive2";
import { box, Exception, k, v, Value } from "./value2";

function setup() {
  return Interpreter.init(new Map(Object.entries(rules)), rulePrimitives, 0);
}

function expectGen(gen: Generator<ProcessNext>, message?: string) {
  return expect(Array.from(gen), message);
}

function mapResults<T>(
  gen: Generator<ProcessNext>,
  f: (res: Interpreter) => T,
) {
  return Array.from(gen).map((res) =>
    f((res as ProcessNextOf<"result">).result),
  );
}

test("ok", () => {
  const it = setup();
  expectGen(it.eval(box("ok", []))).toEqual([it.result()]);
});

test("fail", () => {
  const it = setup();
  expectGen(it.eval(box("fail", []))).toEqual([]);
});

test("nonvar", () => {
  const it = setup();
  expectGen(it.eval(box("nonvar", [k(1)]))).toEqual([it.result()]);
  expectGen(it.eval(box("nonvar", [v(0)]))).toEqual([]);
});

test("=", () => {
  const it = setup();
  expectGen(it.eval(box("=", [k(1), k(1)]))).toEqual([it.result()]);
  expectGen(it.eval(box("=", [k(1), k(2)]))).toEqual([]);
});

test("/=", () => {
  const it = setup();
  expectGen(it.eval(box("/=", [k(1), k(1)]))).toEqual([]);
  expectGen(it.eval(box("/=", [k(1), k(2)]))).toEqual([it.result()]);
});

test(",", () => {
  const it = setup();
  Array.from(
    it.eval(
      box(",", [
        box("=", [v(0), k("foo")]), //
        box("=", [v(1), k("bar")]),
      ]),
    ),
  );
  expect(it.resolve(v(0))).toEqual(k("foo"));
  expect(it.resolve(v(1))).toEqual(k("bar"));

  expectGen(
    setup().eval(
      box(",", [
        box("fail", []), //
        box("=", [v(0), k("foo")]),
      ]),
    ),
  ).toEqual([]);

  expectGen(
    setup().eval(
      box(",", [
        box("=", [v(0), k("foo")]),
        box("fail", []), //
      ]),
    ),
  ).toEqual([]);
});

test(";", () => {
  expect(
    Array.from(
      setup().eval(
        box(";", [
          box("=", [v(0), k("foo")]), //
          box("=", [v(0), k("bar")]),
        ]),
      ),
    ).map((res) => (res as ProcessNextOf<"result">).result.resolve(v(0))),
  ).toEqual([k("foo"), k("bar")]);

  expect(
    Array.from(
      setup().eval(
        box(";", [
          box("fail", []), //
          box("=", [v(0), k("bar")]),
        ]),
      ),
    ).map((res) => (res as ProcessNextOf<"result">).result.resolve(v(0))),
  ).toEqual([k("bar")]);

  expect(
    Array.from(
      setup().eval(
        box(";", [
          box("=", [v(0), k("foo")]),
          box("fail", []), //
        ]),
      ),
    ).map((res) => (res as ProcessNextOf<"result">).result.resolve(v(0))),
  ).toEqual([k("foo")]);
});

test("if_then_else", () => {
  expect(
    mapResults(
      setup().eval(
        box("if_then_else", [
          box("ok", []),
          box("=", [v(0), k("foo")]),
          box("=", [v(0), k("bar")]),
        ]),
      ),
      (it) => it.resolve(v(0)),
    ),
    "when true",
  ).toEqual([k("foo")]);

  expect(
    mapResults(
      setup().eval(
        box("if_then_else", [
          box("fail", []),
          box("=", [v(0), k("foo")]),
          box("=", [v(0), k("bar")]),
        ]),
      ),
      (it) => it.resolve(v(0)),
    ),
    "when false",
  ).toEqual([k("bar")]);

  expect(
    mapResults(
      setup().eval(
        box("if_then_else", [
          box("ok", []),
          box("fail", []),
          box("=", [v(0), k("bar")]),
        ]),
      ),
      (it) => it.resolve(v(0)),
    ),
    "when then fails",
  ).toEqual([]);

  expect(
    mapResults(
      setup().eval(
        box("if_then_else", [
          box(";", [
            box("=", [v(0), k("foo")]), //
            box("=", [v(0), k("bar")]),
          ]),
          box("=", [v(1), box("", [k(123), v(0)])]),
          box("=", [v(1), box("", [k(456), v(0)])]),
        ]),
      ),
      (it) => it.resolve(v(1)),
    ),
    "multiple results",
  ).toEqual([box("", [k(123), k("foo")]), box("", [k(123), k("bar")])]);
});

test("try_error_catch", () => {
  expect(
    mapResults(
      setup().eval(
        box("try_error_catch", [
          box("=", [v(0), k(123)]),
          v(1),
          box("=", [v(0), k(456)]),
        ]),
      ),
      (it) => it.resolve(v(0)),
    ),
  ).toEqual([k(123)]);

  expect(
    mapResults(
      setup().eval(
        box("try_error_catch", [
          box("throw", [box("my_error", [])]),
          v(0),
          box("ok", []),
        ]),
      ),
      (it) => it.resolve(v(0)),
    ),
  ).toEqual([box("my_error", [])]);

  expect(
    mapResults(
      setup().eval(
        box("try_error_catch", [
          box("throw", [box("my_error", [k(123)])]),
          box("my_error", [v(0)]),
          box("ok", []),
        ]),
      ),
      (it) => it.resolve(v(0)),
    ),
  ).toEqual([k(123)]);

  expect(() => {
    Array.from(
      setup().eval(
        box("try_error_catch", [
          box("throw", [box("different_error", [k(123)])]),
          box("my_error", [v(0)]),
          box("ok", []),
        ]),
      ),
    );
  }).toThrow(Exception);
});

test("collect_empty", () => {
  expect(
    mapResults(
      setup().eval(
        box("collect_empty", [
          v(0),
          box(";", [box("=", [v(0), k(123)]), box("=", [v(0), k(456)])]),
          v(1),
        ]),
      ),
      (it) => it.resolve(v(1)),
    ),
  ).toEqual([box("", [k(123), k(456)])]);

  expect(
    mapResults(
      setup().eval(box("collect_empty", [v(0), box("fail", []), v(1)])),
      (it) => it.resolve(v(1)),
    ),
  ).toEqual([box("", [])]);
});

function handleReceive(gen: ProcessGen, send: Value[]) {
  let next = gen.next();
  const out: Interpreter[] = [];
  while (!next.done) {
    if (next.value.tag === "receive") {
      const nextState = next.value.to.fork();
      nextState.unify(next.value.pattern, send.shift()!);
      next = gen.next(nextState);
    } else {
      out.push(next.value.result);
      next = gen.next();
    }
  }
  return out;
}

test("receive", () => {
  expect(
    handleReceive(
      setup().eval(box("receive", [v(0)])), //
      [k("foo")],
    ).map((it) => it.resolve(v(0))),
  ).toEqual([k("foo")]);

  expect(
    handleReceive(
      setup().eval(
        box(",", [
          box("receive", [v(0)]),
          box("=", [v(1), box("", [k(123), v(0)])]),
        ]),
      ),
      [k("foo")],
    ).map((it) => it.resolve(v(1))),
  ).toEqual([box("", [k(123), k("foo")])]);

  expect(
    handleReceive(
      setup().eval(
        box("collect_empty", [
          v(0), //
          box("receive", [v(0)]),
          v(1),
        ]),
      ),
      [k("foo")],
    ).map((it) => it.resolve(v(1))),
  ).toEqual([box("", [k("foo")])]);
});
