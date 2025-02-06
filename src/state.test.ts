import { expect, test } from "vitest";
import { State } from "./state";
import { Expr, AnyStruct, r, s, v, __ } from "./expr";
import { data } from "./data";
import { f } from "./field";

function runAll(...clauses: Expr[]) {
  const state = State.root(data);
  return Array.from(state.runAll(s(",", ...clauses)));
}

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
