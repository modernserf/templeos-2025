import { $, __, alt, l, s, seq, u } from "../expr";
import { pkg } from "../pkg";

export const { rules: view } = pkg("view", {
  view: {
    db__schema: "schema",
    schema__fields: l(
      s.field("file__name"),
      s.field("_subject"),
      s.field("rule__params"),
      s.field_optional("rule__body"),
      s.field_optional("_params_type"),
      s.field_optional("_focus_type"),
      s.field_optional("_menu_items"),
    ),
  },
  _subject: {
    db__schema: "field",
    file__name: "View subject",
    field__type: s.enum(
      s.self(),
      s.record(s.t_ref(__)),
      s.schema(s.t_ref("schema")),
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
  // types
  _t_menu_items: {
    rule__params: l($.t),
    rule__body: s.list_of(
      $.t,
      s.enum(
        s.menu(
          s.string(),
          s.list_of(
            s.enum(
              s.menu_option(
                s.string(),
                s.string(),
                s.type__fn(s.t_ref(__), s.t_ref("history")),
              ),
            ),
          ),
        ),
      ),
    ),
  },
  _menu_items: {
    db__schema: "field",
    file__name: "View menu items",
    field__type: s._t_menu_items(),
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
