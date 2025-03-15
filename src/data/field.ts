import { l, s, $, seq, f } from "../expr";
import { pkg } from "../pkg";

export const field = pkg("field", {
  field: {
    db__schema: "schema",
    file__name: "Field",
    file__description: l("Schema for field definitions"),
    schema__fields: l(s.field_optional("_index"), s.field_optional("_type")),
  },
  _index: {
    db__schema: "field",
    file__name: "Field index",
    file__description: l(
      "If set, the field is indexed using an index of this type.",
    ),
    _index: s.sorted(),
  },
  _type: {
    db__schema: "field",
    file__name: "Field type",
    field__type: "ref",
    field__index: s.ref(),
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
      // TODO: typechecking isnt just fn call
      s.call($.type, $.value),
      s.ok(),
    ),
  },
});
