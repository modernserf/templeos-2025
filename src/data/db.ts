import { s, __, seq, $, l, u, alt, fn } from "../expr";
import { pkg } from "../pkg";

export const dbRules = pkg("db", {
  // db
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
        $.sub,
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
