import { Rec } from "./data";
import { l, r, s, v, Expr, __, Struct } from "./expr";
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
    s("expect_collect", pattern, goal, ...expected),
  view: (goal: Expr, ...expected: Expr[]) =>
    s("expect_view", goal, ...expected),
};

export const cond = (...pairs: Struct<"", [Expr, Expr]>[]) =>
  s("cond", ...pairs);

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
    rule__params: l(v.pattern, v.goal),
    rule__rest_params: v.expected,
    rule__body: s(
      "if_then_else",
      s("collect", v.pattern, v.goal, v.received),
      s("expect_eq", v.received, v.expected),
      s("throw", s("expected_received", v.expected, l()))
    ),
  },
  expect_view: {
    rule__params: l(v.goal),
    rule__rest_params: v.expected,
    rule__body: s(
      "if_then_else",
      s("collect_view", v.goal, v.received),
      s("expect_eq", v.received, v.expected),
      s("throw", s("expected_received", v.expected, l()))
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
        s("struct_tag_list", s("pair", 123, 456), v.id, v.args),
        l("pair", l(123, 456))
      ),
      test.collect(
        v.struct,
        s("struct_tag_list", v.struct, "pair", l(123, 456)),
        s("pair", 123, 456)
      )
    ),
  },
  test__struct_at_value: {
    test__group: "struct",
    rule__params: l(),
    rule__body: r(
      // get
      test.collect(
        v.value,
        s("struct_at_value", s("pair", 123, 456), 0, v.value),
        123
      ),
      s("set_context", "trace_enabled", l()),
      // iter
      test.collect(
        l(v.index, v.value),
        s("struct_at_value", s("pair", 123, 456), v.index, v.value),
        l(0, 123),
        l(1, 456)
      ),
      // find
      test.collect(
        v.index,
        s("struct_at_value", s("pair", 123, 456), v.index, 456),
        1
      ),
      // unique states
      test.collect(
        v.id,
        s("struct_at_value", s("pair", 123, 456), __, __),
        "pair"
      )
    ),
  },
  test__struct_at_value_updated: {
    test__group: "struct",
    rule__params: l(),
    rule__body: r(
      test.collect(
        v.value,
        s("struct_at_value_updated", s("foo", "a", "b"), 0, 123, v.value),
        s("foo", 123, "b")
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
    rule__body: s(
      "if_then_else",
      s("var", v.list),
      s("_list_length_gen", l(), v.length, v.list),
      s("struct_arity", v.list, v.length)
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
    rule__body: r(
      s("struct_tag_list", v.list, "", __),
      s("struct_at_value", v.list, __, v.item)
    ),
  },
  test__list_item: {
    test__group: "list",
    rule__params: l(),
    rule__body: r(
      test.ok(s("list_item", l(1, 2, 3), 1)),
      test.fail(s("list_item", l(1, 2, 3), 4)),
      test.fail(s("list_item", l(), __)),
      test.fail(s("list_item", s("tuple", 1, 2, 3), __)),

      test.collect(v.x, s("list_item", l(1, 2, 3), v.x), 1, 2, 3),

      s("=", v.plist, l(s("foo", 123), s("bar", 456))),
      test.collect(
        v.value, //
        s("list_item", v.plist, s("foo", v.value)),
        123
      )
    ),
  },
  list_at_removed_splice: {
    rule__params: l(v.list, v.at, v.removed, v.splice),
    rule__body: r(
      // if at is not provided, scan across list for match on removed
      s("list_length", v.list, v.len),
      s("number_min_max", v.at, 0, v.len),

      s("list_from_to_slice", v.list, __, v.at, v.prefix),
      s("list_from_to_slice", v.list, v.at, __, v.rest),
      s("list_list_append", v.removed, v.suffix, v.rest),
      s("list_list_append", v.prefix, v.suffix, v.splice)
    ),
  },
  test__list_at_removed_splice: {
    test__group: "list",
    rule__params: l(),
    rule__body: r(
      test.collect(
        l(v.removed, v.splice),
        s("list_at_removed_splice", l(1, 2, 3), 1, l(v.removed), v.splice),
        l(2, l(1, 3))
      ),

      test.collect(
        l(v.first, v.second, v.splice),
        s(
          "list_at_removed_splice",
          l(1, 2, 3, 4, 5),
          1,
          l(v.first, v.second),
          v.splice
        ),
        l(2, 3, l(1, 4, 5))
      ),

      test.collect(
        v.splice,
        s("list_at_removed_splice", l(1, 2, 3, 4, 5), __, l(3, 4), v.splice),
        l(1, 2, 5)
      ),
      test.collect(
        l(v.l, v.r),
        s("list_at_removed_splice", l(1, 2, 3, 4, 5), __, l(v.l, v.r), __),
        l(1, 2),
        l(2, 3),
        l(3, 4),
        l(4, 5)
      ),

      test.collect(
        l(v.removed, v.splice),
        s("list_at_removed_splice", l(1, 2, 3, 4, 5), 2, v.removed, v.splice),
        l(l(), l(1, 2, 3, 4, 5)),
        l(l(3), l(1, 2, 4, 5)),
        l(l(3, 4), l(1, 2, 5)),
        l(l(3, 4, 5), l(1, 2))
      ),

      test.collect(
        l(v.at, v.removed),
        s(
          "list_at_removed_splice",
          l(1, 2, 3, 4, 5),
          v.at,
          v.removed,
          l(1, 2, 5)
        ),
        l(2, v(3, 4))
      )
    ),
  },
  apply: {
    file__description: l("run a rule with a list of params"),
    rule__params: l(v.id),
    rule__rest_params: v.param_lists,
    rule__body: r(
      s(
        "collect",
        v.param,
        r(
          s("list_item", v.param_lists, v.param_list),
          s("list_item", v.param_list, v.param)
        ),
        v.params
      ),
      s("struct_tag_list", v.call, v.id, v.params),
      v.call
    ),
  },
  cond: {
    file__description: l("pattern match on a list of (if, then) pairs"),
    rule__params: l(l(v.if, v.then)),
    rule__rest_params: v.else,
    rule__body: s(
      "if_then_else",
      v.if,
      v.then,
      s(
        "if_then_else",
        s("=", v.else, l()),
        s("fail"),
        s("apply", "cond", v.else)
      )
    ),
  },
  test__cond: {
    test__group: "rules",
    rule__params: l(),
    rule__body: r(
      test.collect(
        v.result,
        cond(
          l(s("=", 123, 456), s("=", v.result, "foo")),
          l(s("=", 456, 456), s("=", v.result, "bar")),
          l(s("ok"), s("=", v.result, "baz"))
        ),
        "bar"
      ),
      test.collect(
        v.result,
        cond(
          l(s("=", 123, 789), s("=", v.result, "foo")),
          l(s("=", 456, 789), s("=", v.result, "bar")),
          l(s("ok"), s("=", v.result, "baz"))
        ),
        "baz"
      ),
      test.fail(
        cond(
          l(s("=", 123, 789), s("=", v.result, "foo")),
          l(s("=", 456, 789), s("=", v.result, "bar"))
        )
      )
    ),
  },
  match: {
    rule__params: l(v.pattern, v.match),
    rule__rest_params: v.rest,
    rule__body: s(
      "if_then_else",
      s("=", v.pattern, v.match),
      s("ok"),
      s(
        "if_then_else",
        s("=", v.rest, l()),
        s("fail"),
        s("apply", "match", l(v.pattern), v.rest)
      )
    ),
  },
  match_cond: {
    rule__params: l(v.pattern, l(v.match, v.then)),
    rule__rest_params: v.rest,
    rule__body: s(
      "if_then_else",
      s("=", v.pattern, v.match),
      v.then,
      r(
        s("list_list_append", l(v.head), v.tail, v.rest),
        s("match_cond", v.pattern, v.head, v.tail)
      )
    ),
  },
  test__match: {
    rule__params: l(),
    rule__body: r(
      test.collect(
        v.result,
        s("match", s("foo", v.result), s("foo", 123), s("bar", 456)),
        123
      ),
      test.collect(
        v.result,
        s("match", s("bar", v.result), s("foo", 123), s("bar", 456)),
        456
      ),
      test.fail(s("match", s("baz", v.result), s("foo", 123), s("bar", 456)))
    ),
  },
  first: {
    rule__params: l(),
    rule__rest_params: v.rest,
    rule__body: r(
      s("struct_tag_list", v.body, ";", v.rest),
      s("limit", 1, v.body)
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
  params_default_match: {
    rule__params: l(v.params, v.default, v.match),
    rule__body: s(
      "if_then_else",
      s("list_item", v.params, v.match),
      s("ok"),
      s("=", v.default, v.match)
    ),
  },
  location_id_view_params: {
    rule__params: l(v.location, v.id, v.view, v.params),
    rule__body: r(
      s("nonvar", v.location),
      s(
        "match",
        v.location,
        s("location", v.id),
        s("location", v.id, v.view),
        s("location", v.id, v.view, v.params)
      ),
      s("if_var", v.params, s("=", v.params, l()))
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
  _struct_push: {
    rule__params: l(v.struct, v.added, v.updated),
    rule__body: r(
      s("struct_tag_list", v.struct, v.tag, v.list),
      s("list_list_append", v.list, l(v.added), v.next_list),
      s("struct_tag_list", v.updated, v.tag, v.next_list)
    ),
  },
  _add_field: {
    rule__params: l(v.id, v.field),
    rule__body: db.with_tx(
      v.tx,
      f.db__type(v.field, v.field_type),
      s("get_default", v.field_type, "db__default_value", v.default_value, l()),
      db.update(v.tx, v.id, v.field, v.default_value)
    ),
  },
  each_item_do: {
    file__description: l(
      "for each item in collection, run do block but discard results (e.g. for side effects). succeed if collection is empty."
    ),
    rule__params: l(v.collection, v.item, v.do),
    rule__body: s(
      "if_then_else",
      s("=", v.collection, l()),
      s("ok"),
      s("collect", __, r(s("list_item", v.collection, v.item), v.do), __)
    ),
  },
  // view helpers
  // utilities
  rule__location_view: {
    rule__params: l(v.location, v.view),
    rule__body: r.or(
      // location for view type
      r(
        s("nonvar", v.view),
        f.view__schema(v.view, v.schema),
        f.db__schema(v.location, v.schema)
      ),
      // view for location type
      r(
        s("nonvar", v.location),
        f.db__schema(v.location, v.schema),
        f.view__schema(v.view, v.schema)
      ),
      // view for any type
      f.view__schema(v.view, "schema__any")
    ),
  },
  rule__field_view: {
    rule__params: l(v.field, v.view),
    rule__body: r.or(
      // f.view__field(v.view, v.field),
      r(
        s("nonvar", v.field),
        f.db__type(v.field, v.type),
        f.view__type(v.view, v.type)
      ),
      r(
        s("nonvar", v.view),
        f.db__type(v.field, v.type),
        f.view__type(v.view, v.type)
      ),
      f.view__type(v.view, "type__any")
    ),
  },
  rule__type_view: {
    rule__params: l(v.type, v.view),
    rule__body: r.or(
      f.view__type(v.view, v.type),
      f.view__type(v.view, "type__any")
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
    rule__params: l(v.location),
    rule__body: db.with_tx(v.tx, s("new__window", v.tx, __, v.location)),
  },
  on__closeWindow: {
    rule__params: l(v.window),
    rule__body: db.with_tx(v.tx, db.delete(v.tx, v.window)),
  },
  on__push: {
    rule__params: l(v.window, v.location),
    rule__body: db.with_tx(
      v.tx,
      f.window__currentHistory(v.window, v.prev),
      s("new__history", v.tx, v.next, v.window, v.location),
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
  new__default: {
    rule__params: l(v.tx, v.id, v.schema),
    rule__body: r(
      s("if_var", v.id, s("id", v.id)),
      db.update(v.tx, v.id, "db__schema", v.schema),
      f.db__fields(v.schema, v.fields),
      s(
        "each_item_do",
        v.fields,
        s("field", v.field),
        r(
          f.db__type(v.field, v.field_type),
          s(
            "get_default",
            v.field_type,
            "db__default_value",
            v.default_value,
            l()
          ),
          db.update(v.tx, v.id, v.field, v.default_value)
        )
      )
    ),
  },

  new__rule: {
    rule__params: l(v.tx, v.id, v.params, v.body),
    rule__body: r(
      db.update(v.tx, v.id, "rule__params", v.params),
      db.update(v.tx, v.id, "rule__body", v.body)
    ),
  },
  new__window: {
    rule__params: l(v.tx, v.window, v.location),
    rule__body: r(
      s("if_var", v.window, s("id", v.window)),
      s("new__history", v.tx, v.history, v.window, v.location),
      db.update(v.tx, v.window, "db__schema", "schema__window"),
      db.update(v.tx, v.window, "window__currentHistory", v.history)
    ),
  },
  new__history: {
    rule__params: l(v.tx, v.history, v.window, v.location),
    rule__body: r(
      s("if_var", v.history, s("id", v.history)),
      s("timestamp", v.ts),
      s("location_id_view_params", v.location, v.id, v.view, v.params),
      db.update(v.tx, v.history, "db__schema", "schema__history"),
      db.update(v.tx, v.history, "time__created", v.ts),
      db.update(v.tx, v.history, "history__window", v.window),
      db.update(v.tx, v.history, "history__location", v.id),
      s(
        "if_then_else",
        s("nonvar", v.view),
        db.update(v.tx, v.history, "history__view", v.view),
        r()
      ),
      s(
        "each_item_do",
        v.params,
        s("param", v.param_field, v.param_value),
        db.update(v.tx, v.history, v.param_field, v.param_value)
      )
    ),
  },
} satisfies Record<string, Rec>;
