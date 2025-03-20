import { l, s, $, __, u, seq, x, alt } from "../expr";
import { pkg_ } from "../pkg";
import { ensure, State } from "../process";
import { box, k } from "../value";
import { test } from "./test_utils";

export const { rules: core, rulePrimitives: corePrimitives } = pkg_("core", {
  type_value: {
    rule__params: l($.type, $.value),
    rule__primitive: function* (it, type, value) {
      const t = value.tag === "fresh" ? "var" : value.tag;
      if (it.unify(type, box(t, []))) yield it.result();
    },
  },
  test__type_value: {
    test__group: "core",
    rule__params: l(),
    rule__body: seq(
      test.ok(s.type_value(s.var(), __)),
      test.ok(s.type_value(s.var(), $._x)),
      test.ok(s.type_value(s.number(), 123)),
      test.ok(s.type_value(s.string(), "hello")),
      test.ok(s.type_value(s.box(), s.id(123, "hello"))),
      test.ok(s.type_value(s.box(), l(__, __))),

      s.unify($.y, 123),
      test.ok(s.type_value(s.number(), $.y)),
    ),
  },

  unpack_expand: {
    rule__params: l($.content, $.expand),
    rule__primitive: function* (it, content, expand) {
      if (expand.tag !== "expand") return;
      if (it.unify(content, expand.value)) yield it.result();
    },
  },
  ident_var: {
    rule__params: l($.ident, $.var),
    rule__primitive: function* (it, ident, v) {
      if (v.tag === "fresh") return;
      ensure(v, "var");
      if (it.unify(ident, k(v.fact.name))) yield it.result();
    },
  },
  _test_ident_var: {
    test__group: "primitives",
    rule__params: l(),
    test__flags: l(s.ignore_single_vars()),
    rule__body: seq(
      s.expect_eq(x.ident_var($.foo), "foo"),
      s.expect_fail(s.ident_var(__, __)),
      s.expect_throw(s.ident_var(__, 123), s.expected_type(s.var(), 123)),
    ),
  },

  length_box: {
    rule__params: l($.length, $.box),
    rule__primitive: function* (it, length, box) {
      ensure(box, "box");
      if (!it.unify(length, k(box.args.length))) return;
      yield it.result();
    },
  },
  test__length_box: {
    test__group: "primitives",
    rule__params: l(),
    rule__body: seq(
      test.collect($.len, s.length_box($.len, s.foo()), 0),
      test.collect($.len, s.length_box($.len, s.bar(1, 2, 3)), 3),
    ),
  },
  box: {
    rule__params: l($.box, $.tag, $.list),
    rule__primitive: function* (it, aBox, tag, list) {
      if (aBox.tag === "box") {
        const { id, args } = aBox;
        if (it.unify(tag, k(id)) && it.unify(list, box("", args))) {
          yield it.result();
        }
      } else if (tag.tag === "string" && list.tag === "box") {
        if (it.unify(aBox, box(tag.value, list.args))) {
          yield it.result();
        }
      }
    },
  },
  test__box: {
    test__group: "primitives",
    rule__params: l(),
    rule__body: seq(
      test.collect(
        l($.tag, $.list),
        s.box(s.foo(123, 456), $.tag, $.list),
        l("foo", l(123, 456)),
      ),
      test.collect($.box, s.box($.box, "bar", l(789)), s.bar(789)),
    ),
  },
  // Why this order?
  // value = box[index]
  // expr(value, value_box_index(box, index))
  // pipe(value, box, value_box_index(index))
  value_box_index: {
    rule__params: l($.value, $.box, $.index),
    rule__primitive: function* (it, value, b, index) {
      ensure(b, "box");
      if (index.tag === "number") {
        const i = index.value;
        if (i < 0 || i >= b.args.length) return;
        if (it.unify(value, b.args[i])) {
          yield it.result();
        }
      } else {
        for (let i = 0; i < b.args.length; i++) {
          yield* it.unifyChoice(
            box("", [index, value]),
            box("", [k(i), b.args[i]]),
          );
        }
      }
    },
  },
  test__value_box_index: {
    test__group: "primitives",
    rule__params: l(),
    rule__body: seq(
      // get
      test.collect(
        $.value,
        s.value_box_index($.value, s.pair(123, 456), 0),
        123,
      ),
      // iter
      test.collect(
        l($.index, $.value),
        s.value_box_index($.value, s.pair(123, 456), $.index),
        l(0, 123),
        l(1, 456),
      ),
      // find
      test.collect(
        $.index,
        s.value_box_index(456, s.pair(123, 456), $.index),
        1,
      ),
    ),
  },
  updated_box_index_value: {
    rule__params: l($.updated, $.box, $.index, $.value),
    rule__primitive: function* (it, updated, b, index, value) {
      ensure(b, "box");
      ensure(index, "number");
      const i = index.value;

      if (i < 0 || i >= b.args.length) return;
      const nextArgs = b.args.slice();
      nextArgs[i] = value;
      if (it.unify(updated, box(b.id, nextArgs))) {
        yield it.result();
      }
    },
  },
  test__updated_box_index_value: {
    test__group: "primitives",
    rule__params: l(),
    rule__body: seq(
      test.collect(
        $.value,
        s.updated_box_index_value($.value, s.foo("a", "b"), 0, 123),
        s.foo(123, "b"),
      ),
    ),
  },
  slice_box_from_to: {
    rule__params: l($.slice, $.box, $.from, $.to),
    rule__primitive: function* (it, slice, b, from, to) {
      ensure(b, "box");
      const fromVal = from.tag == "number" ? from.value : 0;
      const toVal = to.tag == "number" ? to.value : b.args.length;
      if (
        it.unify(from, k(fromVal)) &&
        it.unify(to, k(toVal)) &&
        it.unify(slice, box(b.id, b.args.slice(fromVal, toVal)))
      ) {
        yield it.result();
      }
    },
  },
  test__slice_box_from_to: {
    test__group: "primitives",
    rule__params: l(),
    rule__body: seq(
      // all outputs
      test.collect(
        l($.from, $.to, $.slice),
        s.slice_box_from_to($.slice, l("a", "b", "c"), $.from, $.to),
        l(0, 3, l("a", "b", "c")),
      ),
      // subset
      test.collect(
        $.slice,
        s.slice_box_from_to($.slice, l("a", "b", "c"), 1, __),
        l("b", "c"),
      ),
    ),
  },
  append: {
    rule__params: l($.append, $.left, $.right),
    rule__primitive: function* (state, append, left, right) {
      if (left.tag == "box" && right.tag == "box") {
        if (left.tag !== right.tag) return;
        if (left.args.length === 0) {
          if (state.unify(right, append)) yield state.result();
        } else {
          if (state.unify(append, box(left.id, left.args.concat(right.args))))
            yield state.result();
        }
        return;
      }
      ensure(append, "box");
      const unifySplit = (st: State, split: number) =>
        st.unify(left, {
          tag: "box",
          id: append.id,
          args: append.args.slice(0, split),
        }) &&
        st.unify(right, {
          tag: "box",
          id: append.id,
          args: append.args.slice(split),
        });

      if (left.tag == "box" && unifySplit(state, left.args.length)) {
        yield state.result();
      } else if (
        right.tag == "box" &&
        unifySplit(state, append.args.length - right.args.length)
      ) {
        yield state.result();
      } else {
        for (let i = 0; i <= append.args.length; i++) {
          const s = state.choice();
          if (unifySplit(state, i)) yield state.result();
          state.backtrack(s);
        }
      }
    },
  },
  test__append: {
    test__group: "primitives",
    rule__params: l(),
    rule__body: seq(
      // concat
      s.expect_collect(
        $.append,
        s.append($.append, l("a"), l("b", "c")),
        l("a", "b", "c"),
      ),
      // cons
      test.collect(
        l($.head, $.tail),
        s.append(l("a", "b", "c"), l($.head), $.tail),
        l("a", l("b", "c")),
      ),
      // stack
      test.collect(
        l($.stack, $.pop),
        s.append(l("a", "b", "c"), $.stack, l($.pop)),
        l(l("a", "b"), "c"),
      ),
      // scan
      test.collect(
        $.left,
        s.append(l("a", "b", "c"), $.left, __),
        l(),
        l("a"),
        l("a", "b"),
        l("a", "b", "c"),
      ),
    ),
  },

  id: {
    rule__params: l($.id),
    rule__primitive: function* (it, id) {
      if (it.unify(id, k(crypto.randomUUID()))) yield it.result();
    },
  },
  // fields
  // TODO: foo_field($.value, $.id) -> value_record_field($.value, $.id, "foo_field")
  db__schema: {
    db__schema: "field",
    file__name: "DB Schema",
    file__description: l("schema used to validate & render this record"),
    field__type: s.ref("schema"),
    field__index: s.ref(),
  },
  time__created: {
    db__schema: "field",
    file__name: "Time created",
    field__type: s.t_timestamp(),
    field__index: s.sorted(),
  },
  rule__params: {
    db__schema: "field",
    file__name: "Rule params",
    field__type: s.list_of(s.any_type()),
  },
  rule__body: {
    db__schema: "field",
    file__name: "Rule body",
    field__type: s.goal(),
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
  list: {
    rule__params: $.params,
    rule__body: seq(
      s.params_rest($.params, l($.out), $.items),
      s.box($.out, "", $.items),
    ),
  },
  _test_list_recursive: {
    rule__params: l($.value, $.expr),
    rule__body: s.match_cond(
      $.expr,
      l(s.value($.value), s.ok()),
      l(
        s.pair($.left, $.right),
        alt(
          s._test_list_recursive($.value, $.left),
          s._test_list_recursive($.value, $.right),
        ),
      ),
      l(
        s.list($.list),
        seq(
          s.value_box_index($.sub_expr, $.list, __),
          s._test_list_recursive($.value, $.sub_expr),
        ),
      ),
    ),
  },
  _test_list: {
    test__group: "core",
    rule__params: l(),
    rule__body: seq(
      s.expect_eq(x.list(1, x.in(l()), x.in(l(2, 3))), l(1, 2, 3)),

      s.expect_eq(
        x.list(
          x._test_list_recursive(
            s.pair(s.value(1), s.pair(s.value(2), s.value(3))),
          ),
        ),
        l(1, 2, 3),
      ),

      s.expect_eq(
        x.list(
          x._test_list_recursive(s.list(l(s.value(1), s.value(2), s.value(3)))),
        ),
        l(1, 2, 3),
      ),
    ),
  },
  result_if: {
    rule__params: l($.result, $.if, $.then_f, $.else_f),
    rule__body: s.if_then_else(
      $.if,
      s.call($.then_f, $.result),
      s.call($.else_f, $.result),
    ),
  },
  bool_goal: {
    rule__params: l($.bool, $.goal),
    rule__body: s.if_then_else(
      s.block(__, $.goal),
      u($.bool, s.ok()),
      u($.bool, s.fail()),
    ),
  },
  value_box_index_default: {
    rule__params: l($.value, $.box, $.index, $.default),
    rule__body: s.cond(
      s.value_box_index($.value, $.box, $.index),
      u($.value, $.default),
    ),
  },
  every: {
    rule__params: l($.if, $.then),
    rule__body: seq(
      s.id($.id),
      s.try_error_catch(
        s.block(__, seq($.if, s.cond($.then, s.throw(s.fail($.id))))),
        s.fail($.id),
        s.fail(),
      ),
    ),
  },

  // TODO: check performance on this, maybe want native impl for this
  append_box_prefix: {
    file__description: l(
      "prepend elements of prefix to box, keeping box's tag",
    ),
    rule__params: l($.updated, $.target, $.left),
    rule__body: seq(
      s.box($.target, $.tag, $.right),
      s.append($.next, $.left, $.right),
      s.box($.updated, $.tag, $.next),
    ),
  },
  append_box_suffix: {
    file__description: l("append elements of suffix to box, keeping box's tag"),
    rule__params: l($.updated, $.target, $.right),
    rule__body: seq(
      s.box($.target, $.tag, $.left),
      s.append($.next, $.left, $.right),
      s.box($.updated, $.tag, $.next),
    ),
  },
  params_rest: {
    rule__params: l($.params, $.required, $.rest),
    rule__body: s.if_then_else(
      s.append($.params, $.required, $.rest),
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
      l(u($.fn, s.fn($._params, $._goal)), s._apply_fn($.args, $.fn)),
      l(s.is_box($.fn), s.apply__primitive($.args, $.fn)),
      l(s.string($.fn), s._apply_id($.args, $.fn)),
      s.throw(s.invalid_apply($.args, $.fn)),
    ),
  },
  _apply_id: {
    rule__params: l($.args, $.id),
    rule__body: seq(s.box($.callable, $.id, $.args), $.callable),
  },
  _apply_fn: {
    rule__params: l($.args, $.fn),
    rule__body: seq(
      s.resolve_deep(s.fn($.params, $.goal), $.fn),
      u($.args, $.params),
      $.goal,
    ),
  },
  _rapply_partial: {
    rule__params: l($.args, $.fn),
    rule__body: seq(s.append_box_suffix($.callable, $.fn, $.args), $.callable),
  },
  empty: {
    rule__params: l($.box),
    rule__body: s.box($.box, __, l()),
  },
  nonempty: {
    rule__params: l($.box),
    rule__body: s.none(s.box($.box, __, l())),
  },
  cond: {
    rule__params: $.params,
    rule__body: seq(
      s.nonempty($.params),
      s.params_rest($.params, l($.cond), $.else),
      s.if_then_else(
        u(l($.if, $.then), $.cond),
        s.if_then_else($.if, $.then, s.apply__primitive($.else, s.cond())),
        s.if_then_else($.cond, s.ok(), s.apply__primitive($.else, s.cond())),
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
  or_default: {
    rule__params: l($.val, $.default),
    rule__body: s.cond(s.nonvar($.val), u($.val, $.default)),
  },
  _test_var: {
    test__group: "core",
    rule__params: l(),
    rule__body: seq(
      test.ok(s.var($._x)),
      test.ok(s.var(__)),
      test.fail(s.var(123)),
    ),
  },

  _test_typechecks: {
    test__group: "core",
    rule__params: l(),
    rule__body: seq(
      test.ok(s.string("hello")),
      test.ok(s.number(123)),
      test.ok(s.is_box(l())),
      test.ok(s.is_box(s.atom())),
      test.fail(s.string(s.atom())),
      test.fail(s.number("123")),
      test.fail(s.is_box("")),
    ),
  },
  left_right_box_split: {
    rule__params: l($.left, $.right, $.box, $.split),
    rule__body: seq(
      s.slice_box_from_to($.left, $.box, 0, $.split),
      s.slice_box_from_to($.right, $.box, $.split, __),
    ),
  },
  updated_box_index_fn: {
    rule__params: l($.next, $.prev, $.index, $.fn),
    rule__body: seq(
      s.value_box_index($.prev_value, $.prev, $.index),
      s.call($.fn, $.next_value, $.prev_value),
      s.updated_box_index_value($.next, $.prev, $.index, $.next_value),
    ),
  },
  updated_box_index_removed: {
    rule__params: l($.updated, $.box, $.index, $.removed),
    rule__body: seq(
      s.left_right_box_split($.pre, $.mid, $.box, $.index),
      s.append($.mid, $.removed, $.post),
      s.append($.updated, $.pre, $.post),
    ),
  },
  _test_updated_box_index_removed: {
    test__group: "core",
    rule__params: l(),
    rule__body: seq(
      test.collect(
        l($.updated, $.removed),
        s.updated_box_index_removed(
          $.updated,
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
      s.call($.fn, $.value),
      u($.opt, s.some($.value)),
      u($.opt, s.none()),
    ),
  },
  result: {
    rule__params: l($.res, $.fn),
    rule__body: s.try_error_catch(
      seq(s.call($.fn, $.value), u($.res, s.ok($.value))),
      $.err,
      u($.res, s.error($.err)),
    ),
  },
});
