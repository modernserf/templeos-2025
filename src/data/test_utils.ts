import { Rec } from ".";
import { l, s, $, Expr, seq } from "../expr";

export const test = {
  ok: (goal: Expr) => s.expect_ok(goal),
  fail: (goal: Expr) => s.expect_fail(goal),
  eq: (l: Expr, r: Expr) => s.expect_eq(l, r),
  throw: (goal: Expr, error: Expr) => s.expect_throw(goal, error),
  collect: (pattern: Expr, goal: Expr, ...expected: Expr[]) =>
    s.expect_collect(pattern, goal, ...expected),
};

export const testUtils = {
  test__group: {
    db__schema: "field",
    file__name: "Test group",
    db__index: s.ref(),
  },

  // test utils
  expect_ok: {
    rule__params: l($.goal),
    rule__body: s.if_then_else($.goal, s.ok(), s.throw(s.expected_ok($.goal))),
  },
  expect_fail: {
    rule__params: l($.goal),
    rule__body: s.if_then_else(
      $.goal,
      s.throw(s.expected_fail($.goal)),
      s.ok(),
    ),
  },
  expect_throw: {
    rule__params: l($.goal, $.error_expected),
    rule__body: s.try_error_catch(
      seq($.goal, s.throw(s.expected_throw($.error_expected))),
      $.error_received,
      s.if_then_else(
        s("=", $.error_expected, $.error_received),
        s.ok(),
        s.throw(s.expected_received($.error_expected, $.error_received)),
      ),
    ),
  },
  expect_eq: {
    rule__params: l($.received, $.expected),
    rule__body: s.if_then_else(
      s(",", s.nonvar($.received), s("=", $.received, $.expected)),
      s.ok(),
      s.throw(s.expected_received($.expected, $.received)),
    ),
  },
  expect_collect: {
    rule__params: l($.pattern, $.goal),
    rule__rest_params: $.expected,
    rule__body: s.if_then_else(
      s.collect_item_in($.received, $.pattern, $.goal),
      s.expect_eq($.received, $.expected),
      s.throw(s.expected_received($.expected, l())),
    ),
  },
} satisfies Record<string, Rec>;
