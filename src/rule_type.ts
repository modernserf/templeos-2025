import { Rec } from "./data";
import { l, r, s, $, __, u } from "./expr";
import { test } from "./test_utils";

export const ruleType = {
  test__value_type: {
    test__group: "rules",
    rule__params: l(),
    rule__body: r(
      test.ok(s.value_type(__, s.var())),
      test.ok(s.value_type($.x, s.var())),
      test.ok(s.value_type(123, s.number())),
      test.ok(s.value_type("hello", s.string())),
      test.ok(s.value_type(s.id(123, "hello"), s.box())),
      test.ok(s.value_type(l(__, __), s.box())),

      u($.y, 123),
      test.ok(s.value_type($.y, s.number())),
    ),
  },
  var: {
    rule__params: l($.item),
    rule__body: s.value_type($.item, s.var()),
  },
  test__var: {
    test__group: "rules",
    rule__params: l(),
    rule__body: r(
      test.ok(s.var($.x)),
      test.ok(s.var(__)),
      test.fail(s.var(123)),
    ),
  },
  nonvar: {
    rule__params: l($.item),
    rule__body: r(s.value_type($.item, $.type), s("/=", $.type, s.var())),
  },
  test__nonvar: {
    test__group: "rules",
    rule__params: l(),
    rule__body: r(
      test.ok(s.nonvar(123)),
      test.ok(s.nonvar(l($.x))),
      test.fail(s.nonvar(__)),
      test.fail(s.nonvar($.x)),
    ),
  },
  string: {
    rule__params: l($.item),
    rule__body: s.value_type($.item, s.string()),
  },
  number: {
    rule__params: l($.item),
    rule__body: s.value_type($.item, s.number()),
  },
  test__typechecks: {
    test__group: "rules",
    rule__params: l(),
    rule__body: r(
      test.ok(s.string("hello")),
      test.ok(s.number(123)),
      test.ok(s.box(l())),
      test.ok(s.box(s.atom())),
      test.fail(s.string(s.atom())),
      test.fail(s.number("123")),
      test.fail(s.box("")),
    ),
  },
  constrain_type: {
    rule__params: l($.item, $.type),
    rule__body: s.value_constraint($.item, s.value_type($.item, $.type)),
  },
  test__constraints: {
    test__group: "rules",
    rule__params: l(),
    rule__body: r(
      test.ok(r(s.constrain_type($.x, s.string()), u($.x, "hello"))),
      test.fail(r(s.constrain_type($.x, s.string()), u($.x, 123))),
      // odd that this fails here but not in the other test
      test.fail(
        s.constrain_type($.x, s.string()),
        s.constrain_type($.x, s.number()),
      ),
      test.fail(
        s.constrain_type($.x, s.number()),
        s.constrain_type($.x, s.string()),
        u($.x, 1),
      ),
      test.fail(
        s.constrain_type($.x, s.string()),
        s.constrain_type($.x, s.number()),
        u($.x, 1),
      ),
      test.fail(
        s.constrain_type($.x, s.string()),
        s.constrain_type($.y, s.number()),
        u($.x, $.y),
        u($.y, 1),
      ),
    ),
  },
  value_expr: {
    rule__params: l($.value, $.expr),
    rule__body: r(
      s.value_type($.value, $.type),
      s.match_cond(
        $.type,
        l(s.var(), r(s.var_name($.value, $.name), u($.expr, s.var($.name)))),
        l(s.number(), u($.expr, s.number($.value))),
        l(s.string(), u($.expr, s.string($.value))),
        l(
          s.box(),
          r(
            s.box_tag_list($.value, $.tag, $.list_2),
            u($.expr, s.box($.tag, $.list_2)),
          ),
        ),
      ),
    ),
  },
} satisfies Record<string, Rec>;
