import { $, __, alt, f, l, s, seq, u } from "../expr";
import { pkg } from "../pkg";

export const view = pkg("view", {
  view: {
    db__schema: "schema",
    schema__fields: l(
      s.field("file__name"),
      s.field("_subject"),
      s.field("rule__params"),
      s.field_optional("rule__body"),
    ),
  },
  _subject: {
    db__schema: "field",
    file__name: "View subject",
    // type: self(), record(id), schema(id), any()
    field__index: s.ref(),
  },
  _for_record: {
    rule__params: l($.view, $.record),
    rule__body: alt(
      // new
      seq(f._subject($.record, s.self()), u($.view, $.record)),
      f._subject($.view, s.record($.record)),
      seq(
        f.db__schema($.record, $.schema),
        f._subject($.view, s.schema($.schema)),
      ),
      f._subject($.view, s.any()),
    ),
  },
});
