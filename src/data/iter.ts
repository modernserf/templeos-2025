import { l, s, $, __, seq, u, fn, alt } from "../expr";
import { pkg } from "../pkg";

export const iter = pkg("iter", {
  _iter: {
    rule__params: l($.iter, $.state, $.fn_next),
    rule__body: u($.iter, s._iter($.state, $.fn_next)),
  },
  _next: {
    rule__params: l($.value, $.next_iter, s._iter($.state, $.fn_next)),
    rule__body: s.call($.fn_next, $.value, $.next_iter, $.state),
  },

  _in: {
    rule__params: l($.out, $.iter),
    rule__body: seq(
      s._next($.value, $.next, $.iter),
      alt(u($.out, $.value), s._in($.out, $.next)),
    ),
  },
  _collect: {
    rule__params: l($.list, $.iter),
    rule__body: s.collect_item_in($.list, $.value, s._in($.value, $.iter)),
  },

  _nil: {
    rule__params: l($.iter),
    rule__body: s._iter($.iter, __, s._nil_next()),
  },
  _nil_next: {
    rule__params: l(__, __, __),
    rule__body: s.fail(),
  },

  _unit: {
    rule__params: l($.iter, $.value),
    rule__body: s._iter($.iter, $.value, s._unit_next()),
  },
  _unit_next: {
    rule__params: l($.value, s.fail(), $.value),
  },

  _list: {
    rule__params: l($.iter, $.list),
    rule__body: s._list_at($.iter, $.list, 0),
  },
  _list_at: {
    rule__params: l($.iter, $.list, $.index),
    rule__body: s._iter($.iter, l($.list, $.index), s._list_next()),
  },
  _list_next: {
    rule__params: l($.value, $.next, l($.list, $.index)),
    rule__body: seq(
      s.value_box_index($.value, $.list, $.index),
      s.inc($.next_index, $.index),
      s._list_at($.next, $.list, $.next_index),
    ),
  },
  _test_list: {
    test__group: "iter",
    rule__params: l(),
    rule__body: seq(
      s.expect_collect(
        $.value,
        seq(
          s._list($.iter, l(1, 2, 3)), //
          s._next($.value, __, $.iter),
        ),
        1,
      ),
      s.expect_collect(
        $.value,
        seq(
          s._list($.iter, l(1, 2, 3)), //
          s._next(__, $.next, $.iter),
          s._next($.value, __, $.next),
        ),
        2,
      ),

      s.expect_collect(
        $.list,
        seq(s._list($.iter, l(1, 2, 3)), s._collect($.list, $.iter)),
        l(1, 2, 3),
      ),
    ),
  },

  _range: {
    rule__params: l($.iter, $.from, $.to),
    rule__body: s._iter($.iter, l($.from, $.to), s._range_next()),
  },
  _range_next: {
    rule__params: l($.from, $.next, l($.from, $.to)),
    rule__body: seq(
      s.cond(s.var($.to), s.lt($.from, $.to)),
      s.inc($.next_from, $.from),
      s._range($.next, $.next_from, $.to),
    ),
  },
  _test_range: {
    test__group: "iter",
    rule__params: l(),
    rule__body: seq(
      s.expect_collect(
        $.list,
        seq(s._range($.iter, 1, 4), s._collect($.list, $.iter)),
        l(1, 2, 3),
      ),
    ),
  },

  _take: {
    rule__params: l($.prefix, $.iter, $.count),
    rule__body: s._iter($.prefix, l($.iter, $.count), s._take_next()),
  },
  _take_next: {
    rule__params: l($.value, $.next, l($.iter, $.count)),
    rule__body: seq(
      s.gt($.count, 0),
      s._next($.value, $.next_iter, $.iter),
      s.inc($.count, $.next_count),
      s._take($.next, $.next_iter, $.next_count),
    ),
  },
  _test_take: {
    test__group: "iter",
    rule__params: l(),
    rule__body: seq(
      s.expect_collect(
        $.list,
        seq(
          s._list($.iter, l(1, 2, 3, 4, 5)),
          s._take($.take, $.iter, 2),
          s._collect($.list, $.take),
        ),
        l(1, 2),
      ),
    ),
  },

  _append: {
    rule__params: l($.append, $.left, $.right),
    rule__body: s._iter($.append, l($.left, $.right), s._append_next()),
  },
  _append_next: {
    rule__params: l($.value, $.next, l($.left, $.right)),
    rule__body: s.if_then_else(
      s._next($.value, $.left_next, $.left),
      s._append($.next, $.left_next, $.right),
      s._next($.value, $.next, $.right),
    ),
  },

  _test_append: {
    test__group: "iter",
    rule__params: l(),
    rule__body: seq(
      s.expect_collect(
        $.list,
        seq(
          s._list($.l, l(1, 2, 3)),
          s._list($.r, l(4, 5)),
          s._append($.iter, $.l, $.r),
          s._collect($.list, $.iter),
        ),
        l(1, 2, 3, 4, 5),
      ),
    ),
  },

  _zip: {
    rule__params: l($.zipped, $.iters),
    rule__body: s._iter($.zipped, $.iters, s._zip_next()),
  },
  _zip_next: {
    rule__params: l($.value, $.next, $.iters),
    rule__body: seq(
      s.map_list(
        $.results,
        $.iters,
        fn(
          l($.value, $.next_iter),
          $.iter,
        )(s._next($.value, $.next_iter, $.iter)),
      ),
      // check that all yielded
      s.length_box($.len, $.iters),
      s.length_box($.len, $.results),

      s.map_list($.value, $.results, s.value_box_index(0)),
      s.map_list($.next_iters, $.results, s.value_box_index(1)),
      s._zip($.next, $.next_iters),
    ),
  },

  _test_zip: {
    test__group: "iter",
    rule__params: l(),
    rule__body: seq(
      s.expect_collect(
        $.zipped,
        seq(
          s._list($.a, l("foo", "bar", "baz")),
          s._list($.b, l(1, 2, 3, 4, 5)),
          s._list($.c, l(123, 456, 789)),
          s._zip($.z, l($.a, $.b, $.c)),
          s._collect($.zipped, $.z),
        ),
        l(l("foo", 1, 123), l("bar", 2, 456), l("baz", 3, 789)),
      ),
    ),
  },

  _enumerate: {
    rule__params: l($.enumerated, $.iter),
    rule__body: seq(
      s._range($.indexes, 0, __),
      s._zip($.enumerated, l($.indexes, $.iter)),
    ),
  },

  _test_enumerate: {
    test__group: "iter",
    rule__params: l(),
    rule__body: seq(
      s.expect_collect(
        $.res,
        seq(
          s._list($.list, l("foo", "bar", "baz")),
          s._enumerate($.iter, $.list),
          s._collect($.res, $.iter),
        ),
        l(l(0, "foo"), l(1, "bar"), l(2, "baz")),
      ),
    ),
  },

  _map: {
    rule__params: l($.mapped, $.iter, $.fn),
    rule__body: s._iter($.mapped, l($.iter, $.fn), s._map_next()),
  },
  _map_next: {
    rule__params: l($.mapped, $.next, l($.iter, $.fn)),
    rule__body: seq(
      s._next($.value, $.next_iter, $.iter),
      s.collect_item_in($.results, $.result, s.call($.fn, $.result, $.value)),
      s._list($.list_iter, $.results),
      s._map($.map_iter, $.next_iter, $.fn),
      s._append($.append_iter, $.list_iter, $.map_iter),
      s._next($.mapped, $.next, $.append_iter),
    ),
  },
  _test_map: {
    test__group: "iter",
    rule__params: l(),
    rule__body: seq(
      s.expect_collect(
        $.result,
        seq(
          s._list($.list, l(1, 2, 3)),
          s._map(
            $.map,
            $.list,
            fn($.out, $.in)(s.gt($.in, 1), alt(u($.out, $.in), u($.out, $.in))),
          ),
          s._collect($.result, $.map),
        ),
        l(2, 2, 3, 3),
      ),
    ),
  },
});
