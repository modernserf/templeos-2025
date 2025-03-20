import { s, __, seq, $, l, u, alt, fn } from "../expr";
import { pkg_ } from "../pkg";
import { ensure, resolveDeep } from "../process";
import { k, valueExpr } from "../value";

export const { rules: dbRules, rulePrimitives: dbPrim } = pkg_("db", {
  tx: {
    rule__params: l($.tx),
    rule__primitive: function* (it, tx) {
      if (it.unify(tx, k(it.pm.db.beginTx()))) yield it.result();
    },
  },
  commit: {
    rule__params: l($.tx),
    rule__primitive: function* (it, tx) {
      ensure(tx, "number");
      it.pm.db.commitTx(tx.value);
      yield it.result();
    },
  },
  rollback: {
    rule__params: l($.tx),
    rule__primitive: function* (it, tx) {
      ensure(tx, "number");
      it.pm.db.rollbackTx(tx.value);
      yield it.result();
    },
  },
  // does not handle high cardinality fields
  tx_update_field_value__primitive: {
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
  // only single field, does not handle high cardinality fields
  tx_delete_field__primitive: {
    rule__params: l($.tx, $.id, $.field),
    rule__primitive: function* (it, tx, id, field) {
      ensure(tx, "number");
      ensure(id, "string");
      ensure(field, "string");

      it.pm.db.updateTx(tx.value, id.value, field.value, null);
      yield it.result();
    },
  },
  tx_delete_record__primitive: {
    rule__params: l($.tx, $.id),
    rule__primitive: function* (it, tx, id) {
      ensure(tx, "number");
      ensure(id, "string");

      it.pm.db.insertTx(tx.value, id.value, null);
      yield it.result();
    },
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
  record_index_field: {
    rule__params: l($.id, $.index, $.field),
    rule__primitive: function* (it, id, index, field) {
      ensure(field, "string");

      const idx = it.pm.db.getIndex(field.value);
      if (!idx) return;

      const indexExpr = valueExpr(resolveDeep(index));
      for (const [{ entityId }] of idx.tree.getRange(
        { value: indexExpr, entityId: "" },
        { value: indexExpr, entityId: "~" },
      )) {
        yield* it.unifyChoice(id, k(entityId));
      }
    },
  },
  field_record: {
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

  record_field_value: {
    rule__params: l($.id, $.field, $.value),
    rule__body: s.cond(
      l(s.nonvar($.id), s.value_record_field($.value, $.id, $.field)),
      l(s.nonvar($.value), s.record_index_field($.id, $.value, $.field)),
      // full scan
      l(
        s.nonvar($.field),
        seq(s.record($.id), s.value_record_field($.value, $.id, $.field)),
      ),
      s.todo("record_field_value modes"),
    ),
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
  ref_field_record: {
    rule__params: l($.ref, $.field, $.record),
    rule__body: seq(
      alt(
        s.field__index(s.ref(), $.field),
        s.field__index(s.multi_ref(), $.field),
      ),
      s.record_field_value($.ref, $.field, $.record),
    ),
  },
  with_tx: {
    rule__params: l($.tx, $.goal),
    rule__body: seq(
      s.tx($.tx),
      s.if_then_else(s.block(__, $.goal), s.commit($.tx), s.rollback($.tx)),
    ),
  },
  tx_update_field_value: {
    rule__params: l($.tx, $.id, $.field, $.value),
    rule__body: seq(
      // todo
      s.tx_update_field_value__primitive($.tx, $.id, $.field, $.value),
    ),
  },
  tx_delete_field: {
    rule__params: l($.tx, $.id, $.field),
    rule__body: seq(
      s.if_then_else(
        s.var($.field),
        s.tx_delete_record__primitive($.tx, $.id),
        s.tx_delete_field__primitive($.tx, $.id, $.field),
      ),
    ),
  },

  init__db_server: {
    rule__params: l(),
    rule__body: s._db_server("db_server", "local_storage"),
  },

  // TODO: typedef for update patterns
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
  db__subscribe: {
    rule__params: l($.h, $.fn),
    rule__body: seq(
      s.self($.self),
      s.event_send("db_server", s.get_subs($.self)),
      s.receive(s.subs($.subs)),
      s.event_subscribe($.h, $.subs, $.fn),
    ),
  },
  db__unsubscribe: {
    rule__params: l($.h),
    rule__body: seq(
      s.self($.self),
      s.event_send("db_server", s.get_subs($.self)),
      s.receive(s.subs($.subs)),
      s.event_unsubscribe($.h, $.subs),
    ),
  },
  db__update: {
    rule__params: l($.batch),
    rule__body: seq(
      s._normalize_update($.normalized, $.batch),
      s.event_send("db_server", s.update($.normalized)),
    ),
  },
  db__reset: {
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

  _apply_update: {
    rule__params: l($.batch),
    rule__body: s.with_tx(
      $.tx,
      s.each_item_do(
        $.batch,
        $.item,
        s.match_cond(
          $.item,
          l(
            s.update($.id, $.field, $.value),
            s.tx_update_field_value__primitive($.tx, $.id, $.field, $.value),
          ),
          l(
            s.delete($.id, $.field),
            s.tx_delete_field__primitive($.tx, $.id, $.field),
          ),
          l(s.delete($.id), s.tx_delete_record__primitive($.tx, $.id)),
        ),
      ),
    ),
  },
});
