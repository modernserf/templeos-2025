import { Rec } from ".";
import { l, seq, s, $, f } from "../expr";
import { db } from "./db";

export const omnibox = {
  set_state: {
    rule__params: l($.state, $.value),
    rule__body: seq(
      db.with_tx($.tx, db.update($.tx, $.state, "history__params", $.value)),
      f.history__window($.state, $.window),
      s.dispatch(s.render_window($.window)),
    ),
  },
  omnibox: {
    db__schema: "form",
    file__name: "Search",
    rule__params: l($.out, $.id, $.state),
    rule__body: seq(
      s.value_record_field_default(
        s.omnibox($.search),
        $.state,
        "history__params",
        s.omnibox(""),
      ),
      s.expr(
        $.out,
        s.view__column(
          l(),
          s.children(
            s.view__input(
              l(
                s.debounce(100),
                s.placeholder("Search..."),
                s.style("width", "100%"),
              ),
              $.search,
              seq(
                s.receive(s.change($.next)),
                s.set_state($.state, s.omnibox($.next)),
              ),
            ),
            s.view__column(
              l(s.style("padding", "0.5rem")),
              s.children(
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
        ),
      ),
    ),
  },
} satisfies Record<string, Rec>;
