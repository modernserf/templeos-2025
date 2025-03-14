import { $, __, f, l, s, seq } from "../expr";
import { pkg } from "../pkg";

export const schema = pkg("schema", {
  schema: {
    db__schema: "schema",
    file__name: "Schema",
    file__description: l("Schema for schema definitions"),
    _fields: l(s.field("_fields")),
  },
  _fields: {
    db__schema: "field",
    file__name: "Fields",
  },
  _constructor: {
    db__schema: "field",
    file__name: "Constructor",
    file__description: l("rule creates records of this schema"),
    db__index: s.ref(),
  },
  schema_check: {
    rule__params: l($.schema, $.record),
    rule__body: seq(
      f.db__schema($.record, $.schema),
      f._fields($.schema, $.fields),
      s.list__every($.fields, s._check_field($.record)),
    ),
  },
  // TODO: check field value types
  _check_field: {
    rule__params: l($.field_def, $.record),
    rule__body: s.match_cond(
      $.field_def,
      l(s.field($.field), s.value_record_field(__, $.record, $.field)),
      l(s.field_optional($.field), s.ok()),
      l(__, s.unknown_message($.field_def)),
    ),
  },
  _test_invalid_schema: {
    // missing schema__fields
    db__schema: "schema",
  },
  _test_schema_check: {
    test__group: "schema",
    rule__params: l(),
    rule__body: seq(
      s.expect_collect($.schema, s.schema_check($.schema, "schema"), "schema"),
      s.expect_collect($.schema, s.schema_check($.schema, "_fields"), "field"),
      s.expect_fail(s.schema_check("schema", "_test_invalid_schema")),
    ),
  },

  _view_schema_records: {
    file__name: "Schema records",
    view__schema: "schema",
    rule__params: l($.out, $.id, $.params),
    rule__body: seq(
      s.column(
        $.out,
        l(),
        s.table(
          l(),
          s.table_section(
            l(),
            l(s.view__string("Records")),
            s.expr_iter_else(
              f.db__schema($.rec, $.id),
              l(s.table_row(l(), s.view__file_link($.rec))),
              l(s.table_row(l(), s.view__string("none"))),
            ),
          ),
          s.table_section(
            l(),
            l(s.view__string("Constructors")),
            s.expr_iter_else(
              f._constructor($.ctor, $.id),
              l(s.table_row(l(), s._view_constructor($.ctor))),
              l(s.table_row(l(), s.view__string("none"))),
            ),
          ),
        ),
      ),
    ),
  },

  _view_constructor: {
    rule__params: l($.out, $.ctor),
    rule__body: seq(
      f.file__name($.ctor, $.name),
      s.view__button(
        $.out,
        l(),
        $.name,
        s.on_click(
          seq(
            s.call($.ctor, $.id),
            s.current_window($.window),
            s.on__push($.window, s.location($.id)),
          ),
        ),
      ),
    ),
  },
});
