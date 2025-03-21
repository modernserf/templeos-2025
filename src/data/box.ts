import { l, s, $, __, u, seq, x } from "../expr";
import { pkg_ } from "../pkg";
import { ensure } from "../process";
import { box, k } from "../value";

export const { rules: boxRules, rulePrimitives: boxPrim } = pkg_("box", {
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
  _test_box: {
    test__group: "box",
    rule__params: l(),
    rule__body: seq(
      s.expect_collect(
        l($.tag, $.list),
        s.box(s.foo(123, 456), $.tag, $.list),
        l("foo", l(123, 456)),
      ),
      s.expect_collect($.box, s.box($.box, "bar", l(789)), s.bar(789)),
    ),
  },
  empty: {
    rule__params: l($.box),
    rule__body: s.length(0, $.box),
  },
  nonempty: {
    rule__params: l($.box),
    rule__body: s.none(s.length(0, $.box)),
  },
  length: {
    rule__params: l($.length, $.box),
    rule__primitive: function* (it, length, box) {
      ensure(box, "box");
      if (!it.unify(length, k(box.args.length))) return;
      yield it.result();
    },
  },
  _test_length: {
    test__group: "box",
    rule__params: l(),
    rule__body: seq(
      s.expect_eq(x.length(s.foo()), 0),
      s.expect_eq(x.length(s.bar(1, 2, 3)), 3),
    ),
  },
  at: {
    rule__params: l($.value, $.box, $.index),
    rule__primitive: function* (it, value, b, index) {
      ensure(b, "box");
      ensure(index, "number");
      const i = index.value;
      if (i < 0 || i >= b.args.length) return;
      if (it.unify(value, b.args[i])) yield it.result();
    },
  },
  _test_at: {
    test__group: "box",
    rule__params: l(),
    rule__body: seq(
      s.expect_eq(x.at(s.foo("a", "b", "c"), 1), "b"),
      s.expect_fail(s.at(__, s.foo(), 1)),
    ),
  },
  at_default: {
    rule__params: l($.value, $.box, $.index, $.default),
    rule__body: s.cond(s.at($.value, $.box, $.index), u($.value, $.default)),
  },
  in: {
    rule__params: l($.value, $.box),
    rule__body: seq(
      s.length($.len, $.box),
      s.number_min_to($.index, 0, $.len),
      s.at($.value, $.box, $.index),
    ),
  },
  _test_in: {
    test__group: "box",
    rule__params: l(),
    rule__body: seq(
      s.expect_collect($.value, s.in($.value, s.foo("a", "b")), "a", "b"),
      s.expect_ok(s.in("a", s.bar("a", "b"))),
      s.expect_fail(s.in("c", s.bar("a", "b"))),
    ),
  },
  index_value_box: {
    rule__params: l($.index, $.value, $.box),
    rule__body: seq(
      s.length($.len, $.box),
      s.number_min_to($.index, 0, $.len),
      s.at($.value, $.box, $.index),
    ),
  },
  _test_index_value_box: {
    test__group: "box",
    rule__params: l(),
    rule__body: seq(
      s.expect_collect(
        l($.index, $.value),
        s.index_value_box($.index, $.value, s.foo("a", "b")),
        l(0, "a"),
        l(1, "b"),
      ),

      s.expect_eq(x.index_value_box("a", s.foo("a", "b")), 0),
      s.expect_fail(s.index_value_box(__, "c", s.foo("a", "b"))),
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
    test__group: "box",
    rule__params: l(),
    rule__body: seq(
      s.expect_eq(
        x.updated_box_index_value(s.foo("a", "b"), 0, 123),
        s.foo(123, "b"),
      ),
    ),
  },
  updated_box_index_fn: {
    rule__params: l($.next, $.prev, $.index, $.fn),
    rule__body: seq(
      s.at($.prev_value, $.prev, $.index),
      s.call($.fn, $.next_value, $.prev_value),
      s.updated_box_index_value($.next, $.prev, $.index, $.next_value),
    ),
  },
  left_right_box_split: {
    rule__params: l($.left, $.right, $.box, $.split),
    rule__primitive: function* (it, left, right, append, split) {
      ensure(append, "box");
      ensure(split, "number");
      if (
        it.unify(left, {
          tag: "box",
          id: append.id,
          args: append.args.slice(0, split.value),
        }) &&
        it.unify(right, {
          tag: "box",
          id: append.id,
          args: append.args.slice(split.value),
        })
      ) {
        yield it.result();
      }
    },
  },
  _slice_scan: {
    rule__params: l($.from, $.to, $.slice, $.box),
    rule__body: seq(
      s.length($.l_slice, $.slice),
      s.length($.l_box, $.box),
      s.number_min_max($.to, $.l_slice, $.l_box),
      s.sub($.from, $.to, $.l_slice),
    ),
  },
  slice__primitive: {
    rule__params: l($.slice, $.box, $.from, $.to),
    rule__primitive: function* (it, slice, b, from, to) {
      ensure(b, "box");
      ensure(from, "number");
      ensure(to, "number");
      if (it.unify(slice, box(b.id, b.args.slice(from.value, to.value)))) {
        yield it.result();
      }
    },
  },
  slice: {
    rule__params: l($.slice, $.box, $.from, $.to),
    rule__body: s.if_then_else(
      s.var($.from),
      seq(
        s._slice_scan($.from, $.to, $.slice, $.box),
        s.slice__primitive($.slice, $.box, $.from, $.to),
      ),
      s.slice__primitive($.slice, $.box, $.from, $.to),
    ),
  },
  test__slice: {
    test__group: "box",
    rule__params: l(),
    rule__body: seq(
      s.expect_eq(x.slice(l("a", "b", "c", "d", "e"), 1, 3), l("b", "c")),
      s.expect_collect(
        l($.from, $.to),
        s.slice(l("b", "c"), l("a", "b", "c", "d", "e"), $.from, $.to),
        l(1, 3),
      ),
    ),
  },

  _append_concat: {
    rule__params: l($.append, $.left, $.right),
    rule__primitive: function* (state, append, left, right) {
      ensure(left, "box");
      ensure(right, "box");
      if (left.tag !== right.tag) return;
      if (left.args.length === 0) {
        if (state.unify(right, append)) yield state.result();
      } else {
        if (state.unify(append, box(left.id, left.args.concat(right.args))))
          yield state.result();
      }
    },
  },
  append: {
    rule__params: l($.append, $.left, $.right),
    rule__body: s.if_then_else(
      s.var($.append),
      s._append_concat($.append, $.left, $.right),
      s.if_then_else(
        s.nonvar($.left),
        s.left_right_box_split($.left, $.right, $.append, x.length($.left)),
        s.if_then_else(
          s.nonvar($.right),
          s.left_right_box_split(
            $.left,
            $.right,
            $.append,
            x.sub(x.length($.append), x.length($.right)),
          ),
          seq(
            s.number_min_max($.i, 0, x.length($.append)),
            s.left_right_box_split($.left, $.right, $.append, $.i),
          ),
        ),
      ),
    ),
  },
  _test_append: {
    test__group: "box",
    rule__params: l(),
    rule__body: seq(
      // concat
      s.expect_collect(
        $.append,
        s.append($.append, l("a"), l("b", "c")),
        l("a", "b", "c"),
      ),
      // cons
      s.expect_collect(
        l($.head, $.tail),
        s.append(l("a", "b", "c"), l($.head), $.tail),
        l("a", l("b", "c")),
      ),
      // stack
      s.expect_collect(
        l($.stack, $.pop),
        s.append(l("a", "b", "c"), $.stack, l($.pop)),
        l(l("a", "b"), "c"),
      ),
      // scan
      s.expect_collect(
        $.left,
        s.append(l("a", "b", "c"), $.left, __),
        l(),
        l("a"),
        l("a", "b"),
        l("a", "b", "c"),
      ),
    ),
  },
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
  splice: {
    rule__params: l($.with, $.without, $.index, $.splice),
    rule__body: s.if_then_else(
      s.var($.with),
      // insert
      seq(
        s.left_right_box_split($.l, $.r, $.without, $.index),
        s.append($.splice_r, $.splice, $.r),
        s.append($.with, $.l, $.splice_r),
      ),
      // remove
      seq(
        s.left_right_box_split($.l, $.splice_r, $.with, $.index),
        s.append($.splice_r, $.splice, $.r),
        s.append($.without, $.l, $.r),
      ),
    ),
  },
  _test_splice: {
    test__group: "core",
    rule__params: l(),
    rule__body: seq(
      s.expect_collect(
        $.with,
        s.splice($.with, l("foo", "baz"), 1, l("bar")),
        l("foo", "bar", "baz"),
      ),
      s.expect_collect(
        l($.without, $.removed),
        s.splice(l("foo", "bar", "baz"), $.without, 1, l($.removed)),
        l(l("foo", "baz"), "bar"),
      ),
    ),
  },
});
