import { l, s, $, __, u, seq, fn } from "../expr";
import { pkg } from "../pkg";

export const typeRecs = pkg("type", {
  type: {
    db__schema: "schema",
    schema__fields: l(s.field("rule__params")),
  },
  // type constructors
  _const: {
    rule__params: l(s.const($.id), $.id),
  },
  string: {
    rule__params: l(s.string()),
  },
  number: {
    rule__params: l(s.number()),
  },
  _box: {
    rule__params: l(s.box($.tag, $.tuple, $.rest), $.tag_, $.tuple_, $.rest_),
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
    rule__params: l(s.any()),
  },
  _none: {
    rule__params: l(s.none()),
  },
  _and: {
    rule__params: l(s.and($.l, $.r), $.left, $.right),
    rule__body: seq(s.expr($.l, $.left), s.expr($.r, $.right)),
  },
  _or: {
    rule__params: l(s.or($.l, $.r), $.left, $.right),
    rule__body: seq(s.expr($.l, $.left), s.expr($.r, $.right)),
  },
  oneof: {
    rule__params: $.params,
    rule__body: seq(
      s.params_rest($.params, l($.out), $.ts),
      s.fold_op($.out, $.ts, s._or()),
    ),
  },
  _type: {
    rule__params: l($.out),
    rule__body: s.oneof(
      $.out,
      s.box("string"),
      s.box("number"),
      s.box("const", s.string()),
      s.box("box", s._type(), s.list(s._type()), s._type()),
      s.box("any"),
      s.box("none"),
      s.box("and", s._type(), s._type()),
      s.box("or", s._type(), s._type()),
    ),
  },

  _check: {
    rule__params: l($.value, $.type_expr),
    rule__body: seq(
      s.expr($.type, $.type_expr),
      s._check_value($.value, $.type),
    ),
  },
  _check_value: {
    rule__params: l($.value, $.type),
    rule__body: s.match_cond(
      $.type,
      l(s.any(), s.ok()),
      l(s.none(), s.fail()),
      l(s.const($.const), u($.value, $.const)),
      l(s.string(), s.is_string($.value)),
      l(s.number(), s.is_number($.value)),
      l(
        s.box($.tag, $.tuple_types, $.rest_type),
        s._check_box($.value, $.tag, $.tuple_types, $.rest_type),
      ),
      l(
        s.and($.l, $.r),
        seq(s._check_value($.value, $.l), s._check_value($.value, $.r)),
      ),
      l(
        s.or($.l, $.r),
        s.cond(s._check_value($.value, $.l), s._check_value($.value, $.r)),
      ),
    ),
  },
  _check_box: {
    rule__params: l($.value, $.tag_type, $.tuple_types, $.rest_type),
    rule__body: seq(
      s.box_tag_list($.value, $.tag, $.vals),
      s._check_value($.tag, $.tag_type),

      s.length_box($.tuple_len, $.tuple_types),
      s.length_box($.val_len, $.vals),
      s.gt_eq($.val_len, $.tuple_len),

      s.slice_box_from_to($.tuple_vals, $.vals, 0, $.tuple_len),
      s.try_error_catch(
        s.zip_lists(
          __,
          l($.tuple_vals, $.tuple_types),
          fn(__, $.v, $.t)(s.cond(s._check_value($.v, $.t), s.throw(s.fail()))),
        ),
        s.fail(),
        s.fail(),
      ),

      s.slice_box_from_to($.rest_vals, $.vals, $.tuple_len, __),
      s.list__every($.rest_vals, s._check_value($.rest_type)),
    ),
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
          // s._and(
          // s.box("", s.string(), s._any()),
          s.box("", s._any(), s.number()),
          // ),
        ),
      ),
    ),
  },

  // type checking
  var: {
    rule__params: l($.item),
    rule__body: s.type_value(s.var(), $.item),
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
