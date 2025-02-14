import { Rec } from ".";
import { l, r, s, $, view } from "../expr";
import { db } from "./db";

export const omnibox = {
  data__omnibox: {
    db__schema: "field",
    file__name: "Omnibox search string",
    db__type: "string",
  },
  omnibox: {
    db__schema: "form",
    file__name: "Omnibox",
    rule__params: l($.id, $.state, $.out),
    rule__body: r(
      s.get_default($.state, "data__omnibox", $.omnibox, ""),
      view.render(
        view.column(
          l(),
          s.children(
            view.input(
              l(
                s.debounce(100),
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
            view.column(
              l(s.style("padding", "0.5rem")),
              s.children(
                view.iter_else(
                  s.limit(
                    10,
                    r(
                      s.file__name($.result, $.result_name),
                      s.string_substring($.result_name, $.omnibox),
                    ),
                  ),
                  l(view.file_info($.result), view.spacer("0.5rem")),
                  l(view.string("no results")),
                ),
              ),
            ),
          ),
        ),
        $.out,
      ),
    ),
  },
} satisfies Record<string, Rec>;
