import BTree from "sorted-btree";
import { s, __, seq, $, l } from "../expr";
import { pkg } from "../pkg";
import { ensure, Exception, resolveDeep } from "../process";
import { box, Value } from "../value";
import { defaultOrd } from "../ord";

// var < number < string < box
// a() < z(), a() < a(0)
const ord = {
  expand: 0,
  var: 0,
  fresh: 0,
  number: 1,
  string: 2,
  box: 3,
} as const;

function indexOrd(l: Value, r: Value): number {
  if (l.tag !== r.tag) {
    return ord[l.tag] - ord[r.tag];
  }
  if (l.tag === "string" && r.tag === "string") {
    return defaultOrd.cmp(l.value, r.value);
  }
  if (l.tag === "number" && r.tag === "number") {
    return l.value - r.value;
  }
  ensure(l, "box");
  ensure(r, "box");
  if (l.id !== r.id) return defaultOrd.cmp(l.id, r.id);
  for (let i = 0; i < Infinity; i++) {
    const la = l.args[i];
    const ra = r.args[i];
    if (!la && !ra) return 0;
    if (!la) return -1;
    if (!ra) return 1;
    const ord = indexOrd(la, ra);
    if (ord !== 0) return ord;
  }
  throw new Exception(box("invalid_index", [l, r]));
}

export const { rules: indexRules, rulePrimitives: indexPrime } = pkg("index", {
  index: {
    db__schema: "schema",
    file__name: "Index",
    schema__fields: l(s.field("rule__params"), s.field("rule__body")),
  },
  ref: {
    db__schema: "index",
    file__name: "ref index",
    rule__params: l($.message),
    rule__body: s.match_cond(
      $.message,
      l(
        s.get($.rec, $.field, $.value),

        s._get_range(
          l(__, __, $.rec),
          __,
          "ref",
          l($.field, $.value, ""),
          l($.field, $.value, "~"),
        ),
      ),
      l(
        s.insert($.rec, $.field, $.value),
        s._insert("ref", l($.field, $.value, $.rec), 0),
      ),
      l(
        s.update($.rec, $.field, $.value, $.prev),
        seq(
          s._delete("ref", l($.field, $.prev, $.rec)),
          s._insert("ref", l($.field, $.value, $.rec), 0),
        ),
      ),
      l(
        s.delete($.rec, $.field, $.value),
        s._delete("ref", l($.field, $.value, $.rec)),
      ),
    ),
  },
  multi_ref: {
    db__schema: "index",
    file__name: "multi_ref index",
    rule__params: l($.message),
    rule__body: s.match_cond(
      $.message,
      l(s.get($.rec, $.field, $.value), s.ref(s.get($.rec, $.field, $.value))),
      l(
        s.insert($.rec, $.field, $.value_list),
        seq(
          s.in($.value, $.value_list),
          s.ref(s.insert($.rec, $.field, $.value)),
        ),
      ),
      l(
        s.update($.rec, $.field, $.value_list, $.prev_list),
        seq(
          s.block(
            __,
            seq(
              s.in($.prev, $.prev_list),
              s._delete("ref", l($.field, $.prev, $.rec)),
            ),
          ),
          s.block(
            __,
            seq(
              s.in($.value, $.value_list),
              s._insert("ref", l($.field, $.prev, $.rec)),
            ),
          ),
        ),
      ),
      l(
        s.delete($.rec, $.field, $.value_list),
        seq(
          s.in($.value, $.value_list),
          s.ref(s.delete($.rec, $.field, $.value)),
        ),
      ),
    ),
  },

  get_indexed: {
    rule__params: l($.id, $.field, $.value),
    rule__body: seq(
      s.field__index($.idx, $.field),
      s.call($.idx, s.get($.id, $.field, $.value)),
    ),
  },
  _init: {
    rule__params: l(),
    rule__body: seq(
      s.block(
        __,
        seq(
          s.record($.id),
          s.value_record_field("index", $.id, "db__schema"),
          s._create($.id),
        ),
      ),
      s.block(
        __,
        seq(
          s.record($.id),
          s.field_record($.field, $.id),
          s.field__index($.idx, $.field),
          s.value_record_field($.value, $.id, $.field),
          s.call($.idx, s.insert($.id, $.field, $.value)),
        ),
      ),
    ),
  },

  _on_update: {
    rule__params: l($.id, $.field, $.value, $.prev),
    rule__body: s.if_then_else(
      s.field__index($.idx, $.field),
      s.if_then_else(
        s.var($.prev),
        s.call($.idx, s.insert($.id, $.field, $.value)),
        s.call($.idx, s.update($.id, $.field, $.value, $.prev)),
      ),
      s.ok(),
    ),
  },
  _on_delete_field: {
    rule__params: l($.id, $.field),
    rule__body: s.if_then_else(
      s.field__index($.idx, $.field),
      seq(
        s.call($.idx, s.get($.id, $.field, $.value)),
        s.call($.idx, s.delete($.id, $.field, $.value)),
      ),
      s.ok(),
    ),
  },
  _on_delete_record: {
    rule__params: l($.id),
    rule__body: s.cond(
      s.block(
        __,
        seq(s.field_record($.field, $.id), s._on_delete_field($.id, $.field)),
      ),
      s.ok(),
    ),
  },

  _create: {
    rule__params: l($.id),
    rule__primitive: function* (it, id) {
      ensure(id, "string");
      it.pm.db.index2.set(id.value, new BTree<Value, Value>([], indexOrd));
      yield it.result();
    },
  },
  _get_range: {
    rule__params: l($.key, $.value, $.index, $.from, $.to),
    rule__primitive: function* (it, key, value, index, from, to) {
      ensure(index, "string");
      const idx = it.pm.db.index2.get(index.value);
      if (!idx) return;

      for (const [k, v] of idx.getRange(resolveDeep(from), resolveDeep(to))) {
        yield* it.unifyChoice(box("", [key, value]), box("", [k, v]));
      }
    },
  },

  _insert: {
    rule__params: l($.index, $.key, $.value),
    rule__primitive: function* (it, index, key, value) {
      ensure(index, "string");
      const idx = it.pm.db.index2.get(index.value);
      if (!idx) return;
      idx.set(resolveDeep(key), resolveDeep(value));
      yield it.result();
    },
  },
  _delete: {
    rule__params: l($.index, $.key),
    rule__primitive: function* (it, index, key) {
      ensure(index, "string");
      const idx = it.pm.db.index2.get(index.value);
      if (!idx) return;
      idx.delete(resolveDeep(key));
      yield it.result();
    },
  },
  _delete_range: {
    rule__params: l($.index, $.from, $.to),
    rule__primitive: function* (it, index, from, to) {
      ensure(index, "string");
      const idx = it.pm.db.index2.get(index.value);
      if (!idx) return;

      idx.deleteRange(resolveDeep(from), resolveDeep(to), false);
      yield it.result();
    },
  },
});
