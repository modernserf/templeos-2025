import { Rec, Field } from ".";
import { s, Expr, __, seq } from "../expr";

export const db = {
  get: (id: Expr, field: Field, value: Expr) =>
    s.get_field_value(id, field, value),
  update: (tx: Expr, id: Expr, field: Field, value: Expr) =>
    s.tx_update_field_value(tx, id, field, value),
  delete: (tx: Expr, id: Expr, field?: Field, value?: Expr) =>
    s.tx_delete_field_value(tx, id, field ?? __, value ?? __),
  with_tx: (tx: Expr, head: Expr, ...body: Expr[]) =>
    s.with_tx(tx, seq(head, ...body)),
  field: (field: Field) => s("field", field),
  field_optional: (field: Field) => s("field_optional", field),
};
