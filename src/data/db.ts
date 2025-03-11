import { s, __, seq, $, l, u, alt, f } from "../expr";
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
      s.throw(s.not_yet_implemented("record_field_value modes")),
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
      alt(f.db__index($.field, s.ref()), f.db__index($.field, s.multi_ref())),
      s.record_field_value($.ref, $.field, $.record),
    ),
  },
  with_tx: {
    rule__params: l($.tx, $.goal),
    rule__body: seq(
      s.tx($.tx),
      s.if_then_else(
        s.collect_item_in(__, __, $.goal),
        s.commit($.tx),
        s.rollback($.tx),
      ),
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
    rule__body: s.spawn_link("db_server", s._db_server("local_storage")),
  },

  db__update: {
    rule__params: l($.batch),
    rule__body: s.send("db_server", s.update($.batch)),
  },
  db__reset: {
    rule__params: l(),
    rule__body: s.send("db_server", s.reset()),
  },
  db__subscribe_callback: {
    rule__params: l($.pid, $.pattern, $.callback),
    rule__body: seq(
      s.spawn_link(
        $.pid,
        s.loop(
          seq(
            s.receive($.e),
            s.match_cond(
              $.e,
              l(s.change(), $.callback),
              l(s.close(), s.fail()),
            ),
          ),
        ),
      ),
      s.send("db_server", s.subscribe($.pid, $.pattern)),
    ),
  },
  db__unsubscribe: {
    rule__params: l($.pid),
    rule__body: s.send("db_server", s.unsubscribe($.pid)),
  },
  _db_server: {
    rule__params: l($.local_storage),
    rule__body: seq(
      s.loop_fail(
        $.next,
        $.prev,
        l(),
        seq(
          s.receive($.message),
          s.match_cond(
            $.message,
            l(
              s.update($.batch),
              seq(
                s._apply_update($.batch),
                s.send($.local_storage, s.update()),
                s._notify_subscribers($.batch, $.prev),
              ),
            ),
            l(s.reset(), s.send($.local_storage, s.clear())),
            l(
              s.subscribe($.pid, $.pattern),
              s.append_left_right(
                $.next,
                $.prev,
                l(s.subscribe($.pid, $.pattern)),
              ),
            ),
            l(
              s.unsubscribe($.pid),
              seq(
                s.collect_item_in(
                  $.next,
                  $.item,
                  seq(
                    s.value_box_index(s.subscribe($.p, $.sub), $.prev, __),
                    s.not_equal($.p, $.pid),
                    u($.item, s.subscribe($.p, $.sub)),
                  ),
                ),
                s.send($.pid, s.close()),
              ),
            ),
            l(__, s.throw(s.not_implemented($.message))),
          ),
          s.var_expr($.next, s.unify($.prev)),
          s.fail(),
        ),
      ),
      s.log("db exit"),
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
            s.update($.field_expr),
            seq(
              s.box_tag_list($.field_expr, $.field, l($.value, $.id)),
              s.tx_update_field_value__primitive($.tx, $.id, $.field, $.value),
            ),
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
  _notify_subscribers: {
    rule__params: l($.batch, $.subscribers),
    rule__body: seq(
      s.each_item_do(
        $.subscribers,
        s.subscribe($.pid, $.pattern),
        seq(
          s._check_batch_pattern($.batch, $.pattern),
          s.send($.pid, s.change()),
        ),
      ),
    ),
  },
  _check_batch_pattern: {
    rule__params: l($.batch, $.pattern),
    rule__body: seq(
      s.limit(
        1,
        seq(
          s.match_cond(
            $.pattern,
            l(
              s.oneof($.patterns),
              seq(s($.p).in($.patterns), s._check_batch_pattern($.batch, $.p)),
            ),
            l(
              s.record($.id),
              seq(
                s($.change).in($.batch),
                s.match(
                  $.change,
                  s.update($.id, __, __),
                  s.update(__, __, $.id),
                  s.delete($.id, __),
                  s.delete($.id),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  },
});
