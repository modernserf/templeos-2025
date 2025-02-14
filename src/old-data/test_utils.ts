import { Rec } from ".";
import { l, r, s, $, Expr, view } from "../expr";

export const test = {
  ok: (...goal: Expr[]) => s.expect_ok(r(...goal)),
  fail: (...goal: Expr[]) => s.expect_fail(r(...goal)),
  eq: (l: Expr, r: Expr) => s.expect_eq(l, r),
  throw: (goal: Expr, error: Expr) => s.expect_throw(goal, error),
  collect: (pattern: Expr, goal: Expr, ...expected: Expr[]) =>
    s.expect_collect(pattern, goal, ...expected),
  view: (goal: Expr, ...expected: Expr[]) => s.expect_view(goal, ...expected),
  db: (tx: Expr, ...body: Expr[]) => s.with_tx(tx, r(...body, s.fail())),
};

export const testUtils = {
  test__group: {
    db__schema: "field",
    file__name: "Test group",
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
      r($.goal, s.throw(s.expected_throw($.error_expected))),
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
      s[","](s.nonvar($.received), s("=", $.received, $.expected)),
      s.ok(),
      s.throw(s.expected_received($.expected, $.received)),
    ),
  },
  expect_collect: {
    rule__params: l($.pattern, $.goal),
    rule__rest_params: $.expected,
    rule__body: s.if_then_else(
      s.collect_empty($.pattern, $.goal, $.received),
      s.expect_eq($.received, $.expected),
      s.throw(s.expected_received($.expected, l())),
    ),
  },

  view__test_result: {
    rule__params: l($.test_id, $.out),
    rule__body: s.try_error_catch(
      r(s.call($.test_id), view.string("ok", $.out)),
      $.error,
      view.any($.error, $.out),
    ),
  },
  test_runner: {
    db__schema: "form",
    file__name: "Unit tests",
    rule__params: l($.self, $.state, $.out),
    rule__body: view.render(
      view.table(
        l(),
        s.children(
          view.table_header(
            l(),
            s.children(
              view.string("group"),
              view.string("test"),
              view.string("result"),
            ),
          ),
        ),
        s.children(
          view.iter(
            s.test__group($.id, $.group),
            l(
              view.table_row(
                l(),
                s.children(
                  view.string($.group),
                  view.file_link($.id),
                  view.test_result($.id),
                ),
              ),
            ),
          ),
        ),
      ),
      $.out,
    ),
  },
} satisfies Record<string, Rec>;
