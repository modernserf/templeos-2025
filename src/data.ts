import { l, r, s, v, Expr, Struct, Id, List, AnyStruct, __ } from "./expr";
import { typeRecs } from "./type";

export type FormatText = string | Struct<"link", [string, Id]>;

type SchemaField =
  | Struct<"field", [Field]>
  | Struct<"field_optional", [Field]>
  | Struct<"field_default", [Field, Expr]>;

type IndexType =
  | Struct<"ref", []> // TODO: what does this mean now?
  | Struct<"multiRef", []>
  | Struct<"sorted", []>
  | Struct<"unique", []>;

export type Rec = Record<string, Expr> & {
  time__created?: number;
  db__schema?: SchemaId;
  db__fields?: List<SchemaField>;
  db__type?: TypeId;
  db__index?: IndexType;

  rule__params?: List<Expr>;
  rule__body?: AnyStruct;
  view__schema?: SchemaId;
  view__field?: Field;
  view__type?: TypeId;

  file__name?: string;
  file__description?: List<FormatText>;

  folder__items?: List<Id>;

  history__location?: Id;
  history__view?: Id;
  history__back?: Id;
  history__forward?: Id;
  window__currentHistory?: Id;
  browser__currentWindow?: Id;

  text__content?: List<FormatText>;
};

export const f = new Proxy(
  {},
  {
    get(_, field: Field) {
      return (id: Expr, value: Expr) => s(field, id, value);
    },
  }
) as Record<Field, (id: Expr, value: Expr) => Expr>;

export const db = {
  get: (id: Expr, field: Field, value: Expr) =>
    s("get_field_value", id, field, value),
  update: (tx: Expr, id: Expr, field: Field, value: Expr) =>
    s("tx_update_field_value", tx, id, field, value),
  delete: (tx: Expr, id: Expr, field?: Field, value?: Expr) =>
    s("tx_delete_field_value", tx, id, field ?? __, value ?? __),
  with_tx: (tx: Expr, ...body: Expr[]) => s("with_tx", tx, s(",", ...body)),
};

export const view = {
  row: (...children: Expr[]) => s("view_children", s("Row"), r(...children)),
  column: (...children: Expr[]) =>
    s("view_children", s("Column"), r(...children)),
  data: (data: Expr) => s("view", s("AnyData", data)),
  string: (str: string) => s("view", s("String", str)),
  button: (str: string, onClick: Expr) => s("view", s("Button", str, onClick)),
  input: (value: string, event: Expr, onChange: Expr) =>
    s("view", s("Input", value, event, onChange)),
  select: (value: string, event: Expr, onChange: Expr, children: Expr) =>
    s("view_children", s("Select", value, event, onChange), children),
  option: (id: string, label: string) => s("view", s("Option", id, label)),
  link: (label: string, id: string, target: string = "current") =>
    s("view", s("Link", label, id, target)),
  fileLink: (id: string) => s("view__fileLink", id),
  icon: () => s("view", s("Icon")),
  text: (text: Expr) => s("view", s("Text", text)),
};

export type SchemaId = keyof typeof schemas;
const schemas = {
  // schemas
  schema__any: {
    db__schema: "schema__schema",
    file__name: "any Type",
    file__description: l("Fallback schema for any type of record"),
    db__fields: l(),
  },
  schema__schema: {
    db__schema: "schema__schema",
    file__name: "Schema",
    file__description: l("Schema for schema definitions"),
    db__fields: l(s("field", "db__fields")),
  },
  schema__type: {
    db__schema: "schema__schema",
    file__name: "Type",
    file__description: l("Schema for type definitions"),
    db__fields: l(s("field", "db__type")),
  },
  schema__field: {
    db__schema: "schema__schema",
    file__name: "Field",
    file__description: l("Schema for field definitions"),
    db__fields: l(
      s("field_optional", "db__refType"),
      s("field_optional", "db__index")
    ),
  },
  schema__indexType: {
    db__schema: "schema__schema",
    file__name: "Index type",
    file__description: l(
      "Schema for index type definitions (e.g. ref, unique, sorted etc)"
    ),
    db__fields: l(),
  },
  // TODO: rule primitive / view primitive?
  schema__rule: {
    db__schema: "schema__schema",
    file__name: "Rule",
    file__description: l("Schema for rule definitions"),
    db__fields: l(s("field", "rule__params"), s("field", "rule__body")),
  },
  schema__view: {
    db__schema: "schema__schema",
    file__name: "View",
    file__description: l(
      "a top-level view that can render records with a given schema"
    ),
    db__fields: l(
      s("field", "view__schema"),
      s("field", "rule__params"),
      s("field", "rule__body")
    ),
  },
  schema__text: {
    db__schema: "schema__schema",
    file__name: "Text",
    file__description: l("A text document"),
    db__fields: l(s("field", "text__content")),
  },
  schema__form: {
    db__schema: "schema__schema",
    file__name: "Form",
    file__description: l("A self rendering form UI"),
    db__fields: l(s("field", "rule__params"), s("field", "rule__body")),
  },
  schema__folder: {
    db__schema: "schema__schema",
    file__name: "Folder",
    file__description: l("A collection of records"),
    db__fields: l(s("field", "rule__params"), s("field", "rule__body")),
  },
  schema__history: {
    db__schema: "schema__schema",
    file__name: "History",
    file__description: l("A history entry"),
    db__fields: l(
      s("field", "history__window"),
      s("field", "history__location"),
      s("field_optional", "history__view"),
      s("field", "history__forward"),
      s("field", "history__back")
    ),
  },
  schema__window: {
    db__schema: "schema__schema",
    file__name: "Window",
    file__description: l("A window"),
    db__fields: l(s("field", "window__currentHistory")),
  },
  schema__browser: {
    db__schema: "schema__schema",
    file__name: "Browser",
    file__description: l("Root state for browser"),
    db__fields: l(s("field", "browser__currentWindow")),
  },
} satisfies Record<string, Omit<Rec, "db__schema">>;

type TypeId = keyof typeof coreTypes;
const coreTypes = {
  type__any: {
    db__schema: "schema__type",
    file__name: "Any",
  },
  type__string: {
    db__schema: "schema__type",
    file__name: "String",
    // db__type: s("string"),
  },
  type__number: {
    db__schema: "schema__type",
    file__name: "Number",
    // db__type: s("number"),
  },
  type__time: {
    db__schema: "schema__type",
    file__name: "Time",
  },
  type__ref: {
    db__schema: "schema__type",
    file__name: "Ref",
    // db__type: s("number"),
  },
  type__multiRef: {
    db__schema: "schema__type",
    file__name: "Multi ref",
    // db__type: s("list,s("number")),
  },
  type__text: {
    db__schema: "schema__type",
    file__name: "Text",
    // db__type: s(
    //   "list",
    //   s("oneof", s("string"), s("struct", "link", s("string"), s("ref")))
    // ),
  },
} satisfies Record<string, Rec>;

export type Field = keyof typeof fields;
const fields = {
  time__created: {
    db__schema: "schema__field",
    file__name: "Time created",
    db__type: "type__time",
    db__index: s("sorted"),
  },
  db__schema: {
    db__schema: "schema__field",
    file__name: "DB Schema",
    file__description: l("schema used to validate & render this record"),
    // db__type: s("ref", "schema__schema" as const),
    db__type: "type__ref",
    db__index: s("ref"),
  },
  db__fields: {
    db__schema: "schema__field",
    file__name: "DB Fields",
    // db__type: s(
    //   "list",
    //   s(
    //     "oneof",
    //     s("struct", "field", fieldRef),
    //     s("struct", "field__optional", fieldRef),
    //     s("struct", "field__default", fieldRef, s("any"))
    //   )
    // ),
  },
  db__type: {
    db__schema: "schema__field",
    file__name: "Field type",
    db__type: "type__ref",
    // db__type: s("ref", "schema__schema" as const),
    db__index: s("ref"),
  },
  db__index: {
    db__schema: "schema__field",
    file__name: "Field index",
    file__description: l(
      "If set, the field is indexed using an index of this type."
    ),
    // db__type: s(
    //   "oneof",
    //   s("struct", "ref"),
    //   s("struct", "multiRef"),
    //   s("struct", "sorted"),
    //   s("struct", "unique")
    // ),
    db__index: s("sorted"),
  },
  // TODO: rule primitive / view primitive?
  rule__params: {
    db__schema: "schema__field",
    file__name: "Rule params",
    // db__type: s("list", s("any")),
  },
  rule__body: {
    db__schema: "schema__field",
    file__name: "Rule body",
    // db__type: s("struct"),
  },
  view__schema: {
    db__schema: "schema__field",
    file__name: "View for schema",
    file__description: l("the schema that this view is supposed to render"),
    db__type: "type__ref",
    // db__type: s("ref", "schema__schema" as const),
    db__index: s("ref"),
  },
  view__field: {
    db__schema: "schema__field",
    file__name: "View for field",
    file__description: l("the field that this view can render"),
    db__type: "type__ref",
    db__index: s("ref"),
  },
  view__type: {
    db__schema: "schema__field",
    file__name: "View for type",
    file__description: l("the type that this view can render"),
    db__type: "type__ref",
    db__index: s("ref"),
  },
  file__name: {
    db__schema: "schema__field",
    file__name: "File name",
    file__description: l("field used for name in tab header & file explorer"),
    db__type: "type__string",
  },
  file__description: {
    db__schema: "schema__field",
    file__name: "File description",
    file__description: l("describes the content of the record"),
    db__type: "type__text",
  },
  folder__items: {
    db__schema: "schema__field",
    file__name: "File folder items",
    file__description: l("ids of files in folder"),
    db__type: "type__multiRef",
    db__index: s("multiRef"),
  },
  // Browser
  history__location: {
    db__schema: "schema__field",
    file__name: "History location ref",
    db__type: "type__ref",
  },
  history__view: {
    db__schema: "schema__field",
    file__name: "History view ref",
    db__type: "type__ref",
    // db__type: s("ref", "schema__view" as const),
  },
  history__back: {
    db__schema: "schema__field",
    file__name: "History back ref",
    db__type: "type__ref",
    // db__type: s("ref", "schema__history" as const),
  },
  history__forward: {
    db__schema: "schema__field",
    file__name: "History forward ref",
    db__type: "type__ref",
    // db__type: s("ref", "schema__history" as const),
  },
  history__window: {
    db__schema: "schema__field",
    file__name: "History window ref",
    db__type: "type__ref",
    // db__type: s("ref", "schema__window" as const),
  },
  window__currentHistory: {
    db__schema: "schema__field",
    file__name: "Window current history ref",
    db__type: "type__ref",
    // db__type: s("ref", "schema__history" as const),
  },
  browser__currentWindow: {
    db__schema: "schema__field",
    file__name: "Focused window in browser",
    db__type: "type__ref",
    // db__type: s("ref", "schema__window" as const),
  },
  text__content: {
    db__schema: "schema__field",
    file__name: "Text content",
    file__description: l("a list of text nodes used in text schema"),
    db__type: "type__text",
  },
  data__omnibox: {
    db__schema: "schema__field",
    file__name: "Omnibox search string",
    db__type: "type__string",
  },
} satisfies Record<string, Rec>;

const rules = {
  // type checks
  var: {
    rule__params: l(v.item),
    rule__body: s("value_type", v.item, s("var")),
  },
  nonvar: {
    rule__params: l(v.item),
    rule__body: r(
      s("value_type", v.item, v.type), //
      s("/=", v.type, s("var"))
    ),
  },
  string: {
    rule__params: l(v.item),
    rule__body: s("value_type", v.item, s("string")),
  },
  number: {
    rule__params: l(v.item),
    rule__body: s("value_type", v.item, s("number")),
  },
  struct: {
    rule__params: l(v.item),
    rule__body: s("value_type", v.item, s("struct")),
  },
  constrain_type: {
    rule__params: l(v.item, v.type),
    rule__body: s("value_constraint", v.item, s("value_type", v.item, v.type)),
  },
  list_item: {
    rule__params: l(v.list, v.item),
    rule__body: s("struct_id_index_arg", v.list, "", __, v.item),
  },
  if_var: {
    file__description: l("if arg is var, run body"),
    rule__params: l(v.arg, v.body),
    rule__body: s("if_then_else", s("var", v.arg), v.body, r()),
  },
  get_default: {
    rule__params: l(v.id, v.field, v.value, v.default),
    rule__body: s(
      "if_then_else",
      db.get(v.id, v.field, v.value),
      s("ok"),
      s("=", v.value, v.default)
    ),
  },
  tx_insert: {
    file__description: l("insert a property list into the db"),
    rule__params: l(v.tx, v.id, v.params),
    rule__body: r(
      s("struct_id_index_arg", v.params, __, __, v.pair),
      s("struct_id_index_arg", v.pair, v.field, 0, v.value),
      db.update(v.tx, v.id, v.field, v.value)
    ),
  },
  with_tx: {
    rule__params: l(v.tx, v.goal),
    rule__body: r(
      s("tx", v.tx),
      s(
        "if_then_else",
        s("collect", __, v.goal, __),
        s("commit", v.tx),
        s("rollback", v.tx)
      )
    ),
  },
  // event handlers
  on__selectWindow: {
    rule__params: l(v.window),
    rule__body: db.with_tx(
      v.tx,
      db.update(v.tx, "browser", "browser__currentWindow", v.window)
    ),
  },
  on__newWindow: {
    rule__params: l(v.location, v.params),
    rule__body: db.with_tx(v.tx, s("new__window", v.tx, __, v.location, __)),
  },
  on__closeWindow: {
    rule__params: l(v.window),
    rule__body: db.with_tx(v.tx, db.delete(v.tx, v.window)),
  },
  on__push: {
    rule__params: l(v.window, v.location, v.params),
    rule__body: db.with_tx(
      v.tx,
      s("if_var", v.window, s("get_context", "window_id", v.window)),
      f.window__currentHistory(v.window, v.prev),
      s("new__history", v.tx, v.next, v.window, v.location, v.params),
      db.update(v.tx, v.next, "history__back", v.prev),
      db.update(v.tx, v.prev, "history__forward", v.next),
      db.update(v.tx, v.window, "window__currentHistory", v.next)
    ),
  },
  on__back: {
    rule__params: l(v.window),
    rule__body: db.with_tx(
      v.tx,
      f.window__currentHistory(v.window, v.forward),
      f.history__back(v.forward, v.back),
      db.update(v.tx, v.window, "window__currentHistory", v.back),
      db.update(v.tx, v.back, "history__forward", v.forward),
      db.delete(v.tx, v.forward, "history__back")
    ),
  },
  on__forward: {
    rule__params: l(v.window),
    rule__body: db.with_tx(
      v.tx,
      f.window__currentHistory(v.window, v.back),
      f.history__forward(v.back, v.forward),

      db.update(v.tx, v.window, "window__currentHistory", v.forward),
      db.update(v.tx, v.forward, "history__back", v.back),
      db.delete(v.tx, v.back, "history__forward")
    ),
  },
  // constructors
  new__rule: {
    rule__params: l(v.tx, v.id, v.params, v.body),
    rule__body: r(
      db.update(v.tx, v.id, "rule__params", v.params),
      db.update(v.tx, v.id, "rule__body", v.body)
    ),
  },
  new__window: {
    rule__params: l(v.tx, v.window, v.location, v.params),
    rule__body: r(
      s("if_var", v.window, s("id", v.window)),
      s("new__history", v.tx, v.history, v.window, v.location, v.params),
      db.update(v.tx, v.window, "db__schema", "schema__window"),
      db.update(v.tx, v.window, "window__currentHistory", v.history)
    ),
  },
  new__history: {
    rule__params: l(v.tx, v.history, v.window, v.location, v.params),
    rule__body: r(
      s("if_var", v.history, s("id", v.history)),
      s("timestamp", v.ts),
      db.update(v.tx, v.history, "db__schema", "schema__history"),
      db.update(v.tx, v.history, "time__created", v.ts),
      db.update(v.tx, v.history, "history__window", v.window),
      db.update(v.tx, v.history, "history__location", v.location),
      r.or(
        //
        r(s("nonvar", v.params), s("tx_insert", v.tx, v.history, v.params)),
        r()
      )
    ),
  },
} satisfies Record<string, Rec>;

const views = {
  // type views
  view_type__any: {
    file__name: "Any : View",
    view__type: "type__any",
    rule__params: l(v.data),
    rule__body: r.or(
      r(s("var_name", v.data, v.var_name), view.string(v.var_name)),
      r(
        s("nonvar", v.data),
        r.or(
          r(s("string", v.data), view.string(v.data)),
          r(s("number", v.data), view.string(v.data)),
          r(
            s("struct", v.data),
            s("struct_id_args", v.data, v.id, v.args),
            s(
              "if_then_else",
              r.or(s("=", v.id, ";"), s("=", v.id, ",")),
              view.column(
                s("list_item", v.args, v.arg),
                view.row(s("view_type__any", v.arg), view.string(v.id))
              ),
              view.row(
                view.string(v.id),
                view.string("("),
                view.row(
                  s("list_item", v.args, v.arg),
                  s("view_type__any", v.arg)
                ),
                view.string(")")
              )
            )
          )
        )
      )
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
    rule__body: r.or(
      // []
      r(s("=", v.text, l())),
      // [el | rest]
      r(
        s("list_list_append", l(v.head), v.rest, v.text),
        r.or(
          r(s("string", v.head), view.string(v.head)),
          r(
            s("struct", v.head),
            s("struct_id_args", v.head, "link", v.args),
            // dumb, fixme
            s("struct_id_args", v.as_view, "Link", v.args),
            s("view", v.as_view)
          )
        ),
        s("view_type__text", v.rest)
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
        db.get(v.id, v.field, v.value),
        view.row(view.fileLink(v.field), s("view__for_field", v.field, v.value))
      ),
      r(
        view.string("References"),
        r.or(f.db__index(v.f, s("ref")), f.db__index(v.f, s("multiRef"))),
        r(
          db.get(v.ref, v.f, v.id),
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
      )
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

const files = {
  home: {
    db__schema: "schema__text",
    file__name: "home",
    file__description: l("this is the home card"),
    text__content: l(
      "content that ",
      s("link", "links", "example__folder"),
      " to another record.",
      s("link", "omnibox", "omnibox")
    ),
  },
  omnibox: {
    db__schema: "schema__form",
    file__name: "Omnibox",
    rule__params: l(v.id, v.state),
    rule__body: r(
      s("get_default", v.state, "data__omnibox", v.omnibox, ""),
      view.input(
        v.omnibox,
        v.next,
        db.with_tx(v.tx, db.update(v.tx, v.state, "data__omnibox", v.next))
      ),
      s(
        "limit",
        10,
        r(
          f.file__name(v.result, v.result_name),
          s("string_substring", v.result_name, v.omnibox)
        )
      ),
      s("view__fileInfo", v.result)
    ),
  },
  example__folder: {
    db__schema: "schema__folder",
    file__name: "Example Folder",
    file__description: l("A folder with some items"),
    folder__items: l("home", "schema__text", "view_type__text"),
  },
} satisfies Record<string, Rec>;

// always loads from source
export const data = {
  ...(schemas as Record<string, Rec>),
  ...coreTypes,
  ...fields,
  ...rules,
  ...views,
  ...files,

  ...typeRecs,
};

// loads from db if available
export const initState = {
  rootHistory: {
    db__schema: "schema__history",
    history__window: "rootWindow",
    history__location: "home",
  },
  rootWindow: {
    db__schema: "schema__window",
    window__currentHistory: "rootHistory",
  },
  browser: {
    db__schema: "schema__browser",
    file__name: "Browser state",
    browser__currentWindow: "rootWindow",
  },
} satisfies Record<string, Rec>;
