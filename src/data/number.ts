import { pkg } from "../pkg";
import { l, s, $, __, u, seq, alt } from "../expr";

export const number = pkg("number", {
  // operates on values
  sum: {
    rule__params: l($.sum, $.l, $.r),
    rule__body: s.cond(
      l(s.var($.l), s.sub__primitive($.l, $.sum, $.r)),
      l(s.var($.r), s.sub__primitive($.r, $.sum, $.l)),
      l(s.ok(), s.add__primitive($.sum, $.l, $.r)),
    ),
  },
  inc: {
    rule__params: l($.inc, $.value),
    rule__body: s.sum($.inc, $.value, 1),
  },
  negate: {
    rule__params: l($.neg, $.value),
    rule__body: s.sum(0, $.neg, $.value),
  },
  abs_value: {
    rule__params: l($.abs, $.value),
    rule__body: seq(
      alt(u($.abs, $.value), s.negate($.abs, $.value)),
      s.gt_eq($.abs, 0),
    ),
  },
  product: {
    rule__params: l($.product, $.l, $.r),
    rule__body: s.cond(
      l(s.var($.l), s.fdiv__primitive($.l, $.product, $.r)),
      l(s.var($.r), s.fdiv__primitive($.r, $.product, $.l)),
      l(s.ok(), s.mul__primitive($.product, $.l, $.r)),
    ),
  },
  product_rem: {
    rule__params: l($.result, $.l, $.r, $.rem),
    rule__body: s.cond(
      l(s.var($.l), s.divrem__primitive($.l, $.rem, $.result, $.r)),
      l(s.var($.r), s.divrem__primitive($.r, $.rem, $.result, $.l)),
      l(
        s.ok(),
        seq(s.mul__primitive($.mul, $.l, $.r), s.sum($.result, $.mul, $.rem)),
      ),
    ),
  },
  _test_product_rem: {
    test__group: "number",
    rule__params: l(),
    rule__body: seq(
      s.expect_collect($.res, s.product_rem($.res, 3, 5, 2), 17),
      s.expect_collect(
        l($.l, $.rem),
        s.product_rem(17, $.l, 5, $.rem),
        l(3, 2),
      ),
      s.expect_collect(
        l($.r, $.rem),
        s.product_rem(17, 3, $.r, $.rem),
        l(5, 2),
      ),
    ),
  },
  reciprocal: {
    rule__params: l($.left, $.right),
    rule__body: s.product(1, $.left, $.right),
  },
  _test_num: {
    test__group: "number",
    rule__params: l(),
    rule__body: seq(
      s.expect_collect($.inc, s.inc($.inc, 1), 2),
      s.expect_collect($.dec, s.inc(2, $.dec), 1),

      s.expect_collect($.neg, s.negate(1, $.neg), -1),
      s.expect_collect($.neg, s.negate($.neg, -2), 2),

      s.expect_collect($.abs, s.abs_value($.abs, 1), 1),
      s.expect_collect($.abs, s.abs_value($.abs, -1), 1),
      s.expect_collect($.value, s.abs_value(1, $.value), 1, -1),

      s.expect_collect($.rec, s.reciprocal($.rec, 2), 1 / 2),
      s.expect_collect($.rec, s.reciprocal(1 / 4, $.rec), 4),
    ),
  },
  // operates on exprs
  add: {
    rule__params: l($.out, $.left, $.right),
    rule__body: seq(
      s.expr_number($.l, $.left),
      s.expr_number($.r, $.right),
      s.add__primitive($.out, $.l, $.r),
    ),
  },
  sub: {
    rule__params: l($.out, $.left, $.right),
    rule__body: seq(
      s.expr_number($.l, $.left),
      s.expr_number($.r, $.right),
      s.sub__primitive($.out, $.l, $.r),
    ),
  },
  mul: {
    rule__params: l($.out, $.left, $.right),
    rule__body: seq(
      s.expr_number($.l, $.left),
      s.expr_number($.r, $.right),
      s.mul__primitive($.out, $.l, $.r),
    ),
  },
  fdiv: {
    rule__params: l($.out, $.left, $.right),
    rule__body: seq(
      s.expr_number($.l, $.left),
      s.expr_number($.r, $.right),
      s.fdiv__primitive($.out, $.l, $.r),
    ),
  },
  mod: {
    rule__params: l($.out, $.left, $.right),
    rule__body: seq(
      s.expr_number($.l, $.left),
      s.expr_number($.r, $.right),
      s.mod__primitive($.out, $.l, $.r),
    ),
  },
  min: {
    rule__params: l($.min, $.left, $.right),
    rule__body: seq(
      s.expr_number($.l, $.left),
      s.expr_number($.r, $.right),
      s.ord($.ord, $.l, $.r),
      s.match(l($.min, $.ord), l($.l, s.lt()), l($.r, __)),
    ),
  },
  max: {
    rule__params: l($.max, $.left, $.right),
    rule__body: seq(
      s.expr_number($.l, $.left),
      s.expr_number($.r, $.right),
      s.ord($.ord, $.l, $.r),
      s.match(l($.max, $.ord), l($.l, s.gt()), l($.r, __)),
    ),
  },

  trunc: {
    rule__params: l($.trunc, $.expr),
    rule__body: seq(
      s.expr_number($.val, $.expr),
      s.trunc__primitive($.trunc, __, $.val),
    ),
  },
  floor: {
    rule__params: l($.floor, $.expr),
    rule__body: seq(
      s.expr_number($.val, $.expr),
      s.trunc__primitive($.trunc, $.frac, $.val),
      s.if_then_else(
        s.lt($.frac, 0),
        s.sub__primitive($.floor, $.trunc, 1),
        u($.trunc, $.floor),
      ),
    ),
  },
  ceil: {
    rule__params: l($.ceil, $.expr),
    rule__body: seq(
      s.expr_number($.val, $.expr),
      s.trunc__primitive($.trunc, $.frac, $.val),
      s.if_then_else(
        s.gt($.frac, 0),
        s.inc($.ceil, $.trunc),
        u($.trunc, $.ceil),
      ),
    ),
  },
  round: {
    rule__params: l($.round, $.expr),
    rule__body: s.floor($.round, s.add($.expr, 0.5)),
  },

  _test_round: {
    test__group: "number",
    rule__params: l(),
    rule__body: seq(
      s.expect_collect($.t, s.trunc($.t, 1), 1),
      s.expect_collect($.t, s.trunc($.t, 1.25), 1),
      s.expect_collect($.t, s.trunc($.t, 1.75), 1),
      s.expect_collect($.t, s.trunc($.t, -1.25), -1),
      s.expect_collect($.t, s.trunc($.t, -1.75), -1),

      s.expect_collect($.t, s.floor($.t, 1), 1),
      s.expect_collect($.t, s.floor($.t, 1.25), 1),
      s.expect_collect($.t, s.floor($.t, 1.75), 1),
      s.expect_collect($.t, s.floor($.t, -1.25), -2),
      s.expect_collect($.t, s.floor($.t, -1.75), -2),

      s.expect_collect($.t, s.ceil($.t, 1), 1),
      s.expect_collect($.t, s.ceil($.t, 1.25), 2),
      s.expect_collect($.t, s.ceil($.t, 1.75), 2),
      s.expect_collect($.t, s.ceil($.t, -1.25), -1),
      s.expect_collect($.t, s.ceil($.t, -1.75), -1),

      s.expect_collect($.t, s.round($.t, 1), 1),
      s.expect_collect($.t, s.round($.t, 1.25), 1),
      s.expect_collect($.t, s.round($.t, 1.75), 2),
      s.expect_collect($.t, s.round($.t, -1.25), -1),
      s.expect_collect($.t, s.round($.t, -1.75), -2),
    ),
  },
});
