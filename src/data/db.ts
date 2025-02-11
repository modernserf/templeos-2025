import { Rec, Field } from ".";
import { l, r, s, $, __, u, Expr, view } from "../expr";
import { test } from "./test_utils";

export const db = {
  get: (id: Expr, field: Field, value: Expr) =>
    s.get_field_value(id, field, value),
  update: (tx: Expr, id: Expr, field: Field, value: Expr) =>
    s.tx_update_field_value(tx, id, field, value),
  delete: (tx: Expr, id: Expr, field?: Field, value?: Expr) =>
    s.tx_delete_field_value(tx, id, field ?? __, value ?? __),
  with_tx: (tx: Expr, ...body: Expr[]) => s.with_tx(tx, r(...body)),
  field: (field: Field) => s("field", field),
  field_optional: (field: Field) => s("field_optional", field),
};

export const dbData = {
  // types
  ref: {
    db__schema: "type",
    file__name: "Ref",
    file__description: l("A record id."),
    db__default_value: "",
    db__default_view: "view__ref",
    // db__type: s.number(),
  },
  multi_ref: {
    db__schema: "type",
    file__name: "Multi ref",
    file__description: l(
      "A list of record ids, which are indexed individually.",
    ),
    db__default_value: l(),
    // db__type: s("list,s.number()),
  },
  // schemas
  schema: {
    db__schema: "schema",
    file__name: "Schema",
    file__description: l("Schema for schema definitions"),
    db__fields: l(db.field("db__fields")),
  },
  field: {
    db__schema: "schema",
    file__name: "Field",
    file__description: l("Schema for field definitions"),
    db__fields: l(db.field_optional("db__index")),
  },
  any_record: {
    db__schema: "schema",
    file__name: "Any Record",
    file__description: l("Fallback schema for any type of record"),
    db__fields: l(),
  },
  // Fields
  db__schema: {
    db__schema: "field",
    file__name: "DB Schema",
    file__description: l("schema used to validate & render this record"),
    // db__type: s.ref( "schema" as const),
    db__type: "ref",
    db__index: s.ref(),
  },
  db__fields: {
    db__schema: "field",
    file__name: "DB Fields",
    // db__type: s(
    //   "list",
    //   s(
    //     "oneof",
    //     s.box( "field", fieldRef),
    //     s.box( "field__optional", fieldRef),
    //     s.box( "field__default", fieldRef, s.any())
    //   )
    // ),
  },
  db__type: {
    db__schema: "field",
    file__name: "Field type",
    db__type: "ref",
    // db__type: s.ref( "schema" as const),
    db__index: s.ref(),
  },
  db__index: {
    db__schema: "field",
    file__name: "Field index",
    file__description: l(
      "If set, the field is indexed using an index of this type.",
    ),
    // db__type: s(
    //   "oneof",
    //   s.box( "ref"),
    //   s.box( "multiRef"),
    //   s.box( "sorted"),
    //   s.box( "unique")
    // ),
    db__index: s.sorted(),
  },
  db__default_view: {
    db__schema: "field",
    file__name: "Default view",
    file__description: l(
      "the default view for this entity ",
      "(e.g. a type, field or schema).",
    ),
  },
  db__default_value: {
    db__schema: "field",
    file__name: "Default value",
  },
  // Rules
  test__db: {
    test__group: "db",
    rule__params: l(),
    rule__body: r(
      s.id($.id),
      test.db(
        $.tx,
        db.update($.tx, $.id, "test__field" as Field, 123),

        s.get_field_value($.id, "test__field", $.value),
        test.eq($.value, 123),
      ),
      test.fail(s.get_field_value($.id, "test__field", $.value)),
    ),
  },
  get_default: {
    rule__params: l($.id, $.field, $.value, $.default),
    rule__body: s.if_then_else(
      s.get_field_value($.id, $.field, $.value),
      s.ok(),
      u($.value, $.default),
    ),
  },
  with_tx: {
    rule__params: l($.tx, $.goal),
    rule__body: r(
      s.tx($.tx),
      s.if_then_else(
        s.collect(__, $.goal, __),
        s.commit($.tx),
        s.rollback($.tx),
      ),
    ),
  },

  _add_field: {
    rule__params: l($.id, $.field),
    rule__body: db.with_tx(
      $.tx,
      s.db__type($.field, $.field_type),
      s.get_default($.field_type, "db__default_value", $.default_value, l()),
      db.update($.tx, $.id, $.field, $.default_value),
    ),
  },

  // constructors
  new__default: {
    rule__params: l($.tx, $.id, $.schema),
    rule__body: r(
      s.if_var($.id, s.id($.id)),
      db.update($.tx, $.id, "db__schema", $.schema),
      s.db__fields($.schema, $.fields),
      s.each_item_do(
        $.fields,
        s.field($.field),
        r(
          s.db__type($.field, $.field_type),
          s.get_default(
            $.field_type,
            "db__default_value",
            $.default_value,
            l(),
          ),
          db.update($.tx, $.id, $.field, $.default_value),
        ),
      ),
    ),
  },

  new__rule: {
    rule__params: l($.tx, $.id, $.params, $.body),
    rule__body: r(
      db.update($.tx, $.id, "rule__params", $.params),
      db.update($.tx, $.id, "rule__body", $.body),
    ),
  },

  // views
  // schema views
  view__any_record_fields: {
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
  view__any_record_refs: {
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
              s.fork(s.db__index($.f, s.ref()), s.db__index($.f, s.multiRef())),
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
  view__any_record_view_state: {
    rule__params: l($.id, $.state, $.out),
    rule__body: view.render(
      view.table(
        l(),
        s.children(
          view.table_header(
            l(),
            s.children(view.string("State"), view.string("Value")),
          ),
        ),
        s.children(
          view.iter(
            r(
              s.get_field_value($.state, $.field, __), //
              s(
                "¬",
                s.match(
                  $.field,
                  "db__schema",
                  "history__id",
                  "history__view",
                  "history__forward",
                  "history__back",
                ),
              ),
            ),
            l(
              view.table_row(
                l(),
                s.children(
                  view.file_link($.field),
                  view.id_field($.state, $.field),
                ),
              ),
            ),
          ),
        ),
      ),
      $.out,
    ),
  },
  view__any_record: {
    file__name: "Default viewer",
    view__schema: "any_record",
    rule__params: l($.id, $.state, $.out),
    rule__body: view.render(
      view.column(
        l(),
        s.children(
          view.any_record_fields($.id, $.state),
          view.any_record_refs($.id, $.state),
          view.any_record_view_state($.id, $.state),
        ),
      ),
      $.out,
    ),
  },

  view__any_record_add_field: {
    rule__params: l($.id, $.out),
    rule__body: r(
      s.collect(
        s.option($.field_id, $.field_name),
        r(
          s.db__schema($.field_id, "field"),
          s.file__name($.field_id, $.field_name),
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
  view__any_record_edit: {
    file__name: "Default editor",
    view__schema: "any_record",
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
      view.any_record_add_field($.id, $.add_menu),
      view.column(l(), l($.table, $.add_menu), $.out),
    ),
  },
  view__schema_field: {
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
  view__schema_: {
    file__name: "Schema viewer",
    view__schema: "schema",
    rule__params: l($.id, $.state, $.out),
    rule__body: view.render(
      view.column(
        l(),
        s.children(
          view.string("Fields:"),
          view.iter(
            r(s.db__fields($.id, $.fields), s.list_item($.fields, $.field)),
            l(view.schema_field($.field)),
          ),
          view.spacer("1rem"),
          view.string("Views:"),
          view.iter(s.view__schema($.view, $.id), l(view.file_info($.view))),
          view.spacer("1rem"),
          view.string("Items:"),
          view.iter(s.db__schema($.record, $.id), l(view.file_info($.record))),

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
} satisfies Record<string, Rec>;
