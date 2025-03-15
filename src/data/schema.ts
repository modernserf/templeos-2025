import { $, __, alt, f, l, s, seq } from "../expr";
import { pkg } from "../pkg";

export const schema = pkg("schema", {
  schema: {
    db__schema: "schema",
    file__name: "Schema",
    file__description: l("Schema for schema definitions"),
    _fields: l(s.field("_fields")),
  },
  // fields that go on schema
  _fields: {
    db__schema: "field",
    file__name: "Fields",
  },
  // fields that ref schema
  _constructor: {
    db__schema: "field",
    file__name: "Constructor",
    file__description: l("rule creates records of this schema"),
    field__index: s.ref(),
  },
  _view_record: {
    db__schema: "field",
    file__name: "View for schema",
    file__description: l("the schema that this view is supposed to render"),
    field__type: "ref",
    // field__type: s.ref( "schema" as const),
    field__index: s.ref(),
  },
  _views: {
    rule__params: l($.view, $.record),
    rule__body: alt(
      // id for view type
      seq(
        s.nonvar($.view),
        f._view_record($.view, $.schema),
        f.db__schema($.record, $.schema),
      ),
      // view for id type
      seq(
        s.nonvar($.record),
        f.db__schema($.record, $.schema),
        f._view_record($.view, $.schema),
      ),
      // view for any type
      f._view_record($.view, "any_record"),
    ),
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
    _view_record: "schema",
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
