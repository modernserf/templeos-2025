import { s, __, seq, $, l, u, fn, Expr } from "../expr";
import { pkg } from "../pkg";
import { ensure, resolveDeep } from "../process";
import { k, valueExpr } from "../value";

export const { rules: dbRules, rulePrimitives: dbPrim } = pkg("db", {
  db__schema: {
    db__schema: "field",
    file__name: "DB Schema",
    file__description: l("schema used to validate & render this record"),
    field__type: s.t_ref("schema"),
    field__index: s.ref(),
  },
  value_record_field: {
    rule__params: l($.value, $.id, $.field),
    rule__primitive: function* (it, value, id, field) {
      ensure(id, "string");
      ensure(field, "string");

      const rec = it.pm.db.get(id.value);
      if (!rec) return;
      const val = rec[field.value];
      if (val == null) return;

      if (it.unify(it.exprValue(val, {}), value)) yield it.result();
    },
  },
  value_record_field_default: {
    rule__params: l($.value, $.record, $.field, $.default),
    rule__body: seq(
      s.cond(
        s.value_record_field($.value, $.record, $.field),
        u($.value, $.default),
      ),
    ),
  },
  field_record: {
    file__description: l("enumerate the fields associated with a record."),
    rule__params: l($.field, $.id),
    rule__primitive: function* (it, field, id) {
      ensure(id, "string");
      const rec = it.pm.db.get(id.value);
      if (!rec) return;
      if (field.tag === "string") {
        if (field.value in rec) yield it.result();
      } else {
        for (const f in rec) {
          yield* it.unifyChoice(field, k(f));
        }
      }
    },
  },
  record: {
    file__description: l("enumerate all records."),
    rule__params: l($.id),
    rule__primitive: function* (it, id) {
      if (id.tag === "string") {
        if (it.pm.db.get(id.value)) yield it.result();
      } else {
        for (const key of it.pm.db.keys()) {
          yield* it.unifyChoice(id, k(key));
        }
      }
    },
  },
  // TODO: should this just do the indexed stuff?
  record_field_value: {
    rule__params: l($.id, $.field, $.value),
    rule__body: s.if_then_else(
      s.nonvar($.field),
      s.if_then_else(
        s.nonvar($.id),
        s.value_record_field($.value, $.id, $.field),
        s.if_then_else(
          s.nonvar($.value),
          s.index__get_grouped($.id, $.field, $.value),
          seq(s.record($.id), s.value_record_field($.value, $.id, $.field)),
        ),
      ),
      s.if_then_else(
        s.nonvar($.id),
        seq(
          s.field_record($.field, $.id),
          s.value_record_field($.value, $.id, $.field),
        ),
        seq(
          s.record($.id),
          s.field_record($.field, $.id),
          s.value_record_field($.value, $.id, $.field),
        ),
      ),
    ),
  },

  _tx: {
    rule__params: l($.tx),
    rule__primitive: function* (it, tx) {
      if (it.unify(tx, k(it.pm.db.beginTx()))) yield it.result();
    },
  },
  _commit: {
    rule__params: l($.tx),
    rule__primitive: function* (it, tx) {
      ensure(tx, "number");
      it.pm.db.commitTx(tx.value);
      yield it.result();
    },
  },
  _rollback: {
    rule__params: l($.tx),
    rule__primitive: function* (it, tx) {
      ensure(tx, "number");
      it.pm.db.rollbackTx(tx.value);
      yield it.result();
    },
  },
  // does not handle high cardinality fields
  _tx_update_field_value: {
    rule__params: l($.tx, $.id, $.field, $.value),
    rule__primitive: function* (it, tx, id, field, value) {
      ensure(tx, "number");
      ensure(id, "string");
      ensure(field, "string");
      it.pm.db.updateTx(
        tx.value,
        id.value,
        field.value,
        valueExpr(resolveDeep(value)),
      );
      yield it.result();
    },
  },
  _tx_update_field_value_prev: {
    rule__params: l($.tx, $.id, $.field, $.value, $.prev),
    rule__primitive: function* (it, tx, id, field, value, prev) {
      ensure(tx, "number");
      ensure(id, "string");
      ensure(field, "string");
      const prevRes = it.pm.db.updateTx(
        tx.value,
        id.value,
        field.value,
        valueExpr(resolveDeep(value)),
      ) as Expr | null;
      if (prevRes != null) {
        if (it.unify(it.exprValue(prevRes, {}), prev)) yield it.result();
      } else {
        yield it.result();
      }
    },
  },
  // only single field, does not handle high cardinality fields
  _tx_delete_field: {
    rule__params: l($.tx, $.id, $.field),
    rule__primitive: function* (it, tx, id, field) {
      ensure(tx, "number");
      ensure(id, "string");
      ensure(field, "string");

      it.pm.db.updateTx(tx.value, id.value, field.value, null);
      yield it.result();
    },
  },
  _tx_delete_record: {
    rule__params: l($.tx, $.id),
    rule__primitive: function* (it, tx, id) {
      ensure(tx, "number");
      ensure(id, "string");

      it.pm.db.deleteTx(tx.value, id.value);
      yield it.result();
    },
  },

  init_db_server: {
    rule__params: l(),
    rule__body: s._db_server("db_server", "local_storage"),
  },
  _db_server: {
    rule__params: l($.in, $.local_storage),
    rule__body: seq(
      s.event_bus($.in),
      s.event_bus($.subs),
      s.event_subscribe(
        $._sub,
        $.in,
        s.match_cond(
          l(
            s.update($.batch),
            seq(
              s._apply_update($.batch),
              s.send($.local_storage, s.update()),
              s.event_send($.subs, $.batch),
            ),
          ),
          l(s.reset(), s.send($.local_storage, s.clear())),
          l(s.get_subs($.pid), s.send($.pid, s.subs($.subs))),
        ),
      ),
    ),
  },
  _subscribe: {
    rule__params: l($.h, $.fn),
    rule__body: seq(
      s.self($.self),
      s.event_send("db_server", s.get_subs($.self)),
      s.receive(s.subs($.subs)),
      s.event_subscribe($.h, $.subs, $.fn),
    ),
  },
  _unsubscribe: {
    rule__params: l($.h),
    rule__body: seq(
      s.self($.self),
      s.event_send("db_server", s.get_subs($.self)),
      s.receive(s.subs($.subs)),
      s.event_unsubscribe($.h, $.subs),
    ),
  },
  _update: {
    rule__params: l($.batch),
    rule__body: seq(
      s._normalize_update($.normalized, $.batch),
      s.event_send("db_server", s.update($.normalized)),
    ),
  },
  _reset: {
    rule__params: l(),
    rule__body: s.event_send("db_server", s.reset()),
  },

  _normalize_update: {
    rule__params: l($.normalized, $.batch),
    rule__body: s.map_list(
      $.normalized,
      $.batch,
      fn(
        $.out,
        $.in,
      )(
        s.match_cond(
          $.in,
          l(
            s.update($.field_expr),
            seq(
              s.box($.field_expr, $.field, l($.value, $.id)),
              u($.out, s.update($.id, $.field, $.value)),
            ),
          ),
          l(__, u($.out, $.in)),
        ),
      ),
    ),
  },

  _with_tx: {
    rule__params: l($.tx, $.goal),
    rule__body: seq(
      s._tx($.tx),
      s.if_then_else(s.block(__, $.goal), s._commit($.tx), s._rollback($.tx)),
    ),
  },
  _apply_update: {
    rule__params: l($.batch),
    rule__body: s._with_tx(
      $.tx,
      s.each_item_do(
        $.batch,
        $.item,
        s.match_cond(
          $.item,
          l(
            s.update($.id, $.field, $.value),
            seq(
              s._tx_update_field_value_prev(
                $.tx,
                $.id,
                $.field,
                $.value,
                $.prev,
              ),
              // TODO: handle rollback for index
              s.index__on_update($.id, $.field, $.value, $.prev),
            ),
          ),
          l(
            s.delete($.id, $.field),
            seq(
              s._tx_delete_field($.tx, $.id, $.field),
              s.index__on_delete_field($.id, $.field),
            ),
          ),
          l(
            s.delete($.id),
            seq(
              s.index__on_delete_record($.id),
              s._tx_delete_record($.tx, $.id),
            ),
          ),
        ),
      ),
    ),
  },
});
