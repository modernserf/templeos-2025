import { expect, test } from "vitest";
import { v, s, State, StateNext, __, Expr, AnyStruct } from "./state3";
import { data } from "./data3";

function allResults(xs: Generator<StateNext>) {
  return Array.from(xs).map((x) => x.state.resolveAll());
}

function runAll(...clauses: Expr[]) {
  const state = State.root(data);
  return allResults(state.run(s(",", ...clauses)));
}

test("unknown rule", () => {
  expect(() => {
    runAll(s("doesNotExist"));
  }).toThrow();
});

test("invalid clause", () => {
  expect(() => {
    runAll(v.id);
  }).toThrow();
});

test("fail", () => {
  expect(runAll(s("fail"))).toEqual([]);
});

test("ok", () => {
  expect(runAll(s("ok"))).toEqual([{}]);
});

test("=", () => {
  expect(runAll(s("=", 123, v.foo))).toEqual([{ foo: 123 }]);
});

test(",", () => {
  // identity: ok
  expect(runAll()).toEqual([{}]);
  expect(runAll(s(","))).toEqual([{}]);

  expect(
    runAll(
      //
      s("=", 123, v.foo),
      s("=", v.bar, 456)
    )
  ).toEqual([{ foo: 123, bar: 456 }]);

  expect(
    runAll(
      //
      s("=", 123, v.foo),
      s("fail")
    )
  ).toEqual([]);

  expect(
    runAll(
      //
      s("fail"),
      s("=", 123, v.foo)
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
        s("=", 123, v.foo),
        s("=", v.foo, 456)
      )
    )
  ).toEqual([{ foo: 123 }, { foo: 456 }]);

  expect(
    runAll(
      s(
        ";", //
        s("=", 123, v.foo),
        s("fail")
      )
    )
  ).toEqual([{ foo: 123 }]);

  // coalesce states
  expect(
    runAll(
      s(
        //
        ";",
        s("ok"),
        s("ok"),
        s("ok")
      )
    )
  ).toEqual([{}]);
});

test("if_then_else", () => {
  expect(
    runAll(
      s(
        "if_then_else",
        s("=", 123, v.foo),
        s("=", 456, v.bar),
        s("=", 789, v.bar)
      )
    )
  ).toEqual([{ foo: 123, bar: 456 }]);

  expect(
    runAll(s("if_then_else", s("fail"), s("=", 456, v.bar), s("=", 789, v.bar)))
  ).toEqual([{ bar: 789 }]);

  expect(
    runAll(s("if_then_else", s("=", 123, v.foo), s("fail"), s("=", 789, v.bar)))
  ).toEqual([]);
});

test("type predicates", () => {
  expect(
    runAll(
      s("=", v.bar, 123),
      s("=", v.baz, "Hello"),
      s("=", v.quux, s("pair", 123, 456)),
      // var
      s("var", v.foo),
      s("var", __),
      // nonvar
      s("nonvar", v.bar),
      s("nonvar", 456),
      s("nonvar", s("pair", 123, 456)),
      s("nonvar", s("pair", __, 123)),
      // number
      s("number", v.bar),
      s("number", 456),
      // string
      s("string", v.baz),
      s("string", "Goodbye"),
      // struct
      s("struct", v.quux),
      s("struct", s("pair", __, 456))
    )
  ).toEqual([
    {
      foo: undefined,
      bar: 123,
      baz: "Hello",
      quux: s("pair", 123, 456),
    },
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
      s("struct_arity", s("pair", 123, __), v.arity)
    )
  ).toEqual([{ arity: 2 }]);
});

test("struct_id_args", () => {
  expect(
    runAll(s("struct_id_args", s("pair", 123, 456), v.id, v.args))
  ).toEqual([
    {
      id: "pair",
      args: s("", 123, 456),
    },
  ]);

  expect(
    runAll(s("struct_id_args", v.struct, "pair", s("", 123, 456)))
  ).toEqual([
    {
      struct: s("pair", 123, 456),
    },
  ]);
});

test("struct_id_index_arg", () => {
  // get
  expect(
    runAll(s("struct_id_index_arg", s("pair", 123, 456), __, 0, v.value))
  ).toEqual([{ value: 123 }]);

  // iter
  expect(
    runAll(s("struct_id_index_arg", s("pair", 123, 456), __, v.index, v.value))
  ).toEqual([
    { index: 0, value: 123 },
    { index: 1, value: 456 },
  ]);

  // find
  expect(
    runAll(s("struct_id_index_arg", s("pair", 123, 456), __, v.index, 456))
  ).toEqual([{ index: 1 }]);

  // coalesce duplicate states
  expect(
    runAll(
      s(
        //
        "struct_id_index_arg",
        s("pair", 123, 456),
        v.id,
        __,
        __
      )
    )
  ).toEqual([{ id: "pair" }]);
});

test("error handlers", () => {
  expect(
    runAll(
      s(
        "try_catch",
        s("throw", s("error", s("out_of_memory"))),
        s("=", v.foo, 123)
      )
    )
  ).toEqual([{ foo: 123 }]);
});

function ll(...xs: Expr[]): Expr {
  let list: AnyStruct = s("nil");
  for (let i = xs.length - 1; i >= 0; i--) {
    list = s("cons", xs[i], list);
  }
  return list;
}

test("list_list_append", () => {
  expect(
    runAll(
      s(
        "list_list_append",
        s("cons", 123, s("nil")),
        s("cons", 456, s("cons", 789, s("nil"))),
        v.joined
      )
    )
  ).toEqual([{ joined: ll(123, 456, 789) }]);

  expect(
    runAll(
      s(
        "list_list_append",
        s("cons", 123, s("nil")),
        v.right,
        s("cons", 123, s("cons", 456, s("cons", 789, s("nil"))))
      )
    )
  ).toEqual([{ right: ll(456, 789) }]);
});

test("db get", () => {
  expect(
    runAll(
      s("update_field_value", "test1", "field1", 123),
      s("update_field_value", "test1", "field2", 456),
      s("update_field_value", "test2", "field1", 789),

      s("get_field_value", "test1", "field1", v.val)
    )
  ).toEqual([{ val: 123 }]);

  expect(
    runAll(
      s("update_field_value", "test1", "field1", 123),
      s("update_field_value", "test1", "field2", 456),
      s("update_field_value", "test2", "field1", 789),

      s("get_field_value", "test1", v.field, v.val)
    )
  ).toEqual([
    { field: "field1", val: 123 },
    { field: "field2", val: 456 },
  ]);

  expect(
    runAll(
      s("update_field_value", "test1", "field1", 123),
      s("update_field_value", "test1", "field2", 456),
      s("update_field_value", "test2", "field1", 789),

      s("get_field_value", v.id, "field1", v.val)
    )
  ).toEqual([
    { id: "test1", val: 123 },
    { id: "test2", val: 789 },
  ]);

  expect(
    runAll(
      s("update_field_value", "test1", "field1", 123),
      s("update_field_value", "test1", "field2", 456),
      s("update_field_value", "test2", "field1", 789),

      s("delete_field_value", "test1", "field1", __),

      s("get_field_value", "test1", v.field, v.val)
    )
  ).toEqual([{ field: "field2", val: 456 }]);

  expect(
    runAll(
      s("update_field_value", "test1", "field1", 123),
      s("update_field_value", "test1", "field2", 456),
      s("update_field_value", "test2", "field1", 789),

      s("get_field_value", v.id, __, __)
    )
  ).toEqual([
    ...Object.keys(data).map((id) => ({ id })),
    //
    { id: "test1" },
    { id: "test2" },
  ]);
});

test("db transact", () => {
  expect(
    runAll(
      s(
        ";",
        // setup
        s(
          ",",
          s("update_field_value", "test1", "field1", 123),
          s("fail") // suppress results
        ),
        // change
        s(
          ",",
          s(
            "with_tx",
            v.tx,
            s(
              ",",
              s("tx_update_field_value", v.tx, "test1", "field1", 456)
              // tx succeeds
            )
          ),
          s("fail") // suppress results (but keep tx committed)
        ),

        // verify
        s("get_field_value", "test1", "field1", v.value)
      )
    )
  ).toEqual([{ value: 456 }]);

  expect(
    runAll(
      s(
        ";",
        // setup
        s(
          ",",
          s("update_field_value", "test1", "field1", 123),
          s("fail") // suppress results
        ),
        // change
        s(
          ",",
          s(
            "with_tx",
            v.tx,
            s(
              ",",
              s("tx_update_field_value", v.tx, "test1", "field1", 456),
              s("fail") // tx fails
            )
          ),
          s("fail") // suppress results (but keep tx committed)
        ),

        // verify
        s("get_field_value", "test1", "field1", v.value)
      )
    )
  ).toEqual([{ value: 123 }]);
});
