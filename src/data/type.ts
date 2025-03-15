import { l, s, $, __, u, seq, fn, f } from "../expr";
import { pkg } from "../pkg";

export const typeRecs = pkg("type", {
  type: {
    db__schema: "schema",
    schema__fields: l(
      s.field("rule__params"),
      s.field_optional("_super_sub"),
      s.field_optional("_sub_super"),
    ),
  },
  _super_sub: {
    db__schema: "field",
    file__name: "Subtype of",
    field__type: s.any_box(),
  },
  _sub_super: {
    db__schema: "field",
    file__name: "Subtype of",
    field__type: s.any_box(),
  },

  // type values are partially applied check fns

  _t_const: {
    db__schema: "type",
    rule__params: l($.value, $.const),
    rule__body: u($.value, $.const),
    _super_sub: fn($.super, $.self)(u($.super, s._t_string())),
  },
  _t_string: {
    db__schema: "type",
    rule__params: l($.value),
    rule__body: s.type_value(s.string(), $.value),
  },
  _t_number: {
    db__schema: "type",
    rule__params: l($.value),
    rule__body: s.type_value(s.number(), $.value),
  },
  _t_var: {
    db__schema: "type",
    rule__params: l($.value),
    rule__body: s.type_value(s.var(), $.value),
  },
  _t_box: {
    db__schema: "type",
    rule__params: l($.value, $.tag_type, $.tuple_types, $.rest_type),
    rule__body: seq(
      s.box_tag_list($.value, $.tag, $.vals),
      s.call($.tag_type, $.tag),

      s.length_box($.tuple_len, $.tuple_types),
      s.length_box($.val_len, $.vals),
      s.gt_eq($.val_len, $.tuple_len),

      s.cond(
        s.empty($.vals),
        s.every(
          s.value_box_index($.v, $.vals, $.i),
          seq(
            s.value_box_index_default($.t, $.tuple_types, $.i, $.rest_type),
            s.call($.t, $.v),
          ),
        ),
      ),
    ),
    _super_sub: fn($.super, s.box($.ltag, $.largs, $.lrest))(
      u(s.box($.rtag, $.rargs, $.rrest), $.super),
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
  },
  _t_any: {
    db__schema: "type",
    rule__params: l($.value),
    rule__body: s.ok(),
    _sub_super: fn(__, __)(s.ok()),
  },
  _t_none: {
    db__schema: "type",
    rule__params: l($.value),
    rule__body: s.fail(),
    _super_sub: fn(__, __)(s.ok()),
  },
  _t_and: {
    db__schema: "type",
    rule__params: l($.value, $.left, $.right),
    rule__body: seq(s.call($.left, $.value), s.call($.right, $.value)),
    _super_sub: fn(
      $.t,
      s._t_and($.l, $.r),
    )(s.cond(s.subtype($.l, $.t), s.subtype($.r, $.t))),
    _sub_super: fn(
      $.t,
      s._t_and($.l, $.r),
    )(seq(s.subtype($.t, $.l), s.subtype($.t, $.r))),
  },
  _t_or: {
    db__schema: "type",
    rule__params: l($.value, $.left, $.right),
    rule__body: s.cond(s.call($.left, $.value), s.call($.right, $.value)),
    _sub_super: fn(
      $.t,
      s._t_or($.l, $.r),
    )(s.cond(s.subtype($.t, $.l), s.subtype($.t, $.r))),
    _super_sub: fn(
      $.t,
      s._t_or($.l, $.r),
    )(seq(s.subtype($.l, $.t), s.subtype($.r, $.t))),
  },

  // type constructors are partially applied exprs that produce type values
  _const: {
    rule__params: l(s._t_const($.id), $.id),
  },
  string: {
    rule__params: l(s._t_string()),
  },
  number: {
    rule__params: l(s._t_number()),
  },
  _box: {
    rule__params: l(
      s._t_box($.tag, $.tuple, $.rest),
      $.tag_,
      $.tuple_,
      $.rest_,
    ),
    rule__body: seq(
      s.expr($.tag, $.tag_),
      s.expr_children($.tuple, $.tuple_),
      s.expr($.rest, $.rest_),
    ),
  },
  box: {
    file__description: l(
      "A box is a data structure with a tag and a list of values.",
    ),
    rule__params: $.params,
    rule__body: seq(
      s.params_rest($.params, l($.out, $.tag), $.tuple),
      s._box($.out, s._const($.tag), $.tuple, s._none()),
    ),
  },
  any_box: {
    rule__params: l($.out),
    rule__body: s._box($.out, s.string(), l(), s._any()),
  },
  list: {
    rule__params: l($.out, $.item),
    rule__body: s._box($.out, s._const(""), l(), $.item),
  },
  _any: {
    rule__params: l(s._t_any()),
  },
  _none: {
    rule__params: l(s._t_none()),
  },
  _and: {
    rule__params: l(s._t_and($.l, $.r), $.left, $.right),
    rule__body: seq(s.expr($.l, $.left), s.expr($.r, $.right)),
  },
  oneof: {
    rule__params: $.params,
    rule__body: seq(
      s.params_rest($.params, l($.out), $.type_exprs),
      s.map_list($.types, $.type_exprs, s.expr()),
      s.fold_op($.out, $.types, fn($.t, $.l, $.r)(u($.t, s._t_or($.l, $.r)))),
    ),
  },
  _type: {
    rule__params: l($.out),
    // TODO
    rule__body: s.any_box(),
  },
  _check: {
    rule__params: l($.value, $.type_expr),
    rule__body: seq(s.expr($.type, $.type_expr), s.call($.type, $.value)),
  },
  _test_check: {
    test__group: "type",
    rule__params: l(),
    rule__body: seq(
      s.expect_ok(s._check(1, s.number())),
      s.expect_ok(s._check(1, s._any())),
      s.expect_fail(s._check(1, s.string())),
      s.expect_fail(s._check(1, s._none())),

      s.expect_ok(s._check("foo", s._const("foo"))),
      s.expect_fail(s._check("foo", s._const("bar"))),

      s.expect_ok(s._check(s.foo(), s.box("foo"))),
      s.expect_ok(s._check(s.foo(), s.any_box())),
      s.expect_fail(s._check(s.foo(), s.box("bar"))),
      s.expect_fail(s._check(s.foo(), s.box("foo", s._any()))),
      s.expect_fail(s._check(s.foo(1), s.box("foo"))),

      s.expect_ok(s._check(l(1, 2, 3), s.list(s.number()))),

      s.expect_ok(
        s._check(l("foo", 1), s.list(s.oneof(s.string(), s.number()))),
      ),
      s.expect_fail(
        s._check(l(s.foo(), s.bar()), s.list(s.oneof(s.string(), s.number()))),
      ),
      s.expect_ok(
        s._check(
          l("foo", 1),
          s._and(
            s.box("", s.string(), s._any()),
            s.box("", s._any(), s.number()),
          ),
        ),
      ),
      s.expect_fail(
        s._check(
          l("foo", "bar"),
          s._and(
            s.box("", s.string(), s._any()),
            s.box("", s._any(), s.number()),
          ),
        ),
      ),
    ),
  },
  subtype: {
    rule__params: l($.sub, $.super),
    rule__body: s.cond(
      u($.sub, $.super),
      l(
        seq(s.box_tag_list($.sub, $.sub_id, __), f._super_sub($.sub_id, $.fn)),
        s.call($.fn, $.super, $.sub),
      ),
      l(
        seq(
          s.box_tag_list($.super, $.super_id, __),
          f._sub_super($.super_id, $.fn),
        ),
        s.call($.fn, $.sub, $.super),
      ),
    ),
  },

  _subtype_expr: {
    rule__params: l($.sub, $.type),
    rule__body: seq(
      s.expr($.l, $.sub),
      s.expr($.r, $.type),
      s.subtype($.l, $.r),
    ),
  },
  _test_subtype: {
    test__group: "type",
    rule__params: l(),
    rule__body: seq(
      s.expect_ok(s._subtype_expr(s.number(), s.number())),
      s.expect_ok(s._subtype_expr(s.number(), s._any())),
      s.expect_fail(s._subtype_expr(s.number(), s.string())),
    ),
  },

  _fn: {
    rule__params: $.params,
    rule__body: seq(
      s.params_rest($.params, l($.t), $.args),
      s.oneof(
        $.t,
        // TODO: check fn / goal args
        s.box("fn", s.list(s._any()), s.goal()),
        s.ref(__),
        s.goal(),
      ),
    ),
  },

  // types that interact with db
  goal: {
    rule__params: l($.t),
    // TODO: check id exists, is rule, args typecheck
    rule__body: s.any_box($.t),
  },
  ref: {
    rule__params: l($.t, $.schema),
    // TODO: check that ref points to extant record & has schema
    rule__body: s.string($.t),
  },

  // type checking
  var: {
    rule__params: l($.item),
    rule__body: s.type_value(s.var(), $.item),
  },
  nonvar: {
    rule__params: l($.item),
    rule__body: seq(s.type_value($.t, $.item), s.not_equal($.t, s.var())),
  },
  is_string: {
    rule__params: l($.item),
    rule__body: s.type_value(s.string(), $.item),
  },
  is_number: {
    rule__params: l($.item),
    rule__body: s.type_value(s.number(), $.item),
  },
  is_box: {
    rule__params: l($.item),
    rule__body: s.type_value(s.box(), $.item),
  },
});
