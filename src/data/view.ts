import { $, __, alt, l, s, seq, u } from "../expr";
import { pkg } from "../pkg";

export const view = pkg("view", {
  view: {
    db__schema: "schema",
    schema__fields: l(
      s.field("file__name"),
      s.field("_subject"),
      s.field("rule__params"),
      s.field_optional("rule__body"),
      s.field_optional("_params_type"),
      s.field_optional("_focus_type"),
    ),
  },
  _subject: {
    db__schema: "field",
    file__name: "View subject",
    field__type: s.enum(
      s.self(),
      s.record(s.ref(__)),
      s.schema(s.ref("schema")),
      s.any(),
    ),
    field__index: s.ref(),
  },
  _params_type: {
    db__schema: "field",
    file__name: "Params type",
    field__type: s.type__type(),
  },
  _focus_type: {
    db__schema: "field",
    file__name: "Focused element type",
    field__type: s.type__type(),
  },

  _for_record: {
    rule__params: l($.view, $.record),
    rule__body: alt(
      seq(s._subject(s.self(), $.record), u($.view, $.record)),
      s._subject(s.record($.record), $.view),
      seq(
        s.db__schema($.schema, $.record),
        s._subject(s.schema($.schema), $.view),
      ),
      s._subject(s.any(), $.view),
    ),
  },
  _render: {
    rule__params: l($.out, $.view, $.record, $.state),
    rule__body: s.call($.view, $.out, $.record, $.state),
  },
});
