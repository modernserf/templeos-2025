import { Rec } from ".";
import { l, seq, s, $, __, f } from "../expr";

export const codeExplorerData = {
  code_explorer: {
    db__schema: "form",
    file__name: "Code explorer",
    rule__params: l($.out, $.self, $.state),
    rule__body: seq(
      s.get_state(s.code_explorer($.search), $.state, s.code_explorer("")),
      s.column(
        $.out,
        l(),
        s.view__input(
          l(
            s.debounce(100),
            s.placeholder("Search..."),
            s.style("width", "100%"),
          ),
          $.search,
          seq(
            s.receive(s.change($.next)),
            s.set_state($.state, s.code_explorer($.next)),
          ),
        ),
        s.expr_iter_else(
          s.limit(
            20,
            seq(
              f.rule__params($.id, $.params),
              s.none(f.test__group($.id, __)),
              s.string_substring($.id, $.search),
              s.box_tag_list($.box, $.id, $.params),
            ),
          ),
          l(
            s.html(
              "div",
              l(
                s.style("margin", "0.25rem 0.5rem 0.25rem"),
                s.style("width", "100%"),
              ),
              s.view__expr($.box),
              s.expr_iter(
                f.file__description($.id, $.desc),
                s.view__expr($.desc),
              ),
            ),
          ),
          l(s.view__string("no results")),
        ),
      ),
    ),
  },
} satisfies Record<string, Rec>;
