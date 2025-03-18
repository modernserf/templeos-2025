import { l, seq, s, $, __, x } from "../expr";
import { pkg } from "../pkg";

export const text = pkg("text", {
  // types
  text: {
    rule__params: l($.t),
    rule__body: s.list_of(
      $.t,
      s.type__union(
        s.string(),
        s.enum(
          s.link(s.string(), s.location()),
          s.code(s.type__any()),
          s.section(s.text(), s.text()),
        ),
      ),
    ),
  },
  // schemas
  text_document: {
    db__schema: "schema",
    file__name: "Text",
    file__description: l("A text document"),
    schema__fields: l(s.field("_content")),
  },
  // fields
  _content: {
    db__schema: "field",
    file__name: "Text content",
    file__description: l("a list of text nodes used in text schema"),
    field__type: s.text(),
  },
  // views
  view__text: {
    rule__params: l($.out, $.text),
    rule__body: s.html(
      $.out,
      "div",
      l(s.class("Text")),
      x._view_node_list($.text),
    ),
  },

  // private

  // views
  _view_section: {
    rule__params: l($.out, $.header, $.body),
    rule__body: s.html(
      $.out,
      "section",
      l(),
      x.html("header", l(), x.wrap(l(), x._view_node_list($.header))),
      x.wrap(l(), x._view_node_list($.body)),
    ),
  },
  _view_node_list: {
    rule__params: l($.out, $.node_list),
    rule__body: seq(s($.node).in($.node_list), s._view_node($.out, $.node)),
  },
  _view_node: {
    rule__params: l($.out, $.node),
    rule__body: s.match_cond(
      $.node,
      l(
        s.link($.label, $.location),
        s.view__link($.out, l(), $.label, $.location),
      ),
      l(s.section($.header, $.body), s._view_section($.out, $.header, $.body)),
      l(
        s.code($.expr),
        s.html($.out, "span", l(s.class("InlineBlock")), x.view__expr($.expr)),
      ),
      l(__, seq(s.string($.node), s.view__string($.out, $.node))),
    ),
  },

  _view_document: {
    file__name: "Text viewer",
    view__subject: s.schema("text_document"),
    rule__params: l($.out, $.id, $._state),
    rule__body: s.column(
      $.out,
      l(s.style("margin", "1rem")),
      x.view__text(x.text__content($.id)),
    ),
  },
});
