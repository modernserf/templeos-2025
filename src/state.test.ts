import { expect, test } from "vitest";
import { State } from "./state";
import { Expr, AnyStruct, r, s, $, __ } from "./expr";
import { data } from "./data";

function runAll(...clauses: Expr[]) {
  const state = State.root(data);
  return Array.from(state.runAll(s("do", ...clauses)));
}

function ll(...xs: Expr[]): Expr {
  let list: AnyStruct = s.nil();
  for (let i = xs.length - 1; i >= 0; i--) {
    list = s.cons(xs[i], list);
  }
  return list;
}

test("db get", () => {
  expect(
    runAll(
      s.with_tx(
        $.tx,
        r(
          s.tx_update_field_value($.tx, "test1", "field1", 123),
          s.tx_update_field_value($.tx, "test1", "field2", 456),
          s.tx_update_field_value($.tx, "test2", "field1", 789),
        ),
      ),
      s.get_field_value("test1", "field1", $.val),
    ),
  ).toMatchObject([{ val: 123 }]);

  expect(
    runAll(
      s.with_tx(
        $.tx,
        r(
          s.tx_update_field_value($.tx, "test1", "field1", 123),
          s.tx_update_field_value($.tx, "test1", "field2", 456),
          s.tx_update_field_value($.tx, "test2", "field1", 789),
        ),
      ),
      s.get_field_value("test1", $.field, $.val),
    ),
  ).toMatchObject([
    { field: "field1", val: 123 },
    { field: "field2", val: 456 },
  ]);

  expect(
    runAll(
      s.with_tx(
        $.tx,
        r(
          s.tx_update_field_value($.tx, "test1", "field1", 123),
          s.tx_update_field_value($.tx, "test1", "field2", 456),
          s.tx_update_field_value($.tx, "test2", "field1", 789),
        ),
      ),
      s.get_field_value($.id, "field1", $.val),
    ),
  ).toMatchObject([
    { id: "test1", val: 123 },
    { id: "test2", val: 789 },
  ]);

  expect(
    runAll(
      s.with_tx(
        $.tx,
        r(
          s.tx_update_field_value($.tx, "test1", "field1", 123),
          s.tx_update_field_value($.tx, "test1", "field2", 456),
          s.tx_update_field_value($.tx, "test2", "field1", 789),
          s.tx_delete_field_value($.tx, "test1", "field1", __),
        ),
      ),

      s.get_field_value("test1", $.field, $.val),
    ),
  ).toMatchObject([{ field: "field2", val: 456 }]);

  // expect(
  //   runAll(
  //     s.with_tx(
  //       $.tx,
  //       r(
  //         s.tx_update_field_value($.tx, "test1", "field1", 123),
  //         s.tx_update_field_value($.tx, "test1", "field2", 456),
  //         s.tx_update_field_value($.tx, "test2", "field1", 789),
  //       ),
  //     ),
  //     s.get_field_value($.id, __, __),
  //   ),
  // ).toMatchObject([
  //   ...Object.keys(data).map((id) => ({ id })),
  //     //   { id: "test1" },
  //   { id: "test2" },
  // ]);
});

test("db transact", () => {
  expect(
    runAll(
      s.fork(
        // setup
        r(
          s.with_tx(
            $.tx,
            s.tx_update_field_value($.tx, "test1", "field1", 123),
          ),
          s.fail(), // suppress results
        ),
        // change
        r(
          s.with_tx(
            $.tx,
            r(
              s.tx_update_field_value($.tx, "test1", "field1", 456),
              // tx succeeds
            ),
          ),
          s.fail(), // suppress results (but keep tx committed)
        ),

        // verify
        s.get_field_value("test1", "field1", $.value),
      ),
    ),
  ).toMatchObject([{ value: 456 }]);

  expect(
    runAll(
      s(
        "fork",
        // setup
        s(
          "do",
          s.with_tx(
            $.tx,
            s.tx_update_field_value($.tx, "test1", "field1", 123),
          ),
          s.fail(), // suppress results
        ),
        // change
        s(
          "do",
          s.with_tx(
            $.tx,
            s(
              "do",
              s.tx_update_field_value($.tx, "test1", "field1", 456),
              s.fail(), // tx fails
            ),
          ),
          s.fail(), // suppress results (but keep tx committed)
        ),

        // verify
        s.get_field_value("test1", "field1", $.value),
      ),
    ),
  ).toMatchObject([{ value: 123 }]);
});

test("define rules", () => {
  const define = s.with_tx(
    $.tx,
    r(
      s.new__rule(
        $.tx,
        "cons_cons_append",
        s("", $.left, $.right, $.append),
        s.fork(
          // []
          r(s("=", $.left, s.nil()), s("=", $.right, $.append)),
          // [head | tail]
          r(
            s("=", $.left, s.cons($.head, $.tail)),
            s("=", s.cons($.head, $.append_tail), $.append),
            s.cons_cons_append($.tail, $.right, $.append_tail),
          ),
        ),
      ),
    ),
  );

  expect(
    runAll(
      define,
      s.cons_cons_append(
        s.cons(123, s.nil()),
        s.cons(456, s.cons(789, s.nil())),
        $.joined,
      ),
    ),
  ).toMatchObject([{ joined: ll(123, 456, 789) }]);

  expect(
    runAll(
      define,
      s.cons_cons_append(
        s.cons(123, s.nil()),
        $.right,
        s.cons(123, s.cons(456, s.cons(789, s.nil()))),
      ),
    ),
  ).toMatchObject([{ right: ll(456, 789) }]);
});

test("internal tests", () => {
  expect(
    runAll(
      s.test__group($.id, $.group),
      s.log("testing", $.group, $.id),
      s.try_error_catch(
        s.call($.id),
        $.error,
        r(s.log($.error), s.throw($.error)),
      ),
    ),
  ).not.toEqual([]);
});
