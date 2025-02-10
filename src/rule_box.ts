import { Rec } from "./data";
import { l, r, s, $, __, u } from "./expr";
import { test } from "./test_utils";

export const ruleBox = {
  box: {
    file__description: l(
      "A box is a data structure with a tag and a list of values.",
    ),
    rule__params: l($.item),
    rule__body: s.value_type($.item, s.box()),
  },
  test_box: {
    test__group: "box",
    rule__params: l(),
    rule__body: r(
      test.ok(s.box(l())),
      test.ok(s.box(s.box(1, 2, 3))),
      test.fail(s.box("hello")),
    ),
  },
  empty: {
    rule__params: l($.box),
    rule__body: s.box_length($.box, 0),
  },
  nonempty: {
    rule__params: l($.box),
    rule__body: r(s.box_length($.box, $.n), s("/=", $.n, 0)),
  },
  box_length: {
    file__description: l("length is the number of values in the box."),
    rule__params: l($.box, $.length),
  },
  test__box_length: {
    test__group: "box",
    rule__params: l(),
    rule__body: r(
      test.collect($.len, s.box_length(s.pair(123, __), $.len), 2),
      test.throw(s.box_length("foo", __), s.expected_type("box", __)),
    ),
  },
  box_tag_length: {
    file__description: l(
      "get the tag and length of a box, or generate a box with this tag and length, filled with vars",
    ),
    rule__params: l($.box_1, $.tag, $.length),
    rule__body: s.if_then_else(
      s.var($.box_1),
      s._box_tag_length_gen($.tag, l(), $.length, $.box_1),
      r(s.box_tag_list($.box_1, $.tag, __), s.box_length($.box_1, $.length)),
    ),
  },
  _box_tag_length_gen: {
    rule__params: l($.tag, $.list_2, $.length, $.out),
    rule__body: s.if_then_else(
      s.box_length($.list_2, $.length),
      s.box_tag_list($.out, $.tag, $.list_2),
      r(
        s.box_box_append($.list_2, l(__), $.next),
        s._box_tag_length_gen($.tag, $.next, $.length, $.out),
      ),
    ),
  },
  test__box_tag_length: {
    test__group: "box",
    rule__params: l(),
    rule__body: r(
      test.collect($.len, s.box_tag_length(l(), __, $.len), 0),
      test.collect($.len, s.box_tag_length(l(__), __, $.len), 1),
      test.collect($.len, s.box_tag_length(l(1, 2, 3), __, $.len), 3),

      test.collect($.box_1, s.box_tag_length($.box_1, "", 0), l()),
      test.collect(
        $.box_1,
        s.box_tag_length($.box_1, "children", 3),
        s.children(__, __, __),
      ),
    ),
  },
  box_tag_list: {
    file__description: l(
      "get the tag and list of a box, or construct a box from a tag and list",
    ),
    rule__params: l($.box_1, $.tag, $.list_2),
  },
  test__box_tag_list: {
    test__group: "box",
    rule__params: l(),
    rule__body: r(
      test.collect(
        l($.id, $.args),
        s.box_tag_list(s.pair(123, 456), $.id, $.args),
        l("pair", l(123, 456)),
      ),
      test.collect(
        $.box_1,
        s.box_tag_list($.box_1, "pair", l(123, 456)),
        s.pair(123, 456),
      ),
    ),
  },
  box_at_value: {
    rule__params: l($.box_1, $.index, $.value),
  },
  test__box_at_value: {
    test__group: "box",
    rule__params: l(),
    rule__body: r(
      // get
      test.collect($.value, s.box_at_value(s.pair(123, 456), 0, $.value), 123),
      s.set_context("trace_enabled", l()),
      // iter
      test.collect(
        l($.index, $.value),
        s.box_at_value(s.pair(123, 456), $.index, $.value),
        l(0, 123),
        l(1, 456),
      ),
      // find
      test.collect($.index, s.box_at_value(s.pair(123, 456), $.index, 456), 1),
      // unique states
      // test.collect($.id, s.box_at_value(s.pair(123, 456), __, __), "pair"),
    ),
  },
  box_at_value_updated: {
    file__description: l(""),
    rule__params: l($.box, $.index, $.next_value, $.next_box),
  },
  test__box_at_value_updated: {
    test__group: "box",
    rule__params: l(),
    rule__body: r(
      test.collect(
        $.value,
        s.box_at_value_updated(s.foo("a", "b"), 0, 123, $.value),
        s.foo(123, "b"),
      ),
    ),
  },
  box_changelist_updated: {
    rule__params: l($.box_1, $.changelist, $.next_box),
  },
  box_from_to_slice: {
    rule__params: l($.box_1, $.from_index, $.to_index, $.slice),
  },
  test__box_from_to_slice: {
    test__group: "box",
    rule__params: l(),
    rule__body: r(
      // all outputs
      test.collect(
        l($.from, $.to, $.slice),
        s.box_from_to_slice(l("a", "b", "c"), $.from, $.to, $.slice),
        l(0, 3, l("a", "b", "c")),
      ),
      // subset
      test.collect(
        $.slice,
        s.box_from_to_slice(l("a", "b", "c"), 1, __, $.slice),
        l("b", "c"),
      ),
    ),
  },
  test__box_box_append: {
    test__group: "box",
    rule__params: l(),
    rule__body: r(
      // concat
      test.collect(
        $.append,
        s.box_box_append(l("a"), l("b", "c"), $.append),
        l("a", "b", "c"),
      ),
      // cons
      test.collect(
        l($.head, $.tail),
        s.box_box_append(l($.head), $.tail, l("a", "b", "c")),
        l("a", l("b", "c")),
      ),
      // stack
      test.collect(
        l($.stack, $.pop),
        s.box_box_append($.stack, l($.pop), l("a", "b", "c")),
        l(l("a", "b"), "c"),
      ),
      // scan
      test.collect(
        $.left,
        s.box_box_append($.left, __, l("a", "b", "c")),
        l(),
        l("a"),
        l("a", "b"),
        l("a", "b", "c"),
      ),
    ),
  },
  box_at_inserted_splice: {
    rule__params: l($.box, $.at, $.inserted, $.splice),
    rule__body: r(
      s.box_from_to_slice($.box, __, $.at, $.prefix),
      s.box_from_to_slice($.box, $.at, __, $.suffix),
      s.box_box_append($.prefix, $.inserted, $.left),
      s.box_box_append($.left, $.suffix, $.splice),
    ),
  },
  test_box_at_inserted_splice: {
    test__group: "box",
    rule__params: l(),
    rule__body: r(
      test.collect(
        $.splice,
        s.box_at_inserted_splice(l(1, 2, 3), 1, l("foo", "bar"), $.splice),
        l(1, "foo", "bar", 2, 3),
      ),
    ),
  },
  box_at_removed_splice: {
    rule__params: l($.box, $.at, $.removed, $.splice),
    rule__body: r(
      // if at is not provided, scan across list for match on removed
      s.box_tag_length($.box, __, $.len),
      s.number_min_max($.at, 0, $.len),

      s.box_from_to_slice($.box, __, $.at, $.prefix),
      s.box_from_to_slice($.box, $.at, __, $.rest),
      s.box_box_append($.removed, $.suffix, $.rest),
      s.box_box_append($.prefix, $.suffix, $.splice),
    ),
  },
  test__box_at_removed_splice: {
    test__group: "box",
    rule__params: l(),
    rule__body: r(
      test.collect(
        l($.removed, $.splice),
        s.box_at_removed_splice(l(1, 2, 3), 1, l($.removed), $.splice),
        l(2, l(1, 3)),
      ),

      test.collect(
        l($.first, $.second, $.splice),
        s.box_at_removed_splice(
          l(1, 2, 3, 4, 5),
          1,
          l($.first, $.second),
          $.splice,
        ),
        l(2, 3, l(1, 4, 5)),
      ),

      test.collect(
        $.splice,
        s.box_at_removed_splice(l(1, 2, 3, 4, 5), __, l(3, 4), $.splice),
        l(1, 2, 5),
      ),
      test.collect(
        l($.l, $.r),
        s.box_at_removed_splice(l(1, 2, 3, 4, 5), __, l($.l, $.r), __),
        l(1, 2),
        l(2, 3),
        l(3, 4),
        l(4, 5),
      ),

      test.collect(
        l($.removed, $.splice),
        s.box_at_removed_splice(l(1, 2, 3, 4, 5), 2, $.removed, $.splice),
        l(l(), l(1, 2, 3, 4, 5)),
        l(l(3), l(1, 2, 4, 5)),
        l(l(3, 4), l(1, 2, 5)),
        l(l(3, 4, 5), l(1, 2)),
      ),

      test.collect(
        l($.at, $.removed),
        s.box_at_removed_splice(l(1, 2, 3, 4, 5), $.at, $.removed, l(1, 2, 5)),
        l(2, $(3, 4)),
      ),
    ),
  },
  box_list_append: {
    file__description: l(
      "concatenate the items of two boxes, and use the left box's tag",
    ),
    rule__params: l($.box_1, $.added, $.updated),
    rule__body: r(
      s.box_tag_list($.box_1, $.tag, $.list_2),
      s.box_box_append($.list_2, $.added, $.next_list),
      s.box_tag_list($.updated, $.tag, $.next_list),
    ),
  },
  list: {
    file__description: l(
      "A list is a box with the empty string as its tag. Lists are used both as anonymous tuples and variable-length collections.",
    ),
    rule__params: l($.list),
    rule__body: s.box_tag_list($.list, "", __),
  },

  list_item: {
    rule__params: l($.list, $.item),
  },
  test__list_item: {
    test__group: "list",
    rule__params: l(),
    rule__body: r(
      test.ok(s.list_item(l(1, 2, 3), 1)),
      test.fail(s.list_item(l(1, 2, 3), 4)),
      test.fail(s.list_item(l(), __)),
      test.fail(s.list_item(s.tuple(1, 2, 3), __)),

      test.collect($.x, s.list_item(l(1, 2, 3), $.x), 1, 2, 3),

      u($.plist, l(s.foo(123), s.bar(456))),
      test.collect($.value, s.list_item($.plist, s.foo($.value)), 123),
    ),
  },
} satisfies Record<string, Rec>;
