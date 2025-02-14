import { Rec } from ".";
import { l, r, s, $, view, __ } from "../expr";
import { db } from "./db";

export const codeExplorerData = {
  code_explorer: {
    db__schema: "form",
    file__name: "Code explorer",
    rule__params: l($.self, $.state, $.out),
    rule__body: r(
      s.get_default($.state, "data__omnibox", $.omnibox, ""),

      view.render(
        view.column(
          l(),
          s.children(
            view.input(
              l(
                s.debounce(300),
                s.placeholder("Search..."),
                s.style("width", "100%"),
              ),
              $.omnibox,
              l(
                s.change($.next),
                db.with_tx(
                  $.tx,
                  db.update($.tx, $.state, "data__omnibox", $.next),
                ),
              ),
            ),
            view.iter_else(
              s.limit(
                20,
                r(
                  s.rule__params($.id, $.params),
                  s("¬", s.test__group($.id, __)),
                  s.string_substring($.id, $.omnibox),
                  s.box_tag_list($.box_1, $.id, $.params),
                  s.get_default($.id, "file__description", $.desc, l("")),
                ),
              ),
              l(view.expr($.box_1), view.text($.desc), view.spacer("0.5rem")),
              l(view.string("no results")),
            ),
          ),
        ),
        $.out,
      ),
    ),
  },
} satisfies Record<string, Rec>;
