import { l, r, s, v, Expr } from "./expr";

export const test = {
  ok: (...goal: Expr[]) => s("expect_ok", r(...goal)),
  fail: (...goal: Expr[]) => s("expect_fail", r(...goal)),
  eq: (l: Expr, r: Expr) => s("expect_eq", l, r),
  throw: (goal: Expr, error: Expr) => s("expect_throw", goal, error),
  collect: (pattern: Expr, goal: Expr, ...expected: Expr[]) =>
    s("expect_collect", pattern, goal, ...expected),
  view: (goal: Expr, ...expected: Expr[]) =>
    s("expect_view", goal, ...expected),
  db: (tx: Expr, ...body: Expr[]) => s("with_tx", tx, r(...body, s("fail"))),
};

export const testUtils = {
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
    rule__params: l(v.goal, v.error_expected),
    rule__body: s(
      "try_error_catch",
      r(v.goal, s("throw", s("expected_throw", v.error_expected))),
      v.error_received,
      s(
        "if_then_else",
        s("=", v.error_expected, v.error_received),
        s("ok"),
        s("throw", s("expected_received", v.error_expected, v.error_received))
      )
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
};
