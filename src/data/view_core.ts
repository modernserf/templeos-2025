import { Rec } from ".";
import { l, seq, s, $, u, __, f } from "../expr";
import { test } from "./test_utils";

export const viewCore = {
  html: {
    rule__params: l($.out, $.tag, $.props),
    rule__rest_params: $.children,
    rule__body: seq(
      s.expr_children($.rendered_children, $.children),
      u($.out, s.Html($.tag, $.props, $.rendered_children)),
    ),
  },
  view__spacer: {
    rule__params: l(
      s.Html("div", l(s.class("Spacer"), s.style("flexBasis", $.space)), l()),
      $.space,
    ),
  },
  row: {
    rule__params: l($.out, $.props),
    rule__rest_params: $.children,
    rule__body: seq(
      s.append_left_right($.node_props, $.props, l(s.class("Row"))),
      s.expr_children($.rendered_children, $.children),
      u($.out, s.Html("div", $.node_props, $.rendered_children)),
    ),
  },
  column: {
    rule__params: l($.out, $.props),
    rule__rest_params: $.children,
    rule__body: seq(
      s.append_left_right($.node_props, $.props, l(s.class("Column"))),
      s.expr_children($.rendered_children, $.children),
      u($.out, s.Html("div", $.node_props, $.rendered_children)),
    ),
  },
  wrap: {
    rule__params: l($.out, $.props),
    rule__rest_params: $.children,
    rule__body: seq(
      s.append_left_right($.node_props, $.props, l(s.class("Wrap"))),
      s.expr_children($.rendered_children, $.children),
      u($.out, s.Html("div", $.node_props, $.rendered_children)),
    ),
  },
  view__string: {
    rule__params: l(s.String($.string), $.string),
  },
  view__link: {
    rule__params: l($.out, $.props, $.label, $.location),
    rule__body: seq(
      s.current_window($.window),
      s.view__button(
        $.out,
        l(s.class("Link")),
        $.label,
        seq(
          s.receive($.event),
          // receive all events but drop everything except click
          u(s.click($.params), $.event),
          s.cond(
            l(
              s.value_box_index(s.meta_key(), $.params, 0),
              s.on__new_window($.location),
            ),
            l(
              s.value_box_index(s.target("new"), $.props, __),
              s.on__new_window($.location),
            ),
            l(s.ok(), s.on__push($.window, $.location)),
          ),
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
        seq(
          s.self($.pid),
          s.spawn(
            seq(
              s.view__link($.res, l(), "hello", s.location("test_link")),
              s.send($.pid, s.result($.res)),
            ),
            "test_window_id",
          ),
          s.receive(s.result($.out)),
        ),
        s.Button(l(s.class("Link")), "hello", __),
      ),
    ),
  },
  view__icon: {
    rule__params: l(s.Icon()),
  },

  view__time: {
    rule__params: l($.out, $.ts),
    rule__body: seq(
      // TODO: adjust for timezone
      s.timestamp_date(
        $.ts,
        s.date(__, __, __, $.hour, $.minute, $.second, __),
      ),
      s.html(
        $.out,
        "span",
        l(),
        s.view__string($.hour),
        s.view__string(":"),
        s.view__string($.minute),
        s.view__string(":"),
        s.view__string($.second),
      ),
    ),
  },

  view__file_link: {
    rule__params: l($.out, $.id),
    rule__body: seq(
      s.value_record_field_default($.name, $.id, "file__name", $.id),
      s.view__link($.out, l(), $.name, s.location($.id)),
    ),
  },
  view__file_info: {
    rule__params: l($.out, $.id),
    rule__body: seq(
      s.column(
        $.out,
        l(),
        s.row(
          l(),
          s.expr_iter(
            f.db__schema($.id, $.schema),
            s.view__file_link($.schema),
            s.view__string(":"),
            s.view__spacer("0.5rem"),
          ),
          s.view__file_link($.id),
        ),
        s.expr_iter(f.file__description($.id, $.desc), s.view__text($.desc)),
      ),
    ),
  },

  view__form: {
    file__name: "Form",
    view__schema: "form",
    rule__params: l($.out, $.id, $.state),
    rule__body: s.call($.id, $.out, $.id, $.state),
  },
} satisfies Record<string, Rec>;
