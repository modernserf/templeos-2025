import { expect, test } from "vitest";
import { State, View } from "./state";
import { Expr, AnyStruct, s, v, __ } from "./expr";
import { data } from "./data";

function runAll(...clauses: Expr[]) {
  const state = State.root(data);
  return Array.from(state.runAll(s(",", ...clauses)));
}

function view(id: string, args: Expr[], children?: unknown[]) {
  return { tag: "view", id, args, children };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stripState(view: View): any {
  return {
    ...view,
    state: undefined,
    children: view.children?.map(stripState),
  };
}

function renderAll(...clauses: Expr[]) {
  const state = State.root(data);
  return Array.from(state.render(s(",", ...clauses))).map(stripState);
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

test("constraints", () => {
  expect(
    runAll(
      s("string", v.x) //
    )
  ).toEqual([{}]);

  expect(
    runAll(
      s("string", v.x), //
      s("=", v.x, "hello")
    )
  ).toEqual([{ x: "hello" }]);

  expect(
    runAll(
      s("string", v.x), //
      s("=", "hello", v.x)
    )
  ).toEqual([{ x: "hello" }]);

  expect(
    runAll(
      s("string", v.x), //
      s("=", v.x, 1)
    )
  ).toEqual([]);

  expect(
    runAll(
      s("string", v.x), //
      s("=", 1, v.x)
    )
  ).toEqual([]);

  expect(
    runAll(
      s("string", v.x), //
      s("=", v.x, v.y),
      s("=", v.y, "hello")
    )
  ).toEqual([{ x: "hello", y: "hello" }]);
});

test("conflicting constraints", () => {
  expect(
    runAll(
      //
      s("string", v.x),
      s("number", v.x)
    )
  ).toEqual([{}]);
  expect(
    runAll(
      //
      s("number", v.x),
      s("string", v.x),
      s("=", v.x, 1)
    )
  ).toEqual([]);

  expect(
    runAll(
      //
      s("string", v.x),
      s("number", v.x),
      s("=", v.x, 1)
    )
  ).toEqual([]);

  expect(
    runAll(
      //
      s("string", v.x),
      s("number", v.y),
      s("=", v.x, v.y),
      s("=", v.y, 1)
    )
  ).toEqual([]);
});

test("/=", () => {
  expect(runAll(s("/=", 1, 2))).toEqual([{}]);
  expect(runAll(s("/=", 1, "foo"))).toEqual([{}]);
  expect(runAll(s("/=", 1, 1))).toEqual([]);

  expect(
    runAll(
      //
      s("/=", 1, v.x)
    )
  ).toEqual([{}]);

  expect(
    runAll(
      //
      s("/=", 1, v.x),
      s("=", v.x, 2)
    )
  ).toEqual([{ x: 2 }]);

  expect(
    runAll(
      //
      s("/=", 1, v.x),
      s("=", v.x, 1)
    )
  ).toEqual([]);

  expect(
    runAll(
      //
      s("/=", 1, v.x),
      s("=", v.y, 1),
      s("=", v.x, v.y)
    )
  ).toEqual([]);

  expect(
    runAll(
      //
      s("/=", s("foo", 1), s("foo", v.x))
    )
  ).toEqual([{}]);

  expect(
    runAll(
      //
      s("/=", s("foo", 1), s("foo", v.x)),
      s("=", v.x, 2)
    )
  ).toEqual([{ x: 2 }]);

  expect(
    runAll(
      //
      s("/=", s("foo", 1), s("foo", v.x)),
      s("=", v.x, 1)
    )
  ).toEqual([]);
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

test("list_from_to_slice", () => {
  // all outputs
  expect(
    runAll(s("list_from_to_slice", s("", "a", "b", "c"), v.from, v.to, v.slice))
  ).toEqual([{ from: 0, to: 3, slice: s("", "a", "b", "c") }]);
  // subset
  expect(
    runAll(s("list_from_to_slice", s("", "a", "b", "c"), 1, __, v.slice))
  ).toEqual([{ slice: s("", "b", "c") }]);
});

test("list_list_append", () => {
  // concat
  expect(
    runAll(s("list_list_append", s("", "a"), s("", "b", "c"), v.append))
  ).toEqual([{ append: s("", "a", "b", "c") }]);
  // cons
  expect(
    runAll(s("list_list_append", s("", v.head), v.tail, s("", "a", "b", "c")))
  ).toEqual([{ head: "a", tail: s("", "b", "c") }]);
  // stack
  expect(
    runAll(s("list_list_append", v.stack, s("", v.pop), s("", "a", "b", "c")))
  ).toEqual([{ stack: s("", "a", "b"), pop: "c" }]);
  // scan
  expect(
    runAll(s("list_list_append", v.left, __, s("", "a", "b", "c")))
  ).toEqual([
    //
    { left: s("") },
    { left: s("", "a") },
    { left: s("", "a", "b") },
    { left: s("", "a", "b", "c") },
  ]);
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

test("cons_cons_append", () => {
  expect(
    runAll(
      s(
        "cons_cons_append",
        s("cons", 123, s("nil")),
        s("cons", 456, s("cons", 789, s("nil"))),
        v.joined
      )
    )
  ).toEqual([{ joined: ll(123, 456, 789) }]);

  expect(
    runAll(
      s(
        "cons_cons_append",
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

test("views", () => {
  // sequence
  expect(
    renderAll(
      //
      s("view", s("text", "Hello")),
      s("view", s("text", "World"))
    )
  ).toEqual([
    //
    view("text", ["Hello"]),
    view("text", ["World"]),
  ]);

  // iteration
  expect(
    renderAll(
      //
      s("struct_id_index_arg", s("", "Hello", "World"), __, __, v.x),
      s("view", s("text", v.x))
    )
  ).toEqual([
    //
    view("text", ["Hello"]),
    view("text", ["World"]),
  ]);

  // backtracking;
  expect(
    renderAll(
      s(
        ";", //
        s(
          ",", //
          s("view", s("text", "Hello")),
          s("fail")
        ),
        s(
          ",", //
          s("view", s("text", "World")),
          s("ok")
        )
      )
    )
  ).toEqual([
    //
    view("text", ["World"]),
  ]);

  // // children
  expect(
    renderAll(
      //
      s(
        "view_children",
        s("row"),
        s(
          ",",
          s("struct_id_index_arg", s("", "Hello", "World"), __, __, v.x),
          s("view", s("text", v.x))
        )
      )
    )
  ).toEqual([
    view(
      "row",
      [],
      [
        //
        view("text", ["Hello"]),
        view("text", ["World"]),
      ]
    ),
  ]);
});
