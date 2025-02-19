import { l, seq, s, $, u, __ } from "../expr";
import { test } from "./test_utils";

export const viewTable = {
  view__table: {
    rule__params: l($.out, $.props, $.sections),
    rule__body: seq(
      s.nonempty($.sections),

      s.collect_item_in(
        $.flat,
        $.item,
        s.pipe(
          $.item,
          $.sections,
          s.value_box_index(__),
          s.value_box_index(__),
        ),

        // seq(
        //   s.value_box_index($.s, $.sections, __),
        //   s.value_box_index($.item, $.s, __),
        // ),
      ),
      u($.out, s.Html("table", $.props, $.flat)),
    ),
  },
  view__table_section: {
    rule__params: l($.out, $.header_props, $.header, $.rows),
    rule__body: seq(
      s.nonempty($.rows),
      s.collect_item_in(
        $.header_cells,
        s.Html("th", $.header_props, l($.item)),
        s.value_box_index($.item, $.header, __),
      ),
      u(
        $.out,
        l(
          s.Html("thead", l(), l(s.Html("tr", l(), $.header_cells))),
          s.Html("tbody", l(), $.rows),
        ),
      ),
    ),
  },
  view__table_row: {
    rule__params: l($.out, $.props, $.items),
    rule__body: seq(
      s.collect_item_in(
        $.cells,
        s.Html("td", l(), l($.item)),
        s.value_box_index($.item, $.items, __),
      ),
      u($.out, s.Html("tr", $.props, $.cells)),
    ),
  },
  test__view_table: {
    test__group: "views",
    rule__params: l(),
    rule__body: seq(
      test.collect(
        $.out,
        s.expr(
          $.out,
          s.view__table(
            l(),
            s.children(
              s.view__table_section(
                l(),
                s.children(s.view__string("Key"), s.view__string("Value")),
                s.children(
                  s.view__table_row(
                    l(),
                    s.children(s.view__string("foo"), s.view__string("123")),
                  ),
                  s.view__table_row(
                    l(),
                    s.children(s.view__string("bar"), s.view__string("456")),
                  ),
                ),
              ),
            ),
          ),
        ),
        s.Html(
          "table",
          l(),
          l(
            s.Html(
              "thead",
              l(),
              l(
                s.Html(
                  "tr",
                  l(),
                  l(
                    s.Html("th", l(), l(s.String("Key"))),
                    s.Html("th", l(), l(s.String("Value"))),
                  ),
                ),
              ),
            ),
            s.Html(
              "tbody",
              l(),
              l(
                s.Html(
                  "tr",
                  l(),
                  l(
                    s.Html("td", l(), l(s.String("foo"))),
                    s.Html("td", l(), l(s.String("123"))),
                  ),
                ),
                s.Html(
                  "tr",
                  l(),
                  l(
                    s.Html("td", l(), l(s.String("bar"))),
                    s.Html("td", l(), l(s.String("456"))),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  },
};
