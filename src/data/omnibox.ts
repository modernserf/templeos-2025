import { Rec } from ".";
import { l, seq, s, $, f, fn } from "../expr";

export const omnibox = {
  omnibox: {
    view__subject: s.self(),
    file__name: "Search",
    rule__params: l($.out, $.id, $.state),
    rule__body: seq(
      s.get_state(s.omnibox($.search), $.state, s.omnibox("")),
      s.column(
        $.out,
        l(),
        s.view__input(
          l(
            s.debounce(300),
            s.placeholder("Search..."),
            s.style("width", "100%"),
          ),
          $.search,
          fn(s.change($.next))(s.set_state($.state, s.omnibox($.next))),
        ),
        s.column(
          l(s.style("padding", "0.5rem")),
          s.expr_iter_else(
            s.limit(
              10,
              seq(
                f.file__name($.result, $.result_name),
                s.string_substring($.result_name, $.search),
              ),
            ),
            l(s.view__file_info($.result), s.view__spacer("0.5rem")),
            l(s.view__string("no results")),
          ),
        ),
      ),
    ),
  },
} satisfies Record<string, Rec>;
