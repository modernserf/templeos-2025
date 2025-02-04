import { expect, test } from "vitest";
import { State, View } from "./state";
import { Expr, AnyStruct, r, s, v, __ } from "./expr";
import { data } from "./data";
import { f } from "./field";

function runAll(...clauses: Expr[]) {
  const state = State.root(data);
  return Array.from(state.runAll(s(",", ...clauses)));
}

function view(id: string, args: Expr[], children: unknown[] = []) {
  return { tag: "view", id, args, children, callbacks: [] };
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

test("negation as failure", () => {
  expect(runAll(s("¬", s("fail")))).toEqual([{}]);
  expect(runAll(s("¬", s("ok")))).toEqual([]);
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

test("exception handlers", () => {
  expect(
    runAll(
      s(
        "try_error_catch",
        s("throw", s("out_of_memory")),
        __,
        s("=", v.foo, 123)
      )
    )
  ).toEqual([{ foo: 123 }]);

  expect(
    runAll(
      s("try_error_catch", s("throw", s("out_of_memory")), v.error, s("ok"))
    )
  ).toEqual([{ error: s("out_of_memory") }]);
});

function ll(...xs: Expr[]): Expr {
  let list: AnyStruct = s("nil");
  for (let i = xs.length - 1; i >= 0; i--) {
    list = s("cons", xs[i], list);
  }
  return list;
}

test("db get", () => {
  expect(
    runAll(
      s(
        "with_tx",
        v.tx,
        r(
          s("tx_update_field_value", v.tx, "test1", "field1", 123),
          s("tx_update_field_value", v.tx, "test1", "field2", 456),
          s("tx_update_field_value", v.tx, "test2", "field1", 789)
        )
      ),
      s("get_field_value", "test1", "field1", v.val)
    )
  ).toMatchObject([{ val: 123 }]);

  expect(
    runAll(
      s(
        "with_tx",
        v.tx,
        r(
          s("tx_update_field_value", v.tx, "test1", "field1", 123),
          s("tx_update_field_value", v.tx, "test1", "field2", 456),
          s("tx_update_field_value", v.tx, "test2", "field1", 789)
        )
      ),
      s("get_field_value", "test1", v.field, v.val)
    )
  ).toMatchObject([
    { field: "field1", val: 123 },
    { field: "field2", val: 456 },
  ]);

  expect(
    runAll(
      s(
        "with_tx",
        v.tx,
        r(
          s("tx_update_field_value", v.tx, "test1", "field1", 123),
          s("tx_update_field_value", v.tx, "test1", "field2", 456),
          s("tx_update_field_value", v.tx, "test2", "field1", 789)
        )
      ),
      s("get_field_value", v.id, "field1", v.val)
    )
  ).toMatchObject([
    { id: "test1", val: 123 },
    { id: "test2", val: 789 },
  ]);

  expect(
    runAll(
      s(
        "with_tx",
        v.tx,
        r(
          s("tx_update_field_value", v.tx, "test1", "field1", 123),
          s("tx_update_field_value", v.tx, "test1", "field2", 456),
          s("tx_update_field_value", v.tx, "test2", "field1", 789),
          s("tx_delete_field_value", v.tx, "test1", "field1", __)
        )
      ),

      s("get_field_value", "test1", v.field, v.val)
    )
  ).toMatchObject([{ field: "field2", val: 456 }]);

  expect(
    runAll(
      s(
        "with_tx",
        v.tx,
        r(
          s("tx_update_field_value", v.tx, "test1", "field1", 123),
          s("tx_update_field_value", v.tx, "test1", "field2", 456),
          s("tx_update_field_value", v.tx, "test2", "field1", 789)
        )
      ),
      s("get_field_value", v.id, __, __)
    )
  ).toMatchObject([
    ...Object.keys(data).map((id) => ({ id })),
    //
    { id: "test1" },
    { id: "test2" },
  ]);
});

test("db transact", () => {
  expect(
    runAll(
      r.or(
        // setup
        r(
          s(
            "with_tx",
            v.tx,
            s("tx_update_field_value", v.tx, "test1", "field1", 123)
          ),
          s("fail") // suppress results
        ),
        // change
        r(
          s(
            "with_tx",
            v.tx,
            r(
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
  ).toMatchObject([{ value: 456 }]);

  expect(
    runAll(
      s(
        ";",
        // setup
        s(
          ",",
          s(
            "with_tx",
            v.tx,
            s("tx_update_field_value", v.tx, "test1", "field1", 123)
          ),
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
  ).toMatchObject([{ value: 123 }]);
});

test("define rules", () => {
  const define = s(
    "with_tx",
    v.tx,
    r(
      s(
        "new__rule",
        v.tx,
        "cons_cons_append",
        s("", v.left, v.right, v.append),
        r.or(
          // []
          r(s("=", v.left, s("nil")), s("=", v.right, v.append)),
          // [head | tail]
          r(
            s("=", v.left, s("cons", v.head, v.tail)),
            s("=", s("cons", v.head, v.append_tail), v.append),
            s("cons_cons_append", v.tail, v.right, v.append_tail)
          )
        )
      )
    )
  );

  expect(
    runAll(
      define,
      s(
        "cons_cons_append",
        s("cons", 123, s("nil")),
        s("cons", 456, s("cons", 789, s("nil"))),
        v.joined
      )
    )
  ).toMatchObject([{ joined: ll(123, 456, 789) }]);

  expect(
    runAll(
      define,
      s(
        "cons_cons_append",
        s("cons", 123, s("nil")),
        v.right,
        s("cons", 123, s("cons", 456, s("cons", 789, s("nil"))))
      )
    )
  ).toMatchObject([{ right: ll(456, 789) }]);
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
      s("struct_at_value", s("", "Hello", "World"), __, v.x),
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
          s("struct_at_value", s("", "Hello", "World"), __, v.x),
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

test("internal tests", () => {
  expect(
    runAll(
      //
      f.test__group(v.id, v.group),
      s("log", "testing", v.group, v.id),
      s(
        "try_error_catch",
        s("call", v.id),
        v.error,
        r(s("log", v.error), s("throw", v.error))
      )
    )
  ).not.toEqual([]);
});
