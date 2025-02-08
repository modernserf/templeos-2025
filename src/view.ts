import { Rec } from "./data";
import { l, r, s, $, Expr, __, AnyStruct, fork, eq } from "./expr";
import { f } from "./field";
import { db } from "./rule";
import { test } from "./test_utils";

export const view = new Proxy(
  {},
  {
    get(_, key: string) {
      return (...args: Expr[]) => s(`view__${key}`, ...args);
    },
  },
) as Record<string, (...args: Expr[]) => AnyStruct>;

export const rootView = (output: Expr) =>
  r(
    s.collect(
      $.view,
      fork(
        view.app_menu($.view),
        r(
          f.db__schema($.window, "schema__window"),
          view.window($.window, $.view),
        ),
      ),
      $.content,
    ),
    eq(s.Html("div", l(), $.content), output),
  );

const baseViews = {
  // functional views
  spacer: {
    rule__params: l(
      $.space,
      s.Html("div", l(s.class("Spacer"), s.style("flexBasis", $.space)), r()),
    ),
    rule__body: r(),
  },
  row: {
    rule__params: l(
      $.props,
      $.children,
      s.Html("div", l(s.class("Row")), $.children),
    ),
    rule__body: r(),
  },
  column: {
    rule__params: l(
      $.props,
      $.children,
      s.Html("div", l(s.class("Column")), $.children),
    ),
    rule__body: r(),
  },
  // local_state: {
  //   rule__params: l($.init_value, $.value, $.next, $.on_change, $.children),
  //   rule__body: s.view(
  //     s.LocalState($.init_value, $.value, $.next, $.on_change, $.children),
  //   ),
  // },
  string: {
    rule__params: l($.string, s.String($.string)),
    rule__body: r(),
  },
  button: {
    rule__params: l(
      $.params,
      $.label,
      $.event,
      $.on_click,
      s.Button($.params, $.label, $.event, $.on_click),
    ),
    rule__body: r(),
  },
  input: {
    rule__params: l(
      $.props,
      $.value,
      $.next,
      $.on_change,
      s.Input($.props, $.value, $.next, $.on_change),
    ),
    rule__body: r(),
  },
  select: {
    rule__params: l(
      $.params,
      $.value,
      $.options,
      $.next,
      $.on_change,
      s.Select(l(), $.value, $.options, $.next, $.on_change),
    ),
    rule__body: r(),
  },
  output: {
    rule__params: l($.out, $.out),
    rule__body: r(),
  },
  render: {
    rule__params: l($.expr, $.out),
    rule__body: r(
      s.struct_tag_list($.expr, $.tag, $.args),
      s.collect_empty(
        $.result,
        r(
          s.list_item($.args, $.arg),
          s.cond(
            l(
              s.struct_tag_list($.arg, "children", $.children),
              r(
                s.collect_empty(
                  $.view,
                  r(
                    s.list_item($.children, $.child),
                    view.render($.child, $.view),
                  ),
                  $.result,
                ),
              ),
            ),
            l(s.ok(), eq($.arg, $.result)),
          ),
        ),
        $.rendered_args,
      ),
      s.apply($.tag, $.rendered_args, l($.out)),
    ),
  },
  test_render: {
    test__group: "views",
    rule__params: l(),
    rule__body: r(
      test.collect(
        $.result,
        view.render(view.string("foo"), $.result),
        s.String("foo"),
      ),
      test.collect(
        $.result,
        view.render(
          view.row(l(), s.children(view.string("foo"), view.string("bar"))),
          $.result,
        ),
        s.Html("div", l(s.class("Row")), l(s.String("foo"), s.String("bar"))),
      ),
    ),
  },
  iter: {
    rule__params: l($.iter, $.children, $.out),
    rule__body: r(
      $.iter,
      s.list_item($.children, $.child),
      view.render($.child, $.out),
    ),
  },
  iter_else: {
    rule__params: l($.iter, $.children, $.else, $.out),
    rule__body: s.if_then_else(
      $.iter,
      r(s.list_item($.children, $.child), view.render($.child, $.out)),
      r(s.list_item($.else, $.child), view.render($.child, $.out)),
    ),
  },
  foreach: {
    rule__params: l($.list, $.item, $.children, $.out),
    rule__body: view.iter(s.list_item($.list, $.item), $.children, $.out),
  },
  test_foreach: {
    test__group: "views",
    rule__params: l(),
    rule__body: r(
      test.collect(
        $.result,
        view.render(
          view.row(
            l(),
            s.children(
              view.string("( "),
              view.foreach(
                l("foo", "bar", "baz"),
                $.expr,
                l(view.string($.expr), view.string(" ")),
              ),
              view.string(")"),
            ),
          ),
          $.result,
        ),
        s.Html(
          "div",
          l(s.class("Row")),
          l(
            s.String("( "),
            s.String("foo"),
            s.String(" "),
            s.String("bar"),
            s.String(" "),
            s.String("baz"),
            s.String(" "),
            s.String(")"),
          ),
        ),
      ),
    ),
  },
  link: {
    rule__params: l($.props, $.label, $.location, $.out),
    rule__body: r(
      s.get_context("window_id", $.window),
      view.button(
        l(s.class("Link")),
        $.label,
        $.event,
        s.cond(
          l(eq($.event, s.click(1)), s.on__newWindow($.location)),
          l(s.list_item($.props, s.target("new")), s.on__newWindow($.location)),
          l(s.ok(), s.on__push($.window, $.location)),
        ),
        $.out,
      ),
    ),
  },
  test__link: {
    test__group: "views",
    rule__params: l(),
    rule__body: r(
      test.collect(
        $.out,
        r(
          s.set_context("window_id", "test_window_id"),
          view.link(l(), "hello", s.location("test_link"), $.out),
        ),
        s.Button(
          l(s.class("Link")),
          "hello",
          $.event,
          s.cond(
            l(
              eq($.event, s.click(1)),
              s.on__newWindow(s.location("test_link")),
            ),
            l(
              s.list_item(l(), s.target("new")),
              s.on__newWindow(s.location("test_link")),
            ),
            l(s.ok(), s.on__push("test_window_id", s.location("test_link"))),
          ),
        ),
      ),
    ),
  },
  icon: {
    rule__params: l(s.Icon()),
    rule__body: r(),
  },
  table: {
    rule__params: l($.props, $.header, $.rows, $.out),
    rule__body: r(
      s("/=", $.rows, l()),
      eq(
        $.out,
        s.Html(
          "table",
          $.props,
          l(s.Html("thead", l(), $.header), s.Html("tbody", l(), $.rows)),
        ),
      ),
    ),
  },
  table_header: {
    rule__params: l($.props, $.items, $.out),
    rule__body: r(
      s.collect(
        s.Html("th", l(), l($.item)),
        s.list_item($.items, $.item),
        $.cells,
      ),
      eq($.out, s.Html("tr", $.props, $.cells)),
    ),
  },
  table_row: {
    rule__params: l($.props, $.items, $.out),
    rule__body: r(
      s.collect(
        s.Html("td", l(), l($.item)),
        s.list_item($.items, $.item),
        $.cells,
      ),
      eq($.out, s.Html("tr", $.props, $.cells)),
    ),
  },
  menu: {
    rule__params: l($.label, $.options, $.next, $.on_change, $.out),
    rule__body: r(
      s.list_list_append(l(s.option("", $.label)), $.options, $.menu_options),
      view.select(l(), $.label, $.menu_options, $.next, $.on_change, $.out),
    ),
  },
  text_section: {
    rule__params: l($.header, $.body, $.out),
    rule__body: r(
      s.list_rule_mapped($.header, "view__text_node", $.header_out),
      s.list_rule_mapped($.body, "view__text_node", $.body_out),
      s.list_list_append(
        l(s.Html("header", l(), $.header_out)),
        $.body_out,
        $.joined,
      ),
      eq(s.Html("section", l(), $.joined), $.out),
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
      l(__, r(s.string($.node), view.string($.node, $.out))),
    ),
  },
  text: {
    rule__params: l($.text, $.out),
    rule__body: r(
      s.list_rule_mapped($.text, "view__text_node", $.nodes),
      eq(s.Html("div", l(s.class("Text")), $.nodes), $.out),
    ),
  },
  id_field: {
    rule__params: l($.entity, $.field, $.out),
    rule__body: s.cond(
      l(
        s.get_field_value($.field, "db__default_view", $.view),
        s.call($.view, $.entity, $.field, $.out),
      ),
      l(
        r(
          db.get($.field, "db__type", $.type),
          db.get($.type, "db__default_view", $.view),
        ),
        s.call($.view, $.entity, $.field, $.out),
      ),
      l(
        db.get("type__any", "db__default_view", $.view),
        s.call($.view, $.entity, $.field, $.out),
      ),
    ),
  },

  expr_tuple: {
    rule__params: l($.tag, $.list, $.out),
    rule__body: view.render(
      view.row(
        l(),
        s.children(
          view.file_link($.tag),
          view.string("( "),
          view.foreach($.list, $.expr, l(view.expr($.expr), view.string(" "))),
          view.string(")"),
        ),
      ),
      $.out,
    ),
    __rule__body: r(
      s.collect($.view, fork(), $.row),

      view.row(l(), $.row, $.out),
    ),
  },
  expr_block: {
    rule__params: l($.tag, $.list, $.out),
    rule__body: r(
      s.collect(
        $.view,
        r(
          s.list_item($.list, $.expr),
          view.expr($.expr, $.e),
          view.string($.tag, $.t),
          view.row(l(), l($.e, $.t), $.view),
        ),
        $.column,
      ),
      view.column(l(), $.column, $.out),
    ),
  },
  expr_tuple_block: {
    rule__params: l($.tag, $.list, $.out),
    rule__body: r(
      s.collect(
        $.view,
        r(s.list_item($.list, $.expr), view.expr($.expr, $.view)),
        $.column,
      ),
      s.collect(
        $.view,
        fork(
          view.file_link($.tag, $.view),
          view.string("( ", $.view),
          view.column(l(), $.column, $.view),
          view.string(" )", $.view),
        ),
        $.row,
      ),
      view.row(l(), $.row, $.out),
    ),
  },
  expr_struct: {
    rule__params: l($.tag, $.list, $.out),
    rule__body: s.cond(
      l(s.match($.tag, ",", ";"), view.expr_block($.tag, $.list, $.out)),
      l(
        s.match(
          $.tag,
          "view__row",
          "view__column",
          "view__table",
          "view__table_header",
          "view__table_row",
          "view__table_column",
        ),
        view.expr_tuple_block($.tag, $.list, $.out),
      ),
      l(s.ok(), view.expr_tuple($.tag, $.list, $.out)),
    ),
  },
  expr: {
    rule__params: l($.data, $.out),
    rule__body: fork(
      r(s.var_name($.data, $.var_name), view.string($.var_name, $.out)),
      r(
        s.string($.data),
        s.collect(
          $.view,
          fork(
            view.string('"', $.view),
            view.string($.data, $.view),
            view.string('"', $.view),
          ),
          $.row,
        ),
        view.row(l(), $.row, $.out),
      ),
      r(s.number($.data), view.string($.data, $.out)),
      r(
        s.struct_tag_list($.data, $.tag, $.list),
        view.expr_struct($.tag, $.list, $.out),
      ),
    ),
  },

  fit_content_input: {
    rule__params: l($.value, $.next, $.on_change, $.out),
    rule__body: view.input(
      l(s.class("Input--fitContent"), s.debounce(300)),
      $.value,
      $.next,
      $.on_change,
      $.out,
    ),
  },
  struct_add_field: {
    rule__params: l($.next, $.on_change, $.out),
    rule__body: r(
      view.menu(
        "+",
        l(
          s.option("string", "string"),
          s.option("number", "number"),
          s.option("struct", "struct"),
          s.option("var", "var"),
        ),
        $.next_type,
        r(
          s.match(
            l($.next_type, $.next),
            l("string", ""),
            l("number", 0),
            l("struct", l()),
            l("var", $("")),
          ),
          $.on_change,
        ),
        $.out,
      ),
    ),
  },
  struct_nodes_edit: {
    rule__params: l($.data, $.next, $.on_change, $.view),
    rule__body: r(
      s.struct_tag_list($.data, $.id, $.args),
      s.struct_at_value($.data, $.i, $.arg),
      view.button(
        l(),
        "×",
        __,
        r(
          s.list_at_removed_splice($.args, $.i, l(__), $.next_args),
          s.struct_tag_list($.next, $.id, $.next_args),
          $.on_change,
        ),
        $.delete_button,
      ),
      view.expr_edit(
        $.arg,
        $.arg_next,
        r(
          s.struct_at_value_updated($.data, $.i, $.arg_next, $.next),
          $.on_change,
        ),
        $.expr,
      ),
      view.row(l(), l($.delete_button, $.expr), $.view),
    ),
  },
  struct_edit: {
    rule__params: l($.data, $.next, $.on_change, $.out),
    rule__body: r(
      s.struct_tag_list($.data, $.id, $.args),
      s.collect(
        $.view,
        fork(
          view.struct_nodes_edit($.data, $.next, $.on_change, $.view),
          view.struct_add_field(
            $.next_arg,
            r(s._struct_push($.data, $.next_arg, $.next), $.on_change),
            $.view,
          ),
        ),
        $.arg_nodes,
      ),
      s.collect(
        $.view,
        fork(
          view.fit_content_input(
            $.id,
            $.next_id,
            r(s.struct_tag_list($.next, $.next_id, $.args), $.on_change),
            $.view,
          ),
          view.string("(", $.view),
          view.column(l(), $.arg_nodes, $.view),
          view.string(")", $.view),
        ),
        $.row,
      ),
      view.row(l(), $.row, $.out),
    ),
  },

  expr_edit: {
    rule__params: l($.data, $.next, $.on_change, $.out),
    rule__body: fork(
      r(
        s.var_name($.data, $.var_name),
        view.fit_content_input($.var_name, $.next, $.on_change, $.out),
      ),
      r(
        s.string($.data),
        view.fit_content_input($.data, $.next, $.on_change, $.out),
      ),
      r(
        s.number($.data),
        view.fit_content_input(
          $.data,
          $.next_str,
          r(s.string_number($.next_str, $.next), $.on_change),
          $.out,
        ),
      ),
      r(s.struct($.data), view.struct_edit($.data, $.next, $.on_change, $.out)),
    ),
  },
  // type views
  type__any: {
    rule__params: l($.id, $.field, $.out),
    rule__body: r(db.get($.id, $.field, $.value), view.expr($.value, $.out)),
  },
  type__string: {
    rule__params: l($.id, $.field, $.out),
    rule__body: r(
      db.get($.id, $.field, $.value), //
      view.string($.value, $.out),
    ),
  },
  type__time: {
    rule__params: l($.id, $.field, $.out),
    rule__body: r(
      db.get($.id, $.field, $.value), //
      view.string($.value, $.out),
    ),
  },
  type__ref: {
    rule__params: l($.id, $.field, $.out),
    rule__body: r(
      db.get($.id, $.field, $.value), //
      view.file_link($.value, $.out),
    ),
  },
  type__text: {
    rule__params: l($.id, $.field, $.out),
    rule__body: r(db.get($.id, $.field, $.text), view.text($.text, $.out)),
  },

  tag_edit: {
    rule__params: l($.tag, $.on_delete, $.out),
    rule__body: r(
      view.button(l(), "x", __, $.on_delete, $.button),
      view.file_link($.tag, $.link),
      view.row(l(), l($.button, $.link), $.out),
    ),
  },
  add_tag_menu: {
    rule__params: l($.selected, $.on_add, $.out),
    rule__body: r(
      s.collect(
        s.option($.tag_opt, $.name),
        r(
          f.db__schema($.tag_opt, "schema__tag"),
          f.file__name($.tag_opt, $.name),
        ),
        $.tag_opts,
      ),
      view.menu("Add tag", $.tag_opts, $.selected, $.on_add, $.out),
    ),
  },

  // field views
  file__tags: {
    rule__params: l($.id, $.field, $.out),
    rule__body: r(
      s.collect(
        $.view,
        fork(
          r(
            f.file__tags($.id, $.tag),
            view.tag_edit(
              $.tag,
              db.with_tx($.tx, db.delete($.tx, $.id, "file__tags", $.tag)),
              $.view,
            ),
          ),
          view.spacer("0.25rem", $.view),
          view.add_tag_menu(
            $.selected,
            db.with_tx($.tx, db.update($.tx, $.id, "file__tags", $.selected)),
            $.view,
          ),
        ),
        $.row,
      ),
      view.row(l(), $.row, $.out),
    ),
  },
  rule__body: {
    rule__params: l($.id, $.field, $.out),
    rule__body: r(db.get($.id, $.field, $.body), view.expr($.body, $.out)),
  },

  // schema views
  schema__any_fields: {
    rule__params: l($.id, $.state, $.out),
    rule__body: view.render(
      view.table(
        l(),
        s.children(
          view.table_header(
            l(),
            s.children(view.string("Field"), view.string("Value")),
          ),
        ),
        s.children(
          view.table_row(view.string("id"), view.string($.id)),
          view.iter(
            s.get_field_value($.id, $.field, __),
            l(
              view.table_row(
                l(),
                s.children(
                  view.file_link($.field),
                  view.id_field($.id, $.field),
                ),
              ),
            ),
          ),
        ),
      ),
      $.out,
    ),
  },
  schema__any_refs: {
    rule__params: l($.id, $.state, $.out),
    rule__body: view.render(
      view.table(
        l(),
        s.children(
          view.table_header(
            l(),
            s.children(view.string("Field"), view.string("Ref")),
          ),
        ),
        s.children(
          view.iter(
            r(
              fork(f.db__index($.f, s.ref()), f.db__index($.f, s.multiRef())),
              s.get_field_value($.ref, $.f, $.id),
            ),
            l(
              view.table_row(
                l(),
                s.children(view.file_link($.f), view.file_link($.ref)),
              ),
            ),
          ),
        ),
      ),
      $.out,
    ),
  },

  schema__any: {
    file__name: "Default viewer",
    view__schema: "schema__any",
    rule__params: l($.id, $.state, $.out),
    rule__body: view.render(
      view.column(
        l(),
        s.children(
          view.schema__any_fields($.id, $.state),
          view.schema__any_refs($.id, $.state),
        ),
      ),
      $.out,
    ),
  },

  schema__any_add_field: {
    rule__params: l($.id, $.out),
    rule__body: r(
      s.collect(
        s.option($.field_id, $.field_name),
        r(
          f.db__schema($.field_id, "schema__field"),
          f.file__name($.field_id, $.field_name),
        ),
        $.fields,
      ),
      view.menu(
        "Add field...",
        $.fields,
        $.new_field_id,
        s._add_field($.id, $.new_field_id),
        $.out,
      ),
    ),
  },
  schema__any_edit: {
    file__name: "Default editor",
    view__schema: "schema__any",
    rule__params: l($.id, $.state, $.out),
    rule__body: r(
      s.collect(
        $.row,
        fork(
          r(
            view.string("id", $.field_label),
            view.string($.id, $.field_value),
            view.table_row(l(), l($.field_label, $.field_value), $.row),
          ),
          r(
            s.get_field_value($.id, $.field, $.value),
            view.button(
              l(),
              "×",
              __,
              db.with_tx($.tx, db.delete($.tx, $.id, $.field)),
              $.button,
            ),
            view.file_link($.field, $.link),
            view.row(l(), l($.button, $.link), $.field_label),
            view.expr_edit(
              $.value,
              $.next,
              db.with_tx($.tx, db.update($.tx, $.id, $.field, $.next)),
              $.field_value,
            ),
            view.table_row(l(), l($.field_label, $.field_value), $.row),
          ),
        ),
        $.rows,
      ),
      view.string("Field", $.k),
      view.string("Value", $.v),
      view.table_header(l(), l($.k, $.v), $.header),
      view.table(l(), l($.header), $.rows, $.table),
      view.schema__any_add_field($.id, $.add_menu),
      view.column(l(), l($.table, $.add_menu), $.out),
    ),
  },
  schema__schema: {
    file__name: "Schema viewer",
    view__schema: "schema__schema",
    rule__params: l($.id, $.state, $.out),
    rule__body: view.column(
      view.row(f.file__description($.id, $.desc), view.text($.desc)),
      view.column(
        r(
          view.string("Fields:"),
          f.db__fields($.id, $.fields),
          s.list_item($.fields, $.field),
          s.match_cond(
            $.field,
            l(s.field($.field_id), view.file_link($.field_id)),
            l(
              s.field_optional($.field_id),
              view.row(view.file_link($.field_id), view.string("(optional)")),
            ),
          ),
        ),
      ),
      view.column(
        r(
          view.string("Views:"),
          f.view__schema($.view, $.id),
          view.row(view.file_info($.view)),
        ),
      ),
      view.column(
        r(
          view.string("Items:"),
          f.db__schema($.record, $.id),
          view.row(view.file_info($.record)),
        ),
      ),
      view.button(
        "New item",
        s.with_tx(
          $.tx,
          r(
            s.new__default($.tx, $.item_id, $.id),
            s.new__window($.tx, __, s.location($.item_id)),
          ),
        ),
      ),
    ),
  },
  schema__form: {
    file__name: "Form",
    view__schema: "schema__form",
    rule__params: l($.id, $.state, $.out),
    rule__body: s.call($.id, $.id, $.state, $.out),
  },
  schema__text: {
    file__name: "Text viewer",
    view__schema: "schema__text",
    rule__params: l($.id, $.state, $.out),
    rule__body: r(
      view.spacer("2rem", $.margin),
      f.text__content($.id, $.text),
      view.text($.text, $.content),
      view.row(l(), l($.margin, $.content, $.margin), $.row),
      view.column(l(), l($.margin, $.row, $.margin), $.out),
    ),
  },
  schema__tag: {
    file__name: "Tag items",
    view__schema: "schema__tag",
    rule__params: l($.tag, $.state, $.out),
    rule__body: r(
      f.file__description($.tag, $.desc),
      view.text($.desc, $.header),
      s.collect(
        $.view,
        r(f.file__tags($.file, $.tag), view.file_info($.file, $.view)),
        $.tags,
      ),
      view.column(l(), $.tags, $.tag_section),
      view.column(l(), l($.header, $.tag_section), $.out),
    ),
  },
  // FIXME
  schema__folder_list: {
    file__name: "Folder - List",
    view__schema: "schema__folder",
    rule__params: l($.id, $.state, $.out),
    rule__body: view.render(
      view.column(
        l(),
        s.children(
          view.iter(f.file__description($.id, $.desc), l(view.text($.desc))),
          view.iter(
            f.folder__items($.id, $.item),
            l(view.row(l(), s.children(view.file_info($.item)))),
          ),
        ),
      ),
      $.out,
    ),
  },
  schema__folder_icon: {
    file__name: "Folder - Icon",
    view__schema: "schema__folder",
    rule__params: l($.id, $.state, $.out),
    rule__body: view.render(
      view.column(
        l(),
        s.children(
          view.iter(f.file__description($.id, $.desc), l(view.text($.desc))),
          view.row(
            l(),
            s.children(
              view.iter(
                f.folder__items($.id, $.item),
                l(
                  view.column(
                    l(),
                    s.children(view.icon(), view.file_link($.item)),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
      $.out,
    ),
  },
  // FIXME
  schema__window: {
    file__name: "Window - History",
    view__schema: "schema__window",
    rule__params: l($.id, $.state),
    rule__body: view.column(
      r(
        f.history__window($.history, $.id),
        view.row(
          r(f.history__location($.history, $.h_id), view.file_link($.h_id)),
          r(
            f.history__view($.history, $.h_view),
            view.string(":"),
            view.file_link($.h_view),
          ),
          r(
            f.time__created($.history, $.ts),
            // TODO: adjust for timezone
            s.timestamp_date(
              $.ts,
              s.date(__, __, __, $.hour, $.minute, $.second, __),
            ),
            view.string("-"),
            view.string($.hour),
            view.string(":"),
            view.string($.minute),
            view.string(":"),
            view.string($.second),
          ),
        ),
      ),
    ),
  },
  // built in UI elements
  file_link: {
    rule__params: l($.id, $.out),
    rule__body: r(
      s.get_default($.id, "file__name", $.name, $.id),
      view.link(l(), $.name, s.location($.id), $.out),
    ),
  },
  file_info: {
    rule__params: l($.id, $.out),
    rule__body: r(
      s.collect(
        $.view,
        fork(
          r(
            f.db__schema($.id, $.schema),
            fork(view.file_link($.schema, $.view), view.string(": ", $.view)),
          ),
          view.file_link($.id, $.view),
        ),
        $.main_info,
      ),
      view.row(l(), $.main_info, $.row),
      s.cond(
        l(
          f.file__description($.id, $.description),
          r(
            view.text($.description, $.d),
            view.column(l(), l($.row, $.d), $.out),
          ),
        ),
        l(s.ok(), view.column(l(), l($.row), $.out)),
      ),
    ),
  },
  view_menu: {
    file__name: "View menu",
    file__description: l("the view selection menu on window chrome"),
    rule__params: l($.window, $.id, $.selectedView, $.out),
    rule__body: r(
      s.collect(
        s.option($.view, $.name),
        r(s.rule__location_view($.id, $.view), f.file__name($.view, $.name)),
        $.options,
      ),
      view.select(
        l(),
        $.selectedView,
        $.options,
        $.nextView,
        db.with_tx(
          $.tx,
          f.window__currentHistory($.window, $.history),
          db.update($.tx, $.history, "history__view", $.nextView),
        ),
        $.out,
      ),
    ),
  },
  window: {
    file__name: "Window",
    rule__params: l($.window, $.out),
    rule__body: r(
      f.window__currentHistory($.window, $.history),
      f.browser__currentWindow("browser", $.currentWindow),
      f.history__location($.history, $.id),
      s.set_context("window_id", $.window),
      s.set_context("history_id", $.history),
      s.get_default($.id, "file__name", $.name, $.id),
      s.first(
        // view from params
        f.history__view($.history, $.view),
        // view from id
        s.rule__location_view($.id, $.view),
      ),
      view.window_bar($.window, $.id, $.view, $.name, $.window_bar),
      s.try_error_catch(
        r(
          s.call($.view, $.id, $.history, $.main_content),
          eq(
            $.out,
            s.WindowContainer(
              $.window,
              $.currentWindow,
              l($.window_bar, $.main_content),
            ),
          ),
        ),
        $.error,
        r(
          s.log("error", $.error),
          view.string("Error, see console for details", $.error_message),
          eq(
            $.out,
            s.WindowContainer(
              $.window,
              $.currentWindow,
              l($.window_bar, $.error_message),
            ),
          ),
        ),
      ),
    ),
  },
  window_bar: {
    rule__params: l($.window, $.id, $.view, $.name, $.out),
    rule__body: r(
      view.view_menu($.window, $.id, $.view, $.menu),
      view.string($.name, $.window_title),
      view.button(
        l(s.class("AppWindow__closeButton")),
        "",
        __,
        s.on__closeWindow($.window),
        $.close_button,
      ),
      eq(
        $.out,
        s.Html(
          "header",
          l(s.class("AppWindow__header")),
          l(
            $.close_button,
            s.Html("h1", l(s.class("AppWindow__title")), l($.window_title)),
            $.menu,
          ),
        ),
      ),
    ),
  },
  app_menu: {
    file__name: "App menu",
    rule__params: l($.out),
    rule__body: r(
      s.collect(
        $.view,
        fork(
          view.button(
            l(),
            "←",
            __,
            r(
              f.browser__currentWindow("browser", $.window),
              s.on__back($.window),
            ),
            $.view,
          ),
          view.button(
            l(),
            "→",
            __,
            r(
              f.browser__currentWindow("browser", $.window),
              s.on__forward($.window),
            ),
            $.view,
          ),
          view.button(
            l(),
            "new window",
            __,
            r(s.on__newWindow(s.location("omnibox"))),
            $.view,
          ),
        ),
        $.items,
      ),
      view.row(l(), $.items, $.out),
    ),
  },
} satisfies Record<string, Rec>;

export const views = Object.fromEntries(
  Object.entries(baseViews).map(([key, value]) => [`view__${key}`, value]),
);
