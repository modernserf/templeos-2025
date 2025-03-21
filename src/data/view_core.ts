import { l, seq, s, $, u, __, fn } from "../expr";
import { pkg } from "../pkg";
import { test } from "./test_utils";

export const { rules: viewCore } = pkg("view_core", {
  html: {
    rule__params: $.params,
    rule__body: seq(
      s.params_rest($.params, l($.out, $.tag, $.props), $.children),
      u($.out, s.Html($.tag, $.props, $.children)),
    ),
  },
  view__spacer: {
    rule__params: l(
      s.Html("div", l(s.class("Spacer"), s.style("flexBasis", $.space)), l()),
      $.space,
    ),
  },
  row: {
    rule__params: $.params,
    rule__body: seq(
      s.params_rest($.params, l($.out, $.props), $.children),
      s.append($.node_props, $.props, l(s.class("Row"))),
      u($.out, s.Html("div", $.node_props, $.children)),
    ),
  },
  column: {
    rule__params: $.params,
    rule__body: seq(
      s.params_rest($.params, l($.out, $.props), $.children),
      s.append($.node_props, $.props, l(s.class("Column"))),
      u($.out, s.Html("div", $.node_props, $.children)),
    ),
  },
  wrap: {
    rule__params: $.params,
    rule__body: seq(
      s.params_rest($.params, l($.out, $.props), $.children),
      s.append($.node_props, $.props, l(s.class("Wrap"))),
      u($.out, s.Html("div", $.node_props, $.children)),
    ),
  },
  view__link: {
    rule__params: l($.out, $.props, $.label, $.location),
    rule__body: s.view__button(
      $.out,
      l(s.class("Link")),
      $.label,
      fn(s.click($.params))(
        s.cond(
          l(s.at(s.meta_key(), $.params, 0), s.on__new_window($.location)),
          l(s(s.target("new")).in($.props), s.on__new_window($.location)),
          seq(s.current_window($.window), s.on__push($.window, $.location)),
        ),
      ),
    ),
  },
  test__view__link: {
    test__group: "views",
    rule__params: l(),
    rule__body: seq(
      test.collect(
        $.out,
        s.view__link($.out, l(), "hello", s.location("test_link")),
        s.Button(l(s.class("Link")), "hello", __),
      ),
    ),
  },
  view__icon: {
    rule__params: l(s.Icon()),
  },
});
