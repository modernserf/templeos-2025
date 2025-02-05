import { Rec, Location } from "./data";
import { l, r, s, v, Expr, __, AnyStruct, List } from "./expr";
import { f } from "./field";
import { db } from "./rule";

export const view = {
  row: (...children: Expr[]) => s("view__row", ...children),
  column: (...children: Expr[]) => s("view__column", ...children),
  string: (str: string) => s("view__string", str),
  button: (str: string, onClick: Expr) => s("view__button", str, onClick),
  input: (value: string, event: Expr, onChange: Expr) =>
    s("view__input", value, event, onChange),
  select: (value: Expr, event: Expr, options: Expr, onChange: Expr) =>
    s("view__select", value, event, options, onChange),
  link: (label: string, location: Location, params: List<AnyStruct> = l()) =>
    s("view__link", label, location, params),
  icon: () => s("view__icon"),
  fileLink: (id: string) => s("view__fileLink", id),
};

export const rootView = r(
  s("view__appMenu"),
  f.db__schema(v.window, "schema__window"),
  s("view__window", v.window)
);

export const views = {
  // primitives
  view__row: {
    rule__params: l(),
    rule__rest_params: v.children_list,
    rule__body: r(
      s("struct_tag_list", v.children, ",", v.children_list),
      s("view", "Row", l(), l(), v.children)
    ),
  },
  view__column: {
    rule__params: l(),
    rule__rest_params: v.children_list,
    rule__body: r(
      s("struct_tag_list", v.children, ",", v.children_list),
      s("view", "Column", l(), l(), v.children)
    ),
  },
  view__string: {
    rule__params: l(v.string),
    rule__body: s("view", "String", l(v.string), l(), r()),
  },
  view__button: {
    rule__params: l(v.string, v.on_click),
    rule__body: s("view", "Button", l(v.string, ""), l(l(__, v.on_click)), r()),
  },
  view__input: {
    rule__params: l(v.value, v.next, v.on_change),
    rule__body: s(
      "view",
      "Input",
      l(v.value, ""),
      l(l(v.next, v.on_change)),
      r()
    ),
  },
  view__select: {
    rule__params: l(v.value, v.next, v.options, v.on_change),
    rule__body: s(
      "view",
      "Select",
      l(v.value, v.options),
      l(l(v.next, v.on_change)),
      r()
    ),
  },
  view__link: {
    rule__params: l(v.label, v.location, v.params),
    rule__body: r(
      s("get_context", "window_id", v.window),
      s(
        "view",
        "Button",
        l(v.label, "Link"),
        l(
          l(
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
        ),
        r()
      )
    ),
  },
  view__icon: {
    rule__params: l(),
    rule__body: s("view", "Icon", l(), l(), r()),
  },
  // type views
  view_type__any: {
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
              s("_view_operator_vertical", v.id, v.args)
            ),
            r(
              s("list_item", l("="), v.id),
              s("_view_operator_binary", v.id, v.args)
            )
          ),
          s("ok"),
          s("_view_tuple", v.id, v.args)
        )
      )
    ),
  },
  _view_operator_binary: {
    rule__params: l(v.id, l(v.l, v.r)),
    rule__body: view.row(
      s("view_type__any", v.l),
      view.string(v.id),
      s("view_type__any", v.r)
    ),
  },
  _view_operator_vertical: {
    rule__params: l(v.id, v.args),
    rule__body: view.column(
      s("list_item", v.args, v.arg),
      view.row(view.string(v.id), s("view_type__any", v.arg))
    ),
  },
  _view_tuple: {
    rule__params: l(v.id, v.args),
    rule__body: view.row(
      view.string(v.id),
      view.string("("),
      view.row(s("list_item", v.args, v.arg), s("view_type__any", v.arg)),
      view.string(")")
    ),
  },
  view_type__string: {
    view__type: "type__string",
    rule__params: l(v.string),
    rule__body: view.string(v.string),
  },
  view_type__time: {
    view__type: "type__time",
    rule__params: l(v.ts),
    rule__body: view.string(v.ts),
  },
  view_type__ref: {
    view__type: "type__ref",
    rule__params: l(v.ref),
    rule__body: view.fileLink(v.ref),
  },
  view_type__text: {
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
  _fit_content_input: {
    rule__params: l(v.value, v.next, v.on_change),

    rule__body: s(
      "view",
      "Input",
      l(v.value, "Input--fitContent"),
      l(l(v.next, v.on_change)),
      r()
    ),
  },

  view_type__any_edit: {
    file__name: "Any : Edit",
    rule__params: l(v.data, v.next, v.on_change),
    rule__body: r.or(
      r(
        s("var_name", v.data, v.var_name),
        s("_fit_content_input", v.var_name, v.next, v.on_change)
      ),
      r(
        s("string", v.data),
        s("_fit_content_input", v.data, v.next, v.on_change)
      ),
      r(
        s("number", v.data),
        s(
          "_fit_content_input",
          v.data,
          v.next_str,
          r(s("string_number", v.next_str, v.next), v.on_change)
        )
      ),
      r(
        s("struct", v.data),
        s("view_type__struct_edit", v.data, v.next, v.on_change)
      )
    ),
  },
  view_type__struct_edit: {
    file__name: "Any Struct : Edit",
    rule__params: l(v.data, v.next, v.on_change),
    rule__body: r(
      s("struct_tag_list", v.data, v.id, v.args),
      view.row(
        s(
          "_fit_content_input",
          v.id,
          v.next_id,
          r(s("struct_tag_list", v.next, v.next_id, v.args), v.on_change)
        ),
        view.string("("),
        view.column(
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
            s(
              "view_type__any_edit",
              v.arg,
              v.arg_next,
              r(
                s("struct_at_value_updated", v.data, v.i, v.arg_next, v.next),
                v.on_change
              )
            )
          )
        ),
        s(
          "view_type__struct_add_field",
          v.next_arg,
          r(s("_struct_push", v.data, v.next_arg, v.next), v.on_change)
        ),
        view.string(")")
      )
    ),
  },
  _struct_push: {
    rule__params: l(v.struct, v.added, v.updated),
    rule__body: r(
      s("struct_tag_list", v.struct, v.tag, v.list),
      s("list_list_append", v.list, l(v.added), v.next_list),
      s("struct_tag_list", v.updated, v.tag, v.next_list)
    ),
  },

  view_type__struct_add_field: {
    rule__params: l(v.next, v.on_change),
    rule__body: r(
      view.select(
        "",
        v.next_type,
        l(
          s("option", "", "+"),
          s("option", "string", "string"),
          s("option", "number", "number"),
          s("option", "struct", "struct"),
          s("option", "var", "var")
        ),
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

  // schema views
  view_schema__any: {
    file__name: "Default viewer",
    view__schema: "schema__any",
    rule__params: l(v.id, v.state),
    rule__body: view.column(
      r.or(
        view.row(view.string("id:"), view.string(v.id)),
        r(
          view.string("Fields"),
          s("get_field_value", v.id, v.field, v.value),
          view.row(
            view.fileLink(v.field),
            s("view__for_field", v.field, v.value)
          )
        ),
        r(
          view.string("References"),
          r.or(f.db__index(v.f, s("ref")), f.db__index(v.f, s("multiRef"))),
          r(
            s("get_field_value", v.ref, v.f, v.id),
            view.row(view.fileLink(v.f), view.fileLink(v.ref))
          )
        )
      )
    ),
  },
  view_schema__any_edit: {
    file__name: "Default editor",
    view__schema: "schema__any",
    rule__params: l(v.id, v.state),
    rule__body: view.column(
      view.row(view.string("id:"), view.string(v.id)),
      view.string("Fields"),
      view.column(
        s("get_field_value", v.id, v.field, v.value),
        view.row(
          view.button("×", db.with_tx(v.tx, db.delete(v.tx, v.id, v.field))),
          view.fileLink(v.field),
          s(
            "view_type__any_edit",
            v.value,
            v.next,
            db.with_tx(v.tx, db.update(v.tx, v.id, v.field, v.next))
          )
        )
      )
      // view.column(
      //   s(
      //     "collect",
      //     s("option", v.field_id, v.field_name),
      //     r(
      //       f.db__schema(v.field_id, "schema__field"),
      //       f.file__name(v.field_id, v.field_name)
      //     ),
      //     v.fields
      //   ),
      //   s(
      //     "list_list_append",
      //     l(s("option", "", "Add field...")),
      //     v.fields,
      //     v.field_opts
      //   ),
      //   view.select(
      //     "",
      //     v.new_field_id,
      //     v.field_opts,
      //     s("_add_field", v.id, v.new_field_id)
      //   )
      // )
    ),
  },
  _add_field: {
    rule__params: l(v.id, v.field),
    rule__body: db.with_tx(
      v.tx,
      f.db__type(v.field, v.field_type),
      s(
        "if_then_else",
        f.db__default_value(v.field_type, v.default_value),
        s("ok"),
        s("=", v.default_value, l())
      ),
      db.update(v.tx, v.id, v.field, v.default_value)
    ),
  },
  view_schema__text: {
    file__name: "Text viewer",
    view__schema: "schema__text",
    rule__params: l(v.id, v.state),
    rule__body: r(
      f.text__content(v.id, v.text),
      view.row(s("view_type__text", v.text))
    ),
  },
  view_schema__folder_list: {
    file__name: "Folder - List",
    view__schema: "schema__folder",
    rule__params: l(v.id, v.state),
    rule__body: r(
      f.folder__items(v.id, v.folder),
      s("list_item", v.folder, v.item),
      view.row(s("view__fileInfo", v.item))
    ),
  },
  view_schema__folder_icon: {
    file__name: "Folder - Icon",
    view__schema: "schema__folder",
    rule__params: l(v.id, v.state),
    rule__body: view.row(
      f.folder__items(v.id, v.folder),
      s("list_item", v.folder, v.item),
      view.column(view.icon(), view.fileLink(v.item))
    ),
  },
  view_schema__form: {
    file__name: "Form",
    view__schema: "schema__form",
    rule__params: l(v.id, v.state),
    rule__body: s("call", v.id, v.id, v.state),
  },
  view_schema__schema: {
    file__name: "Schema viewer",
    view__schema: "schema__schema",
    rule__params: l(v.id, v.state),
    rule__body: view.column(
      view.row(f.file__description(v.id, v.desc), s("view_type__text", v.desc)),
      view.column(
        view.string("Fields:"),
        f.db__fields(v.id, v.fields),
        s("list_item", v.fields, v.field),
        r.or(
          r(s("=", v.field, s("field", v.field_id)), view.fileLink(v.field_id)),
          r(
            s("=", v.field, s("field_optional", v.field_id)),
            view.fileLink(v.field_id),
            view.string("(optional)")
          )
        )
      ),
      view.column(
        view.string("Items:"),
        f.db__schema(v.record, v.id),
        view.row(s("view__fileInfo", v.record))
      ),
      s(
        "view__button",
        "New item",
        s(
          "with_tx",
          v.tx,
          r(
            s("id", v.item_id),
            db.update(v.tx, v.item_id, "db__schema", v.id),
            s("new__window", v.tx, __, s("location", v.item_id))
          )
        )
      )
    ),
  },

  // built in UI elements
  view__for_field: {
    rule__params: l(v.field, v.value),
    rule__body: r(
      s("limit", 1, r(s("rule__field_view", v.field, v.view))),
      s("call", v.view, v.value)
    ),
  },
  view__fileLink: {
    rule__params: l(v.id),
    rule__body: r(
      s("get_default", v.id, "file__name", v.name, v.id),
      view.link(v.name, s("location", v.id))
    ),
  },
  view__fileInfo: {
    rule__params: l(v.id),
    rule__body: r(
      f.file__name(v.id, v.name),
      view.link(v.name, s("location", v.id)),
      r.or(
        r(
          f.file__description(v.id, v.description),
          s("view_type__text", v.description)
        ),
        r()
      )
    ),
  },
  view__viewMenu: {
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
        v.nextView,
        v.options,
        db.with_tx(
          v.tx,
          f.window__currentHistory(v.window, v.history),
          db.update(v.tx, v.history, "history__view", v.nextView)
        )
      )
    ),
  },
  view__window: {
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
        "WindowContainer",
        l(v.window, v.currentWindow),
        l(),
        r(
          s("view", "WindowBar", l(v.window, v.id, v.view, v.name), l(), r()),
          s("call", v.view, v.id, v.history)
        )
      )
    ),
  },
  view__appMenu: {
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
  // utilities
  rule__location_view: {
    rule__params: l(v.location, v.view),
    rule__body: r.or(
      // location for view type
      r(
        s("nonvar", v.view),
        f.view__schema(v.view, v.schema),
        f.db__schema(v.location, v.schema)
      ),
      // view for location type
      r(
        s("nonvar", v.location),
        f.db__schema(v.location, v.schema),
        f.view__schema(v.view, v.schema)
      ),
      // view for any type
      f.view__schema(v.view, "schema__any")
    ),
  },
  rule__field_view: {
    rule__params: l(v.field, v.view),
    rule__body: r.or(
      f.view__field(v.view, v.type),
      r(
        s("nonvar", v.field),
        f.db__type(v.field, v.type),
        f.view__type(v.view, v.type)
      ),
      r(
        s("nonvar", v.view),
        f.db__type(v.field, v.type),
        f.view__type(v.view, v.type)
      ),
      f.view__type(v.view, "type__any")
    ),
  },
  rule__type_view: {
    rule__params: l(v.type, v.view),
    rule__body: r.or(
      f.view__type(v.view, v.type),
      f.view__type(v.view, "type__any")
    ),
  },
} satisfies Record<string, Rec>;
