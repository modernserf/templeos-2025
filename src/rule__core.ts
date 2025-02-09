import { Rec } from "./data";
import { l, r, s, $, __, u } from "./expr";
import { test } from "./test_utils";

export const ruleCore = {
  test__unknown_rule: {
    test__group: "primitives",
    rule__params: l(),
    rule__body: r(
      test.throw(s.doesNotExist(123), s.unknown_rule("doesNotExist")),
    ),
  },
  test__invalid_clause: {
    test__group: "primitives",
    rule__params: l(),
    rule__body: r(test.throw(r(1), s.expected_type("box", 1))),
  },
  test__not_callable_example: {
    db__schema: "schema__any",
  },
  test__not_callable: {
    test__group: "primitives",
    rule__params: l(),
    rule__body: r(
      test.throw(
        s.test__not_callable_example(),
        s.invalid_rule("test__not_callable_example"),
      ),
    ),
  },
  test__wrong_args: {
    test__group: "primitives",
    rule__params: l(),
    rule__body: r(
      test.throw(s("=", 123), s.expected_received(u(__, __), s("=", 123))),
    ),
  },
  "%": {
    rule__params: l(),
    rule__rest_params: $.comments,
    rule__body: r(),
  },
  // primitives
  fail: {
    rule__params: l(),
  },
  test__fail: {
    test__group: "primitives",
    rule__params: l(),
    rule__body: test.fail(s.fail()),
  },
  ok: {
    rule__params: l(),
  },
  test__ok: {
    test__group: "primitives",
    rule__params: l(),
    rule__body: test.ok(s.ok()),
  },
  "=": {
    rule__params: l($.left, $.right),
  },
  "test__=": {
    test__group: "primitives",
    rule__params: l(),
    rule__body: r(
      test.ok(u(1, 1)),
      test.ok(u(1, __)),
      test.collect(
        l($.left, $.right),
        u(l($.left, 456), l(123, $.right)),
        l(123, 456),
      ),
    ),
  },
  "/=": {
    rule__params: l($.left, $.right),
  },
  "test__/=": {
    test__group: "primitives",
    rule__params: l(),
    rule__body: r(
      test.ok(s("/=", 1, 2)),
      test.ok(s("/=", 1, "foo")),
      test.fail(s("/=", 1, 1)),

      test.ok(s("/=", 1, $.x)),
      test.collect($.x, r(s("/=", 1, $.x), u($.x, 2)), 2),
      test.fail(s("/=", 1, $.x), u($.y, 1), u($.x, $.y)),

      test.ok(s("/=", s.foo(1), s.foo($.x))),
      test.ok(s("/=", s.foo(1), s.foo($.x)), u($.x, 2)),
      test.fail(s("/=", s.foo(1), s.foo($.x)), u($.x, 1)),
    ),
  },
  do: {
    rule__params: l(),
    rule__rest_params: $.items,
  },
  test__do: {
    test__group: "primitives",
    rule__params: l(),
    rule__body: r(
      test.ok(r()),
      test.ok(r(s.ok())),
      test.fail(r(s.ok(), s.fail())),

      test.fail(r(u($.x, 1), u($.x, 2))),
    ),
  },
  fork: {
    rule__params: l(),
    rule__rest_params: $.items,
  },
  test__fork: {
    test__group: "primitives",
    rule__params: l(),
    rule__body: r(
      test.fail(s("fork")),
      test.ok(s("fork", s.ok())),
      test.ok(s("fork", s.ok(), s.fail())),

      test.collect($.x, s("fork", u($.x, 1), u($.x, 2)), 1, 2),
    ),
  },
  "¬": {
    rule__params: l($.goal),
  },
  "test__¬": {
    test__group: "primitives",
    rule__params: l(),
    rule__body: r(test.fail(s("¬", s.ok())), test.ok(s("¬", s.fail()))),
  },
  if_then_else: {
    rule__params: l($.if, $.then, $.else),
  },
  test__if_then_else: {
    test__group: "primitives",
    rule__params: l(),
    rule__body: r(
      test.collect(
        $.result,
        s.if_then_else(s.ok(), u($.result, 123), u($.result, 456)),
        123,
      ),
      test.collect(
        $.result,
        s.if_then_else(s.fail(), u($.result, 123), u($.result, 456)),
        456,
      ),
      test.collect(
        $.result,
        s.if_then_else(
          s.ok(),
          s.fork(u($.result, 123), u($.result, 789)),
          u($.result, 456),
        ),
        123,
        789,
      ),
      test.collect(
        $.result,
        s.if_then_else(
          s.list_item(l(123, 789), $.item),
          u($.result, s.item($.item)),
          u($.result, 456),
        ),
        s.item(123),
        s.item(789),
      ),
      test.collect(
        $.result,
        s.if_then_else(
          s.list_item(l(), $.item),
          u($.result, s.item($.item)),
          u($.result, s.empty()),
        ),
        s.empty(),
      ),
    ),
  },
  call: {
    rule__params: l($.id),
    rule__rest_params: $.args,
  },
  test__call: {
    test__group: "primitives",
    rule__params: l(),
    rule__body: r(test.collect($.result, s.call("=", 123, $.result), 123)),
  },
  throw: {
    rule__params: l($.error),
  },
  test__throw: {
    test__group: "primitives",
    rule__params: l(),
    rule__body: r(test.throw(s.throw(s.foo(123)), s.foo(123))),
  },
  try_error_catch: {
    rule__params: l($.try, $.error, $.catch),
  },
  test__try_error_catch: {
    test__group: "primitives",
    rule__params: l(),
    rule__body: r(
      test.collect(
        $.result,
        s.try_error_catch(
          s.throw(s.foo(123)),
          s.foo($.arg),
          u($.result, $.arg),
        ),
        123,
      ),

      test.throw(
        s.try_error_catch(
          s.throw(s.foo(123)),
          s.bar($.arg),
          u($.result, $.arg),
        ),
        s.foo(123),
      ),
    ),
  },
  cond: {
    file__description: l("pattern match on a list of (if, then) pairs"),
    rule__params: l(l($.if, $.then)),
    rule__rest_params: $.else,
    rule__body: s.if_then_else(
      $.if,
      $.then,
      s.if_then_else(u($.else, l()), s.fail(), s.apply(s.cond(), $.else)),
    ),
  },
  test__cond: {
    test__group: "rules",
    rule__params: l(),
    rule__body: r(
      test.collect(
        $.result,
        s.cond(
          l(u(123, 456), u($.result, "foo")),
          l(u(456, 456), u($.result, "bar")),
          l(s.ok(), u($.result, "baz")),
        ),
        "bar",
      ),
      test.collect(
        $.result,
        s.cond(
          l(u(123, 789), u($.result, "foo")),
          l(u(456, 789), u($.result, "bar")),
          l(s.ok(), u($.result, "baz")),
        ),
        "baz",
      ),
      test.fail(
        s.cond(
          l(u(123, 789), u($.result, "foo")),
          l(u(456, 789), u($.result, "bar")),
        ),
      ),
    ),
  },
  match: {
    rule__params: l($.pattern, $.match),
    rule__rest_params: $.rest,
    rule__body: s.if_then_else(
      u($.pattern, $.match),
      s.ok(),
      r(s.nonempty($.rest), s.apply(s.match($.pattern), $.rest)),
    ),
  },
  match_cond: {
    rule__params: l($.pattern, l($.match, $.then)),
    rule__rest_params: $.rest,
    rule__body: s.if_then_else(
      u($.pattern, $.match),
      $.then,
      r(s.nonempty($.rest), s.apply(s.match_cond($.pattern), $.rest)),
    ),
  },
  test__match: {
    test__group: "rules",
    rule__params: l(),
    rule__body: r(
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
  test__match_cond: {
    test__group: "rules",
    rule__params: l(),
    rule__body: r(
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

      test.fail(
        s.match_cond(
          s.baz($.pat),
          l(s.foo(123), u($.result, l($.pat))),
          l(s.bar(456), u($.result, l($.pat, $.pat))),
        ),
      ),
    ),
  },
  each_item_do: {
    file__description: l(
      "for each item in collection, run do block but discard results (e.g. for side effects). succeed if collection is empty.",
    ),
    rule__params: l($.collection, $.item, $.do),
    rule__body: s.if_then_else(
      u($.collection, l()),
      s.ok(),
      s.collect(__, r(s.list_item($.collection, $.item), $.do), __),
    ),
  },
  collect_empty: {
    rule__params: l($.pattern, $.goal, $.result),
    rule__body: s.if_then_else(
      s.collect($.pattern, $.goal, $.result),
      s.ok(),
      u($.result, l()),
    ),
  },

  if_var: {
    file__description: l("if arg is var, run body"),
    rule__params: l($.arg, $.body),
    rule__body: s.if_then_else(s.var($.arg), $.body, r()),
  },
} satisfies Record<string, Rec>;
