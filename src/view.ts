import { Rec } from "./data";
import { l, r, s, $, Expr, __, view, u } from "./expr";
import { f } from "./field";
import { db } from "./rule_db";
import { viewCore } from "./view_core";
import { viewExpr } from "./view_expr";
import { viewForm } from "./view_form";
import { viewRender } from "./view_render";
import { viewSystem } from "./view_system";
import { viewText } from "./view_text";

export const rootView = (output: Expr) =>
  r(
    s.collect(
      $.view,
      s.fork(
        view.app_menu($.view),
        r(
          f.db__schema($.window, "schema__window"),
          view.window($.window, $.view),
        ),
      ),
      $.content,
    ),
    u(s.Html("div", l(), $.content), output),
  );

const baseViews = {
  ...viewForm,
  ...viewRender,
  ...viewCore,
  ...viewText,
  ...viewExpr,
  ...viewSystem,

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

  // type views
  type__any: {
    rule__params: l($.id, $.field, $.out),
    rule__body: r(db.get($.id, $.field, $.value), view.expr($.value, $.out)),
  },
  type__string: {
    rule__params: l($.id, $.field, $.out),
    rule__body: r(db.get($.id, $.field, $.value), view.string($.value, $.out)),
  },
  type__time: {
    rule__params: l($.id, $.field, $.out),
    rule__body: r(db.get($.id, $.field, $.ts), view.time($.ts, $.out)),
  },
  type__ref: {
    rule__params: l($.id, $.field, $.out),
    rule__body: r(
      db.get($.id, $.field, $.value),
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
      view.button(
        l(s.class("DeleteExpr")),
        "x",
        l(s.click(__), $.on_delete),
        $.button,
      ),
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
      view.menu(
        "Add tag",
        $.tag_opts,
        l(s.change($.selected), $.on_add),
        $.out,
      ),
    ),
  },

  // field views
  file__tags: {
    rule__params: l($.id, $.field, $.out),
    rule__body: r(
      s.collect(
        $.view,
        s.fork(
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
              s.fork(f.db__index($.f, s.ref()), f.db__index($.f, s.multiRef())),
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
        l(s.change($.new_field_id), s._add_field($.id, $.new_field_id)),
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
        s.fork(
          r(
            view.string("id", $.field_label),
            view.string($.id, $.field_value),
            view.table_row(l(), l($.field_label, $.field_value), $.row),
          ),
          r(
            s.get_field_value($.id, $.field, $.value),
            view.button(
              l(s.class("DeleteExpr")),
              "×",
              l(s.click(__), db.with_tx($.tx, db.delete($.tx, $.id, $.field))),
              $.button,
            ),
            view.file_link($.field, $.link),
            view.row(l(), l($.button, $.link), $.field_label),
            view.expr_edit(
              $.value,
              l(
                $.next,
                db.with_tx($.tx, db.update($.tx, $.id, $.field, $.next)),
              ),
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
  schema__schema_field: {
    rule__params: l($.field_def, $.out),
    rule__body: s.match_cond(
      $.field_def,
      l(s.field($.field_id), view.file_link($.field_id, $.out)),
      l(
        s.field_optional($.field_id),
        view.render(
          view.row(
            l(),
            s.children(view.file_link($.field_id), view.string("(optional)")),
          ),
          $.out,
        ),
      ),
    ),
  },
  schema__schema: {
    file__name: "Schema viewer",
    view__schema: "schema__schema",
    rule__params: l($.id, $.state, $.out),
    rule__body: view.render(
      view.column(
        l(),
        s.children(
          view.string("Fields:"),
          view.iter(
            r(f.db__fields($.id, $.fields), s.list_item($.fields, $.field)),
            l(view.schema__schema_field($.field)),
          ),
          view.spacer("1rem"),
          view.string("Views:"),
          view.iter(f.view__schema($.view, $.id), l(view.file_info($.view))),
          view.spacer("1rem"),
          view.string("Items:"),
          view.iter(f.db__schema($.record, $.id), l(view.file_info($.record))),

          view.button(
            l(),
            "New item",
            l(
              s.click(__),
              s.with_tx(
                $.tx,
                r(
                  s.new__default($.tx, $.item_id, $.id),
                  s.new__window($.tx, __, s.location($.item_id)),
                ),
              ),
            ),
          ),
        ),
      ),
      $.out,
    ),
  },
  schema__form: {
    file__name: "Form",
    view__schema: "schema__form",
    rule__params: l($.id, $.state, $.out),
    rule__body: s.call($.id, $.id, $.state, $.out),
  },

  dispatch: {
    rule__params: l(l($.param, $.handler), $.message),
    rule__body: r(u($.param, $.message), $.handler),
  },
  __match_dispatch_next: {
    rule__params: l($.on_change, $.message, $.rest),
    rule__body: s.if_then_else(
      u($.rest, l()),
      view.dispatch($.on_change, $.message),
      s.apply(view.match_dispatch($.on_change, $.message), $.rest),
    ),
  },
  match_dispatch: {
    rule__params: l($.on_change, $.message, $.case),
    rule__rest_params: $.rest,
    rule__body: r(
      s.match_cond(
        $.case,
        l(
          l($.pattern, $.mapped),
          s.if_then_else(
            u($.message, $.pattern),
            view.dispatch($.on_change, $.mapped),
            s.__match_dispatch_next($.on_change, $.message, $.rest),
          ),
        ),
        l(
          l($.pattern, $.mapped, $.body),
          s.if_then_else(
            u($.message, $.pattern),
            r($.body, view.dispatch($.on_change, $.mapped)),
            s.__match_dispatch_next($.on_change, $.message, $.rest),
          ),
        ),
      ),
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
  schema__window: {
    file__name: "Window - History",
    view__schema: "schema__window",
    rule__params: l($.id, $.state, $.out),
    rule__body: view.render(
      view.table(
        l(),
        s.children(
          view.table_header(
            l(),
            s.children(
              view.string("id"),
              view.string("view"),
              view.string("time"),
            ),
          ),
        ),
        s.children(
          view.iter(
            f.history__window($.history, $.id),
            l(
              view.table_row(
                l(),
                s.children(
                  view.id_field($.history, "history__location"),
                  view.or_default(
                    view.id_field($.history, "history__view"),
                    view.string(""),
                  ),
                  view.id_field($.history, "time__created"),
                ),
              ),
            ),
          ),
        ),
      ),
      $.out,
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
        s.fork(
          r(
            f.db__schema($.id, $.schema),
            s.fork(view.file_link($.schema, $.view), view.string(": ", $.view)),
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
} satisfies Record<string, Rec>;

export const views = Object.fromEntries(
  Object.entries(baseViews).map(([key, value]) => [`view__${key}`, value]),
);
