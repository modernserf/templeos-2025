import { l, s, $, __, u, seq, x } from "../expr";
import { pkg_ } from "../pkg";
import { ensure } from "../process";
import { box, k } from "../value";
import { test } from "./test_utils";

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

  empty: {
    rule__params: l($.box),
    rule__body: s.box($.box, __, l()),
  },
  nonempty: {
    rule__params: l($.box),
    rule__body: s.none(s.box($.box, __, l())),
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
  value_box_index_default: {
    rule__params: l($.value, $.box, $.index, $.default),
    rule__body: s.cond(
      s.value_box_index($.value, $.box, $.index),
      u($.value, $.default),
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
  updated_box_index_fn: {
    rule__params: l($.next, $.prev, $.index, $.fn),
    rule__body: seq(
      s.value_box_index($.prev_value, $.prev, $.index),
      s.call($.fn, $.next_value, $.prev_value),
      s.updated_box_index_value($.next, $.prev, $.index, $.next_value),
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
  // TODO slice_range(slice, box, range)

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
      return;
    },
  },
  append: {
    rule__params: l($.append, $.left, $.right),
    rule__body: s.if_then_else(
      s.var($.append),
      s._append_concat($.append, $.left, $.right),
      s.if_then_else(
        s.nonvar($.left),
        s.left_right_box_split($.left, $.right, $.append, x.length_box($.left)),
        s.if_then_else(
          s.nonvar($.right),
          s.left_right_box_split(
            $.left,
            $.right,
            $.append,
            x.sub(x.length_box($.append), x.length_box($.right)),
          ),
          seq(
            s.number_min_max($.i, 0, x.length_box($.append)),
            s.left_right_box_split($.left, $.right, $.append, $.i),
          ),
        ),
      ),
    ),
  },
  _test_append: {
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
});
