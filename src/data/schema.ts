import { $, __, l, s, seq, x, xfn } from "../expr";
import { pkg } from "../pkg";

export const { rules: schema } = pkg("schema", {
  schema: {
    db__schema: "schema",
    file__name: "Schema",
    file__description: l("Schema for schema definitions"),
    _fields: l(s.field("_fields")),
  },
  // fields that go on schema
  _t_field_def: {
    rule__params: l($.out),
    rule__body: s.enum(
      $.out,
      s.field(s.ref("field")),
      s.field_optional(s.ref("field")),
    ),
  },
  _test_t_field_def: {
    test__group: "schema",
    rule__params: l(),
    rule__body: seq(
      s.expect_eq(
        x._t_field_def(),
        s.type__union(s.type__box(__, __, __), s.type__box(__, __, __)),
      ),

      s.expect_ok(s.type__check(s.field("_fields"), s._t_field_def())),
      s.expect_ok(
        s.type__check(s.field_optional("_constructor"), s._t_field_def()),
      ),
    ),
  },
  _fields: {
    db__schema: "field",
    file__name: "Fields",
    field__type: s.list_of(s._t_field_def()),
  },
  // fields that ref schema but don't belong to other package
  _constructor: {
    db__schema: "field",
    file__name: "Constructor",
    file__description: l("rule creates records of this schema"),
    field__type: s.ref("schema"),
    field__index: s.ref(),
  },

  schema_check: {
    rule__params: l($.schema, $.record),
    rule__body: seq(
      s.db__schema($.schema, $.record),
      s._fields($.fields, $.schema),
      s.list__every($.fields, s._check_field($.record)),
    ),
  },
  _check_field: {
    rule__params: l($.field_def, $.record),
    rule__body: s.match_cond(
      $.field_def,
      l(s.field($.field), s.field_check($.field, $.record)),
      l(s.field_optional($.field), s.field_check_opt($.field, $.record)),
    ),
  },

  _test_invalid_schema: {
    // missing schema__fields
    db__schema: "schema",
    test__flags: l(s.ignore_schema_check_all()),
    _ignore_schema_check_all: s.ok(),
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
  _test_schema_check_all: {
    test__group: "schema",
    rule__params: l(),
    rule__body: s.block(
      __,
      seq(
        s.db__schema($.schema, $.id),
        s.none(s.test__has_flag(s.ignore_schema_check_all(), $.id)),
        s.expect_ok(s.schema_check($.schema, $.id)),
      ),
    ),
  },

  _view_schema_records: {
    db__schema: "view",
    file__name: "Schema records",
    view__subject: s.schema("schema"),
    rule__params: l($.out, $.id, $._state),
    rule__body: seq(
      s.column(
        $.out,
        l(),
        x.table(
          l(),
          x.table_section(
            x.table_header(l(), x.view__string("Records")),
            xfn($.out)(
              s.if_then_else(
                s.db__schema($.id, $.rec),
                s.table_row($.out, l(), x.view__file_link($.rec)),
                s.table_row($.out, l(), x.view__string("none")),
              ),
            ),
          ),
          x.table_section(
            x.table_header(l(), x.view__string("Constructors")),
            xfn($.out)(
              s.if_then_else(
                s._constructor($.id, $.ctor),
                s.table_row($.out, l(), x._view_constructor($.ctor)),
                s.table_row($.out, l(), x.view__string("none")),
              ),
            ),
          ),
        ),
      ),
    ),
  },
  _view_constructor: {
    rule__params: l($.out, $.ctor),
    rule__body: s.view__button(
      $.out,
      l(),
      x.file__name($.ctor),
      s.on_click(
        seq(
          s.call($.ctor, $.id),
          s.current_window($.window),
          s.on__push($.window, s.location($.id)),
        ),
      ),
    ),
  },
});
