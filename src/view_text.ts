import { l, r, s, $, __, view, u } from "./expr";
import { Rec } from "./data";
import { db } from "./rule";
import { f } from "./field";

export const viewText = {
  text_section_layout: {
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
  text_section: {
    rule__params: l($.header, $.body, $.out),
    rule__body: view.render(
      view.text_section_layout(
        s.children(view.text_node_list($.header)),
        s.children(view.text_node_list($.body)),
      ),
      $.out,
    ),
  },
  text_node_list: {
    rule__params: l($.node_list, $.out),
    rule__body: r(
      s.list_item($.node_list, $.node),
      view.text_node($.node, $.out),
    ),
  },
  text_node: {
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
  text: {
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

  schema__text: {
    file__name: "Text viewer",
    view__schema: "schema__text",
    rule__params: l($.id, $.state, $.out),
    rule__body: r(
      f.text__content($.id, $.text),
      view.render(
        view.column(
          l(s.style("margin", "1rem")),
          s.children(view.text($.text)),
        ),
        $.out,
      ),
    ),
  },

  schema__text_base_edit: {
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
  schema__text_link_edit: {
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

  schema__text_section_edit: {
    rule__params: l(l($.header, $.content), $.on_change, $.out),
    rule__body: view.render(
      view.text_section_layout(
        s.children(
          view.schema__text_list_edit(
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
          view.schema__text_list_edit(
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
  schema__text_list_edit: {
    rule__params: l($.list, $.on_change, $.out),
    rule__body: r(
      s.struct_at_value($.list, $.i, $.node),
      view.schema__text_node_edit(
        $.node,
        l(
          $.message,
          view.match_dispatch(
            $.on_change,
            $.message,
            l(
              s.update($.next_value),
              s.update($.next_list),
              s.struct_at_value_updated($.list, $.i, $.next_value, $.next_list),
            ),
          ),
        ),
        $.out,
      ),
    ),
  },
  schema__text_code_edit: {
    rule__params: l($.code, $.on_change, $.out),
    rule__body: r(
      view.expr_edit(
        $.code,
        l(
          $.updated, //
          view.dispatch($.on_change, s.update(s.code($.updated))),
        ),
        $.out,
      ),
    ),
  },
  schema__text_node_edit: {
    rule__params: l($.node, $.on_change, $.out),
    rule__body: r(
      s.value_expr($.node, $.expr),
      s.match_cond(
        $.expr,
        l(
          s.string($.str),
          view.schema__text_base_edit($.str, $.on_change, $.out),
        ),
        l(
          s.struct("link", $.link),
          view.schema__text_link_edit($.link, $.on_change, $.out),
        ),
        l(
          s.struct("section", $.section),
          view.schema__text_section_edit($.section, $.on_change, $.out),
        ),
        l(
          s.struct("code", l($.code)),
          view.schema__text_code_edit($.code, $.on_change, $.out),
        ),
      ),
    ),
  },
  schema__text_edit_menu: {
    rule__params: l($.id, $.state, $.on_change, $.out),
    rule__body: r(
      view.menu(
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
  schema__text_edit_handler: {
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
            f.text__content($.id, $.prev),
            s._struct_push($.prev, $.empty_value, $.next),
            db.with_tx($.tx, db.update($.tx, $.id, "text__content", $.next)),
          ),
        ),
        l(
          s.update($.next),
          db.with_tx($.tx, db.update($.tx, $.id, "text__content", $.next)),
        ),
        l(
          s.focus($.cursor),
          r(
            s.log("todo move cursor", $.cursor), //
          ),
        ),
      ),
    ),
  },
  schema__text_edit: {
    file__name: "Text editor",
    view__schema: "schema__text",
    rule__params: l($.id, $.state, $.out),
    rule__body: r(
      f.text__content($.id, $.text),
      u(
        $.on_change,
        l($.message, view.schema__text_edit_handler($.id, $.state, $.message)),
      ),

      view.render(
        view.column(
          l(s.style("margin", "1rem")),
          s.children(
            view.schema__text_edit_menu($.id, $.state, $.on_change),
            view.schema__text_list_edit($.text, $.on_change),
          ),
        ),
        $.out,
      ),
    ),
  },
} satisfies Record<string, Rec>;
