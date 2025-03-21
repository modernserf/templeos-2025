import { l, seq, s, $, __, fn, xfn, x, u } from "../expr";
import { pkg } from "../pkg";

export const { rules: codeExplorerData } = pkg("code_explorer", {
  code_explorer: {
    db__schema: "view",
    file__name: "Code explorer",
    view__subject: s.self(),
    view__params_type: s.enum(s.code_explorer(s.string())),
    rule__params: l($.out, $._id, $.state),
    rule__body: seq(
      s.get_state(s.code_explorer($.search), $.state, s.code_explorer("")),
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
          fn(s.change($.next))(s.set_state($.state, s.code_explorer($.next))),
        ),
        xfn($.out)(
          s.if_then_else(
            s.limit(
              20,
              seq(
                s.rule__params($.params, $.id),
                s.none(s.test__group(__, $.id)),
                s.string_substring($.id, $.search),
                s.box($.box, $.id, $.params),
              ),
            ),
            s.html(
              $.out,
              "div",
              l(
                s.style("margin", "0.25rem 0.5rem 0.25rem"),
                s.style("width", "100%"),
              ),
              x.view__expr($.box),
              xfn($.u)(
                s.file__description($.desc, $.id),
                s.view__text($.u, $.desc),
              ),
            ),
            u($.out, "no results"),
          ),
        ),
      ),
    ),
  },
});
