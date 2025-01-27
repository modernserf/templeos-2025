import { expect, test } from "vitest";
import { k, v, s, State, StateNext, __ } from "./state3";

test("constants", () => {
  const state = State.root();

  expect(state.resolve(k(123))).toEqual(123);
  expect(state.resolve(k("Hello"))).toEqual("Hello");
  expect(state.resolve(s("foo", k(123), k("Hello")))).toEqual({
    id: "foo",
    args: [123, "Hello"],
  });

  expect(state.unify(k(123), k(123))).not.toBe(null);
  expect(state.unify(k(123), k(456))).toBe(null);
  expect(state.unify(k(123), k("123"))).toBe(null);

  expect(
    state.unify(
      s("foo", k(123), k("Hello")), //
      s("foo", k(123), k("Hello"))
    )
  ).not.toBe(null);
  expect(
    state.unify(
      s("foo", k(123), k("Hello")), //
      k("foo")
    )
  ).toBe(null);
  expect(
    state.unify(
      s("foo", k(123), k("Hello")), //
      s("foo", k(456), k("Hello"))
    )
  ).toBe(null);
  expect(
    state.unify(
      s("foo", k(123), k("Hello")), //
      s("bar", k(123), k("Hello"))
    )
  ).toBe(null);
  expect(
    state.unify(
      s("foo", k(123), k("Hello"), k(789)), //
      s("foo", k(456), k("Hello"))
    )
  ).toBe(null);
});

test("free vars", () => {
  const state = State.root();

  expect(state.unify(v("foo"), v("foo"))).toBe(state);

  expect(state.canResolve(k(123))).toBe(true);
  expect(state.canResolve(s("foo", k(123), k("Hello")))).toBe(true);
  expect(state.canResolve(v("foo"))).toBe(false);
  expect(() => {
    state.resolve(v("foo"));
  }).toThrow();

  const ns = state.unify(v("foo"), k(123))!;
  expect(ns.resolve(v("foo"))).toEqual(123);
  expect(ns.unify(v("foo"), k(123))).not.toBe(null);
  expect(ns.unify(v("foo"), k(456))).toBe(null);
});

test("bound vars", () => {
  const state = State.root()
    .unify(v("foo"), k(123))!
    .unify(v("bar"), v("baz"))!;

  {
    const ns = state.unify(v("foo"), v("bar"))!;
    expect(ns.resolve(v("foo"))).toEqual(123);
    expect(ns.resolve(v("bar"))).toEqual(123);
    expect(ns.resolve(v("baz"))).toEqual(123);
  }
  {
    const ns = state.unify(v("baz"), v("foo"))!;
    expect(ns.resolve(v("foo"))).toEqual(123);
    expect(ns.resolve(v("bar"))).toEqual(123);
    expect(ns.resolve(v("baz"))).toEqual(123);
  }
  {
    const ns = state.unify(v("baz"), v("foo"))!;
    expect(ns.resolve(v("foo"))).toEqual(123);
    expect(ns.resolve(v("bar"))).toEqual(123);
    expect(ns.resolve(v("baz"))).toEqual(123);
  }
});

test("struct vars", () => {
  const state = State.root();

  const ns = state.unify(
    s("foo", k(123), v("b"), v("c")),
    s("foo", v("a"), k(456), v("d"))
  )!;
  expect(ns.resolve(v("a"))).toEqual(123);
  expect(ns.resolve(v("b"))).toEqual(456);
  expect(ns.canResolve(v("c"))).toBe(false);
  expect(ns.canResolve(v("d"))).toBe(false);

  {
    const ns1 = ns.unify(v("c"), k(789))!;
    expect(ns1.resolve(v("c"))).toEqual(789);
    expect(ns1.resolve(v("d"))).toEqual(789);
  }
  {
    const ns1 = ns.unify(v("d"), k(789))!;
    expect(ns1.resolve(v("c"))).toEqual(789);
    expect(ns1.resolve(v("d"))).toEqual(789);
  }
});

test("placeholders", () => {
  const state = State.root();

  expect(state.canResolve(__)).toBe(false);
  expect(() => {
    state.resolve(__);
  }).toThrow();

  const ns = state.unify(
    s("foo", v("a"), v("b"), __),
    s("foo", k(123), k(456), k(789))
  )!;

  expect(ns.resolveAll()).toEqual({ a: 123, b: 456 });
});

function allResults(xs: Generator<StateNext>) {
  return Array.from(xs).map((x) => x.state.resolveAll());
}

test("unknown rule", () => {
  const state = State.root();
  expect(() => {
    allResults(state.runClause(s("doesNotExist")));
  }).toThrow();
});

test("invalid clause", () => {
  const state = State.root();
  expect(() => {
    allResults(state.runClause(v("id")));
  }).toThrow();
});

test("fail", () => {
  const state = State.root();
  expect(allResults(state.runClause(s("fail")))).toEqual([]);
});

test("ok", () => {
  const state = State.root();
  expect(allResults(state.runClause(s("ok")))).toEqual([{}]);
});

test("=", () => {
  const state = State.root();
  expect(allResults(state.runClause(s("=", k(123), v("foo"))))).toEqual([
    { foo: 123 },
  ]);
  expect(allResults(state.runClause(s("=", v("foo"), k(123))))).toEqual([
    { foo: 123 },
  ]);
});

test(",", () => {
  const state = State.root();

  // identity: ok
  expect(allResults(state.runClause(s(",")))).toEqual([{}]);

  const prog = s(
    ",", //
    s("=", k(123), v("foo")),
    s("=", v("bar"), k(456))
  );
  expect(allResults(state.runClause(prog))).toEqual([{ foo: 123, bar: 456 }]);

  const prog2 = s(
    ",", //
    s("=", k(123), v("foo")),
    s("fail")
  );
  expect(allResults(state.runClause(prog2))).toEqual([]);

  const prog3 = s(
    ",", //
    s("fail"),
    s("=", k(123), v("foo"))
  );
  expect(allResults(state.runClause(prog3))).toEqual([]);
});

test(";", () => {
  const state = State.root();

  // identity: fail
  expect(allResults(state.runClause(s(";")))).toEqual([]);

  const prog = s(
    ";", //
    s("=", k(123), v("foo")),
    s("=", v("foo"), k(456))
  );

  expect(allResults(state.runClause(prog))).toEqual([
    { foo: 123 },
    { foo: 456 },
  ]);

  const prog2 = s(
    ";", //
    s("=", k(123), v("foo")),
    s("fail")
  );

  expect(allResults(state.runClause(prog2))).toEqual([{ foo: 123 }]);
});

test("if_then_else", () => {
  const state = State.root();
  const prog = s(
    "if_then_else",
    s("=", k(123), v("foo")),
    s("=", k(456), v("bar")),
    s("=", k(789), v("bar"))
  );
  expect(allResults(state.runClause(prog))).toEqual([{ foo: 123, bar: 456 }]);

  const prog2 = s(
    "if_then_else",
    s("fail"),
    s("=", k(456), v("bar")),
    s("=", k(789), v("bar"))
  );
  expect(allResults(state.runClause(prog2))).toEqual([{ bar: 789 }]);

  const prog3 = s(
    "if_then_else",
    s("=", k(123), v("foo")),
    s("fail"),
    s("=", k(789), v("bar"))
  );
  expect(allResults(state.runClause(prog3))).toEqual([]);
});

test("type predicates", () => {
  const state = State.root();
  const prog = s(
    ",",
    s("=", v("bar"), k(123)),
    s("=", v("baz"), k("Hello")),
    s("=", v("quux"), s("pair", k(123), k(456))),
    // var
    s("var", v("foo")),
    s("var", s("pair", v("foo"), k(123))),
    s("var", __),
    // nonvar
    s("nonvar", v("bar")),
    s("nonvar", k(456)),
    s("nonvar", s("pair", k(123), k(456))),
    // number
    s("number", v("bar")),
    s("number", k(456)),
    // string
    s("string", v("baz")),
    s("string", k("Goodbye")),
    // struct
    s("struct", v("quux")),
    s("struct", s("pair", __, k(456)))
  );

  // query succeeds
  expect(allResults(state.runClause(prog))).toEqual([
    { bar: 123, baz: "Hello", quux: { id: "pair", args: [123, 456] } },
  ]);
});

test("negation as failure", () => {
  const state = State.root();

  expect(allResults(state.runClause(s("¬", s("fail"))))).toEqual([{}]);
  expect(allResults(state.runClause(s("¬", s("ok"))))).toEqual([]);
});

test("struct_arity", () => {
  const state = State.root();
  const prog = s(
    "struct_arity", //
    s("pair", k(123), __),
    v("arity")
  );
  expect(allResults(state.runClause(prog))).toEqual([{ arity: 2 }]);
});

test("struct_atom_args", () => {
  const state = State.root();
  const prog = s(
    "struct_atom_args", //
    s("pair", k(123), k(456)),
    v("atom"),
    v("args")
  );
  expect(allResults(state.runClause(prog))).toEqual([
    {
      atom: { id: "pair", args: [] },
      args: { id: "", args: [123, 456] },
    },
  ]);

  const prog2 = s(
    "struct_atom_args", //
    v("struct"),
    s("pair"),
    s("", k(123), k(456))
  );

  expect(allResults(state.runClause(prog2))).toEqual([
    {
      struct: { id: "pair", args: [123, 456] },
    },
  ]);
});

test("error handlers", () => {
  const state = State.root();
  const prog = s(
    "try_catch", //
    s("throw", s("error", s("out_of_memory"))),
    s("=", v("foo"), k(123))
  );

  expect(allResults(state.runClause(prog))).toEqual([{ foo: 123 }]);
});
