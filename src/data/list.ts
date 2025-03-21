import { pkg } from "../pkg";
import { l, s, $, __, u, seq, alt, x } from "../expr";

export const { rules: list } = pkg("list", {
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
          s.in($.sub_expr, $.list),
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
  _scan: {
    rule__params: l($.next_state, $.init, $.list, $.fn),
    rule__body: s.loop_iter(
      l($.next_state, $.next_index),
      l($.state, $.index),
      l($.init, 0),
      s.if_then_else(
        s.length($.index, $.list),
        s.fail(),
        seq(
          s.at($.item, $.list, $.index),
          s.inc($.next_index, $.index),
          s.ensure_det(s.apply(l($.next_state, $.state, $.item), $.fn)),
          // s.apply(l($.next_state, $.state, $.item), $.fn),
        ),
      ),
    ),
  },
  fold_list: {
    rule__params: l($.next_state, $.init, $.list, $.fn),
    rule__body: seq(
      s.block(
        $.next_state,
        alt(
          u($.next_state, $.init),
          s._scan($.next_state, $.init, $.list, $.fn),
        ),
      ),
    ),
  },
  _test_fold_list: {
    test__group: "list",
    rule__params: l(),
    rule__body: seq(
      s.expect_collect(
        $.result,
        s.fold_list($.result, 0, l(1, 2, 3, 4, 5), s.add()),
        15,
      ),
    ),
  },
  fold_op: {
    rule__params: l($.result, $.list, $.fn),
    rule__body: seq(
      s.append($.list, l($.first), $.rest),
      s.fold_list($.result, $.first, $.rest, $.fn),
    ),
  },
  map_list: {
    rule__params: l($.mapped, $.list, $.fn),
    rule__body: s.collect_item_in(
      $.mapped,
      $.mapped_item,
      seq(s($.item).in($.list), s.apply(l($.mapped_item, $.item), $.fn)),
    ),
  },
  _test_map_list: {
    test__group: "list",
    rule__params: l(),
    rule__body: seq(
      s.expect_collect(
        $.mapped,
        s.map_list($.mapped, l(1, 2, 3), s.add(1)),
        l(2, 3, 4),
      ),
      s.expect_collect(
        $.filter_mapped,
        s.map_list(
          $.filter_mapped,
          l(1, 2, 3),
          s.fn(l(s.wrap($.value), $.value), s.lt($.value, 3)),
        ),
        l(s.wrap(1), s.wrap(2)),
      ),
      s.expect_collect(
        $.flat_mapped,
        s.map_list(
          $.flat_mapped,
          l(1, 2, 3),
          s.fn(l($.value, $.value), alt(s.ok(), s.ok())),
        ),
        l(1, 1, 2, 2, 3, 3),
      ),
    ),
  },
  filter_list: {
    rule__params: l($.filtered, $.list, $.fn),
    rule__body: s.collect_item_in(
      $.filtered,
      $.item,
      seq(s($.item).in($.list), s.apply(l($.item), $.fn)),
    ),
  },
  _test_filter_list: {
    test__group: "list",
    rule__params: l(),
    rule__body: seq(
      s.expect_collect(
        $.res,
        s.filter_list($.res, l(1, 2, 3), s.lt(3)),
        l(1, 2),
      ),

      s.expect_collect(
        $.res,
        s.filter_list($.res, l(1, 2, 3), s.fn(l(__), alt(s.ok(), s.ok()))),
        l(1, 1, 2, 2, 3, 3),
      ),
    ),
  },
  zip_lists: {
    rule__params: l($.zipped, $.lists, $.fn),
    rule__body: s.collect_item_in(
      $.zipped,
      $.zipped_item,
      seq(
        s.nonempty($.lists),
        s.map_list($.lens, $.lists, s.length()),
        s.fold_op($.len, $.lens, s.min()),
        s.sub($.len_, $.len, 1),

        s($.i).number_min_max(0, $.len_),
        s.map_list($.items, $.lists, s.at($.i)),
        s.append($.args, l($.zipped_item), $.items),
        s.apply($.args, $.fn),
      ),
    ),
  },
  _test_zip: {
    test__group: "list",
    rule__params: l(),
    rule__body: seq(
      s.expect_collect(
        $.result,
        s.zip_lists($.result, l(l(1, 2, 3), l(10, 20)), s.add()),
        l(11, 22),
      ),
    ),
  },

  _every: {
    rule__params: l($.list, $.fn),
    rule__body: s.cond(
      s.empty($.list),
      s.every(s($.item).in($.list), s.call($.fn, $.item)),
    ),
  },
  _test_every: {
    test__group: "list",
    rule__params: l(),
    rule__body: seq(
      s.expect_ok(s._every(l(10, 11, 12), s.gt(5))),
      s.expect_ok(s._every(l(), s.gt(5))),
      s.expect_fail(s._every(l(3, 11, 12), s.gt(5))),
    ),
  },
});
