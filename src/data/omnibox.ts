import { l, seq, s, $, fn, x, xfn, alt, u } from "../expr";
import { pkg } from "../pkg";

export const { rules: omnibox } = pkg("search", {
  _view_params_type: {
    rule__params: l($.t),
    rule__body: s.enum($.t, s.params(/*search*/ s.string())),
  },
  _view: {
    rule__params: l($.out, $.state, $.props, $.query, $.render),
    rule__body: seq(
      s.cond(s.in(s.limit($.limit), $.props), u($.limit, 10)),
      s.cond(
        s.in(s.placeholder($.placeholder), $.props),
        u($.placeholder, "Search…"),
      ),
      s.get_state(s.params($.search), $.state, s.params("")),
      s.column(
        $.out,
        l(),
        x.view__input(
          x.list(
            s.debounce(300),
            s.style("width", "100%"),
            s.placeholder($.placeholder),
          ),
          $.search,
          fn(s.change($.next))(s.set_state($.state, s.params($.next))),
        ),
        x.column(
          l(s.style("padding", "0.5rem")),
          xfn($.o)(
            s.if_then_else(
              s.limit($.limit, s.call($.query, $.value, $.search)),
              s.call($.render, $.o, $.value),
              u($.o, "no results"),
            ),
          ),
        ),
      ),
    ),
  },

  omnibox: {
    db__schema: "view",
    view__subject: s.self(),
    file__name: "Search",
    view__params_type: s._view_params_type(),
    rule__params: l($.out, $._id, $.state),
    rule__body: s._view(
      $.out,
      $.state,
      l(),
      fn($.result, $.search)(
        s.file__name($.result_name, $.result),
        s.string_substring($.result_name, $.search),
      ),
      fn(
        $.o,
        $.value,
      )(alt(s.view__file_info($.o, $.value), s.view__spacer($.o, "0.5rem"))),
    ),
  },
});
