import { expect, test } from "vitest";
import { Facts } from "./facts";
import { k, v, box } from "./value";

test("resolve ground terms", () => {
  const s = Facts.init();
  expect(s.resolve(k("foo"))).toEqual(k("foo"));
  expect(s.resolve(k(123))).toEqual(k(123));

  expect(s.resolve(box("", [k("foo"), k("bar")]))).toEqual(
    box("", [k("foo"), k("bar")]),
  );
});

test("resolve unbound var", () => {
  const s = Facts.init();
  expect(s.resolve(v(0))).toEqual(v(0));
  s.unify(v(1), v(0));
  expect(s.resolve(v(1))).toEqual(v(0));
});

test("unify", () => {
  const s = Facts.init();

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

  expect(Facts.init().unify(k(1), k(0))).toBe(false);
  // }, "wrong value");

  expect(Facts.init().unify(k(1), k("1"))).toBe(false);
  // }, "wrong type");

  {
    const s = Facts.init();
    s.unify(k(1), v(0));
    expect(s.unify(k(2), v(0))).toBe(false);
  }
  // }, "var already bound to different value");
});

test("unify var direct circular reference", () => {
  const s = Facts.init();
  s.unify(v(0), v(1));
  s.unify(v(1), v(0));
  s.unify(v(0), k("foo"));
  expect(s.resolve(v(1)), "direct circular reference").toEqual(k("foo"));
});

test("unify box", () => {
  const s = Facts.init();
  s.unify(box("", [k("foo"), k("bar")]), box("", [k("foo"), k("bar")]));

  s.unify(box("", [v(0), k("bar")]), box("", [k("foo"), v(1)]));
  expect(s.resolve(box("", [v(0), v(1)]))).toEqual(
    box("", [k("foo"), k("bar")]),
  );

  s.unify(box("", [k("foo"), k("bar")]), v(2));
  s.unify(box("", [v(3), v(4)]), v(2));
  expect(s.resolve(v(3))).toEqual(k("foo"));
  expect(s.resolve(v(4))).toEqual(k("bar"));

  expect(Facts.init().unify(k("foo"), box("foo", []))).toBe(false);

  expect(Facts.init().unify(box("foo", []), k("foo"))).toBe(false);

  expect(Facts.init().unify(box("foo", []), box("bar", []))).toBe(false);

  expect(Facts.init().unify(box("foo", [k(1)]), box("foo", []))).toBe(false);

  expect(Facts.init().unify(box("foo", [k(1)]), box("foo", [k(2)]))).toBe(
    false,
  );
});

test("fork", () => {
  const s = Facts.init();
  const ns = s.fork();
  s.unify(k(1), v(0));
  ns.unify(k(2), v(0));
  expect(s.resolve(v(0))).toEqual(k(1));
  expect(ns.resolve(v(0))).toEqual(k(2));
});

test("dif", () => {
  const s = Facts.init();
  s.dif(k(1), k(2));
  s.dif(k(1), k("1"));

  s.dif(box("foo", []), box("bar", []));
  s.dif(box("foo", [k(1)]), box("foo", []));
  s.dif(box("foo", [k(1)]), box("foo", [k(2)]));

  s.unify(k(1), v(0));
  s.dif(k(2), v(0));
  expect(s.resolve(v(0))).toEqual(k(1));

  {
    const s = Facts.init();
    expect(s.dif(k(1), k(1))).toBe(false);
  }

  {
    const s = Facts.init();
    expect(s.dif(k("foo"), k("foo"))).toBe(false);
  }

  {
    const s = Facts.init();
    s.unify(v(0), v(1));
    s.unify(v(2), v(0));
    expect(s.dif(v(1), v(2))).toBe(false);
  }
});

test("dif constraint", () => {
  const s = Facts.init();
  s.dif(k(1), v(0));
  s.unify(k(2), v(0));
  expect(s.resolve(v(0))).toEqual(k(2));

  {
    const s = Facts.init();
    s.dif(k(1), v(0));
    expect(s.unify(k(1), v(0))).toBe(false);
  }
});

test("dif multi constraint", () => {
  const s = Facts.init();
  s.dif(k(1), v(0));
  s.dif(k(2), v(0));
  s.unify(k(3), v(0));

  expect(s.resolve(v(0))).toEqual(k(3));
});
