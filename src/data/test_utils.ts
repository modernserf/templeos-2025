import { l, s, $, Expr, seq, __, u, x, xfn, fn } from "../expr";
import { pkg } from "../pkg";

export const test = {
  ok: (goal: Expr) => s.expect_ok(goal),
  fail: (goal: Expr) => s.expect_fail(goal),
  eq: (l: Expr, r: Expr) => s.expect_eq(l, r),
  throw: (goal: Expr, error: Expr) => s.expect_throw(goal, error),
  collect: (pattern: Expr, goal: Expr, ...expected: Expr[]) =>
    s.expect_collect(pattern, goal, ...expected),
};

export const testUtils = pkg("test", {
  _group: {
    db__schema: "field",
    file__name: "Test group",
    field__type: s.string(),
    field__index: s.ref(),
  },
  _flags: {
    db__schema: "field",
    file__name: "Test flags",
    field__type: s.list_of(
      s.enum(s.ignore_schema_check_all(), s.ignore_single_vars()),
    ),
  },
  _has_flag: {
    rule__params: l($.flag, $.id),
    rule__body: seq(s._flags($.flags, $.id), s($.flag).in($.flags)),
  },

  // test utils
  expect_ok: {
    rule__params: l($.goal),
    rule__body: s.if_then_else($.goal, s.ok(), s.expected_ok($.goal)),
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
        u($.error_expected, $.error_received),
        s.ok(),
        s.expected_received($.error_expected, $.error_received),
      ),
    ),
  },
  expect_eq: {
    rule__params: l($.received, $.expected),
    rule__body: s.if_then_else(
      seq(
        s.nonvar($.received),
        s.nonvar($.expected),
        u($.received, $.expected),
      ),
      s.ok(),
      s.expected_received($.expected, $.received),
    ),
  },
  expect_collect: {
    rule__params: $.params,
    rule__body: seq(
      s.params_rest($.params, l($.pattern, $.goal), $.expected),
      s.if_then_else(
        s.collect_item_in($.received, $.pattern, $.goal),
        s.expect_eq($.received, $.expected),
        s.expected_received($.expected, l()),
      ),
    ),
  },

  _get_idents: {
    rule__params: l($.ident, $.expr),
    rule__body: s.cond(
      l(s.var($.expr), s.ident_var($.ident, $.expr)),
      l(
        s.unpack_expand($.unpacked, $.expr),
        s._get_idents($.ident, $.unpacked),
      ),
      l(
        s.is_box($.expr),
        seq(s($._arg).in($.expr), s._get_idents($.ident, $._arg)),
      ),
    ),
  },
  _increment_counter: {
    rule__params: l($.next, $.prev, $.ident),
    rule__body: s.if_then_else(
      s.limit(1, s.value_box_index(l($.ident, $.count), $.prev, $.i)),
      seq(
        s.inc($.nc, $.count),
        s.updated_box_index_value($.next, $.prev, $.i, l($.ident, $.nc)),
      ),
      s.append_left_right($.next, $.prev, l(l($.ident, 1))),
    ),
  },

  _test_count_vars_2: {
    test__group: "core",
    test__flags: l(s.ignore_single_vars()),
    rule__params: l(),
    rule__body: seq(
      s.expect_collect($.ident, s._get_idents($.ident, 123)),
      s.expect_collect($.ident, s._get_idents($.ident, $.foo), "foo"),
      s.expect_collect(
        $.ident,
        s._get_idents($.ident, s.foo($.foo, $.foo, s.bar($.bar))),
        "foo",
        "foo",
        "bar",
      ),
    ),
  },
  _single_vars: {
    rule__params: l($.singles, $.counts),
    rule__body: s.map_list(
      $.singles,
      $.counts,
      fn($.name, l($.name, $.count))(
        s.not_equal(95, x.string_char_code($.name, 0)),
        s.eq($.count, 1),
      ),
    ),
  },
  _test_single_vars_: {
    test__group: "core",
    rule__params: l(),
    rule__body: seq(
      s.expect_eq(
        x._single_vars(l(l("updated", 1), l("removed", 2), l("res", 1))),
        l("updated", "res"),
      ),
    ),
  },

  _test_single_vars_check: {
    test__group: "core",
    rule__params: l(),
    rule__body: s.block(
      __,
      seq(
        s.rule__params($.params, $.id),
        s.cond(s.rule__body($.body, $.id), u($.body, s.ok())),
        s.none(s._has_flag(s.ignore_single_vars(), $.id)),

        // TODO: do this without making list?
        s.collect_item_in(
          $.idents,
          $.ident,
          s._get_idents($.ident, l($.params, $.body)),
        ),
        // s.list($.idents2, x._get_idents($.expr)), // why doesn't this work?
        s.fold_list($.count, l(), $.idents, s._increment_counter()),
        s._single_vars($.singles, $.count),

        // TODO: check for non-single underscore vars too
        s.cond(s.empty($.singles), s.throw(s.single_vars($.id, $.singles))),
      ),
    ),
  },

  view__test_result: {
    rule__params: l($.out, $.test_id),
    rule__body: s.try_error_catch(
      seq(s.call($.test_id), s.view__string($.out, "ok")),
      $.error,
      s.view__expr($.out, $.error),
    ),
  },
  test_runner: {
    view__subject: s.self(),
    file__name: "Unit tests",
    rule__params: l($.out, $._id, $._state),
    rule__body: seq(
      s.table(
        $.out,
        l(),
        x.table_section(
          x.table_header(
            l(),
            x.view__string("group"),
            x.view__string("test"),
            x.view__string("result"),
          ),
          xfn($.out)(
            s.test__group($.group, $.id),
            s.table_row(
              $.out,
              l(),
              x.view__string($.group),
              x.view__file_link($.id),
              x.view__test_result($.id),
            ),
          ),
        ),
      ),
    ),
  },
  _run_all: {
    rule__params: l($.resolve),
    rule__body: seq(
      s.block(
        __,
        seq(
          s.test__group($.group, $.test),
          s.box($.call, $.test, l()),
          s.log($.group, $.test),
          s.try_error_catch($.call, $.e, seq(s.log($.e), s.throw($.e))),
        ),
      ),
      s.send($.resolve, s.ok()),
    ),
  },
});
