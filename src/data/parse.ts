import { l, s, $, __, seq, fn, alt, u } from "../expr";
import { pkg } from "../pkg";

export const parse = pkg("parse", {
  parse: {
    rule__params: l($.result, $.string, $.parser),
    rule__body: seq(
      s.call($.parser, $.result, $.out, s._state($.string, 0)),
      s._end(__, __, $.out),
    ),
  },
  _state_index: {
    rule__params: l($.index, s._state(__, $.index)),
  },
  _state: {
    rule__params: l(s._state($.string, 0), $.string),
  },
  _ok: {
    rule__params: l(s._ok(), $.state, $.state),
  },
  _fail: {
    rule__params: l(__, $.state, $.state),
    rule__body: s.fail(),
  },
  _end: {
    rule__params: l(
      s._end(),
      s._state($.string, $.index),
      s._state($.string, $.index),
    ),
    rule__body: s.string_length($.index, $.string),
  },
  _str: {
    rule__params: l(
      $.str,
      s._state($.string, $.next_index),
      s._state($.string, $.index),
      $.str,
    ),
    rule__body: seq(
      s.string_length($.len, $.str),
      s.add($.next_index, $.index, $.len),
      s.string_slice($.str, $.string, $.index, $.next_index),
    ),
  },
  _test_str: {
    test__group: "parse",
    rule__params: l(),
    rule__body: seq(
      s.expect_collect($.res, s.parse($.res, "foo", s._str("foo")), "foo"),
      s.expect_fail(s.parse(__, "bar", s._str("foo"))),
    ),
  },
  _char_test: {
    rule__params: l(
      $.char,
      s._state($.string, $.next_index),
      s._state($.string, $.index),
      $.fn,
    ),
    rule__body: seq(
      s.inc($.next_index, $.index),
      s.string_char($.char, $.string, $.index),
      s.call($.fn, $.char),
    ),
  },
  _test_char_test: {
    test__group: "parse",
    rule__params: l(),
    rule__body: seq(
      s.expect_collect(
        $.res,
        s.parse($.res, "a", s._char_test(s.match("a", "b", "c"))),
        "a",
      ),
      s.expect_collect(
        $.res,
        s.parse($.res, "b", s._char_test(s.match("a", "b", "c"))),
        "b",
      ),
      s.expect_fail(s.parse($.res, "d", s._char_test(s.match("a", "b", "c")))),
    ),
  },
  _str_test: {
    rule__params: l(
      $.str,
      s._state($.string, $.next_index),
      s._state($.string, $.index),
      $.fn,
    ),
    rule__body: seq(
      s.block(
        l($.next, $.state),
        s.loop_iter(
          $.next,
          $.state,
          s._state($.string, $.index),
          s._char_test(__, $.next, $.state, $.fn),
        ),
      ),
      s._state_index($.next_index, $.next),
      s.not_eq($.next_index, $.index),
      s.string_slice($.str, $.string, $.index, $.next_index),
    ),
  },
  _test_str_test: {
    test__group: "parse",
    rule__params: l(),
    rule__body: seq(
      s.expect_collect(
        $.res,
        s.parse($.res, "abab", s._str_test(s.match("a", "b", "c"))),
        "abab",
      ),
      // s.expect_fail(
      //   s.parse($.res, "abad", s._char_test(s.match("a", "b", "c"))),
      // ),
      // s.expect_fail(s.parse($.res, "", s._char_test(s.match("a", "b", "c")))),
    ),
  },
  _ws: {
    rule__params: l(__, $.out, $.in),
    rule__body: s._str_test(__, $.out, $.in, s.match(" ", "\n", "\t")),
  },
  _opt_ws: {
    rule__params: l(__, $.out, $.in),
    rule__body: s._option(__, $.out, $.in, s._ws()),
  },
  _number: {
    rule__params: l($.result, $.out, $.in),
    rule__body: s._seq(
      $.result,
      $.out,
      $.in,
      l(s._str_test(fn($.ch)(s.gt_eq($.ch, "0"), s.lt_eq($.ch, "9")))),
      fn($.num, $.str)(s.string_number($.str, $.num)),
    ),
  },
  _peek: {
    rule__params: l($.result, $.state, $.state, $.parse),
    rule__body: s.call($.parse, $.result, __, $.state),
  },
  _seq: {
    rule__params: l($.result, $.out, $.in, $.parsers, $.fn),
    rule__body: s._seq_state(
      $.result,
      $.out,
      $.in,
      $.parsers,
      $.fn,
      l($.result),
    ),
  },
  _seq_state: {
    rule__params: l($.result, $.out, $.in, $.parsers, $.fn, $.fn_args),
    rule__body: s.if_then_else(
      s.empty($.parsers),
      seq(u($.out, $.in), s.apply($.fn_args, $.fn)),
      seq(
        s.append($.parsers, l($.parser), $.rest),
        s.call($.parser, $.res, $.next, $.in),
        s.append($.next_args, $.fn_args, l($.res)),
        s._seq_state($.result, $.out, $.next, $.rest, $.fn, $.next_args),
      ),
    ),
  },
  _test_seq: {
    test__group: "parse",
    rule__params: l(),
    rule__body: seq(
      s.expect_collect(
        $.result,
        s.parse(
          $.result,
          "foo bar",
          s._seq(
            l(s._test_ident(), s._opt_ws(), s._test_ident()),
            fn(s.expr($.l, $.r), s._ident($.l), __, s._ident($.r))(),
          ),
        ),
        s.expr("foo", "bar"),
      ),
    ),
  },
  _left: {
    rule__params: l($.result, $.out, $.in, $.l, $.r),
    rule__body: s._seq(
      $.result,
      $.out,
      $.in,
      l($.l, $.r),
      fn($.res, $.res, __)(),
    ),
  },
  _right: {
    rule__params: l($.result, $.out, $.in, $.l, $.r),
    rule__body: s._seq(
      $.result,
      $.out,
      $.in,
      l($.l, $.r),
      fn($.res, __, $.res)(),
    ),
  },
  _cond: {
    rule__params: l($.result, $.out, $.in, $.cases),
    rule__body: seq(
      s.append($.cases, l($.case), $.rest),
      s.if_then_else(
        u(l($.if, $.then), $.case),
        s.if_then_else(
          s.call($.if, __, $.next, $.in),
          s.call($.then, $.result, $.out, $.next),
          s._cond($.result, $.out, $.in, $.rest),
        ),
        s.if_then_else(
          s.call($.case, $.result, $.out, $.in),
          s.ok(),
          s._cond($.result, $.out, $.in, $.rest),
        ),
      ),
    ),
  },
  _test_cond: {
    test__group: "parse",
    rule__params: l(),
    rule__body: seq(
      s.expect_collect(
        $.result,
        s.parse(
          $.result,
          "return foo",
          s._cond(
            l(
              l(
                s._str("return"),
                s._seq(
                  l(s._opt_ws(), s._test_ident()),
                  fn(s.return($.expr), __, $.expr)(),
                ),
              ),
              s._seq(l(s._str("break")), fn(s.break(), __)()),
            ),
          ),
        ),
        s.return(s._ident($.expr)),
      ),

      s.expect_collect(
        $.result,
        s.parse(
          $.result,
          "break",
          s._cond(
            l(
              l(
                s._str("return"),
                s._seq(
                  l(s._opt_ws(), s._test_ident()),
                  fn(s.return($.expr), __, $.expr)(),
                ),
              ),
              s._seq(l(s._str("break")), fn(s.break(), __)()),
            ),
          ),
        ),
        s.break(),
      ),
    ),
  },
  _alt: {
    rule__params: l($.result, $.out, $.in, $.alts),
    rule__body: seq(
      s.append($.alts, l($.alt), $.rest),
      alt(
        s.call($.alt, $.result, $.out, $.in),
        s._alt($.result, $.out, $.in, $.rest),
      ),
    ),
  },
  _repeat1: {
    rule__params: l($.results, $.out, $.in, $.p),
    rule__body: s.block(
      l($.results, $.out),
      s.loop_iter(
        l($.results, $.out),
        l($.prev_results, $.prev_state),
        l(l(), $.in),
        seq(
          s.call($.p, $.res, $.out, $.prev_state),
          s.cond(s.not_eq($.out, $.prev_state), s.throw(s._repeat_loop($.p))),
          s.append($.results, $.prev_results, l($.res)),
        ),
      ),
    ),
  },
  _repeat: {
    rule__params: l($.results, $.out, $.in, $.p),
    rule__body: s.cond(
      s._repeat1($.results, $.out, $.in, $.p),
      u(l($.results, $.out), l(l(), $.in)),
    ),
  },
  _test_repeat: {
    test__group: "parse",
    rule__params: l(),
    rule__body: seq(
      s.expect_collect(
        $.result,
        s.parse(
          $.result,
          "foo bar baz",
          s._repeat(s._right(s._opt_ws(), s._test_ident())),
        ),
        l(s._ident("foo"), s._ident("bar"), s._ident("baz")),
      ),

      s.expect_throw(
        s.parse(__, "hello", s._repeat(s._opt_ws())),
        s._repeat_loop(__),
      ),
    ),
  },
  _option: {
    rule__params: l($.res_opt, $.out, $.in, $.p),
    rule__body: s.if_then_else(
      s.call($.p, $.res, $.out, $.in),
      u($.res_opt, s.some($.res)),
      u(l($.res_opt, $.out), l(s.none(), $.in)),
    ),
  },
  _separated_by: {
    rule__params: l($.items, $.out, $.in, $.p_item, $.p_sep),
    rule__body: s._seq(
      $.items,
      $.out,
      $.in,
      l($.p_item, s._repeat(s._right($.p_sep, $.p_item), s._option($.p_sep))),
      fn($.res, $.head, $.tail, __)(s.append($.res, l($.head), $.tail)),
    ),
  },

  _test_ident: {
    rule__params: l(s._ident($.ident), $.out, $.in),
    rule__body: s._str_test(
      $.ident,
      $.out,
      $.in,
      fn($.char)(s.gt_eq($.char, "a"), s.lt_eq($.char, "z")),
    ),
  },
  _test_expr_list: {
    rule__params: l(s._list($.res), $.out, $.in),
    rule__body: s._seq(
      $.res,
      $.out,
      $.in,
      l(
        s._left(s._str("("), s._opt_ws()), //
        s._repeat(s._left(s._test_expr(), s._opt_ws())),
        s._str(")"),
      ),
      fn($.x, __, $.x, __)(),
    ),
  },
  _test_expr: {
    rule__params: l($.expr, $.out, $.in),
    rule__body: s._alt(
      $.expr,
      $.out,
      $.in,
      l(s._test_ident(), s._test_expr_list()),
    ),
  },

  _test_parse: {
    test__group: "parse",
    rule__params: l(),
    rule__body: seq(
      s.expect_ok(s.parse(__, "", s._opt_ws())),
      s.expect_ok(s.parse(__, " ", s._opt_ws())),
      s.expect_ok(s.parse(__, "  \t\n", s._opt_ws())),

      s.expect_collect(
        $.res,
        s.parse($.res, "foo", s._test_expr()),
        s._ident("foo"),
      ),

      s.expect_collect(
        $.res,
        s.parse($.res, "()", s._test_expr()),
        s._list(l()),
      ),
    ),
  },
});
