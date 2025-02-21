import { l, seq, s, $, u, __ } from "../expr";
import { test } from "./test_utils";

export const viewTable = {
  table: {
    rule__params: l($.out, $.props),
    rule__rest_params: $.sections,
    rule__body: seq(
      s.expr_children($.rendered_sections, $.sections),
      s.nonempty($.rendered_sections),
      s.collect_item_in(
        $.flat,
        $.item,
        s.pipe(
          $.item,
          $.rendered_sections,
          s.value_box_index(__),
          s.value_box_index(__),
        ),
      ),
      u($.out, s.Html("table", $.props, $.flat)),
    ),
  },
  table_section: {
    rule__params: l($.out, $.header_props, $.header),
    rule__rest_params: $.rows,
    rule__body: seq(
      s.expr_children($.rendered_header, $.header),
      s.expr_children($.rendered_rows, $.rows),
      s.nonempty($.rendered_rows),
      s.collect_item_in(
        $.header_cells,
        s.Html("th", $.header_props, l($.item)),
        s.value_box_index($.item, $.rendered_header, __),
      ),
      u(
        $.out,
        l(
          s.Html("thead", l(), l(s.Html("tr", l(), $.header_cells))),
          s.Html("tbody", l(), $.rendered_rows),
        ),
      ),
    ),
  },
  table_row: {
    rule__params: l($.out, $.props),
    rule__rest_params: $.items,
    rule__body: seq(
      s.expr_children($.rendered_items, $.items),
      s.collect_item_in(
        $.cells,
        s.Html("td", l(), l($.item)),
        s.value_box_index($.item, $.rendered_items, __),
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
        s.table(
          $.out,
          l(),
          s.table_section(
            l(),
            l(s.view__string("Key"), s.view__string("Value")),
            s.table_row(l(), s.view__string("foo"), s.view__string("123")),
            s.table_row(l(), s.view__string("bar"), s.view__string("456")),
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
