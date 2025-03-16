import { l, s, $, seq, f, x } from "../expr";
import { pkg } from "../pkg";

export const field = pkg("field", {
  field: {
    db__schema: "schema",
    file__name: "Field",
    file__description: l("Schema for field definitions"),
    schema__fields: l(s.field("_type"), s.field_optional("_index")),
  },
  _index: {
    db__schema: "field",
    file__name: "Field index",
    file__description: l(
      "If set, the field is indexed using an index of this type.",
    ),
    field__type: x.enum(s.ref(), s.multi_ref(), s.sorted()),
    field_index: s.sorted(),
  },
  _type: {
    db__schema: "field",
    file__name: "Field type",
    field__type: x.type__fn(x.type__type()),
  },
  field_check: {
    rule__params: l($.field, $.record),
    rule__body: seq(
      s.value_record_field($.value, $.record, $.field),
      s._check_type($.field, $.value),
    ),
  },
  field_check_opt: {
    rule__params: l($.field, $.record),
    rule__body: s.if_then_else(
      s.value_record_field($.value, $.record, $.field),
      s._check_type($.field, $.value),
      s.ok(),
    ),
  },
  _check_type: {
    rule__params: l($.field, $.value),
    rule__body: s.if_then_else(
      f._type($.field, $.type),
      s.type__check($.value, $.type),
      s.ok(),
    ),
  },
});
