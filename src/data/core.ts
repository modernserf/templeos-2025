import { l, s, $, __, u, seq } from "../expr";
import { pkg } from "../pkg";
import { test } from "./test_utils";

export const core = pkg("core", {
  // fields
  // TODO: foo_field($.value, $.id) -> value_record_field($.value, $.id, "foo_field")
  db__schema: {
    db__schema: "field",
    file__name: "DB Schema",
    file__description: l("schema used to validate & render this record"),
    // field__type: s.ref( "schema" as const),
    field__type: "ref",
    field__index: s.ref(),
  },
  time__created: {
    db__schema: "field",
    file__name: "Time created",
    field__type: "time",
    field__index: s.sorted(),
  },
  rule__params: {
    db__schema: "field",
    file__name: "Rule params",
  },
  rule__body: {
    db__schema: "field",
    file__name: "Rule body",
  },
  file__name: {
    db__schema: "field",
    file__name: "File name",
    file__description: l("field used for name in tab header & file explorer"),
    field__type: "string",
  },
  file__description: {
    db__schema: "field",
    file__name: "File description",
    file__description: l("describes the content of the record"),
    field__type: "text",
  },
  // utilities
  none: {
    rule__params: l($.expr),
    rule__body: s.if_then_else($.expr, s.fail(), s.ok()),
  },
  in: {
    rule__params: l($.value, $.box),
    rule__body: s.value_box_index($.value, $.box, __),
  },
  do: {
    rule__params: l($.goal),
    rule__body: s.if_then_else($.goal, s.ok(), s.ok()),
  },
  loop: {
    rule__params: l($.goal),
    rule__body: s.do(s.block(__, s.loop_iter(__, __, __, $.goal))),
  },
  bool_goal: {
    rule__params: l($.bool, $.goal),
    rule__body: s.if_then_else(
      s.block(__, $.goal),
      u($.bool, s.ok()),
      u($.bool, s.fail()),
    ),
  },

  // TODO: check performance on this, maybe want native impl for this
  append_box_prefix: {
    file__description: l(
      "prepend elements of prefix to box, keeping box's tag",
    ),
    rule__params: l($.updated, $.target, $.left),
    rule__body: seq(
      s.box_tag_list($.target, $.tag, $.right),
      s.append_left_right($.next, $.left, $.right),
      s.box_tag_list($.updated, $.tag, $.next),
    ),
  },
  append_box_suffix: {
    file__description: l("append elements of suffix to box, keeping box's tag"),
    rule__params: l($.updated, $.target, $.right),
    rule__body: seq(
      s.box_tag_list($.target, $.tag, $.left),
      s.append_left_right($.next, $.left, $.right),
      s.box_tag_list($.updated, $.tag, $.next),
    ),
  },
  params_rest: {
    rule__params: l($.params, $.required, $.rest),
    rule__body: s.if_then_else(
      s.append_left_right($.params, $.required, $.rest),
      s.ok(),
      s.throw(s.invalid_params($.params, $.required, $.rest)),
    ),
  },
  call: {
    rule__params: $.params,
    rule__body: seq(
      s.params_rest($.params, l($.fn), $.args),
      s.apply($.args, $.fn),
    ),
  },
  apply: {
    rule__params: l($.args, $.fn),
    rule__body: s.cond(
      l(u($.fn, s.fn($.params, $.goal)), s._apply_fn($.args, $.fn)),
      l(s.is_box($.fn), s._lapply_partial($.args, $.fn)),
      l(s.is_string($.fn), s._apply_id($.args, $.fn)),
      s.throw(s.invalid_apply($.args, $.fn)),
    ),
  },
  _apply_id: {
    rule__params: l($.args, $.id),
    rule__body: seq(s.box_tag_list($.callable, $.id, $.args), $.callable),
  },
  _apply_fn: {
    rule__params: l($.args, $.fn),
    rule__body: seq(
      s.resolve_deep(s.fn($.params, $.goal), $.fn),
      u($.args, $.params),
      $.goal,
    ),
  },
  _lapply_partial: {
    rule__params: l($.args, $.fn),
    rule__body: seq(s.append_box_prefix($.callable, $.fn, $.args), $.callable),
  },
  _rapply_partial: {
    rule__params: l($.args, $.fn),
    rule__body: seq(s.append_box_suffix($.callable, $.fn, $.args), $.callable),
  },
  empty: {
    rule__params: l($.box),
    rule__body: s.box_tag_list($.box, __, l()),
  },
  nonempty: {
    rule__params: l($.box),
    rule__body: s.none(s.box_tag_list($.box, __, l())),
  },
  cond: {
    rule__params: $.options,
    rule__body: seq(
      s.nonempty($.options),
      s.params_rest($.options, l($.cond), $.else),
      s.if_then_else(
        u(l($.if, $.then), $.cond),
        s.if_then_else($.if, $.then, s._lapply_partial($.else, s.cond())),
        s.if_then_else($.cond, s.ok(), s._lapply_partial($.else, s.cond())),
      ),
    ),
  },
  _test_cond: {
    test__group: "core",
    rule__params: l(),
    rule__body: seq(
      test.collect(
        $.result,
        s.cond(
          l(u(123, 456), u($.result, "foo")),
          l(u(456, 456), u($.result, "bar")),
          u($.result, "baz"),
        ),
        "bar",
      ),
      test.collect(
        $.result,
        s.cond(
          l(u(123, 789), u($.result, "foo")),
          l(u(456, 789), u($.result, "bar")),
          u($.result, "baz"),
        ),
        "baz",
      ),
      test.fail(s.cond()),
      test.fail(
        s.cond(
          l(u(123, 789), u($.result, "foo")),
          l(u(456, 789), u($.result, "bar")),
        ),
      ),
    ),
  },
  match: {
    rule__params: $.params,
    rule__body: seq(
      s.params_rest($.params, l($.pattern, $.match), $.rest),
      s.if_then_else(
        u($.pattern, $.match),
        s.ok(),
        seq(s.nonempty($.rest), s._rapply_partial($.rest, s.match($.pattern))),
      ),
    ),
  },
  match_cond: {
    rule__params: $.params,
    rule__body: seq(
      s.params_rest($.params, l($.pattern, l($.match, $.then)), $.rest),
      s.if_then_else(
        u($.pattern, $.match),
        $.then,
        s.if_then_else(
          s.empty($.rest),
          s.no_match($.pattern),
          s._rapply_partial($.rest, s.match_cond($.pattern)),
        ),
      ),
    ),
  },
  _test_match: {
    test__group: "core",
    rule__params: l(),
    rule__body: seq(
      test.collect(
        $.result,
        s.match(s.foo($.result), s.foo(123), s.bar(456)),
        123,
      ),
      test.collect(
        $.result,
        s.match(s.bar($.result), s.foo(123), s.bar(456)),
        456,
      ),
      test.fail(s.match(s.baz($.result), s.foo(123), s.bar(456))),
    ),
  },
  _test_match_cond: {
    test__group: "core",
    rule__params: l(),
    rule__body: seq(
      test.collect(
        $.result,
        s.match_cond(
          s.foo($.pat),
          l(s.foo(123), u($.result, l($.pat))),
          l(s.bar(456), u($.result, l($.pat, $.pat))),
          l(__, u($.result, l())),
        ),
        l(123),
      ),

      test.collect(
        $.result,
        s.match_cond(
          s.bar($.pat),
          l(s.foo(123), u($.result, l($.pat))),
          l(s.bar(456), u($.result, l($.pat, $.pat))),
          l(__, u($.result, l())),
        ),
        l(456, 456),
      ),

      test.collect(
        $.result,
        s.match_cond(
          s.baz($.pat),
          l(s.foo(123), u($.result, l($.pat))),
          l(s.bar(456), u($.result, l($.pat, $.pat))),
          l(__, u($.result, "ok")),
        ),
        "ok",
      ),

      test.throw(
        s.match_cond(
          s.baz($.pat),
          l(s.foo(123), u($.result, l($.pat))),
          l(s.bar(456), u($.result, l($.pat, $.pat))),
        ),
        s.no_match(s.baz(__)),
      ),
    ),
  },
  each_item_do: {
    file__description: l(
      "for each item in collection, run do block but discard results (e.g. for side effects). succeed if collection is empty.",
    ),
    rule__params: l($.collection, $.item, $.do),
    rule__body: seq(s.block(__, seq(s($.item).in($.collection), $.do))),
  },
  var_expr: {
    rule__params: l($.var, $.expr),
    rule__body: s.cond(s.nonvar($.var), s.expr($.var, $.expr)),
  },
  _test_var: {
    test__group: "core",
    rule__params: l(),
    rule__body: seq(
      test.ok(s.var($.x)),
      test.ok(s.var(__)),
      test.fail(s.var(123)),
    ),
  },

  _test_typechecks: {
    test__group: "core",
    rule__params: l(),
    rule__body: seq(
      test.ok(s.is_string("hello")),
      test.ok(s.is_number(123)),
      test.ok(s.is_box(l())),
      test.ok(s.is_box(s.atom())),
      test.fail(s.is_string(s.atom())),
      test.fail(s.is_number("123")),
      test.fail(s.is_box("")),
    ),
  },
  expr_value: {
    rule__params: l($.expr, $.value),
    rule__body: seq(
      s.type_value($.type, $.value),
      s.match_cond(
        $.type,
        l(s.var(), seq(s.var_name($.value, $.name), u($.expr, s.var($.name)))),
        l(s.number(), u($.expr, s.number($.value))),
        l(s.string(), u($.expr, s.string($.value))),
        l(
          s.box(),
          seq(
            s.box_tag_list($.value, $.tag, $.list_2),
            u($.expr, s.box($.tag, $.list_2)),
          ),
        ),
      ),
    ),
  },

  // expr
  expr: {
    file__description: l("evaluate box tree as expression"),
    rule__params: l($.out, $.expr),
    rule__body: s.apply(l($.out), $.expr),
  },
  expr_number: {
    file__description: l("evaluate box tree as expression"),
    rule__params: l($.out, $.expr),
    rule__body: s.cond(
      l(s.is_number($.expr), u($.out, $.expr)),
      s.apply(l($.out), $.expr),
    ),
  },
  expr_unify: {
    rule__params: l($.left, $.right),
    rule__body: seq(s.expr($.out, $.right), s.expr($.out, $.left)),
  },
  expr_children: {
    rule__params: l($.out, $.children),
    rule__body: s.collect_item_in(
      $.out,
      $.rendered,
      seq(
        s($.value).in($.children), //
        s.expr($.rendered, $.value),
      ),
    ),
  },
  expr_iter: {
    rule__params: $.params,
    rule__body: seq(
      s.params_rest($.params, l($.out, $.iter), $.children),
      $.iter,
      s($.child).in($.children),
      s.expr($.out, $.child),
    ),
  },
  expr_iter_else: {
    rule__params: l($.out, $.iter, $.then, $.else),
    rule__body: seq(
      s.if_then_else($.iter, s($.child).in($.then), s($.child).in($.else)),
      s.expr($.out, $.child),
    ),
  },

  dot: {
    rule__params: l($.out, $.left, $.right),
    rule__body: seq(
      s.apply(l($.subject), $.left),
      s.apply(l($.out, $.subject), $.right),
    ),
  },

  left_right_box_split: {
    rule__params: l($.left, $.right, $.box, $.split),
    rule__body: seq(
      s.slice_box_from_to($.left, $.box, 0, $.split),
      s.slice_box_from_to($.right, $.box, $.split, __),
    ),
  },
  updated_box_index_removed: {
    rule__params: l($.updated, $.box, $.index, $.removed),
    rule__body: seq(
      s.left_right_box_split($.pre, $.mid, $.box, $.index),
      s.append_left_right($.mid, $.removed, $.post),
      s.append_left_right($.updated, $.pre, $.post),
    ),
  },
  _test_updated_box_index_removed: {
    test__group: "core",
    rule__params: l(),
    rule__body: seq(
      test.collect(
        l($.updated, $.removed),
        s.updated_box_index_removed(
          $.res,
          l("foo", "bar", "baz"),
          1,
          l($.removed),
        ),
        l(l("foo", "baz"), "bar"),
      ),
    ),
  },

  ensure_det: {
    rule__params: l($.goal),
    rule__body: seq(
      s.cond(s.ensure_limit(1, $.goal), s.throw(s.expected_det($.goal))),
    ),
  },

  // semidet -> det
  // nondet -> multi
  option: {
    rule__params: l($.opt, $.fn),
    rule__body: s.if_then_else(
      s.expr($.value, $.fn),
      u($.opt, s.some($.value)),
      u($.opt, s.none()),
    ),
  },
  result: {
    rule__params: l($.res, $.fn),
    rule__body: s.try_error_catch(
      seq(s.expr($.value, $.fn), u($.res, s.ok($.value))),
      $.err,
      u($.res, s.error($.err)),
    ),
  },
});
