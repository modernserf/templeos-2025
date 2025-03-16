import { l, s, $, __, seq, u } from "../expr";
// var < number < string < box
// a() < z(), a() < a(0)

import { pkg } from "../pkg";

export const ord = pkg("ord", {
  ord: {
    rule__params: l($.ord, $.left, $.right),
    rule__body: seq(
      s.type_value($.l, $.left),
      s.type_value($.r, $.right),

      s.match_cond(
        l($.l, $.r),
        l(l(s.var(), s.var()), u($.ord, s.eq())),
        l(l(s.number(), s.number()), s.ord__number($.ord, $.left, $.right)),
        l(l(s.string(), s.string()), s.ord__string($.ord, $.left, $.right)),
        l(l(s.box(), s.box()), s._ord_box($.ord, $.left, $.right)),
        l(
          __,
          seq(
            s._rank_type($.l_, $.l),
            s._rank_type($.r_, $.r),
            s.ord__number($.ord, $.l_, $.r_),
          ),
        ),
      ),
    ),
  },
  _test_ord: {
    test__group: "ord",
    rule__params: l(),
    rule__body: seq(
      s.expect_ok(s.ord(s.lt(), 1, 2)),
      s.expect_ok(s.ord(s.eq(), 2, 2)),
      s.expect_ok(s.ord(s.gt(), 3, 2)),

      s.expect_ok(s.ord(s.lt(), "foo", "zoo")),
      s.expect_ok(s.ord(s.lt(), "foo", "foobar")),

      // TODO: I think this is not good for stable sorting
      s.expect_ok(s.ord(s.eq(), $.foo, $.bar)),

      s.expect_ok(s.ord(s.lt(), s.foo(), s.zoo())),
      s.expect_ok(s.ord(s.lt(), s.foo(), s.foo(1))),
      s.expect_ok(s.ord(s.lt(), s.foo(0), s.foo(1))),

      s.expect_ok(s.ord(s.lt(), 12345, "0")),
      s.expect_ok(s.ord(s.lt(), "foo", s.bar())),
    ),
  },

  lt: {
    rule__params: l($.left, $.right),
    rule__body: s.ord(s.lt(), $.left, $.right),
  },
  lt_eq: {
    rule__params: l($.left, $.right),
    rule__body: seq(
      s.ord($.ord, $.left, $.right),
      s.match($.ord, s.lt(), s.eq()),
    ),
  },
  eq: {
    rule__params: l($.left, $.right),
    rule__body: s.ord(s.eq(), $.left, $.right),
  },
  not_eq: {
    rule__params: l($.left, $.right),
    rule__body: seq(
      s.ord($.ord, $.left, $.right),
      s.match($.ord, s.lt(), s.gt()),
    ),
  },
  gt: {
    rule__params: l($.left, $.right),
    rule__body: s.ord(s.gt(), $.left, $.right),
  },
  gt_eq: {
    rule__params: l($.left, $.right),
    rule__body: seq(
      s.ord($.ord, $.left, $.right),
      s.match($.ord, s.gt(), s.eq()),
    ),
  },

  sort: {
    rule__params: l($.sorted, $.list, $.fn),
    rule__body: s.if_then_else(
      s.empty($.list),
      u($.sorted, $.list),
      seq(
        s.append_left_right($.list, l($.head), $.tail),
        s._partition($.left, $.right, $.head, $.tail, $.fn),
        s.sort($.ls, $.left, $.fn),
        s.sort($.rs, $.right, $.fn),
        s.append_left_right($.ls_head, $.ls, l($.head)),
        s.append_left_right($.sorted, $.ls_head, $.rs),
      ),
    ),
  },
  _partition: {
    rule__params: l($.left, $.right, $.head, $.tail, $.fn),
    rule__body: s.if_then_else(
      s.empty($.tail),
      u(l($.left, $.right), l(l(), l())),
      seq(
        s.append_left_right($.tail, l($.x), $.xs),
        s.apply(l($.ord, $.x, $.head), $.fn),
        s.match_cond(
          $.ord,
          l(
            s.gt(),
            seq(
              s._partition($.left, $.r, $.head, $.xs, $.fn),
              s.append_left_right($.right, l($.x), $.r),
            ),
          ),
          l(
            __,
            seq(
              s._partition($.l, $.right, $.head, $.xs, $.fn),
              s.append_left_right($.left, l($.x), $.l),
            ),
          ),
        ),
      ),
    ),
  },
  _test_sort: {
    test__group: "ord",
    rule__params: l(),
    rule__body: seq(
      s.expect_collect(
        $.result, //
        s.sort($.result, l(), s.ord()),
        l(),
      ),
      s.expect_collect(
        $.result, //
        s.sort($.result, l(1, 2, 3), s.ord()),
        l(1, 2, 3),
      ),

      s.expect_collect(
        $.result, //
        s.sort($.result, l(3, 1, 2), s.ord()),
        l(1, 2, 3),
      ),

      s.expect_collect(
        $.result, //
        s.sort($.result, l("foo", 3, "bar", 1, 2, "baz"), s.ord()),
        l(1, 2, 3, "bar", "baz", "foo"),
      ),
    ),
  },

  ord_desc: {
    rule__params: l($.ord, $.left, $.right),
    rule__body: seq(s.ord($.rev, $.left, $.right), s._reverse($.ord, $.rev)),
  },

  _reverse: {
    rule__params: l($.ord, $.reverse),
    rule__body: s.match(
      l($.ord, $.reverse),
      l(s.lt(), s.gt()),
      l(s.gt(), s.lt()),
      l(s.eq(), s.eq()),
    ),
  },

  ord_seq: {
    rule__params: l($.result, $.left_fn, $.right_fn),
    rule__body: seq(
      s.call($.left_fn, $.l),
      s.match_cond(
        $.l,
        l(s.eq(), s.call($.right_fn, $.result)),
        l(__, u($.result, $.l)),
      ),
    ),
  },

  _ord_box: {
    rule__params: l($.ord, $.left, $.right),
    rule__body: seq(
      s.box_tag_list($.left, $.ltag, $.ls),
      s.box_tag_list($.right, $.rtag, $.rs),
      s.ord_seq($.ord, s.ord__string($.ltag, $.rtag), s._ord_list($.ls, $.rs)),
    ),
  },
  _ord_list: {
    rule__params: l($.ord, $.left, $.right),
    rule__body: s.match_cond(
      l($.left, $.right),
      l(l(l(), l()), u($.ord, s.eq())),
      l(l(l(), __), u($.ord, s.lt())),
      l(l(__, l()), u($.ord, s.gt())),
      l(
        __,
        seq(
          s.append_left_right($.left, l($.l), $.ls),
          s.append_left_right($.right, l($.r), $.rs),
          s.ord_seq($.ord, s.ord($.l, $.r), s._ord_list($.ls, $.rs)),
        ),
      ),
    ),
  },
  _rank_type: {
    rule__params: l($.rank, $.type),
    rule__body: s.match(
      l($.rank, $.type),
      l(1, s.var()),
      l(2, s.number()),
      l(3, s.string()),
      l(4, s.box()),
    ),
  },
});
