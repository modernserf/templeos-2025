import { Rec } from ".";
import { l, r, s, $, view, u, __ } from "../expr";
import { test } from "./test_utils";

export const viewCore = {
  view__output: {
    rule__params: l($.out, $.out),
    rule__body: r(),
  },
  view__html: {
    rule__params: l($.tag, $.props, $.children, $.out),
    rule__body: r(u($.out, s.Html($.tag, $.props, $.children))),
  },
  view__spacer: {
    rule__params: l(
      $.space,
      s.Html("div", l(s.class("Spacer"), s.style("flexBasis", $.space)), l()),
    ),
    rule__body: r(),
  },
  view__row: {
    rule__params: l($.props, $.children, $.out),
    rule__body: r(
      s.box_box_append($.props, l(s.class("Row")), $.node_props),
      u($.out, s.Html("div", $.node_props, $.children)),
    ),
  },
  view__column: {
    rule__params: l($.props, $.children, $.out),
    rule__body: r(
      s.box_box_append($.props, l(s.class("Column")), $.node_props),
      u($.out, s.Html("div", $.node_props, $.children)),
    ),
  },
  view__wrap: {
    rule__params: l($.props, $.children, $.out),
    rule__body: r(
      s.box_box_append($.props, l(s.class("Wrap")), $.node_props),
      u($.out, s.Html("div", $.node_props, $.children)),
    ),
  },
  view__receive: {
    rule__params: l(l($.pattern, $.goal), l($.render_out, $.render), $.out),
    rule__body: r(
      u($.out, s.Receive($.pattern, $.goal, $.render_out, $.render)),
    ),
  },
  // view__local_state: {
  //   rule__params: l($.init_value, $.value, $.next, $.on_change, $.children),
  //   rule__body: s.view(
  //     s.LocalState($.init_value, $.value, $.next, $.on_change, $.children),
  //   ),
  // },
  view__string: {
    rule__params: l($.string, s.String($.string)),
    rule__body: r(),
  },
  view__link: {
    rule__params: l($.props, $.label, $.location, $.out),
    rule__body: r(
      s.get_context("window_id", $.window),
      view.button(
        l(s.class("Link")),
        $.label,
        l(
          s.click($.params),
          s.cond(
            l(s.list_item($.params, s.meta_key()), s.on__newWindow($.location)),
            l(
              s.list_item($.props, s.target("new")),
              s.on__newWindow($.location),
            ),
            l(s.ok(), s.on__push($.window, $.location)),
          ),
        ),
        $.out,
      ),
    ),
  },
  view__test__link: {
    test__group: "views",
    rule__params: l(),
    rule__body: r(
      test.collect(
        $.out,
        r(
          s.set_context("window_id", "test_window_id"),
          view.link(l(), "hello", s.location("test_link"), $.out),
        ),
        s.Button(l(s.class("Link")), "hello", __, __),
      ),
    ),
  },
  view__icon: {
    rule__params: l(s.Icon()),
    rule__body: r(),
  },
  view__table: {
    rule__params: l($.props, $.header, $.rows, $.out),
    rule__body: r(
      s("/=", $.rows, l()),
      u(
        $.out,
        s.Html(
          "table",
          $.props,
          l(s.Html("thead", l(), $.header), s.Html("tbody", l(), $.rows)),
        ),
      ),
    ),
  },
  view__table_header: {
    rule__params: l($.props, $.items, $.out),
    rule__body: r(
      s.collect(
        s.Html("th", l(), l($.item)),
        s.list_item($.items, $.item),
        $.cells,
      ),
      u($.out, s.Html("tr", $.props, $.cells)),
    ),
  },
  view__table_row: {
    rule__params: l($.props, $.items, $.out),
    rule__body: r(
      s.collect(
        s.Html("td", l(), l($.item)),
        s.list_item($.items, $.item),
        $.cells,
      ),
      u($.out, s.Html("tr", $.props, $.cells)),
    ),
  },
  view__time: {
    rule__params: l($.ts, $.out),
    rule__body: r(
      // TODO: adjust for timezone
      s.timestamp_date(
        $.ts,
        s.date(__, __, __, $.hour, $.minute, $.second, __),
      ),
      view.render(
        view.html(
          "span",
          l(),
          s.children(
            view.string($.hour),
            view.string(":"),
            view.string($.minute),
            view.string(":"),
            view.string($.second),
          ),
        ),
        $.out,
      ),
    ),
  },
} satisfies Record<string, Rec>;
