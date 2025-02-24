import { l, seq, s, $, __, f } from "../expr";
import { Rec } from ".";

export const text = {
  // types
  text: {
    db__schema: "type",
    file__name: "Text",
    db__default_value: l(),
    db__default_view: "view__text_type",
    // db__type: s(
    //   "list",
    //   s.oneof( s.string(), s.box( "link", s.string(), s.ref()))
    // ),
  },
  // schemas
  text_document: {
    db__schema: "schema",
    file__name: "Text",
    file__description: l("A text document"),
    db__fields: l(s.field("text__content")),
  },
  // fields
  text__content: {
    db__schema: "field",
    file__name: "Text content",
    file__description: l("a list of text nodes used in text schema"),
    db__type: "text",
  },
  // views

  view__text_section_layout: {
    rule__params: l($.out, $.header, $.body),
    rule__body: seq(
      s.append_box_suffix($.header_wrap, s.wrap(l()), $.header),
      s.append_box_suffix($.body_wrap, s.wrap(l()), $.body),
      s.html(
        $.out,
        "section",
        l(),
        s.html("header", l(), $.header_wrap),
        s.wrap(l(), $.body_wrap),
      ),
    ),
  },
  view__text_section: {
    rule__params: l($.out, $.header, $.body),
    rule__body: s.view__text_section_layout(
      $.out,
      l(s.view__text_node_list($.header)),
      l(s.view__text_node_list($.body)),
    ),
  },
  view__text_node_list: {
    rule__params: l($.out, $.node_list),
    rule__body: seq(
      s.value_box_index($.node, $.node_list, __),
      s.view__text_node($.out, $.node),
    ),
  },
  view__text_node: {
    rule__params: l($.out, $.node),
    rule__body: s.match_cond(
      $.node,
      l(
        s.link($.label, $.location),
        s.view__link($.out, l(), $.label, $.location),
      ),
      l(
        s.section($.header, $.body),
        s.view__text_section($.out, $.header, $.body),
      ),
      l(
        s.code($.expr),
        s.html($.out, "span", l(s.class("InlineBlock")), s.view__expr($.expr)),
      ),
      l(__, seq(s.string($.node), s.view__string($.out, $.node))),
    ),
  },
  view__text: {
    rule__params: l($.out, $.text),
    rule__body: s.html(
      $.out,
      "div",
      l(s.class("Text")),
      s.view__text_node_list($.text),
    ),
  },

  view__text_document: {
    file__name: "Text viewer",
    view__schema: "text_document",
    rule__params: l($.out, $.id, $.state),
    rule__body: seq(
      f.text__content($.id, $.text),
      s.column($.out, l(s.style("margin", "1rem")), s.view__text($.text)),
    ),
  },
} satisfies Record<string, Rec>;
