import { expect, test } from "vitest";
import { State, Fail } from "./state2";
import { k, v, box, Exception } from "./value2";

function expectFail(fn: () => unknown, message?: string) {
  expect(fn, message).toThrow(Fail);
}

test("init", () => {
  const s = State.init(123);
  expect(s.pid).toEqual(123);
});

test("resolve ground terms", () => {
  const s = State.init(0);
  expect(s.resolve(k("foo"))).toEqual(k("foo"));
  expect(s.resolve(k(123))).toEqual(k(123));

  expect(s.resolve(box("", [k("foo"), k("bar")]))).toEqual(
    box("", [k("foo"), k("bar")]),
  );
});

test("resolve unbound var", () => {
  const s = State.init(0);
  expect(s.resolve(v(0))).toEqual(v(0));
  s.unify(v(1), v(0));
  expect(s.resolve(v(1))).toEqual(v(0));
});

test("unify", () => {
  const s = State.init(0);

  s.unify(k(1), k(1));
  s.unify(k("foo"), k("foo"));

  s.unify(k(1), v(0));
  expect(s.resolve(v(0)), "var unify on right").toEqual(k(1));

  s.unify(v(1), k(2));
  expect(s.resolve(v(1)), "var unify on left").toEqual(k(2));

  s.unify(v(2), v(1));
  expect(s.resolve(v(2)), "var chain").toEqual(k(2));

  s.unify(v(2), v(3));
  s.unify(v(4), v(5));
  s.unify(v(6), v(5));
  s.unify(v(4), v(3));
  expect(s.resolve(v(6)), "long var chain").toEqual(k(2));

  expectFail(() => {
    const s = State.init(0);
    s.unify(k(1), k(0));
  }, "wrong value");

  expectFail(() => {
    const s = State.init(0);
    s.unify(k(1), k("1"));
  }, "wrong type");

  expectFail(() => {
    const s = State.init(0);
    s.unify(k(1), v(0));
    s.unify(k(2), v(0));
  }, "var already bound to different value");
});

test("unify var direct circular reference", () => {
  const s = State.init(0);
  s.unify(v(0), v(1));
  s.unify(v(1), v(0));
  s.unify(v(0), k("foo"));
  expect(s.resolve(v(1)), "direct circular reference").toEqual(k("foo"));
});

test("unify box", () => {
  const s = State.init(0);
  s.unify(box("", [k("foo"), k("bar")]), box("", [k("foo"), k("bar")]));

  s.unify(box("", [v(0), k("bar")]), box("", [k("foo"), v(1)]));
  expect(s.resolve(box("", [v(0), v(1)]))).toEqual(
    box("", [k("foo"), k("bar")]),
  );

  s.unify(box("", [k("foo"), k("bar")]), v(2));
  s.unify(box("", [v(3), v(4)]), v(2));
  expect(s.resolve(v(3))).toEqual(k("foo"));
  expect(s.resolve(v(4))).toEqual(k("bar"));

  expectFail(() => {
    const s = State.init(0);
    s.unify(k("foo"), box("foo", []));
  }, "box with string");

  expectFail(() => {
    const s = State.init(0);
    s.unify(box("foo", []), k("foo"));
  }, "string with box");

  expectFail(() => {
    const s = State.init(0);
    s.unify(box("foo", []), box("bar", []));
  }, "wrong tag");

  expectFail(() => {
    const s = State.init(0);
    s.unify(box("foo", [k(1)]), box("foo", []));
  }, "wrong number of args");

  expectFail(() => {
    const s = State.init(0);
    s.unify(box("foo", [k(1)]), box("foo", [k(2)]));
  }, "wrong contents");
});

test("fork", () => {
  const s = State.init(0);
  const ns = s.fork();
  s.unify(k(1), v(0));
  ns.unify(k(2), v(0));
  expect(s.resolve(v(0))).toEqual(k(1));
  expect(ns.resolve(v(0))).toEqual(k(2));
});

test("context", () => {
  const s = State.init(0);
  const ns = s.setContext("foo", v(1));
  expect(ns.getContext("foo")).toEqual(v(1));

  expect(() => {
    const s = State.init(0);
    s.setContext("foo", v(1));
    s.getContext("foo");
  }).toThrow(Exception);
});

test("dif", () => {
  const s = State.init(0);
  s.dif(k(1), k(2));
  s.dif(k(1), k("1"));

  s.dif(box("foo", []), box("bar", []));
  s.dif(box("foo", [k(1)]), box("foo", []));
  s.dif(box("foo", [k(1)]), box("foo", [k(2)]));

  s.unify(k(1), v(0));
  s.dif(k(2), v(0));
  expect(s.resolve(v(0))).toEqual(k(1));

  expectFail(() => {
    const s = State.init(0);
    s.dif(k(1), k(1));
  }, "same value");

  expectFail(() => {
    const s = State.init(0);
    s.dif(k("foo"), k("foo"));
  }, "same value");

  expectFail(() => {
    const s = State.init(0);
    s.unify(v(0), v(1));
    s.unify(v(2), v(0));
    s.dif(v(1), v(2));
  }, "same var");
});

test("dif constraint", () => {
  const s = State.init(0);
  s.dif(k(1), v(0));
  s.unify(k(2), v(0));
  expect(s.resolve(v(0))).toEqual(k(2));

  expectFail(() => {
    const s = State.init(0);
    s.dif(k(1), v(0));
    s.unify(k(1), v(0));
  });
});

test("dif multi constraint", () => {
  const s = State.init(0);
  s.dif(k(1), v(0));
  s.dif(k(2), v(0));
  s.unify(k(3), v(0));

  expect(s.resolve(v(0))).toEqual(k(3));
});
