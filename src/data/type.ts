import { l, s, $, __, u, seq, fn, alt, x } from "../expr";
import { pkg } from "../pkg";

export const typeRecs = pkg("type", {
  type: {
    db__schema: "schema",
    schema__fields: l(s.field("rule__params"), s.field_optional("_hierarchy")),
  },
  _hierarchy: {
    db__schema: "field",
    file__name: "Type Hierarchy",
    field__type: s.list_of(
      s.tuple(s._option(s._type()), s._option(s._type()), s.goal()),
    ),
  },
  any_type: {
    db__schema: "type",
    rule__params: l(__),
    rule__body: s.ok(),
    _hierarchy: l(l(__, s.any_type(), s.ok())),
  },
  no_type: {
    db__schema: "type",
    rule__params: l(__),
    rule__body: s.fail(),
    _hierarchy: l(l(s.no_type(), __, s.ok())),
  },
  const: {
    db__schema: "type",
    rule__params: l($.value, $.const),
    rule__body: u($.value, $.const),
    _hierarchy: l(
      l(s.const($.val), s.string(), s.string($.val)),
      l(s.const($.val), s.number(), s.number($.val)),
    ),
  },
  string: {
    db__schema: "type",
    rule__params: l($.value),
    rule__body: s.type_value(s.string(), $.value),
  },
  number: {
    db__schema: "type",
    rule__params: l($.value),
    rule__body: s.type_value(s.number(), $.value),
  },
  pid: {
    rule__params: l($.t),
    rule__body: s._union($.t, s.string(), s.number()),
  },
  // where does this fit into type hierarchy?
  var: {
    db__schema: "type",
    rule__params: l($.value),
    rule__body: s.type_value(s.var(), $.value),
  },
  nonvar: {
    rule__params: l($.item),
    rule__body: s.not_equal(x.type_value($.item), s.var()),
  },
  _box: {
    db__schema: "type",
    rule__params: l($.value, $.tag_type, $.tuple_types, $.rest_type),
    rule__body: seq(
      s.box($.value, $.tag, $.vals),
      s._check($.tag, $.tag_type),

      s.length_box($.tuple_len, $.tuple_types),
      s.length_box($.val_len, $.vals),
      s.gt_eq($.val_len, $.tuple_len),

      s.cond(
        s.empty($.vals),
        s.every(
          s.value_box_index($.v, $.vals, $.i),
          seq(
            s.value_box_index_default($.t, $.tuple_types, $.i, $.rest_type),
            s._check($.v, $.t),
          ),
        ),
      ),
    ),
    _hierarchy: l(
      l(
        s._box($.ltag, $.largs, $.lrest),
        s._box($.rtag, $.rargs, $.rrest),
        seq(
          s.subtype($.ltag, $.rtag),
          s.length_box($.llen, $.largs),
          s.length_box($.rlen, $.rargs),
          s.max($.len, $.llen, $.rlen),
          s.every(
            s.number_min_max($.i, 0, $.len),
            seq(
              s.value_box_index_default($.l, $.largs, $.i, $.lrest),
              s.value_box_index_default($.r, $.rargs, $.i, $.rrest),
              s.subtype($.l, $.r),
            ),
          ),
        ),
      ),
    ),
  },
  any_box: {
    rule__params: l(s._box(s.string(), l(), s.any_type())),
  },
  is_box: {
    rule__params: l($.value),
    rule__body: s.type_value(s.box(), $.value),
  },
  list_of: {
    rule__params: l(s._box(s.const(""), l(), $.t), $.t),
  },
  tuple: {
    rule__params: $.params,
    rule__body: seq(
      s.params_rest($.params, l($.t), $.tuple),
      u($.t, s._box(s.const(""), $.tuple, s.none())),
    ),
  },
  _test_tuple: {
    test__group: "type",
    rule__params: l(),

    rule__body: seq(
      s.expect_ok(
        s._check(
          l("foo", "bar", 123),
          s.tuple(s.string(), s.any_type(), s.number()),
        ),
      ),
    ),
  },
  _intersection: {
    db__schema: "type",
    rule__params: l($.value, $.left, $.right),
    rule__body: seq(s._check($.value, $.left), s._check($.value, $.right)),
    _hierarchy: l(
      l(
        s._intersection($.l, $.r),
        $.t,
        s.cond(s.subtype($.l, $.t), s.subtype($.r, $.t)),
      ),
      l(
        $.t,
        s._intersection($.l, $.r),
        seq(s.subtype($.t, $.l), s.subtype($.t, $.r)),
      ),
    ),
  },
  _union: {
    db__schema: "type",
    rule__params: l($.value, $.left, $.right),
    rule__body: s.cond(s._check($.value, $.left), s._check($.value, $.right)),
    _hierarchy: l(
      l(s._union($.l, $.r), $.t, seq(s.subtype($.l, $.t), s.subtype($.r, $.t))),
      l(
        $.t,
        s._union($.l, $.r),
        s.cond(s.subtype($.t, $.l), s.subtype($.t, $.r)),
      ),
    ),
  },
  _option: {
    rule__params: l(s._union(s.var(), $.t), $.t),
  },
  _test_option: {
    test__group: "type",
    rule__params: l(),
    rule__body: seq(
      s.expect_eq(x._option(x._type()), s._union(s.var(), s._box(__, __, __))),
    ),
  },

  enum: {
    rule__params: $.params,
    rule__body: seq(
      s.params_rest($.params, l($.t), $.boxes),
      s.map_list(
        $.mapped,
        $.boxes,
        fn(
          s._box(s.const($.tag), $.tuple, s.no_type()),
          $.box,
        )(s.box($.box, $.tag, $.tuple)),
      ),
      s.fold_op($.t, $.mapped, fn(s._union($.l, $.r), $.l, $.r)()),
    ),
  },
  _test_enum: {
    test__group: "type",
    rule__params: l(),
    rule__body: seq(
      s.expect_eq(
        x.enum(s.foo(s.number()), s.bar(s.string(), s.string())),
        s._union(
          s._box(s.const("foo"), l(s.number()), s.no_type()),
          s._box(s.const("bar"), l(s.string(), s.string()), s.no_type()),
        ),
      ),
    ),
  },
  union_enum: {
    rule__params: $.params,
    rule__body: seq(
      s.params_rest($.params, l($.t, $.union), $.boxes),
      s._union($.t, $.union, s.enum($.boxes)),
    ),
  },

  // types that interact with db
  goal: {
    db__schema: "type",
    rule__params: l($.value),
    rule__body: seq(
      s.box($.value, $.tag, $._args),
      s.rule__params(__, $.tag),
      // TODO: typecheck args
    ),
    _hierarchy: l(
      // TODO: check if box is valid goal
      l(s._box(__, __, __), s.goal(), s.ok()),
    ),
  },
  ref: {
    db__schema: "type",
    rule__params: l($.record, $.schema),
    rule__body: s.cond(s.var($.schema), s.db__schema($.schema, $.record)),
    _hierarchy: l(
      l(s.ref(__), s.string(), s.ok()),
      l(s._const($.id), s.ref($.schema), s.ref($.id, $.schema)),
    ),
  },
  _type: {
    rule__params: l($.out),
    // TODO
    rule__body: s.any_box($.out),
  },
  _fn: {
    rule__params: $.params,
    rule__body: seq(
      s.params_rest($.params, l($.t), $._args),
      u(
        $.t,
        s._union(
          s._union(
            // TODO: check fn / goal args
            s._box(
              s.const("fn"),
              l(s.list_of(s.any_type()), s.goal()),
              s.no_type(),
            ),
            s.goal(),
          ),
          s.ref(__),
        ),
      ),
    ),
  },

  _expr: {
    rule__params: l($.type, $.expr),
    rule__body: seq(
      s.box($.expr, $.id, __),
      s.if_then_else(
        s.db__schema("type", $.id),
        u($.type, $.expr),
        s.call($.expr, $.type),
      ),
    ),
  },
  _check: {
    rule__params: l($.value, $.expr),
    rule__body: seq(s._expr($.type, $.expr), s.call($.type, $.value)),
  },
  _test_check: {
    test__group: "type",
    rule__params: l(),
    rule__body: seq(
      s.expect_ok(s._check(1, s.number())),
      s.expect_ok(s._check(1, s.any_type())),
      s.expect_fail(s._check(1, s.string())),
      s.expect_fail(s._check(1, s.no_type())),

      s.expect_ok(s._check("foo", s.const("foo"))),
      s.expect_fail(s._check("foo", s.const("bar"))),

      s.expect_ok(s._check(s.foo(), s._box(s.const("foo"), l(), s.none()))),
      s.expect_ok(s._check(s.foo(), s.enum(s.foo()))),
      s.expect_ok(s._check(s.foo(), x.any_box())),
      s.expect_fail(s._check(s.foo(), s.enum(s.bar()))),
      s.expect_fail(s._check(s.foo(), s.enum(s.foo(s.any_type())))),
      s.expect_fail(s._check(s.foo(1), s.enum(s.foo()))),

      s.expect_ok(s._check(l(1, 2, 3), s.list_of(s.number()))),

      s.expect_ok(
        s._check(l("foo", 1), s.list_of(s._union(s.string(), s.number()))),
      ),
      s.expect_fail(
        s._check(
          l(s.foo(), s.bar()),
          s.list_of(s._union(s.string(), s.number())),
        ),
      ),
      s.expect_ok(
        s._check(
          l("foo", 1),
          s._intersection(
            s.tuple(s.string(), s.any_type()),
            s.tuple(s.any_type(), s.number()),
          ),
        ),
      ),
      s.expect_fail(
        s._check(
          l("foo", "bar"),
          s._intersection(
            s.tuple(s.string(), s.any_type()),
            s.tuple(s.any_type(), s.number()),
          ),
        ),
      ),
    ),
  },
  subtype: {
    rule__params: l($.sub, $.super),
    rule__body: s.limit(
      1,
      alt(
        u($.sub, $.super),
        seq(
          s.box($.sub, $.sub_id, __),
          s._hierarchy($.rows, $.sub_id),
          s(l($.sub, $.super, $.goal)).in($.rows),
          $.goal,
        ),
        seq(
          s.box($.super, $.super_id, __),
          s._hierarchy($.rows, $.super_id),
          s(l($.sub, $.super, $.goal)).in($.rows),
          $.goal,
        ),
      ),
    ),
  },

  _test_subtype: {
    test__group: "type",
    rule__params: l(),
    rule__body: seq(
      s.expect_ok(s.subtype(s.number(), s.number())),
      s.expect_ok(s.subtype(s.number(), s.any_type())),
      s.expect_fail(s.subtype(s.number(), s.string())),
    ),
  },
});
