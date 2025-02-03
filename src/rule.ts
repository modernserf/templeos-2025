import { Rec } from "./data";
import { l, r, s, v, Expr, __ } from "./expr";
import { Field, f } from "./field";

export const db = {
  update: (tx: Expr, id: Expr, field: Field, value: Expr) =>
    s("tx_update_field_value", tx, id, field, value),
  delete: (tx: Expr, id: Expr, field?: Field, value?: Expr) =>
    s("tx_delete_field_value", tx, id, field ?? __, value ?? __),
  with_tx: (tx: Expr, ...body: Expr[]) => s("with_tx", tx, s(",", ...body)),
};

export const test = {
  ok: (...goal: Expr[]) => s("expect_ok", r(...goal)),
  fail: (...goal: Expr[]) => s("expect_fail", r(...goal)),
  throw: (goal: Expr, error: Expr) => s("expect_throw", goal, error),
  collect: (pattern: Expr, goal: Expr, ...expected: Expr[]) =>
    s("expect_collect", pattern, goal, l(...expected)),
};

export const rules = {
  // test utils
  expect_ok: {
    rule__params: l(v.goal),
    rule__body: s(
      "if_then_else",
      v.goal,
      s("ok"),
      s("throw", s("expected_ok", v.goal))
    ),
  },
  expect_fail: {
    rule__params: l(v.goal),
    rule__body: s(
      "if_then_else",
      v.goal,
      s("throw", s("expected_fail", v.goal)),
      s("ok")
    ),
  },
  expect_throw: {
    rule__params: l(v.goal, v.error),
    rule__body: s(
      "try_error_catch",
      r(v.goal, s("throw", s("expected_throw", v.error))),
      v.error,
      s("ok")
    ),
  },
  expect_eq: {
    rule__params: l(v.received, v.expected),
    rule__body: s(
      "if_then_else",
      r(s("nonvar", v.received), s("=", v.received, v.expected)),
      s("ok"),
      s("throw", s("expected_received", v.expected, v.received))
    ),
  },
  expect_collect: {
    rule__params: l(v.pattern, v.goal, v.expected),
    rule__body: r(
      s("collect", v.pattern, v.goal, v.received),
      s("expect_eq", v.received, v.expected)
    ),
  },

  // type checks
  test__value_type: {
    test__group: "rules",
    rule__params: l(),
    rule__body: r(
      test.ok(s("value_type", __, s("var"))),
      test.ok(s("value_type", v.x, s("var"))),
      test.ok(s("value_type", 123, s("number"))),
      test.ok(s("value_type", "hello", s("string"))),
      test.ok(s("value_type", s("id", 123, "hello"), s("struct"))),
      test.ok(s("value_type", l(__, __), s("struct"))),

      s("=", v.y, 123),
      test.ok(s("value_type", v.y, s("number")))
    ),
  },
  var: {
    rule__params: l(v.item),
    rule__body: s("value_type", v.item, s("var")),
  },
  test__var: {
    test__group: "rules",
    rule__params: l(),
    rule__body: r(
      test.ok(s("var", v.x)),
      test.ok(s("var", __)),
      test.fail(s("var", 123))
    ),
  },
  nonvar: {
    rule__params: l(v.item),
    rule__body: r(
      s("value_type", v.item, v.type), //
      s("/=", v.type, s("var"))
    ),
  },
  test__nonvar: {
    test__group: "rules",
    rule__params: l(),
    rule__body: r(
      test.ok(s("nonvar", 123)),
      test.ok(s("nonvar", l(v.x))),
      test.fail(s("nonvar", __)),
      test.fail(s("nonvar", v.x))
    ),
  },
  string: {
    rule__params: l(v.item),
    rule__body: s("value_type", v.item, s("string")),
  },
  number: {
    rule__params: l(v.item),
    rule__body: s("value_type", v.item, s("number")),
  },
  struct: {
    rule__params: l(v.item),
    rule__body: s("value_type", v.item, s("struct")),
  },
  test__typechecks: {
    test__group: "rules",
    rule__params: l(),
    rule__body: r(
      test.ok(s("string", "hello")),
      test.ok(s("number", 123)),
      test.ok(s("struct", l())),
      test.ok(s("struct", s("atom"))),
      test.fail(s("string", s("atom"))),
      test.fail(s("number", "123")),
      test.fail(s("struct", ""))
    ),
  },
  constrain_type: {
    rule__params: l(v.item, v.type),
    rule__body: s("value_constraint", v.item, s("value_type", v.item, v.type)),
  },
  test__constraints: {
    test__group: "rules",
    rule__params: l(),
    rule__body: r(
      test.ok(r(s("constrain_type", v.x, s("string")), s("=", v.x, "hello"))),
      test.fail(r(s("constrain_type", v.x, s("string")), s("=", v.x, 123))),
      // odd that this fails here but not in the other test
      test.fail(
        s("constrain_type", v.x, s("string")),
        s("constrain_type", v.x, s("number"))
      ),
      test.fail(
        s("constrain_type", v.x, s("number")),
        s("constrain_type", v.x, s("string")),
        s("=", v.x, 1)
      ),
      test.fail(
        s("constrain_type", v.x, s("string")),
        s("constrain_type", v.x, s("number")),
        s("=", v.x, 1)
      ),
      test.fail(
        s("constrain_type", v.x, s("string")),
        s("constrain_type", v.y, s("number")),
        s("=", v.x, v.y),
        s("=", v.y, 1)
      )
    ),
  },
  // structs
  test__struct_arity: {
    test__group: "struct",
    rule__params: l(),
    rule__body: r(
      test.collect(v.len, s("struct_arity", s("pair", 123, __), v.len), 2),
      test.throw(s("struct_arity", "foo", __), s("expected_received", __, __))
    ),
  },
  test__struct_id_args: {
    test__group: "struct",
    rule__params: l(),
    rule__body: r(
      test.collect(
        l(v.id, v.args),
        s("struct_id_args", s("pair", 123, 456), v.id, v.args),
        l("pair", l(123, 456))
      ),
      test.collect(
        v.struct,
        s("struct_id_args", v.struct, "pair", l(123, 456)),
        s("pair", 123, 456)
      )
    ),
  },
  test__struct_id_index_arg: {
    test__group: "struct",
    rule__params: l(),
    rule__body: r(
      // get
      test.collect(
        v.value,
        s("struct_id_index_arg", s("pair", 123, 456), __, 0, v.value),
        123
      ),
      // iter
      test.collect(
        l(v.index, v.value),
        s("struct_id_index_arg", s("pair", 123, 456), __, v.index, v.value),
        l(0, 123),
        l(1, 456)
      ),
      // find
      test.collect(
        v.index,
        s("struct_id_index_arg", s("pair", 123, 456), __, v.index, 456),
        1
      ),
      // unique states
      test.collect(
        v.id,
        s("struct_id_index_arg", s("pair", 123, 456), v.id, __, __),
        "pair"
      )
    ),
  },
  // lists
  test__list_from_to_slice: {
    test__group: "list",
    rule__params: l(),
    rule__body: r(
      // all outputs
      test.collect(
        l(v.from, v.to, v.slice),
        s("list_from_to_slice", l("a", "b", "c"), v.from, v.to, v.slice),
        l(0, 3, l("a", "b", "c"))
      ),
      // subset
      test.collect(
        v.slice,
        s("list_from_to_slice", l("a", "b", "c"), 1, __, v.slice),
        l("b", "c")
      )
    ),
  },
  test__list_list_append: {
    test__group: "list",
    rule__params: l(),
    rule__body: r(
      // concat
      test.collect(
        v.append,
        s("list_list_append", l("a"), l("b", "c"), v.append),
        l("a", "b", "c")
      ),
      // cons
      test.collect(
        l(v.head, v.tail),
        s("list_list_append", l(v.head), v.tail, l("a", "b", "c")),
        l("a", l("b", "c"))
      ),
      // stack
      test.collect(
        l(v.stack, v.pop),
        s("list_list_append", v.stack, l(v.pop), l("a", "b", "c")),
        l(l("a", "b"), "c")
      ),
      // scan
      test.collect(
        v.left,
        s("list_list_append", v.left, __, l("a", "b", "c")),
        l(),
        l("a"),
        l("a", "b"),
        l("a", "b", "c")
      )
    ),
  },

  list_length: {
    rule__params: l(v.list, v.length),
    rule__body: r.or(
      r(s("var", v.list), s("_list_length_gen", l(), v.length, v.list)),
      r(s("nonvar", v.list), s("struct_arity", v.list, v.length))
    ),
  },
  _list_length_gen: {
    rule__params: l(v.list, v.length, v.out),
    rule__body: s(
      "if_then_else",
      s("struct_arity", v.list, v.length),
      s("=", v.list, v.out),
      r(
        s("list_list_append", v.list, l(__), v.next),
        s("_list_length_gen", v.next, v.length, v.out)
      )
    ),
  },
  test__list_length: {
    test__group: "list",
    rule__params: l(),
    rule__body: r(
      test.collect(v.len, s("list_length", l(), v.len), 0),
      test.collect(v.len, s("list_length", l(__), v.len), 1),
      test.collect(v.len, s("list_length", l(1, 2, 3), v.len), 3),

      test.collect(v.list, s("list_length", v.list, 0), l()),
      test.collect(v.list, s("list_length", v.list, 3), l(__, __, __))
    ),
  },
  list_item: {
    rule__params: l(v.list, v.item),
    rule__body: s("struct_id_index_arg", v.list, "", __, v.item),
  },
  test__list_item: {
    test__group: "list",
    rule__params: l(),
    rule__body: r(
      test.ok(s("list_item", l(1, 2, 3), 1)),
      test.fail(s("list_item", l(1, 2, 3), 4)),
      test.fail(s("list_item", l(), __)),
      test.fail(s("list_item", s("tuple", 1, 2, 3), __)),

      test.collect(v.x, s("list_item", l(1, 2, 3), v.x), 1, 2, 3)
    ),
  },

  if_var: {
    file__description: l("if arg is var, run body"),
    rule__params: l(v.arg, v.body),
    rule__body: s("if_then_else", s("var", v.arg), v.body, r()),
  },
  get_default: {
    rule__params: l(v.id, v.field, v.value, v.default),
    rule__body: s(
      "if_then_else",
      s("get_field_value", v.id, v.field, v.value),
      s("ok"),
      s("=", v.value, v.default)
    ),
  },
  tx_insert: {
    file__description: l("insert a property list into the db"),
    rule__params: l(v.tx, v.id, v.params),
    rule__body: r(
      s("struct_id_index_arg", v.params, __, __, v.pair),
      s("struct_id_index_arg", v.pair, v.field, 0, v.value),
      db.update(v.tx, v.id, v.field, v.value)
    ),
  },
  with_tx: {
    rule__params: l(v.tx, v.goal),
    rule__body: r(
      s("tx", v.tx),
      s(
        "if_then_else",
        s("collect", __, v.goal, __),
        s("commit", v.tx),
        s("rollback", v.tx)
      )
    ),
  },
  // event handlers
  on__selectWindow: {
    rule__params: l(v.window),
    rule__body: db.with_tx(
      v.tx,
      db.update(v.tx, "browser", "browser__currentWindow", v.window)
    ),
  },
  on__newWindow: {
    rule__params: l(v.location, v.params),
    rule__body: db.with_tx(v.tx, s("new__window", v.tx, __, v.location, __)),
  },
  on__closeWindow: {
    rule__params: l(v.window),
    rule__body: db.with_tx(v.tx, db.delete(v.tx, v.window)),
  },
  on__push: {
    rule__params: l(v.window, v.location, v.params),
    rule__body: db.with_tx(
      v.tx,
      s("if_var", v.window, s("get_context", "window_id", v.window)),
      f.window__currentHistory(v.window, v.prev),
      s("new__history", v.tx, v.next, v.window, v.location, v.params),
      db.update(v.tx, v.next, "history__back", v.prev),
      db.update(v.tx, v.prev, "history__forward", v.next),
      db.update(v.tx, v.window, "window__currentHistory", v.next)
    ),
  },
  on__back: {
    rule__params: l(v.window),
    rule__body: db.with_tx(
      v.tx,
      f.window__currentHistory(v.window, v.forward),
      f.history__back(v.forward, v.back),
      db.update(v.tx, v.window, "window__currentHistory", v.back),
      db.update(v.tx, v.back, "history__forward", v.forward),
      db.delete(v.tx, v.forward, "history__back")
    ),
  },
  on__forward: {
    rule__params: l(v.window),
    rule__body: db.with_tx(
      v.tx,
      f.window__currentHistory(v.window, v.back),
      f.history__forward(v.back, v.forward),

      db.update(v.tx, v.window, "window__currentHistory", v.forward),
      db.update(v.tx, v.forward, "history__back", v.back),
      db.delete(v.tx, v.back, "history__forward")
    ),
  },
  // constructors
  new__rule: {
    rule__params: l(v.tx, v.id, v.params, v.body),
    rule__body: r(
      db.update(v.tx, v.id, "rule__params", v.params),
      db.update(v.tx, v.id, "rule__body", v.body)
    ),
  },
  new__window: {
    rule__params: l(v.tx, v.window, v.location, v.params),
    rule__body: r(
      s("if_var", v.window, s("id", v.window)),
      s("new__history", v.tx, v.history, v.window, v.location, v.params),
      db.update(v.tx, v.window, "db__schema", "schema__window"),
      db.update(v.tx, v.window, "window__currentHistory", v.history)
    ),
  },
  new__history: {
    rule__params: l(v.tx, v.history, v.window, v.location, v.params),
    rule__body: r(
      s("if_var", v.history, s("id", v.history)),
      s("timestamp", v.ts),
      db.update(v.tx, v.history, "db__schema", "schema__history"),
      db.update(v.tx, v.history, "time__created", v.ts),
      db.update(v.tx, v.history, "history__window", v.window),
      db.update(v.tx, v.history, "history__location", v.location),
      r.or(
        //
        r(s("nonvar", v.params), s("tx_insert", v.tx, v.history, v.params)),
        r()
      )
    ),
  },
} satisfies Record<string, Rec>;
