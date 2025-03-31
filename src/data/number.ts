import { pkg } from "../pkg";
import { l, s, $, __, u, seq, alt, x } from "../expr";
import { k } from "../value";
import { ensure } from "../process";

export const { rules: number, rulePrimitives: numberPrim } = pkg("number", {
  random: {
    rule__params: l($.rand),
    rule__primitive: function* (it, rand) {
      if (it.unify(rand, k(Math.random()))) yield it.result();
    },
  },
  random_int: {
    rule__params: l($.rand, $.max),
    rule__body: s.floor($.rand, x.mul(x.add(1, $.max), x.random())),
  },
  number_min_max: {
    rule__params: l($.number, $.min, $.max),
    rule__primitive: function* (it, num, min, max) {
      if (num.tag == "number") {
        if (min.tag == "number") {
          if (min.value > num.value) return;
        } else {
          if (!it.unify(num, min)) return;
        }
        if (max.tag == "number") {
          if (max.value < num.value) return;
        } else {
          if (!it.unify(num, max)) return;
        }
        yield it.result();
      } else {
        const minVal = min.tag == "number" ? min.value : 0;
        const maxVal = max.tag == "number" ? max.value : Infinity;
        if (minVal > maxVal) return;
        for (let i = minVal; i <= maxVal; i++) {
          yield* it.unifyChoice(num, k(i));
        }
      }
    },
  },
  number_min_to: {
    rule__params: l($.number, $.min, $.to),
    rule__primitive: function* (it, num, min, to) {
      ensure(min, "number");
      ensure(to, "number");
      for (let i = min.value; i < to.value; i++) {
        yield* it.unifyChoice(num, k(i));
      }
    },
  },
  test__number_min_max: {
    test__group: "number",
    rule__params: l(),
    rule__body: seq(
      s.expect_fail(s.number_min_max(10, 10, 0)),

      s.expect_ok(s.number_min_max(3, 0, 10)),
      s.expect_ok(s.number_min_max(0, 0, 10)),
      s.expect_ok(s.number_min_max(10, 0, 10)),

      s.expect_ok(s.number_min_max(3, __, 10)),
      s.expect_ok(s.number_min_max(23, 0, __)),
      s.expect_fail(s.number_min_max(23, 0, 10)),

      s.expect_collect($.val, s.number_min_max($.val, 3, 6), 3, 4, 5, 6),
    ),
  },
  sum: {
    rule__params: l($.sum, $.l, $.r),
    rule__body: s.cond(
      l(s.var($.l), s.sub($.l, $.sum, $.r)),
      l(s.var($.r), s.sub($.r, $.sum, $.l)),
      s.add($.sum, $.l, $.r),
    ),
  },
  inc: {
    rule__params: l($.inc, $.value),
    rule__body: s.sum($.inc, $.value, 1),
  },
  dec: {
    rule__params: l($.dec, $.value),
    rule__body: s.sum($.value, $.dec, 1),
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
      l(s.var($.l), s.fdiv($.l, $.product, $.r)),
      l(s.var($.r), s.fdiv($.r, $.product, $.l)),
      s.mul($.product, $.l, $.r),
    ),
  },
  product_rem: {
    rule__params: l($.result, $.l, $.r, $.rem),
    rule__body: s.cond(
      l(s.var($.l), s.div_rem($.l, $.rem, $.result, $.r)),
      l(s.var($.r), s.div_rem($.r, $.rem, $.result, $.l)),
      seq(s.mul($.mul, $.l, $.r), s.sum($.result, $.mul, $.rem)),
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
  add: {
    rule__params: l($.sum, $.left, $.right),
    rule__primitive: function* (it, sum, left, right) {
      ensure(left, "number");
      ensure(right, "number");
      if (it.unify(sum, k(left.value + right.value))) yield it.result();
    },
  },
  sub: {
    rule__params: l($.sum, $.left, $.right),
    rule__primitive: function* (it, sum, left, right) {
      ensure(left, "number");
      ensure(right, "number");
      if (it.unify(sum, k(left.value - right.value))) yield it.result();
    },
  },
  mul: {
    rule__params: l($.sum, $.left, $.right),
    rule__primitive: function* (it, sum, left, right) {
      ensure(left, "number");
      ensure(right, "number");
      if (it.unify(sum, k(left.value * right.value))) yield it.result();
    },
  },
  fdiv: {
    rule__params: l($.sum, $.left, $.right),
    rule__primitive: function* (it, sum, left, right) {
      ensure(left, "number");
      ensure(right, "number");
      if (it.unify(sum, k(left.value / right.value))) yield it.result();
    },
  },
  mod: {
    rule__params: l($.mod, $.left, $.right),
    rule__primitive: function* (it, mod, left, right) {
      ensure(left, "number");
      ensure(right, "number");
      const n = left.value;
      const d = right.value;
      if (it.unify(mod, k(((n % d) + d) % d))) yield it.result();
    },
  },
  div_rem: {
    rule__params: l($.div, $.rem, $.left, $.right),
    rule__primitive: function* (it, div, rem, left, right) {
      ensure(left, "number");
      ensure(right, "number");
      const q = Math.trunc(left.value / right.value);
      const r = left.value % right.value;
      if (it.unify(div, k(q)) && it.unify(rem, k(r))) yield it.result();
    },
  },
  trunc_frac: {
    rule__params: l($.trunc, $.frac, $.value),
    rule__primitive: function* (it, trunc, frac, value) {
      ensure(value, "number");
      const t = Math.trunc(value.value);
      const f = value.value - t;
      if (it.unify(trunc, k(t)) && it.unify(frac, k(f))) yield it.result();
    },
  },
  min: {
    rule__params: l($.min, $.l, $.r),
    rule__body: seq(
      s.ord($.ord, $.l, $.r),
      s.match(l($.min, $.ord), l($.l, s.lt()), l($.r, __)),
    ),
  },
  max: {
    rule__params: l($.max, $.l, $.r),
    rule__body: seq(
      s.ord($.ord, $.l, $.r),
      s.match(l($.max, $.ord), l($.l, s.gt()), l($.r, __)),
    ),
  },
  trunc: {
    rule__params: l($.trunc, $.val),
    rule__body: seq(s.trunc_frac($.trunc, __, $.val)),
  },
  floor: {
    rule__params: l($.floor, $.val),
    rule__body: seq(
      s.trunc_frac($.trunc, $.frac, $.val),
      s.if_then_else(
        s.lt($.frac, 0),
        s.sub($.floor, $.trunc, 1),
        u($.trunc, $.floor),
      ),
    ),
  },
  ceil: {
    rule__params: l($.ceil, $.val),
    rule__body: seq(
      s.trunc_frac($.trunc, $.frac, $.val),
      s.if_then_else(
        s.gt($.frac, 0),
        s.inc($.ceil, $.trunc),
        u($.trunc, $.ceil),
      ),
    ),
  },
  round: {
    rule__params: l($.round, $.val),
    rule__body: s.floor($.round, x.add($.val, 0.5)),
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
