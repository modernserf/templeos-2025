import { expect, test } from "vitest";
import { k, v, s, State, StateNext, __, Expr, Value } from "./state3";

function allResults(xs: Generator<StateNext>) {
  return Array.from(xs).map((x) => x.state.resolveAll());
}

function runAll(...clauses: Expr[]) {
  const state = State.root();
  return allResults(state.runClause(s(",", ...clauses)));
}

test("unknown rule", () => {
  expect(() => {
    runAll(s("doesNotExist"));
  }).toThrow();
});

test("invalid clause", () => {
  expect(() => {
    runAll(v("id"));
  }).toThrow();
});

test("fail", () => {
  expect(runAll(s("fail"))).toEqual([]);
});

test("ok", () => {
  expect(runAll(s("ok"))).toEqual([{}]);
});

test("=", () => {
  expect(runAll(s("=", k(123), v("foo")))).toEqual([{ foo: 123 }]);
});

test(",", () => {
  // identity: ok
  expect(runAll()).toEqual([{}]);
  expect(runAll(s(","))).toEqual([{}]);

  expect(
    runAll(
      //
      s("=", k(123), v("foo")),
      s("=", v("bar"), k(456))
    )
  ).toEqual([{ foo: 123, bar: 456 }]);

  expect(
    runAll(
      //
      s("=", k(123), v("foo")),
      s("fail")
    )
  ).toEqual([]);

  expect(
    runAll(
      //
      s("fail"),
      s("=", k(123), v("foo"))
    )
  ).toEqual([]);
});

test(";", () => {
  // identity: fail
  expect(runAll(s(";"))).toEqual([]);

  expect(
    runAll(
      s(
        ";", //
        s("=", k(123), v("foo")),
        s("=", v("foo"), k(456))
      )
    )
  ).toEqual([{ foo: 123 }, { foo: 456 }]);

  expect(
    runAll(
      s(
        ";", //
        s("=", k(123), v("foo")),
        s("fail")
      )
    )
  ).toEqual([{ foo: 123 }]);
});

test("if_then_else", () => {
  expect(
    runAll(
      s(
        "if_then_else",
        s("=", k(123), v("foo")),
        s("=", k(456), v("bar")),
        s("=", k(789), v("bar"))
      )
    )
  ).toEqual([{ foo: 123, bar: 456 }]);

  expect(
    runAll(
      s(
        "if_then_else",
        s("fail"),
        s("=", k(456), v("bar")),
        s("=", k(789), v("bar"))
      )
    )
  ).toEqual([{ bar: 789 }]);

  expect(
    runAll(
      s(
        "if_then_else",
        s("=", k(123), v("foo")),
        s("fail"),
        s("=", k(789), v("bar"))
      )
    )
  ).toEqual([]);
});

test("type predicates", () => {
  expect(
    runAll(
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
    )
  ).toEqual([
    { bar: 123, baz: "Hello", quux: { id: "pair", args: [123, 456] } },
  ]);
});

test("negation as failure", () => {
  expect(runAll(s("¬", s("fail")))).toEqual([{}]);
  expect(runAll(s("¬", s("ok")))).toEqual([]);
});

test("struct_arity", () => {
  expect(
    runAll(
      //
      s("struct_arity", s("pair", k(123), __), v("arity"))
    )
  ).toEqual([{ arity: 2 }]);
});

test("struct_atom_args", () => {
  expect(
    runAll(
      s("struct_atom_args", s("pair", k(123), k(456)), v("atom"), v("args"))
    )
  ).toEqual([
    {
      atom: { id: "pair", args: [] },
      args: { id: "", args: [123, 456] },
    },
  ]);

  expect(
    runAll(s("struct_atom_args", v("struct"), s("pair"), s("", k(123), k(456))))
  ).toEqual([
    {
      struct: { id: "pair", args: [123, 456] },
    },
  ]);
});

test("struct_atom_index_arg", () => {
  // get
  expect(
    runAll(
      s(
        "struct_atom_index_arg",
        s("pair", k(123), k(456)),
        __,
        k(0),
        v("value")
      )
    )
  ).toEqual([{ value: 123 }]);

  // iter
  expect(
    runAll(
      s(
        "struct_atom_index_arg",
        s("pair", k(123), k(456)),
        __,
        v("index"),
        v("value")
      )
    )
  ).toEqual([
    { index: 0, value: 123 },
    { index: 1, value: 456 },
  ]);

  // find
  expect(
    runAll(
      s(
        "struct_atom_index_arg",
        s("pair", k(123), k(456)),
        __,
        v("index"),
        k(456)
      )
    )
  ).toEqual([{ index: 1 }]);
});

test("error handlers", () => {
  expect(
    runAll(
      s(
        "try_catch",
        s("throw", s("error", s("out_of_memory"))),
        s("=", v("foo"), k(123))
      )
    )
  ).toEqual([{ foo: 123 }]);
});

test("list rules", () => {
  expect(runAll(s("empty_list", s("")))).toEqual([{}]);
  expect(runAll(s("empty_list", v("l")))).toEqual([
    { l: { id: "", args: [] } },
  ]);

  expect(
    runAll(
      //
      s("list_iter", s("", k(123), k(456)), v("iter"))
    )
  ).toEqual([
    {
      iter: {
        id: "list_index_len",
        args: [{ id: "", args: [123, 456] }, 0, 2],
      },
    },
  ]);
});

function ll(...xs: Value[]): Value {
  let list: Value = { id: "nil", args: [] };
  for (let i = xs.length - 1; i >= 0; i--) {
    list = { id: "cons", args: [xs[i], list] };
  }
  return list;
}

test("list_list_append", () => {
  expect(
    runAll(
      s(
        "list_list_append",
        s("cons", k(123), s("nil")),
        s("cons", k(456), s("cons", k(789), s("nil"))),
        v("joined")
      )
    )
  ).toEqual([{ joined: ll(123, 456, 789) }]);

  expect(
    runAll(
      s(
        "list_list_append",
        s("cons", k(123), s("nil")),
        v("right"),
        s("cons", k(123), s("cons", k(456), s("cons", k(789), s("nil"))))
      )
    )
  ).toEqual([{ right: ll(456, 789) }]);
});
