import { Rec } from "./data";
import { l, r, s, v, Expr, __ } from "./expr";
import { Field, f } from "./field";

export const db = {
  update: (tx: Expr, id: Expr, field: Field, value: Expr) =>
    s("tx_update_field_value", tx, id, field, value),
  delete: (tx: Expr, id: Expr, field?: Field, value?: Expr) =>
    s("tx_delete_field_value", tx, id, field ?? __, value ?? __),
  with_tx: (tx: Expr, ...body: Expr[]) => s("with_tx", tx, s(",", ...body)),
};

export const rules = {
  // type checks
  var: {
    rule__params: l(v.item),
    rule__body: s("value_type", v.item, s("var")),
  },
  nonvar: {
    rule__params: l(v.item),
    rule__body: r(
      s("value_type", v.item, v.type), //
      s("/=", v.type, s("var"))
    ),
  },
  string: {
    rule__params: l(v.item),
    rule__body: s("value_type", v.item, s("string")),
  },
  number: {
    rule__params: l(v.item),
    rule__body: s("value_type", v.item, s("number")),
  },
  struct: {
    rule__params: l(v.item),
    rule__body: s("value_type", v.item, s("struct")),
  },
  constrain_type: {
    rule__params: l(v.item, v.type),
    rule__body: s("value_constraint", v.item, s("value_type", v.item, v.type)),
  },
  list_item: {
    rule__params: l(v.list, v.item),
    rule__body: s("struct_id_index_arg", v.list, "", __, v.item),
  },
  if_var: {
    file__description: l("if arg is var, run body"),
    rule__params: l(v.arg, v.body),
    rule__body: s("if_then_else", s("var", v.arg), v.body, r()),
  },
  get_default: {
    rule__params: l(v.id, v.field, v.value, v.default),
    rule__body: s(
      "if_then_else",
      s("get_field_value", v.id, v.field, v.value),
      s("ok"),
      s("=", v.value, v.default)
    ),
  },
  tx_insert: {
    file__description: l("insert a property list into the db"),
    rule__params: l(v.tx, v.id, v.params),
    rule__body: r(
      s("struct_id_index_arg", v.params, __, __, v.pair),
      s("struct_id_index_arg", v.pair, v.field, 0, v.value),
      db.update(v.tx, v.id, v.field, v.value)
    ),
  },
  with_tx: {
    rule__params: l(v.tx, v.goal),
    rule__body: r(
      s("tx", v.tx),
      s(
        "if_then_else",
        s("collect", __, v.goal, __),
        s("commit", v.tx),
        s("rollback", v.tx)
      )
    ),
  },
  // event handlers
  on__selectWindow: {
    rule__params: l(v.window),
    rule__body: db.with_tx(
      v.tx,
      db.update(v.tx, "browser", "browser__currentWindow", v.window)
    ),
  },
  on__newWindow: {
    rule__params: l(v.location, v.params),
    rule__body: db.with_tx(v.tx, s("new__window", v.tx, __, v.location, __)),
  },
  on__closeWindow: {
    rule__params: l(v.window),
    rule__body: db.with_tx(v.tx, db.delete(v.tx, v.window)),
  },
  on__push: {
    rule__params: l(v.window, v.location, v.params),
    rule__body: db.with_tx(
      v.tx,
      s("if_var", v.window, s("get_context", "window_id", v.window)),
      f.window__currentHistory(v.window, v.prev),
      s("new__history", v.tx, v.next, v.window, v.location, v.params),
      db.update(v.tx, v.next, "history__back", v.prev),
      db.update(v.tx, v.prev, "history__forward", v.next),
      db.update(v.tx, v.window, "window__currentHistory", v.next)
    ),
  },
  on__back: {
    rule__params: l(v.window),
    rule__body: db.with_tx(
      v.tx,
      f.window__currentHistory(v.window, v.forward),
      f.history__back(v.forward, v.back),
      db.update(v.tx, v.window, "window__currentHistory", v.back),
      db.update(v.tx, v.back, "history__forward", v.forward),
      db.delete(v.tx, v.forward, "history__back")
    ),
  },
  on__forward: {
    rule__params: l(v.window),
    rule__body: db.with_tx(
      v.tx,
      f.window__currentHistory(v.window, v.back),
      f.history__forward(v.back, v.forward),

      db.update(v.tx, v.window, "window__currentHistory", v.forward),
      db.update(v.tx, v.forward, "history__back", v.back),
      db.delete(v.tx, v.back, "history__forward")
    ),
  },
  // constructors
  new__rule: {
    rule__params: l(v.tx, v.id, v.params, v.body),
    rule__body: r(
      db.update(v.tx, v.id, "rule__params", v.params),
      db.update(v.tx, v.id, "rule__body", v.body)
    ),
  },
  new__window: {
    rule__params: l(v.tx, v.window, v.location, v.params),
    rule__body: r(
      s("if_var", v.window, s("id", v.window)),
      s("new__history", v.tx, v.history, v.window, v.location, v.params),
      db.update(v.tx, v.window, "db__schema", "schema__window"),
      db.update(v.tx, v.window, "window__currentHistory", v.history)
    ),
  },
  new__history: {
    rule__params: l(v.tx, v.history, v.window, v.location, v.params),
    rule__body: r(
      s("if_var", v.history, s("id", v.history)),
      s("timestamp", v.ts),
      db.update(v.tx, v.history, "db__schema", "schema__history"),
      db.update(v.tx, v.history, "time__created", v.ts),
      db.update(v.tx, v.history, "history__window", v.window),
      db.update(v.tx, v.history, "history__location", v.location),
      r.or(
        //
        r(s("nonvar", v.params), s("tx_insert", v.tx, v.history, v.params)),
        r()
      )
    ),
  },
} satisfies Record<string, Rec>;
