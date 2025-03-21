import { l, seq, s, $, u, __, fn, alt, x } from "../expr";
import { pkg } from "../pkg";

export const { rules: viewTable } = pkg("table", {
  table: {
    rule__params: $.params,
    rule__body: seq(
      s.params_rest($.params, l($.out, $.props), $.sections),
      s.nonempty($.sections),
      u($.out, s.Html("table", $.props, $.sections)),
    ),
  },
  table_section: {
    rule__params: $.params,
    rule__body: seq(
      s.params_rest($.params, l($.out, $.header), $.rows),
      s.nonempty($.rows),
      alt(
        u($.out, s.Html("thead", l(), l($.header))),
        u($.out, s.Html("tbody", l(), $.rows)),
      ),
    ),
  },
  table_header: {
    rule__params: $.params,
    rule__body: seq(
      s.params_rest($.params, l($.out, $.header_props), $.values),
      s.map_list(
        $.cells,
        $.values,
        fn(s.Html("th", $.header_props, l($.item)), $.item)(),
      ),
      u($.out, s.Html("tr", l(), $.cells)),
    ),
  },
  table_row: {
    rule__params: $.params,
    rule__body: seq(
      s.params_rest($.params, l($.out, $.props), $.items),
      s.map_list($.cells, $.items, fn(s.Html("td", l(), l($.item)), $.item)()),
      u($.out, s.Html("tr", $.props, $.cells)),
    ),
  },
  _test_table: {
    test__group: "views",
    rule__params: l(),
    rule__body: seq(
      u(
        $.expected,
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
                  l(s.Html("th", l(), l("Key")), s.Html("th", l(), l("Value"))),
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
                  l(s.Html("td", l(), l("foo")), s.Html("td", l(), l("123"))),
                ),
                s.Html(
                  "tr",
                  l(),
                  l(s.Html("td", l(), l("bar")), s.Html("td", l(), l("456"))),
                ),
              ),
            ),
          ),
        ),
      ),
      u($.items, l(l("foo", "123"), l("bar", "456"))),
      s.expect_eq(
        x.table(
          l(),
          x.table_section(
            x.table_header(l(), "Key", "Value"),
            x(
              fn($.out)(
                s(l($.key, $.value)).in($.items),
                s.table_row($.out, l(), $.key, $.value),
              ),
            ),
          ),
        ),
        $.expected,
      ),
    ),
  },
});
