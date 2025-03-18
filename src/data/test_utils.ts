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

  _count_vars: {
    rule__params: l($.next, $.prev, $.expr),
    rule__body: seq(
      s.cond(
        l(
          seq(s.var($.expr), s.ident_var($.ident, $.expr)),
          s.if_then_else(
            seq(
              s.value_box_index(l($.name, $.count), $.prev, $.i),
              s.eq($.name, $.ident),
            ),
            seq(
              s.inc($.next_count, $.count),
              s.updated_box_index_value(
                $.n,
                $.prev,
                $.i,
                l($.ident, $.next_count),
              ),
              u($.next, $.n),
            ),
            s.append_left_right($.next, $.prev, l(l($.ident, 1))),
          ),
        ),
        l(
          s.unpack_expand($.unpacked, $.expr),
          s._count_vars($.next, $.prev, $.unpacked),
        ),
        l(s.is_box($.expr), s._count_vars_box($.next, $.prev, $.expr, 0)),
        l(s.ok(), u($.next, $.prev)),
      ),
      s.cond(s.is_box($.next), s.throw(s.invalid_next($.expr, $.prev))),
    ),
  },
  // TODO: why didn't fold_list work here
  _count_vars_box: {
    rule__params: l($.next, $.prev, $.expr, $.i),
    rule__body: seq(
      s.if_then_else(
        s.value_box_index($._value, $.expr, $.i),
        seq(
          s.ensure_det(s._count_vars($.ns, $.prev, $._value)),
          s.inc($.next_i, $.i),
          s._count_vars_box($.next, $.ns, $.expr, $.next_i),
        ),
        u($.next, $.prev),
      ),
    ),
  },
  _test_count_vars: {
    test__group: "core",
    test__flags: l(s.ignore_single_vars()),
    rule__params: l(),
    rule__body: seq(
      s.expect_eq(x._count_vars(l(), 123), l()),
      s.expect_eq(x._count_vars(l(), $.foo), l(l("foo", 1))),
      s.expect_eq(
        x._count_vars(l(), s.foo($.foo, $.foo, s.bar($.bar))),
        l(l("foo", 2), l("bar", 1)),
      ),
      s.expect_eq(
        x._count_vars(
          l(l("duration", 1), l("self", 1), l("id", 1)),
          s.ms_duration($.time_ms, $.duration),
        ),
        l(l("duration", 2), l("self", 1), l("id", 1), l("time_ms", 1)),
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

  // TODO: this takes ~5sec to run, can this be made fast enough to unit test?
  _test_single_vars_check: {
    // test__group: "core",
    rule__params: l(),
    rule__body: s.block(
      __,
      seq(
        s.rule__params($.params, $.id),
        // FIXME: handle var params (and var body) properly
        s.if_then_else(
          s.var($.params),
          u($.init, l(l("params", 1))),
          u($.init, l()),
        ),
        s.cond(s.rule__body($.body, $.id), u($.body, s.ok())),
        s.none(s._has_flag(s.ignore_single_vars(), $.id)),

        s._count_vars($.count, $.init, l($.params, $.body)),
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
      // run last
      s.sleep(1),
      s.log("core", "_test_single_vars_check"),
      s._test_single_vars_check(),
      s.send($.resolve, s.ok()),
    ),
  },
});
