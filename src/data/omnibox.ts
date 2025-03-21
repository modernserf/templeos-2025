import { l, seq, s, $, fn, x, xfn, alt, u } from "../expr";
import { pkg } from "../pkg";

export const { rules: omnibox } = pkg("search", {
  omnibox: {
    db__schema: "view",
    view__subject: s.self(),
    file__name: "Search",
    view__params_type: s.enum(s.code_explorer(s.string())),
    rule__params: l($.out, $._id, $.state),
    rule__body: seq(
      s.get_state(s.omnibox($.search), $.state, s.omnibox("")),
      s.column(
        $.out,
        l(),
        x.view__input(
          l(
            s.debounce(300),
            s.placeholder("Search..."),
            s.style("width", "100%"),
          ),
          $.search,
          fn(s.change($.next))(s.set_state($.state, s.omnibox($.next))),
        ),
        x.column(
          l(s.style("padding", "0.5rem")),
          xfn($.out)(
            s.if_then_else(
              s.limit(
                10,
                seq(
                  s.file__name($.result_name, $.result),
                  s.string_substring($.result_name, $.search),
                ),
              ),
              alt(
                s.view__file_info($.out, $.result),
                s.view__spacer($.out, "0.5rem"),
              ),
              u($.out, "no results"),
            ),
          ),
        ),
      ),
    ),
  },
});
