import { $, __, f, l, s, seq } from "../expr";
import { pkg } from "../pkg";

export const schema = pkg("schema", {
  schema: {
    db__schema: "schema",
    file__name: "Schema",
    file__description: l("Schema for schema definitions"),
    _fields: l(s.field("_fields")),
  },
  // fields that go on schema
  _t_field_def: {
    rule__params: l($.out),
    rule__body: s.oneof(
      $.out,
      s.box("field", s.ref("field")),
      s.box("field_optional", s.ref("field")),
    ),
  },
  _test_t_field_def: {
    test__group: "schema",
    rule__params: l(),
    rule__body: seq(
      s.expect_ok(s.type__check(s.field("_fields"), s._t_field_def())),
      s.expect_ok(
        s.type__check(s.field_optional("_constructor"), s._t_field_def()),
      ),
    ),
  },
  _fields: {
    db__schema: "field",
    file__name: "Fields",
    field__type: s.list(s._t_field_def()),
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
      f.db__schema($.record, $.schema),
      f._fields($.schema, $.fields),
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
        f.db__schema($.id, $.schema),
        s.none(f._ignore_schema_check_all($.id, __)),
        s.expect_ok(s.schema_check($.schema, $.id)),
      ),
    ),
  },

  _view_schema_records: {
    file__name: "Schema records",
    view__subject: s.schema("schema"),
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
