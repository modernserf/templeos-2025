import { Rec } from "./data";
import { l, r, s, v, Expr, __ } from "./expr";
import { f } from "./field";
import { db } from "./rule";

export const view = {
  row: (...children: Expr[]) => s("view_children", s("Row"), r(...children)),
  column: (...children: Expr[]) =>
    s("view_children", s("Column"), r(...children)),
  data: (data: Expr) => s("view", s("AnyData", data)),
  string: (str: string) => s("view", s("String", str)),
  button: (str: string, onClick: Expr) =>
    s("view_callback", s("Button", str), __, onClick),
  input: (value: string, event: Expr, onChange: Expr) =>
    s("view_callback", s("Input", value), event, onChange),
  select: (value: string, event: Expr, onChange: Expr, children: Expr) =>
    s("view_callback", s("Select", value), event, onChange, children),
  option: (id: string, label: string) => s("view", s("Option", id, label)),
  link: (label: string, id: string, target: string = "current") =>
    s("view", s("Link", label, id, target)),
  fileLink: (id: string) => s("view__fileLink", id),
  icon: () => s("view", s("Icon")),
  text: (text: Expr) => s("view", s("Text", text)),
};

export const rootView = r(
  s("view__appMenu"),
  f.db__schema(v.window, "schema__window"),
  s("view__window", v.window)
);

export const views = {
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
  view_type__any_edit: {
    file__name: "Any : Edit",
    rule__params: l(v.data, v.next, v.on_change),
    rule__body: r.or(
      r(
        s("var_name", v.data, v.var_name),
        // view.string("todo var")
        view.input(v.var_name, v.next, v.on_change)
      ),
      r(s("string", v.data), view.input(v.data, v.next, v.on_change)),
      r(
        s("number", v.data),
        view.input(
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
        view.input(
          v.id,
          v.next_id,
          r(s("struct_tag_list", v.next, v.next_id, v.args), v.on_change)
        ),
        view.string("("),
        s(
          "view_children",
          s("Column"),
          r(
            s("struct_at_value", v.data, v.i, v.arg),
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

        view.string(")")
      )
    ),
  },

  // schema views
  view_schema__any: {
    file__name: "Default viewer",
    view__schema: "schema__any",
    rule__params: l(v.id, v.state),
    rule__body: r.or(
      r(
        view.string("Fields"),
        s("get_field_value", v.id, v.field, v.value),
        view.row(view.fileLink(v.field), s("view__for_field", v.field, v.value))
      ),
      r(
        view.string("References"),
        r.or(f.db__index(v.f, s("ref")), f.db__index(v.f, s("multiRef"))),
        r(
          s("get_field_value", v.ref, v.f, v.id),
          view.row(view.fileLink(v.f), view.fileLink(v.ref))
        )
      )
    ),
  },
  view_schema__any_edit: {
    file__name: "Default editor",
    view__schema: "schema__any",
    rule__params: l(v.id, v.state),
    rule__body: r.or(
      r(
        view.string("Fields"),
        s("get_field_value", v.id, v.field, v.value),
        view.row(
          view.fileLink(v.field),
          s(
            "view_type__any_edit",
            v.value,
            v.next,
            db.with_tx(v.tx, db.update(v.tx, v.id, v.field, v.next))
          )
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
    rule__body: r(
      view.row(
        f.folder__items(v.id, v.folder),
        s("list_item", v.folder, v.item),
        view.column(view.icon(), view.fileLink(v.item))
      )
    ),
  },
  view_schema__form: {
    file__name: "Form",
    view__schema: "schema__form",
    rule__params: l(v.id, v.state),
    rule__body: r(
      //
      s("call", v.id, v.id, v.state)
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
      view.link(v.name, v.id)
    ),
  },
  view__fileInfo: {
    rule__params: l(v.id),
    rule__body: r(
      f.file__name(v.id, v.name),
      view.link(v.name, v.id),
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
      view.select(
        v.selectedView,
        v.nextView,
        db.with_tx(
          v.tx,
          f.window__currentHistory(v.window, v.history),
          db.update(v.tx, v.history, "history__view", v.nextView)
        ),
        r(
          s("rule__location_view", v.id, v.view),
          f.file__name(v.view, v.name),
          view.option(v.view, v.name)
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
        s("Window", v.id, v.view, v.window, v.history, v.currentWindow, v.name)
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
      view.button("new window", r(s("on__newWindow", "omnibox", l())))
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
