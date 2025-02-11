import { l, r, s, $, __, view, u } from "../expr";
import { Rec } from ".";
import { db } from "./db";

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
    db__fields: l(db.field("text__content")),
  },
  // fields
  text__content: {
    db__schema: "field",
    file__name: "Text content",
    file__description: l("a list of text nodes used in text schema"),
    db__type: "text",
  },
  // views
  view__text_type: {
    rule__params: l($.id, $.field, $.out),
    rule__body: r(db.get($.id, $.field, $.text), view.text($.text, $.out)),
  },

  view__text_section_layout: {
    rule__params: l($.header, $.content, $.out),
    rule__body: view.render(
      view.html(
        "section",
        l(),
        s.children(
          view.html("header", l(), s.children(view.wrap(l(), $.header))),
          view.wrap(l(), $.content),
        ),
      ),
      $.out,
    ),
  },
  view__text_section: {
    rule__params: l($.header, $.body, $.out),
    rule__body: view.render(
      view.text_section_layout(
        s.children(view.text_node_list($.header)),
        s.children(view.text_node_list($.body)),
      ),
      $.out,
    ),
  },
  view__text_node_list: {
    rule__params: l($.node_list, $.out),
    rule__body: r(
      s.list_item($.node_list, $.node),
      view.text_node($.node, $.out),
    ),
  },
  view__text_node: {
    rule__params: l($.node, $.out),
    rule__body: s.match_cond(
      $.node,
      l(
        s.link($.label, $.location),
        view.link(l(), $.label, $.location, $.out),
      ),
      l(
        s.section($.header, $.body),
        view.text_section($.header, $.body, $.out),
      ),
      l(
        s.code($.expr),
        r(
          view.expr($.expr, $.expr_out),
          view.html("span", l(s.class("InlineBlock")), l($.expr_out), $.out),
        ),
      ),
      l(__, r(s.string($.node), view.string($.node, $.out))),
    ),
  },
  view__text: {
    rule__params: l($.text, $.out),

    rule__body: view.render(
      view.html(
        "div",
        l(s.class("Text")),
        s.children(view.text_node_list($.text)),
      ),
      $.out,
    ),
  },

  view__text_document: {
    file__name: "Text viewer",
    view__schema: "text_document",
    rule__params: l($.id, $.state, $.out),
    rule__body: r(
      s.text__content($.id, $.text),
      view.render(
        view.column(
          l(s.style("margin", "1rem")),
          s.children(view.text($.text)),
        ),
        $.out,
      ),
    ),
  },

  view__text_document_base_edit: {
    rule__params: l($.text, $.on_change, $.out),
    rule__body: r(
      view.input(
        l(
          s.debounce(1000),
          s.class("Input--fitContent"),
          s.style("border", "none"),
        ),
        $.text,
        l(s.change($.next), r(view.dispatch($.on_change, s.update($.next)))),
        $.out,
      ),
    ),
  },
  view__text_document_link_edit: {
    rule__params: l(l($.label, $.location), $.on_change, $.out),
    rule__body: r(
      s.match(
        $.location,
        s.location($.id),
        s.location($.id, __),
        s.location($.id, __, __),
      ),
      view.render(
        view.row(
          l(),
          s.children(
            view.input(
              l(
                s.debounce(1000),
                s.class("Input--fitContent"),
                s.style("border", "none"),
                s.style("borderBottom", "1px dotted black"),
              ),
              $.label,
              l(
                s.change($.message),
                view.dispatch(
                  $.on_change,
                  s.update(s.link($.next, $.location)),
                ),
              ),
            ),
            view.input(
              l(s.debounce(1000), s.class("Input--fitContent")),
              $.id,
              l(
                s.change($.message),
                view.dispatch(
                  $.on_change,
                  s.update(s.link($.label, s.location($.next))),
                ),
              ),
            ),
            // view.string("TODO: view & params"),
          ),
        ),
        $.out,
      ),
    ),
  },

  view__text_document_section_edit: {
    rule__params: l(l($.header, $.content), $.on_change, $.out),
    rule__body: view.render(
      view.text_section_layout(
        s.children(
          view.text_document_list_edit(
            $.header,
            l(
              $.message,
              view.match_dispatch(
                $.on_change,
                $.message,
                l(s.update($.next), s.update(s.section($.next, $.content))),
              ),
            ),
          ),
        ),
        s.children(
          view.text_document_list_edit(
            $.content,
            l(
              $.message,
              view.match_dispatch(
                $.on_change,
                $.message,
                l(s.update($.next), s.update(s.section($.header, $.next))),
              ),
            ),
          ),
        ),
      ),
      $.out,
    ),
  },
  view__text_document_list_edit: {
    rule__params: l($.list_2, $.on_change, $.out),
    rule__body: r(
      s.box_at_value($.list_2, $.i, $.node),
      view.text_document_node_edit(
        $.node,
        l(
          $.message,
          view.match_dispatch(
            $.on_change,
            $.message,
            l(
              s.update($.next_value),
              s.update($.next_list),
              s.box_at_value_updated($.list_2, $.i, $.next_value, $.next_list),
            ),
          ),
        ),
        $.out,
      ),
    ),
  },
  view__text_document_code_edit: {
    rule__params: l($.code, $.on_change, $.out),
    rule__body: r(
      view.expr_edit(
        $.code,
        l($.updated, view.dispatch($.on_change, s.update(s.code($.updated)))),
        $.out,
      ),
    ),
  },
  view__text_document_node_edit: {
    rule__params: l($.node, $.on_change, $.out),
    rule__body: r(
      s.value_expr($.node, $.expr),
      s.match_cond(
        $.expr,
        l(
          s.string($.str),
          view.text_document_base_edit($.str, $.on_change, $.out),
        ),
        l(
          s.box("link", $.link),
          view.text_document_link_edit($.link, $.on_change, $.out),
        ),
        l(
          s.box("section", $.section),
          view.text_document_section_edit($.section, $.on_change, $.out),
        ),
        l(
          s.box("code", l($.code)),
          view.text_document_code_edit($.code, $.on_change, $.out),
        ),
      ),
    ),
  },
  view__text_document_edit_menu: {
    rule__params: l($.id, $.state, $.on_change, $.out),
    rule__body: r(
      view.menu(
        l(),
        "insert",
        l(
          s.option("text", "Text"),
          s.option("link", "Link"),
          s.option("section", "Section"),
          s.option("code", "Code"),
        ),
        l(
          s.change($.selected),
          view.dispatch($.on_change, s.insert($.selected)),
        ),
        $.out,
      ),
    ),
  },
  view__text_document_edit_handler: {
    rule__params: l($.id, $.state, $.message),
    rule__body: r(
      s.match_cond(
        $.message,
        l(
          s.insert($.type),
          r(
            s.match(
              l($.type, $.empty_value),
              l("text", ""),
              l("link", s.link("", s.location(""))),
              l("section", s.section(l(""), l(""))),
              l("code", s.code(s.tuple("foo", "bar"))),
            ),
            s.text__content($.id, $.prev),
            s.box_list_append($.prev, l($.empty_value), $.next),
            db.with_tx($.tx, db.update($.tx, $.id, "text__content", $.next)),
          ),
        ),
        l(
          s.update($.next),
          db.with_tx($.tx, db.update($.tx, $.id, "text__content", $.next)),
        ),
        l(s.focus($.cursor), r(s.log("todo move cursor", $.cursor))),
      ),
    ),
  },
  view__text_document_edit: {
    file__name: "Text editor",
    view__schema: "text_document",
    rule__params: l($.id, $.state, $.out),
    rule__body: r(
      s.text__content($.id, $.text),
      u(
        $.on_change,
        l($.message, view.text_document_edit_handler($.id, $.state, $.message)),
      ),

      view.render(
        view.column(
          l(s.style("margin", "1rem")),
          s.children(
            view.text_document_edit_menu($.id, $.state, $.on_change),
            view.text_document_list_edit($.text, $.on_change),
          ),
        ),
        $.out,
      ),
    ),
  },
} satisfies Record<string, Rec>;
