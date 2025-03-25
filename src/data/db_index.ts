import BTree from "sorted-btree";
import { s, __, seq, $, l } from "../expr";
import { pkg } from "../pkg";
import { ensure, Exception, resolveDeep } from "../process";
import { box, Value } from "../value";
import { defaultOrd } from "../ord";

const ord = {
  expand: 0,
  var: 0,
  number: 1,
  string: 2,
  box: 3,
  fresh: 4,
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
  _create: {
    rule__params: l($.id),
    rule__primitive: function* (it, id) {
      ensure(id, "string");
      it.pm.db.index2.set(id.value, new BTree<Value, null>([], indexOrd));
      yield it.result();
    },
  },
  _get_range: {
    rule__params: l($.key, $.index, $.from, $.to),
    rule__primitive: function* (it, key, index, from, to) {
      ensure(index, "string");
      const idx = it.pm.db.index2.get(index.value);
      if (!idx) return;
      for (const [k] of idx.getRange(resolveDeep(from), resolveDeep(to))) {
        yield* it.unifyChoice(key, k);
      }
    },
  },
  _insert: {
    rule__params: l($.index, $.key),
    rule__primitive: function* (it, index, key) {
      ensure(index, "string");
      const idx = it.pm.db.index2.get(index.value);
      if (!idx) return;
      if (idx.has(resolveDeep(key))) return;
      idx.set(resolveDeep(key), null);
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
  index: {
    db__schema: "schema",
    file__name: "Index",
    schema__fields: l(s.field("rule__params"), s.field("rule__body")),
  },
  // AV index
  _unique: {
    db__schema: "index",
    file__name: "unique index",
    rule__params: l($.message),
    rule__body: s.match_cond(
      $.message,
      l(s.insert(__, $.field, $.value), s._insert("_ref", l($.value, $.field))),
      l(s.delete(__, $.field, $.value), s._delete("_ref", l($.value, $.field))),
    ),
  },
  _get_unique: {
    rule__params: l($.value, $.field),
    rule__body: s._get_range(
      l(__, $.value),
      "_unique",
      l($.field),
      l($.field, __),
    ),
  },
  // VAE index
  _ref: {
    db__schema: "index",
    file__name: "ref index",
    rule__params: l($.message),
    rule__body: s.match_cond(
      $.message,
      l(
        s.insert($.rec, $.field, $.value),
        s._insert("_ref", l($.value, $.field, $.rec)),
      ),
      l(
        s.delete($.rec, $.field, $.value),
        s._delete("_ref", l($.value, $.field, $.rec)),
      ),
    ),
  },
  _get_refs: {
    file__description: l("enumerate all indexed references to this record."),
    rule__params: l($.ref, $.field, $.id),
    rule__body: s._get_range(
      l(__, $.field, $.ref),
      "_ref",
      l($.id),
      l($.id, __, __),
    ),
  },
  // AVE index
  _group: {
    db__schema: "index",
    file__name: "group index",
    rule__params: l($.message),
    rule__body: s.match_cond(
      $.message,
      l(
        s.insert($.rec, $.field, $.value),
        s._insert("_group", l($.field, $.value, $.rec)),
      ),
      l(
        s.delete($.rec, $.field, $.value),
        s._delete("_group", l($.field, $.value, $.rec)),
      ),
    ),
  },
  _get_grouped: {
    rule__params: l($.rec, $.field, $.value),
    rule__body: s._get_range(
      l(__, __, $.rec),
      "_group",
      l($.field, $.value),
      l($.field, $.value, __),
    ),
  },
  // index-handling rules
  _constraint: {
    rule__params: l($.message, $.fn),
    rule__body: s.match_cond(
      $.message,
      l(s.insert(__, __, $.value), s.call($.fn, $.value)),
      l(__, s.ok()),
    ),
  },
  _multi: {
    rule__params: l($.message, $.index),
    rule__body: s.match_cond(
      $.message,
      l(
        s.insert($.rec, $.field, $.value_list),
        s.block(
          __,
          seq(
            s.in($.value, $.value_list),
            s.call($.index, s.insert($.rec, $.field, $.value)),
          ),
        ),
      ),
      l(
        s.delete($.rec, $.field, $.value_list),
        s.block(
          __,
          seq(
            s.in($.value, $.value_list),
            s.call($.index, s.delete($.rec, $.field, $.value)),
          ),
        ),
      ),
    ),
  },
  _fork: {
    rule__params: l($.message, $.indexes),
    rule__body: s.every(s.in($.index, $.indexes), s.call($.index, $.message)),
  },
  ref: {
    rule__params: l($.message),
    rule__body: s._fork($.message, l(s._ref(), s._group())),
  },
  multi_ref: {
    rule__params: l($.message),
    rule__body: s._multi($.message, s.ref()),
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
        seq(
          s.call($.idx, s.delete($.id, $.field, $.prev)),
          s.call($.idx, s.insert($.id, $.field, $.value)),
        ),
      ),
      s.ok(),
    ),
  },
  _on_delete_field: {
    rule__params: l($.id, $.field),
    rule__body: s.if_then_else(
      s.field__index($.idx, $.field),
      seq(
        s.value_record_field($.value, $.id, $.field),
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
});
