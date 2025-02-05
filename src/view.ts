import { Rec } from "./data";
import { l, r, s, v, Expr, __, AnyStruct } from "./expr";
import { f } from "./field";
import { db } from "./rule";

export const view = new Proxy(
  {},
  {
    get(_, key: string) {
      return (...args: Expr[]) => s(`view__${key}`, ...args);
    },
  }
) as Record<string, (...args: Expr[]) => AnyStruct>;

export const rootView = r(
  view.app_menu(),
  f.db__schema(v.window, "schema__window"),
  view.window(v.window)
);

const baseViews = {
  // primitives
  row: {
    rule__params: l(),
    rule__rest_params: v.children_list,
    rule__body: r(
      s("struct_tag_list", v.children, ";", v.children_list),
      s("view", s("Row", v.children))
    ),
  },
  column: {
    rule__params: l(),
    rule__rest_params: v.children_list,
    rule__body: r(
      s("struct_tag_list", v.children, ";", v.children_list),
      s("view", s("Column", v.children))
    ),
  },
  local_state: {
    rule__params: l(v.init_value, v.value, v.next, v.on_change, v.children),
    rule__body: s(
      "view",
      s("LocalState", v.init_value, v.value, v.next, v.on_change, v.children)
    ),
  },
  string: {
    rule__params: l(v.string),
    rule__body: s("view", s("String", v.string)),
  },
  button: {
    rule__params: l(v.string, v.on_click),
    rule__body: s("view", s("Button", v.string, "", __, v.on_click)),
  },
  input: {
    rule__params: l(v.value, v.next, v.on_change),
    rule__body: s("view", s("Input", v.value, "", v.next, v.on_change)),
  },
  select: {
    rule__params: l(v.value, v.options, v.next, v.on_change),
    rule__body: s("view", s("Select", v.value, v.options, v.next, v.on_change)),
  },
  link: {
    rule__params: l(v.label, v.location),
    rule__rest_params: v.rest_params,
    rule__body: r(
      s(
        "if_then_else",
        s("=", l(v.params), v.rest_params),
        s("ok"),
        s("=", v.params, l())
      ),
      s("get_context", "window_id", v.window),
      s(
        "view",
        s(
          "Button",
          v.label,
          "Link",
          v.event,
          s(
            "if_then_else",
            s("=", v.event, s("click", 1)),
            s("on__newWindow", v.location),
            s(
              "if_then_else",
              s("list_item", v.params, s("target", "new")),
              s("on__newWindow", v.location),
              s("on__push", v.window, v.location)
            )
          )
        )
      )
    ),
  },
  icon: {
    rule__params: l(),
    rule__body: s("view", s("Icon")),
  },
  // type views
  type__any: {
    file__name: "Any : View",
    view__type: "type__any",
    rule__params: l(v.data),
    rule__body: r.or(
      r(s("var_name", v.data, v.var_name), view.string(v.var_name)),
      r(
        s("string", v.data),
        view.string('"'),
        view.string(v.data),
        view.string('"')
      ),
      r(s("number", v.data), view.string(v.data)),
      r(
        s("struct", v.data),
        s("struct_tag_list", v.data, v.id, v.args),
        s(
          "if_then_else",
          r.or(
            r(
              s("list_item", l(";", ","), v.id),
              view.operator_vertical(v.id, v.args)
            ),
            r(s("list_item", l("="), v.id), view.operator_binary(v.id, v.args))
          ),
          s("ok"),
          view.tuple(v.id, v.args)
        )
      )
    ),
  },
  operator_binary: {
    rule__params: l(v.id, l(v.l, v.r)),
    rule__body: view.row(
      view.type__any(v.l),
      view.string(v.id),
      view.type__any(v.r)
    ),
  },
  operator_vertical: {
    rule__params: l(v.id, v.args),
    rule__body: view.column(
      r(
        s("list_item", v.args, v.arg),
        view.row(view.string(v.id), view.type__any(v.arg))
      )
    ),
  },
  tuple: {
    rule__params: l(v.id, v.args),
    rule__body: view.row(
      view.string(v.id),
      view.string("("),
      view.row(
        r(
          s("list_item", v.args, v.arg), //
          view.type__any(v.arg)
        )
      ),
      view.string(")")
    ),
  },
  type__string: {
    view__type: "type__string",
    rule__params: l(v.string),
    rule__body: view.string(v.string),
  },
  type__time: {
    view__type: "type__time",
    rule__params: l(v.ts),
    rule__body: view.string(v.ts),
  },
  type__ref: {
    view__type: "type__ref",
    rule__params: l(v.ref),
    rule__body: view.file_link(v.ref),
  },
  type__text: {
    view__type: "type__text",
    rule__params: l(v.text),
    rule__body: r(
      s("list_item", v.text, v.node),
      r.or(
        r(s("string", v.node), view.string(v.node)),
        r(
          s("=", v.node, s("link", v.label, v.location)),
          view.link(v.label, v.location)
        )
      )
    ),
  },
  // type editors
  fit_content_input: {
    rule__params: l(v.value, v.next, v.on_change),
    rule__body: s(
      "view",
      s("Input", v.value, "Input--fitContent", v.next, v.on_change)
    ),
  },
  type__any_edit: {
    file__name: "Any : Edit",
    rule__params: l(v.data, v.next, v.on_change),
    rule__body: r.or(
      r(
        s("var_name", v.data, v.var_name),
        view.fit_content_input(v.var_name, v.next, v.on_change)
      ),
      r(
        s("string", v.data),
        view.fit_content_input(v.data, v.next, v.on_change)
      ),
      r(
        s("number", v.data),
        view.fit_content_input(
          v.data,
          v.next_str,
          r(s("string_number", v.next_str, v.next), v.on_change)
        )
      ),
      r(
        s("struct", v.data),
        view.type__struct_edit(v.data, v.next, v.on_change)
      )
    ),
  },
  type__struct_edit: {
    file__name: "Any Struct : Edit",
    rule__params: l(v.data, v.next, v.on_change),
    rule__body: r(
      s("struct_tag_list", v.data, v.id, v.args),
      view.row(
        view.fit_content_input(
          v.id,
          v.next_id,
          r(s("struct_tag_list", v.next, v.next_id, v.args), v.on_change)
        ),
        view.string("("),
        view.column(
          r(
            s("struct_at_value", v.data, v.i, v.arg),
            view.row(
              view.button(
                "×",
                r(
                  s("list_at_removed_splice", v.args, v.i, l(__), v.next),
                  s("struct_tag_list", v.next, v.id, v.next_args),
                  v.on_change
                )
              ),
              view.type__any_edit(
                v.arg,
                v.arg_next,
                r(
                  s("struct_at_value_updated", v.data, v.i, v.arg_next, v.next),
                  v.on_change
                )
              )
            )
          )
        ),
        view.type__struct_add_field(
          v.next_arg,
          r(s("_struct_push", v.data, v.next_arg, v.next), v.on_change)
        ),
        view.string(")")
      )
    ),
  },

  menu: {
    rule__params: l(v.label, v.options, v.next, v.on_change),
    rule__body: r(
      s(
        "list_list_append",
        l(s("option", "", v.label)),
        v.options,
        v.menu_options
      ),
      view.select("", v.menu_options, v.next, v.on_change)
    ),
  },

  type__struct_add_field: {
    rule__params: l(v.next, v.on_change),
    rule__body: r(
      view.menu(
        "+",
        l(
          s("option", "string", "string"),
          s("option", "number", "number"),
          s("option", "struct", "struct"),
          s("option", "var", "var")
        ),
        v.next_type,
        r(
          r.or(
            s("=", l(v.next_type, v.next), l("string", "")),
            s("=", l(v.next_type, v.next), l("number", 0)),
            s("=", l(v.next_type, v.next), l("struct", l())),
            s("=", l(v.next_type, v.next), l("var", v("")))
          ),
          v.on_change
        )
      )
    ),
  },
  // field views
  file__tags: {
    view__field: "file__tags",
    rule__params: l(v.id, v.field),
    rule__body: view.row(
      r(
        f.file__tags(v.id, v.tag),
        view.button(
          "x",
          db.with_tx(v.tx, db.delete(v.tx, v.id, "file__tags", v.tag))
        ),
        view.file_link(v.tag)
      ),
      r(
        s(
          "collect",
          s("option", v.tag_opt, v.name),
          r(
            f.db__schema(v.tag_opt, "schema__tag"),
            f.file__name(v.tag_opt, v.name)
          ),
          v.tag_opts
        ),
        view.menu(
          "Add tag",
          v.tag_opts,
          v.selected,
          db.with_tx(v.tx, db.update(v.tx, v.id, "file__tags", v.selected))
        )
      )
    ),
  },

  // schema views
  schema__any: {
    file__name: "Default viewer",
    view__schema: "schema__any",
    rule__params: l(v.id, v.state),
    rule__body: view.column(
      view.row(view.string("id:"), view.string(v.id)),
      r(
        view.string("Fields"),
        s("get_field_value", v.id, v.field, __),
        view.row(
          view.file_link(v.field),
          r(
            s(
              "if_then_else",
              f.view__field(v.view, v.field),
              s("call", v.view, v.id, v.field),
              r(
                s("limit", 1, r(s("rule__field_view", v.field, v.view))),
                s("get_field_value", v.id, v.field, v.value),
                s("call", v.view, v.value)
              )
            )
          )
        )
      ),
      r(
        view.string("References"),
        r.or(f.db__index(v.f, s("ref")), f.db__index(v.f, s("multiRef"))),
        s("get_field_value", v.ref, v.f, v.id),
        view.row(view.file_link(v.f), view.file_link(v.ref))
      )
    ),
  },
  schema__any_edit: {
    file__name: "Default editor",
    view__schema: "schema__any",
    rule__params: l(v.id, v.state),
    rule__body: view.column(
      view.row(view.string("id:"), view.string(v.id)),
      view.string("Fields"),
      view.column(
        r(
          s("get_field_value", v.id, v.field, v.value),
          view.row(
            view.button("×", db.with_tx(v.tx, db.delete(v.tx, v.id, v.field))),
            view.file_link(v.field),
            view.type__any_edit(
              v.value,
              v.next,
              db.with_tx(v.tx, db.update(v.tx, v.id, v.field, v.next))
            )
          )
        )
      ),
      view.column(
        r(
          s(
            "collect",
            s("option", v.field_id, v.field_name),
            r(
              f.db__schema(v.field_id, "schema__field"),
              f.file__name(v.field_id, v.field_name)
            ),
            v.fields
          ),
          view.menu(
            "Add field...",
            v.fields,
            v.new_field_id,
            s("_add_field", v.id, v.new_field_id)
          )
        )
      )
    ),
  },
  schema__schema: {
    file__name: "Schema viewer",
    view__schema: "schema__schema",
    rule__params: l(v.id, v.state),
    rule__body: view.column(
      view.row(f.file__description(v.id, v.desc), view.type__text(v.desc)),
      view.column(
        r(
          view.string("Fields:"),
          f.db__fields(v.id, v.fields),
          s("list_item", v.fields, v.field),
          r.or(
            r(
              s("=", v.field, s("field", v.field_id)),
              view.file_link(v.field_id)
            ),
            r(
              s("=", v.field, s("field_optional", v.field_id)),
              view.row(view.file_link(v.field_id), view.string("(optional)"))
            )
          )
        )
      ),
      view.column(
        r(
          view.string("Views:"),
          f.view__schema(v.view, v.id),
          view.row(view.file_info(v.view))
        )
      ),
      view.column(
        r(
          view.string("Items:"),
          f.db__schema(v.record, v.id),
          view.row(view.file_info(v.record))
        )
      ),
      view.button(
        "New item",
        s(
          "with_tx",
          v.tx,
          r(
            s("new__default", v.tx, v.item_id, v.id),
            s("new__window", v.tx, __, s("location", v.item_id))
          )
        )
      )
    ),
  },
  schema__form: {
    file__name: "Form",
    view__schema: "schema__form",
    rule__params: l(v.id, v.state),
    rule__body: s("call", v.id, v.id, v.state),
  },
  schema__text: {
    file__name: "Text viewer",
    view__schema: "schema__text",
    rule__params: l(v.id, v.state),
    rule__body: r(
      f.text__content(v.id, v.text),
      view.row(view.type__text(v.text))
    ),
  },
  schema__tag: {
    file__name: "Tag items",
    view__schema: "schema__tag",
    rule__params: l(v.tag, v.state),
    rule__body: view.column(
      r(f.file__description(v.tag, v.desc), view.type__text(v.desc)),
      r(f.file__tags(v.file, v.tag), view.row(view.file_info(v.file)))
    ),
  },
  schema__folder_list: {
    file__name: "Folder - List",
    view__schema: "schema__folder",
    rule__params: l(v.id, v.state),
    rule__body: view.column(
      r(f.file__description(v.id, v.desc), view.type__text(v.desc)),
      r(f.folder__items(v.id, v.item), view.row(view.file_info(v.item)))
    ),
  },
  schema__folder_icon: {
    file__name: "Folder - Icon",
    view__schema: "schema__folder",
    rule__params: l(v.id, v.state),
    rule__body: view.column(
      r(f.file__description(v.id, v.desc), view.type__text(v.desc)),
      view.row(
        r(
          f.folder__items(v.id, v.item),
          view.column(view.icon(), view.file_link(v.item))
        )
      )
    ),
  },
  schema__window: {
    file__name: "Window - History",
    view__schema: "schema__window",
    rule__params: l(v.id, v.state),
    rule__body: view.column(
      r(
        f.history__window(v.history, v.id),
        view.row(
          r(f.history__location(v.history, v.h_id), view.file_link(v.h_id)),
          r(
            f.history__view(v.history, v.h_view),
            view.string(":"),
            view.file_link(v.h_view)
          ),
          r(
            f.time__created(v.history, v.ts),
            // TODO: adjust for timezone
            s(
              "timestamp_date",
              v.ts,
              s("date", __, __, __, v.hour, v.minute, v.second, __)
            ),
            view.string("-"),
            view.string(v.hour),
            view.string(":"),
            view.string(v.minute),
            view.string(":"),
            view.string(v.second)
          )
        )
      )
    ),
  },
  // built in UI elements

  file_link: {
    rule__params: l(v.id),
    rule__body: r(
      s("get_default", v.id, "file__name", v.name, v.id),
      view.link(v.name, s("location", v.id))
    ),
  },
  file_info: {
    rule__params: l(v.id),
    rule__body: r.or(
      view.file_link(v.id),
      r(
        f.file__description(v.id, v.description),
        view.type__text(v.description)
      )
    ),
  },
  view_menu: {
    file__name: "View menu",
    file__description: l("the view selection menu on window chrome"),
    rule__params: l(v.window, v.id, v.selectedView),
    rule__body: r(
      s(
        "collect",
        s("option", v.view, v.name),
        r(s("rule__location_view", v.id, v.view), f.file__name(v.view, v.name)),
        v.options
      ),
      view.select(
        v.selectedView,
        v.options,
        v.nextView,
        db.with_tx(
          v.tx,
          f.window__currentHistory(v.window, v.history),
          db.update(v.tx, v.history, "history__view", v.nextView)
        )
      )
    ),
  },
  window: {
    file__name: "Window",
    rule__params: l(v.window),
    rule__body: r(
      f.window__currentHistory(v.window, v.history),
      f.browser__currentWindow("browser", v.currentWindow),
      f.history__location(v.history, v.id),
      s("set_context", "window_id", v.window),
      s("set_context", "history_id", v.history),
      s("get_default", v.id, "file__name", v.name, v.id),
      s(
        "limit",
        1,
        r.or(
          // view from params
          f.history__view(v.history, v.view),
          // view from id
          s("rule__location_view", v.id, v.view)
        )
      ),
      s(
        "view",
        s(
          "WindowContainer",
          v.window,
          v.currentWindow,
          r(
            s("view", s("WindowBar", v.window, v.id, v.view, v.name)),
            s("call", v.view, v.id, v.history)
          )
        )
      )
    ),
  },
  app_menu: {
    file__name: "App menu",
    rule__params: l(),
    rule__body: view.row(
      view.button(
        "←",
        r(
          f.browser__currentWindow("browser", v.window),
          s("on__back", v.window)
        )
      ),
      view.button(
        "→",
        r(
          f.browser__currentWindow("browser", v.window),
          s("on__forward", v.window)
        )
      ),
      view.button("new window", r(s("on__newWindow", s("location", "omnibox"))))
    ),
  },
} satisfies Record<string, Rec>;

export const views = Object.fromEntries(
  Object.entries(baseViews).map(([key, value]) => [`view__${key}`, value])
);
