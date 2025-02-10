import { Rec, Field } from ".";
import { l, r, s, $, __, u, Expr } from "../expr";
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

export const dbData = {
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
      s.db__type($.field, $.field_type),
      s.get_default($.field_type, "db__default_value", $.default_value, l()),
      db.update($.tx, $.id, $.field, $.default_value),
    ),
  },

  // constructors
  new__default: {
    rule__params: l($.tx, $.id, $.schema),
    rule__body: r(
      s.if_var($.id, s.id($.id)),
      db.update($.tx, $.id, "db__schema", $.schema),
      s.db__fields($.schema, $.fields),
      s.each_item_do(
        $.fields,
        s.field($.field),
        r(
          s.db__type($.field, $.field_type),
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

  // etc
} satisfies Record<string, Rec>;
