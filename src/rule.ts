import { Rec } from "./data";
import { l, r, s, $, Expr, __, fork, eq } from "./expr";
import { Field, f } from "./field";
import { test } from "./test_utils";

export const db = {
  get: (id: Expr, field: Field, value: Expr) =>
    s.get_field_value(id, field, value),
  update: (tx: Expr, id: Expr, field: Field, value: Expr) =>
    s.tx_update_field_value(tx, id, field, value),
  delete: (tx: Expr, id: Expr, field?: Field, value?: Expr) =>
    s.tx_delete_field_value(tx, id, field ?? __, value ?? __),
  with_tx: (tx: Expr, ...body: Expr[]) => s.with_tx(tx, s(",", ...body)),
};

export const rules = {
  test__unknown_rule: {
    test__group: "primitives",
    rule__params: l(),
    rule__body: r(
      test.throw(
        s.doesNotExist(123), //
        s.unknown_rule("doesNotExist"),
      ),
    ),
  },
  test__invalid_clause: {
    test__group: "primitives",
    rule__params: l(),
    rule__body: r(
      test.throw(
        r(1), //
        s.expected_type("struct", 1),
      ),
    ),
  },
  test__not_callable_example: {
    db__schema: "schema__any",
  },
  test__not_callable: {
    test__group: "primitives",
    rule__params: l(),
    rule__body: r(
      test.throw(
        s.test__not_callable_example(),
        s.invalid_rule("test__not_callable_example"),
      ),
    ),
  },
  test__wrong_args: {
    test__group: "primitives",
    rule__params: l(),
    rule__body: r(
      test.throw(s("=", 123), s.expected_received(eq(__, __), s("=", 123))),
    ),
  },
  "%": {
    rule__params: l(),
    rule__rest_params: $.comments,
    rule__body: r(),
  },
  // primitives
  fail: {
    rule__params: l(),
  },
  test__fail: {
    test__group: "primitives",
    rule__params: l(),
    rule__body: r(
      test.fail(s.fail()), //
    ),
  },
  ok: {
    rule__params: l(),
  },
  test__ok: {
    test__group: "primitives",
    rule__params: l(),
    rule__body: r(
      test.ok(s.ok()), //
    ),
  },
  "=": {
    rule__params: l($.left, $.right),
  },
  "test__=": {
    test__group: "primitives",
    rule__params: l(),
    rule__body: r(
      test.ok(eq(1, 1)),
      test.ok(eq(1, __)),
      test.collect(
        l($.left, $.right), //
        eq(l($.left, 456), l(123, $.right)),
        l(123, 456),
      ),
    ),
  },
  "/=": {
    rule__params: l($.left, $.right),
  },
  "test__/=": {
    test__group: "primitives",
    rule__params: l(),
    rule__body: r(
      test.ok(s("/=", 1, 2)),
      test.ok(s("/=", 1, "foo")),
      test.fail(s("/=", 1, 1)),

      test.ok(
        s("/=", 1, $.x), //
      ),
      test.collect(
        $.x,
        r(
          s("/=", 1, $.x), //
          eq($.x, 2),
        ),
        2,
      ),
      test.fail(
        s("/=", 1, $.x), //
        eq($.y, 1),
        eq($.x, $.y),
      ),

      test.ok(
        s("/=", s.foo(1), s.foo($.x)), //
      ),
      test.ok(
        s("/=", s.foo(1), s.foo($.x)), //
        eq($.x, 2),
      ),
      test.fail(
        s("/=", s.foo(1), s.foo($.x)), //
        eq($.x, 1),
      ),
    ),
  },
  ",": {
    rule__params: l(),
    rule__rest_params: $.items,
  },
  "test__,": {
    test__group: "primitives",
    rule__params: l(),
    rule__body: r(
      test.ok(r()), //
      test.ok(r(s.ok())),
      test.fail(r(s.ok(), s.fail())),

      test.fail(
        r(
          eq($.x, 1), //
          eq($.x, 2),
        ),
      ),
    ),
  },
  ";": {
    rule__params: l(),
    rule__rest_params: $.items,
  },
  "test__;": {
    test__group: "primitives",
    rule__params: l(),
    rule__body: r(
      test.fail(s(";")), //
      test.ok(s(";", s.ok())),
      test.ok(s(";", s.ok(), s.fail())),

      test.collect(
        $.x,
        s(
          ";",
          eq($.x, 1), //
          eq($.x, 2),
        ),
        1,
        2,
      ),
    ),
  },
  "¬": {
    rule__params: l($.goal),
  },
  "test__¬": {
    test__group: "primitives",
    rule__params: l(),
    rule__body: r(
      test.fail(s("¬", s.ok())), //
      test.ok(s("¬", s.fail())),
    ),
  },
  if_then_else: {
    rule__params: l($.if, $.then, $.else),
  },
  test__if_then_else: {
    test__group: "primitives",
    rule__params: l(),
    rule__body: r(
      test.collect(
        $.result,
        s.if_then_else(s.ok(), eq($.result, 123), eq($.result, 456)),
        123,
      ),
      test.collect(
        $.result,
        s.if_then_else(s.fail(), eq($.result, 123), eq($.result, 456)),
        456,
      ),
      test.collect(
        $.result,
        s.if_then_else(
          s.ok(),
          fork(eq($.result, 123), eq($.result, 789)),
          eq($.result, 456),
        ),
        123,
        789,
      ),
      test.collect(
        $.result,
        s.if_then_else(
          s.list_item(l(123, 789), $.item),
          eq($.result, s.item($.item)),
          eq($.result, 456),
        ),
        s.item(123),
        s.item(789),
      ),
      test.collect(
        $.result,
        s.if_then_else(
          s.list_item(l(), $.item),
          eq($.result, s.item($.item)),
          eq($.result, s.empty()),
        ),
        s.empty(),
      ),
    ),
  },
  call: {
    rule__params: l($.id),
    rule__rest_params: $.args,
  },
  test__call: {
    test__group: "primitives",
    rule__params: l(),
    rule__body: r(
      test.collect(
        $.result, //
        s.call("=", 123, $.result),
        123,
      ),
    ),
  },
  throw: {
    rule__params: l($.error),
  },
  test__throw: {
    test__group: "primitives",
    rule__params: l(),
    rule__body: r(
      test.throw(
        s.throw(s.foo(123)), //
        s.foo(123),
      ),
    ),
  },
  try_error_catch: {
    rule__params: l($.try, $.error, $.catch),
  },
  test__try_error_catch: {
    test__group: "primitives",
    rule__params: l(),
    rule__body: r(
      test.collect(
        $.result,
        s.try_error_catch(
          //
          s.throw(s.foo(123)),
          s.foo($.arg),
          eq($.result, $.arg),
        ),
        123,
      ),

      test.throw(
        s.try_error_catch(
          //
          s.throw(s.foo(123)),
          s.bar($.arg),
          eq($.result, $.arg),
        ),
        s.foo(123),
      ),
    ),
  },

  test__db: {
    test__group: "db",
    rule__params: l(),
    rule__body: r(
      s.id($.id),
      test.db(
        $.tx,
        db.update($.tx, $.id, "test__field" as Field, 123),

        s.get_field_value($.id, "test__field", $.value),
        test.eq($.value, 123),
      ),
      test.fail(s.get_field_value($.id, "test__field", $.value)),
    ),
  },

  // type checks
  test__value_type: {
    test__group: "rules",
    rule__params: l(),
    rule__body: r(
      test.ok(s.value_type(__, s.var())),
      test.ok(s.value_type($.x, s.var())),
      test.ok(s.value_type(123, s.number())),
      test.ok(s.value_type("hello", s.string())),
      test.ok(s.value_type(s.id(123, "hello"), s.struct())),
      test.ok(s.value_type(l(__, __), s.struct())),

      eq($.y, 123),
      test.ok(s.value_type($.y, s.number())),
    ),
  },
  var: {
    rule__params: l($.item),
    rule__body: s.value_type($.item, s.var()),
  },
  test__var: {
    test__group: "rules",
    rule__params: l(),
    rule__body: r(
      test.ok(s.var($.x)),
      test.ok(s.var(__)),
      test.fail(s.var(123)),
    ),
  },
  nonvar: {
    rule__params: l($.item),
    rule__body: r(
      s.value_type($.item, $.type), //
      s("/=", $.type, s.var()),
    ),
  },
  test__nonvar: {
    test__group: "rules",
    rule__params: l(),
    rule__body: r(
      test.ok(s.nonvar(123)),
      test.ok(s.nonvar(l($.x))),
      test.fail(s.nonvar(__)),
      test.fail(s.nonvar($.x)),
    ),
  },
  string: {
    rule__params: l($.item),
    rule__body: s.value_type($.item, s.string()),
  },
  number: {
    rule__params: l($.item),
    rule__body: s.value_type($.item, s.number()),
  },
  struct: {
    rule__params: l($.item),
    rule__body: s.value_type($.item, s.struct()),
  },
  test__typechecks: {
    test__group: "rules",
    rule__params: l(),
    rule__body: r(
      test.ok(s.string("hello")),
      test.ok(s.number(123)),
      test.ok(s.struct(l())),
      test.ok(s.struct(s.atom())),
      test.fail(s.string(s.atom())),
      test.fail(s.number("123")),
      test.fail(s.struct("")),
    ),
  },
  constrain_type: {
    rule__params: l($.item, $.type),
    rule__body: s.value_constraint($.item, s.value_type($.item, $.type)),
  },
  test__constraints: {
    test__group: "rules",
    rule__params: l(),
    rule__body: r(
      test.ok(r(s.constrain_type($.x, s.string()), eq($.x, "hello"))),
      test.fail(r(s.constrain_type($.x, s.string()), eq($.x, 123))),
      // odd that this fails here but not in the other test
      test.fail(
        s.constrain_type($.x, s.string()),
        s.constrain_type($.x, s.number()),
      ),
      test.fail(
        s.constrain_type($.x, s.number()),
        s.constrain_type($.x, s.string()),
        eq($.x, 1),
      ),
      test.fail(
        s.constrain_type($.x, s.string()),
        s.constrain_type($.x, s.number()),
        eq($.x, 1),
      ),
      test.fail(
        s.constrain_type($.x, s.string()),
        s.constrain_type($.y, s.number()),
        eq($.x, $.y),
        eq($.y, 1),
      ),
    ),
  },
  value_expr: {
    rule__params: l($.value, $.expr),
    rule__body: r(
      s.value_type($.value, $.type),
      s.match_cond(
        $.type,
        l(s.var(), r(s.var_name($.value, $.name), eq($.expr, s.var($.name)))),
        l(s.number(), eq($.expr, s.number($.value))),
        l(s.string(), eq($.expr, s.string($.value))),
        l(
          s.struct(),
          r(
            s.struct_tag_list($.value, $.tag, $.list),
            eq($.expr, s.struct($.tag, $.list)),
          ),
        ),
      ),
    ),
  },

  // structs
  test__struct_arity: {
    test__group: "struct",
    rule__params: l(),
    rule__body: r(
      test.collect($.len, s.struct_arity(s.pair(123, __), $.len), 2),
      test.throw(s.struct_arity("foo", __), s.expected_type("struct", __)),
    ),
  },
  test__struct_id_args: {
    test__group: "struct",
    rule__params: l(),
    rule__body: r(
      test.collect(
        l($.id, $.args),
        s.struct_tag_list(s.pair(123, 456), $.id, $.args),
        l("pair", l(123, 456)),
      ),
      test.collect(
        $.struct,
        s.struct_tag_list($.struct, "pair", l(123, 456)),
        s.pair(123, 456),
      ),
    ),
  },
  test__struct_at_value: {
    test__group: "struct",
    rule__params: l(),
    rule__body: r(
      // get
      test.collect(
        $.value,
        s.struct_at_value(s.pair(123, 456), 0, $.value),
        123,
      ),
      s.set_context("trace_enabled", l()),
      // iter
      test.collect(
        l($.index, $.value),
        s.struct_at_value(s.pair(123, 456), $.index, $.value),
        l(0, 123),
        l(1, 456),
      ),
      // find
      test.collect(
        $.index,
        s.struct_at_value(s.pair(123, 456), $.index, 456),
        1,
      ),
      // unique states
      // test.collect($.id, s.struct_at_value(s.pair(123, 456), __, __), "pair"),
    ),
  },
  test__struct_at_value_updated: {
    test__group: "struct",
    rule__params: l(),
    rule__body: r(
      test.collect(
        $.value,
        s.struct_at_value_updated(s.foo("a", "b"), 0, 123, $.value),
        s.foo(123, "b"),
      ),
    ),
  },
  // lists
  test__list_from_to_slice: {
    test__group: "list",
    rule__params: l(),
    rule__body: r(
      // all outputs
      test.collect(
        l($.from, $.to, $.slice),
        s.list_from_to_slice(l("a", "b", "c"), $.from, $.to, $.slice),
        l(0, 3, l("a", "b", "c")),
      ),
      // subset
      test.collect(
        $.slice,
        s.list_from_to_slice(l("a", "b", "c"), 1, __, $.slice),
        l("b", "c"),
      ),
    ),
  },
  test__list_list_append: {
    test__group: "list",
    rule__params: l(),
    rule__body: r(
      // concat
      test.collect(
        $.append,
        s.list_list_append(l("a"), l("b", "c"), $.append),
        l("a", "b", "c"),
      ),
      // cons
      test.collect(
        l($.head, $.tail),
        s.list_list_append(l($.head), $.tail, l("a", "b", "c")),
        l("a", l("b", "c")),
      ),
      // stack
      test.collect(
        l($.stack, $.pop),
        s.list_list_append($.stack, l($.pop), l("a", "b", "c")),
        l(l("a", "b"), "c"),
      ),
      // scan
      test.collect(
        $.left,
        s.list_list_append($.left, __, l("a", "b", "c")),
        l(),
        l("a"),
        l("a", "b"),
        l("a", "b", "c"),
      ),
    ),
  },

  list_length: {
    rule__params: l($.list, $.length),
    rule__body: s.if_then_else(
      s.var($.list),
      s._list_length_gen(l(), $.length, $.list),
      s.struct_arity($.list, $.length),
    ),
  },
  _list_length_gen: {
    rule__params: l($.list, $.length, $.out),
    rule__body: s.if_then_else(
      s.struct_arity($.list, $.length),
      eq($.list, $.out),
      r(
        s.list_list_append($.list, l(__), $.next),
        s._list_length_gen($.next, $.length, $.out),
      ),
    ),
  },
  test__list_length: {
    test__group: "list",
    rule__params: l(),
    rule__body: r(
      test.collect($.len, s.list_length(l(), $.len), 0),
      test.collect($.len, s.list_length(l(__), $.len), 1),
      test.collect($.len, s.list_length(l(1, 2, 3), $.len), 3),

      test.collect($.list, s.list_length($.list, 0), l()),
      test.collect($.list, s.list_length($.list, 3), l(__, __, __)),
    ),
  },
  test__list_item: {
    test__group: "list",
    rule__params: l(),
    rule__body: r(
      test.ok(s.list_item(l(1, 2, 3), 1)),
      test.fail(s.list_item(l(1, 2, 3), 4)),
      test.fail(s.list_item(l(), __)),
      test.fail(s.list_item(s.tuple(1, 2, 3), __)),

      test.collect($.x, s.list_item(l(1, 2, 3), $.x), 1, 2, 3),

      eq($.plist, l(s.foo(123), s.bar(456))),
      test.collect(
        $.value, //
        s.list_item($.plist, s.foo($.value)),
        123,
      ),
    ),
  },
  list_at_removed_splice: {
    rule__params: l($.list, $.at, $.removed, $.splice),
    rule__body: r(
      // if at is not provided, scan across list for match on removed
      s.list_length($.list, $.len),
      s.number_min_max($.at, 0, $.len),

      s.list_from_to_slice($.list, __, $.at, $.prefix),
      s.list_from_to_slice($.list, $.at, __, $.rest),
      s.list_list_append($.removed, $.suffix, $.rest),
      s.list_list_append($.prefix, $.suffix, $.splice),
    ),
  },
  test__list_at_removed_splice: {
    test__group: "list",
    rule__params: l(),
    rule__body: r(
      test.collect(
        l($.removed, $.splice),
        s.list_at_removed_splice(l(1, 2, 3), 1, l($.removed), $.splice),
        l(2, l(1, 3)),
      ),

      test.collect(
        l($.first, $.second, $.splice),
        s.list_at_removed_splice(
          l(1, 2, 3, 4, 5),
          1,
          l($.first, $.second),
          $.splice,
        ),
        l(2, 3, l(1, 4, 5)),
      ),

      test.collect(
        $.splice,
        s.list_at_removed_splice(l(1, 2, 3, 4, 5), __, l(3, 4), $.splice),
        l(1, 2, 5),
      ),
      test.collect(
        l($.l, $.r),
        s.list_at_removed_splice(l(1, 2, 3, 4, 5), __, l($.l, $.r), __),
        l(1, 2),
        l(2, 3),
        l(3, 4),
        l(4, 5),
      ),

      test.collect(
        l($.removed, $.splice),
        s.list_at_removed_splice(l(1, 2, 3, 4, 5), 2, $.removed, $.splice),
        l(l(), l(1, 2, 3, 4, 5)),
        l(l(3), l(1, 2, 4, 5)),
        l(l(3, 4), l(1, 2, 5)),
        l(l(3, 4, 5), l(1, 2)),
      ),

      test.collect(
        l($.at, $.removed),
        s.list_at_removed_splice(l(1, 2, 3, 4, 5), $.at, $.removed, l(1, 2, 5)),
        l(2, $(3, 4)),
      ),
    ),
  },
  list_rule_mapped: {
    rule__params: l($.list, $.rule, $.mapped),
    rule__body: s.collect(
      $.out,
      r(s.list_item($.list, $.item), s.call($.rule, $.item, $.out)),
      $.mapped,
    ),
  },
  apply: {
    file__description: l("run a rule with a list of params"),
    rule__params: l($.id),
    rule__rest_params: $.param_lists,
    rule__body: r(
      s.collect(
        $.param,
        r(
          s.list_item($.param_lists, $.param_list),
          s.list_item($.param_list, $.param),
        ),
        $.params,
      ),
      s.struct_tag_list($.call, $.id, $.params),
      $.call,
    ),
  },
  cond: {
    file__description: l("pattern match on a list of (if, then) pairs"),
    rule__params: l(l($.if, $.then)),
    rule__rest_params: $.else,
    rule__body: s.if_then_else(
      $.if,
      $.then,
      s.if_then_else(eq($.else, l()), s.fail(), s.apply("cond", $.else)),
    ),
  },
  test__cond: {
    test__group: "rules",
    rule__params: l(),
    rule__body: r(
      test.collect(
        $.result,
        s.cond(
          l(eq(123, 456), eq($.result, "foo")),
          l(eq(456, 456), eq($.result, "bar")),
          l(s.ok(), eq($.result, "baz")),
        ),
        "bar",
      ),
      test.collect(
        $.result,
        s.cond(
          l(eq(123, 789), eq($.result, "foo")),
          l(eq(456, 789), eq($.result, "bar")),
          l(s.ok(), eq($.result, "baz")),
        ),
        "baz",
      ),
      test.fail(
        s.cond(
          l(eq(123, 789), eq($.result, "foo")),
          l(eq(456, 789), eq($.result, "bar")),
        ),
      ),
    ),
  },
  nonempty: {
    rule__params: l($.list),
    rule__body: s("/=", $.list, l()),
  },
  match: {
    rule__params: l($.pattern, $.match),
    rule__rest_params: $.rest,
    rule__body: s.if_then_else(
      eq($.pattern, $.match),
      s.ok(),
      r(s.nonempty($.rest), s.apply("match", l($.pattern), $.rest)),
    ),
  },
  match_cond: {
    rule__params: l($.pattern, l($.match, $.then)),
    rule__rest_params: $.rest,
    rule__body: s.if_then_else(
      eq($.pattern, $.match),
      $.then,
      r(s.nonempty($.rest), s.apply("match_cond", l($.pattern), $.rest)),
    ),
  },
  test__match: {
    test__group: "rules",
    rule__params: l(),
    rule__body: r(
      test.collect(
        $.result,
        s.match(s.foo($.result), s.foo(123), s.bar(456)),
        123,
      ),
      test.collect(
        $.result,
        s.match(s.bar($.result), s.foo(123), s.bar(456)),
        456,
      ),
      test.fail(s.match(s.baz($.result), s.foo(123), s.bar(456))),
    ),
  },
  test__match_cond: {
    test__group: "rules",
    rule__params: l(),
    rule__body: r(
      test.collect(
        $.result,
        s.match_cond(
          s.foo($.pat),
          l(s.foo(123), eq($.result, l($.pat))),
          l(s.bar(456), eq($.result, l($.pat, $.pat))),
          l(__, eq($.result, l())),
        ),
        l(123),
      ),

      test.collect(
        $.result,
        s.match_cond(
          s.bar($.pat),
          l(s.foo(123), eq($.result, l($.pat))),
          l(s.bar(456), eq($.result, l($.pat, $.pat))),
          l(__, eq($.result, l())),
        ),
        l(456, 456),
      ),

      test.collect(
        $.result,
        s.match_cond(
          s.baz($.pat),
          l(s.foo(123), eq($.result, l($.pat))),
          l(s.bar(456), eq($.result, l($.pat, $.pat))),
          l(__, eq($.result, "ok")),
        ),
        "ok",
      ),

      test.fail(
        s.match_cond(
          s.baz($.pat),
          l(s.foo(123), eq($.result, l($.pat))),
          l(s.bar(456), eq($.result, l($.pat, $.pat))),
        ),
      ),
    ),
  },
  first: {
    rule__params: l(),
    rule__rest_params: $.rest,
    rule__body: r(s.struct_tag_list($.body, ";", $.rest), s.limit(1, $.body)),
  },
  if_var: {
    file__description: l("if arg is var, run body"),
    rule__params: l($.arg, $.body),
    rule__body: s.if_then_else(s.var($.arg), $.body, r()),
  },
  get_default: {
    rule__params: l($.id, $.field, $.value, $.default),
    rule__body: s.if_then_else(
      s.get_field_value($.id, $.field, $.value),
      s.ok(),
      eq($.value, $.default),
    ),
  },
  params_default_match: {
    rule__params: l($.params, $.default, $.match),
    rule__body: s.if_then_else(
      s.list_item($.params, $.match),
      s.ok(),
      eq($.default, $.match),
    ),
  },
  location_id_view_params: {
    rule__params: l($.location, $.id, $.view, $.params),
    rule__body: r(
      s.nonvar($.location),
      s.match(
        $.location,
        s.location($.id),
        s.location($.id, $.view),
        s.location($.id, $.view, $.params),
      ),
      s.if_var($.params, eq($.params, l())),
    ),
  },
  with_tx: {
    rule__params: l($.tx, $.goal),
    rule__body: r(
      s.tx($.tx),
      s.if_then_else(
        s.collect(__, $.goal, __),
        s.commit($.tx),
        s.rollback($.tx),
      ),
    ),
  },
  _struct_push: {
    rule__params: l($.struct, $.added, $.updated),
    rule__body: r(
      s.struct_tag_list($.struct, $.tag, $.list),
      s.list_list_append($.list, l($.added), $.next_list),
      s.struct_tag_list($.updated, $.tag, $.next_list),
    ),
  },
  _add_field: {
    rule__params: l($.id, $.field),
    rule__body: db.with_tx(
      $.tx,
      f.db__type($.field, $.field_type),
      s.get_default($.field_type, "db__default_value", $.default_value, l()),
      db.update($.tx, $.id, $.field, $.default_value),
    ),
  },
  each_item_do: {
    file__description: l(
      "for each item in collection, run do block but discard results (e.g. for side effects). succeed if collection is empty.",
    ),
    rule__params: l($.collection, $.item, $.do),
    rule__body: s.if_then_else(
      eq($.collection, l()),
      s.ok(),
      s.collect(__, r(s.list_item($.collection, $.item), $.do), __),
    ),
  },
  collect_empty: {
    rule__params: l($.pattern, $.goal, $.result),
    rule__body: s.if_then_else(
      s.collect($.pattern, $.goal, $.result),
      s.ok(),
      eq($.result, l()),
    ),
  },
  // view helpers
  // utilities
  rule__location_view: {
    rule__params: l($.location, $.view),
    rule__body: fork(
      // location for view type
      r(
        s.nonvar($.view),
        f.view__schema($.view, $.schema),
        f.db__schema($.location, $.schema),
      ),
      // view for location type
      r(
        s.nonvar($.location),
        f.db__schema($.location, $.schema),
        f.view__schema($.view, $.schema),
      ),
      // view for any type
      f.view__schema($.view, "schema__any"),
    ),
  },
  // event handlers
  on__selectWindow: {
    rule__params: l($.window),
    rule__body: db.with_tx(
      $.tx,
      db.update($.tx, "browser", "browser__currentWindow", $.window),
    ),
  },
  on__newWindow: {
    rule__params: l($.location),
    rule__body: db.with_tx($.tx, s.new__window($.tx, __, $.location)),
  },
  on__closeWindow: {
    rule__params: l($.window),
    rule__body: db.with_tx($.tx, db.delete($.tx, $.window)),
  },
  on__push: {
    rule__params: l($.window, $.location),
    rule__body: db.with_tx(
      $.tx,
      f.window__currentHistory($.window, $.prev),
      s.new__history($.tx, $.next, $.window, $.location),
      db.update($.tx, $.next, "history__back", $.prev),
      db.update($.tx, $.prev, "history__forward", $.next),
      db.update($.tx, $.window, "window__currentHistory", $.next),
    ),
  },

  on__back: {
    rule__params: l($.window),
    rule__body: db.with_tx(
      $.tx,
      f.window__currentHistory($.window, $.forward),
      f.history__back($.forward, $.back),
      db.update($.tx, $.window, "window__currentHistory", $.back),
      db.update($.tx, $.back, "history__forward", $.forward),
      db.delete($.tx, $.forward, "history__back"),
    ),
  },
  on__forward: {
    rule__params: l($.window),
    rule__body: db.with_tx(
      $.tx,
      f.window__currentHistory($.window, $.back),
      f.history__forward($.back, $.forward),

      db.update($.tx, $.window, "window__currentHistory", $.forward),
      db.update($.tx, $.forward, "history__back", $.back),
      db.delete($.tx, $.back, "history__forward"),
    ),
  },

  // constructors
  new__default: {
    rule__params: l($.tx, $.id, $.schema),
    rule__body: r(
      s.if_var($.id, s.id($.id)),
      db.update($.tx, $.id, "db__schema", $.schema),
      f.db__fields($.schema, $.fields),
      s.each_item_do(
        $.fields,
        s.field($.field),
        r(
          f.db__type($.field, $.field_type),
          s.get_default(
            $.field_type,
            "db__default_value",
            $.default_value,
            l(),
          ),
          db.update($.tx, $.id, $.field, $.default_value),
        ),
      ),
    ),
  },

  new__rule: {
    rule__params: l($.tx, $.id, $.params, $.body),
    rule__body: r(
      db.update($.tx, $.id, "rule__params", $.params),
      db.update($.tx, $.id, "rule__body", $.body),
    ),
  },
  new__window: {
    rule__params: l($.tx, $.window, $.location),
    rule__body: r(
      s.if_var($.window, s.id($.window)),
      s.new__history($.tx, $.history, $.window, $.location),
      db.update($.tx, $.window, "db__schema", "schema__window"),
      db.update($.tx, $.window, "window__currentHistory", $.history),
    ),
  },
  new__history: {
    rule__params: l($.tx, $.history, $.window, $.location),
    rule__body: r(
      s.if_var($.history, s.id($.history)),
      s.timestamp($.ts),
      s.location_id_view_params($.location, $.id, $.view, $.params),
      db.update($.tx, $.history, "db__schema", "schema__history"),
      db.update($.tx, $.history, "time__created", $.ts),
      db.update($.tx, $.history, "history__window", $.window),
      db.update($.tx, $.history, "history__location", $.id),
      s.if_then_else(
        s.nonvar($.view),
        db.update($.tx, $.history, "history__view", $.view),
        r(),
      ),
      s.each_item_do(
        $.params,
        s.param($.param_field, $.param_value),
        db.update($.tx, $.history, $.param_field, $.param_value),
      ),
    ),
  },
} satisfies Record<string, Rec>;
