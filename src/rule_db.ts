import { Rec } from "./data";
import { l, r, s, $, __, u, Expr } from "./expr";
import { f, Field } from "./field";
import { test } from "./test_utils";

export const db = {
  get: (id: Expr, field: Field, value: Expr) =>
    s.get_field_value(id, field, value),
  update: (tx: Expr, id: Expr, field: Field, value: Expr) =>
    s.tx_update_field_value(tx, id, field, value),
  delete: (tx: Expr, id: Expr, field?: Field, value?: Expr) =>
    s.tx_delete_field_value(tx, id, field ?? __, value ?? __),
  with_tx: (tx: Expr, ...body: Expr[]) => s.with_tx(tx, r(...body)),
};

export const ruleDB = {
  test__db: {
    test__group: "db",
    rule__params: l(),
    rule__body: r(
      s.id($.id),
      test.db(
        $.tx,
        db.update($.tx, $.id, "test__field" as Field, 123),

        s.get_field_value($.id, "test__field", $.value),
        test.eq($.value, 123),
      ),
      test.fail(s.get_field_value($.id, "test__field", $.value)),
    ),
  },
  get_default: {
    rule__params: l($.id, $.field, $.value, $.default),
    rule__body: s.if_then_else(
      s.get_field_value($.id, $.field, $.value),
      s.ok(),
      u($.value, $.default),
    ),
  },
  with_tx: {
    rule__params: l($.tx, $.goal),
    rule__body: r(
      s.tx($.tx),
      s.if_then_else(
        s.collect(__, $.goal, __),
        s.commit($.tx),
        s.rollback($.tx),
      ),
    ),
  },

  _add_field: {
    rule__params: l($.id, $.field),
    rule__body: db.with_tx(
      $.tx,
      f.db__type($.field, $.field_type),
      s.get_default($.field_type, "db__default_value", $.default_value, l()),
      db.update($.tx, $.id, $.field, $.default_value),
    ),
  },

  // event handlers
  on__selectWindow: {
    rule__params: l($.window),
    rule__body: db.with_tx(
      $.tx,
      db.update($.tx, "browser", "browser__currentWindow", $.window),
    ),
  },
  on__newWindow: {
    rule__params: l($.location),
    rule__body: db.with_tx($.tx, s.new__window($.tx, __, $.location)),
  },
  on__closeWindow: {
    rule__params: l($.window),
    rule__body: db.with_tx($.tx, db.delete($.tx, $.window)),
  },
  on__push: {
    rule__params: l($.window, $.location),
    rule__body: db.with_tx(
      $.tx,
      f.window__currentHistory($.window, $.prev),
      s.new__history($.tx, $.next, $.window, $.location),
      db.update($.tx, $.next, "history__back", $.prev),
      db.update($.tx, $.prev, "history__forward", $.next),
      db.update($.tx, $.window, "window__currentHistory", $.next),
    ),
  },

  on__back: {
    rule__params: l($.window),
    rule__body: db.with_tx(
      $.tx,
      f.window__currentHistory($.window, $.forward),
      f.history__back($.forward, $.back),
      db.update($.tx, $.window, "window__currentHistory", $.back),
      db.update($.tx, $.back, "history__forward", $.forward),
      db.delete($.tx, $.forward, "history__back"),
    ),
  },
  on__forward: {
    rule__params: l($.window),
    rule__body: db.with_tx(
      $.tx,
      f.window__currentHistory($.window, $.back),
      f.history__forward($.back, $.forward),

      db.update($.tx, $.window, "window__currentHistory", $.forward),
      db.update($.tx, $.forward, "history__back", $.back),
      db.delete($.tx, $.back, "history__forward"),
    ),
  },

  // constructors
  new__default: {
    rule__params: l($.tx, $.id, $.schema),
    rule__body: r(
      s.if_var($.id, s.id($.id)),
      db.update($.tx, $.id, "db__schema", $.schema),
      f.db__fields($.schema, $.fields),
      s.each_item_do(
        $.fields,
        s.field($.field),
        r(
          f.db__type($.field, $.field_type),
          s.get_default(
            $.field_type,
            "db__default_value",
            $.default_value,
            l(),
          ),
          db.update($.tx, $.id, $.field, $.default_value),
        ),
      ),
    ),
  },

  new__rule: {
    rule__params: l($.tx, $.id, $.params, $.body),
    rule__body: r(
      db.update($.tx, $.id, "rule__params", $.params),
      db.update($.tx, $.id, "rule__body", $.body),
    ),
  },
  new__window: {
    rule__params: l($.tx, $.window, $.location),
    rule__body: r(
      s.if_var($.window, s.id($.window)),
      s.new__history($.tx, $.history, $.window, $.location),
      db.update($.tx, $.window, "db__schema", "schema__window"),
      db.update($.tx, $.window, "window__currentHistory", $.history),
    ),
  },

  new__history: {
    rule__params: l($.tx, $.history, $.window, $.location),
    rule__body: r(
      s.if_var($.history, s.id($.history)),
      s.timestamp($.ts),
      s.location_id_view_params($.location, $.id, $.view, $.params),
      db.update($.tx, $.history, "db__schema", "schema__history"),
      db.update($.tx, $.history, "time__created", $.ts),
      db.update($.tx, $.history, "history__window", $.window),
      db.update($.tx, $.history, "history__location", $.id),
      s.if_then_else(
        s.nonvar($.view),
        db.update($.tx, $.history, "history__view", $.view),
        r(),
      ),
      s.each_item_do(
        $.params,
        s.param($.param_field, $.param_value),
        db.update($.tx, $.history, $.param_field, $.param_value),
      ),
    ),
  },

  // etc
  location_id_view_params: {
    rule__params: l($.location, $.id, $.view, $.params),
    rule__body: r(
      s.nonvar($.location),
      s.match(
        $.location,
        s.location($.id),
        s.location($.id, $.view),
        s.location($.id, $.view, $.params),
      ),
      s.if_var($.params, u($.params, l())),
    ),
  },
} satisfies Record<string, Rec>;
