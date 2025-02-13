import { Rec } from "../data";
import { test } from "../data/test_utils";
import { $, __, seq, alt, l, s } from "./expr";
import { Process } from "./process";
import { ProcessGen, ProcessNext, RulePrimitive } from "./process_manager";
import {
  box,
  ensure,
  Exception,
  Value,
  k,
  printValue,
  valueExpr,
} from "./value";

function compilePrimitives(
  map: Record<
    string,
    Pick<Rec, "rule__params" | "rule__rest_params" | "rule__body"> & {
      rule__primitive?: RulePrimitive;
    }
  >,
) {
  const out: {
    rules: Record<string, Rec>;
    rulePrimitives: Record<string, RulePrimitive>;
  } = { rules: {}, rulePrimitives: {} };

  for (const key in map) {
    const { rule__primitive, ...rec } = map[key];
    if (rule__primitive) {
      out.rulePrimitives[key] = rule__primitive;
    }
    out.rules[key] = rec;
  }

  return out;
}

function* seq_(
  gen: ProcessGen,
  after: Value,
): Generator<ProcessNext, boolean, Process> {
  let next = gen.next();
  let didSucceed = false;
  while (!next.done) {
    if (next.value.tag === "result") {
      didSucceed = true;
      yield* next.value.result.eval(after);
      next = gen.next();
    } else {
      const result = yield next.value;
      next = gen.next(result);
    }
  }
  return didSucceed;
}

export const { rules, rulePrimitives } = compilePrimitives({
  ok: {
    rule__params: l(),
    rule__primitive: function* (it) {
      yield it.result();
    },
  },
  fail: {
    rule__params: l(),
    rule__primitive: function* () {},
  },
  nonvar: {
    rule__params: l($.term),
    rule__primitive: function* (it, term) {
      if (term.tag !== "var") yield it.result();
    },
  },
  "=": {
    rule__params: l($.left, $.right),
    rule__primitive: function* (it, left, right) {
      if (it.unify(left, right)) yield it.result();
    },
  },
  "/=": {
    rule__params: l($.left, $.right),
    rule__primitive: function* (it, left, right) {
      if (it.dif(left, right)) yield it.result();
    },
  },
  ",": {
    rule__params: l($.before, $.after),
    rule__primitive: function* (it, before, after) {
      yield* seq_(it.eval(before), after);
    },
  },
  ";": {
    rule__params: l($.before, $.after),
    rule__primitive: function* (it, before, after) {
      yield* it.fork().eval(before);
      yield* it.eval(after);
    },
  },
  loop: {
    rule__params: l($.goal),
    rule__primitive: function* (it, goal) {
      while (true) {
        const gen = it.fork().eval(goal);
        let next = gen.next();
        let didSucceed = false;
        while (!next.done) {
          if (next.value.tag === "result") {
            didSucceed = true;
            yield next.value;
            next = gen.next();
          } else {
            const result = yield next.value;
            next = gen.next(result);
          }
        }
        if (!didSucceed) break;
      }
    },
  },
  if_then_else: {
    rule__params: l($.if, $.then, $.else),
    rule__primitive: function* (it, if_, then_, else_) {
      const didSucceed = yield* seq_(it.fork().eval(if_), then_);
      if (!didSucceed) yield* it.eval(else_);
    },
  },
  throw: {
    rule__params: l($.error),
    rule__primitive: function* (_, error) {
      throw new Exception(error);
    },
  },
  try_error_catch: {
    rule__params: l($.try, $.error, $.catch),
    rule__primitive: function* (it, try_, error_, catch_) {
      try {
        yield* it.fork().eval(try_);
      } catch (e) {
        if (e instanceof Exception) {
          const next = it.fork();
          if (next.unify(e.error, error_)) {
            yield* next.eval(catch_);
            return;
          }
        }
        throw e;
      }
    },
  },
  collect_empty: {
    rule__params: l($.pattern, $.goal, $.out),
    rule__primitive: function* (it, pattern, goal, out) {
      const matches: Value[] = [];

      const gen = it.fork().eval(goal);
      let next = gen.next();
      while (!next.done) {
        if (next.value.tag === "result") {
          const result = next.value.result;
          matches.push(result.resolve(pattern));
          next = gen.next();
        } else {
          const result = yield next.value;
          next = gen.next(result);
        }
      }

      if (it.unify(out, box("", matches))) yield it.result();
    },
  },
  receive: {
    rule__params: l($.pattern),
    rule__primitive: function* (it, pattern) {
      const next = yield it.receive(pattern);
      /* v8 ignore next */
      if (!next) throw new Error("expected receive result");
      yield next.result();
    },
  },
  limit: {
    rule__params: l($.limit, $.goal),
    rule__primitive: function* (it, limit, goal) {
      ensure(limit, "number");
      let count = 0;

      const gen = it.fork().eval(goal);
      let next = gen.next();
      while (!next.done) {
        if (next.value.tag === "result") {
          yield next.value;
          count += 1;
          if (count >= limit.value) break;
          next = gen.next();
        } else {
          const result = yield next.value;
          next = gen.next(result);
        }
      }
    },
  },
  test__limit: {
    rule__params: l(),
    rule__body: test.collect(
      $.item,
      s.limit(
        3,
        alt(
          s["="]($.item, 1),
          s["="]($.item, 2),
          s["="]($.item, 3),
          s["="]($.item, 4),
          s["="]($.item, 5),
        ),
      ),
      1,
      2,
      3,
    ),
  },
  string_number: {
    rule__params: l($.string, $.number),
    rule__primitive: function* (it, string, number) {
      if (string.tag == "string") {
        const parsed = Number(string.value);
        if (Number.isFinite(parsed)) {
          if (!it.unify(k(parsed), number)) return;
          yield it.result();
        }
      } else if (number.tag == "number") {
        const strung = String(number.value);
        if (!it.unify(k(strung), string)) return;
        yield it.result();
      }
    },
  },
  test__string_number: {
    rule__params: l(),
    rule__body: seq(
      test.collect($.number, s.string_number("123", $.number), 123),
      test.collect($.string, s.string_number($.string, 123), "123"),
      test.fail(s.string_number("not a number", $.number)),
    ),
  },
  string_substring: {
    rule__params: l($.string, $.sub),
    rule__primitive: function* (it, string, sub) {
      ensure(string, "string");
      ensure(sub, "string");
      if (string.value.toLowerCase().match(sub.value.toLowerCase())) {
        yield it.result();
      }
    },
  },
  test__string_substring: {
    rule__params: l(),
    rule__body: seq(
      test.ok(s.string_substring("foobar", "oo")),
      test.fail(s.string_substring("foobar", "baz")),
    ),
  },
  number_min_max: {
    rule__params: l($.number, $.min, $.max),
    rule__primitive: function* (it, num, min, max) {
      if (num.tag == "number") {
        if (min.tag == "number") {
          if (min.value > num.value) return;
        } else {
          if (!it.unify(num, min)) return;
        }
        if (max.tag == "number") {
          if (max.value < num.value) return;
        } else {
          if (!it.unify(num, max)) return;
        }
        yield it.result();
      } else {
        const minVal = min.tag == "number" ? min.value : 0;
        const maxVal = max.tag == "number" ? max.value : Infinity;
        if (minVal > maxVal) return;
        for (let i = minVal; i <= maxVal; i++) {
          const ns = it.fork();
          if (!ns.unify(num, k(i))) return;
          yield ns.result();
        }
      }
    },
  },
  test__number_min_max: {
    rule__params: l(),
    rule__body: seq(
      test.ok(s.number_min_max(3, 0, 10)),
      test.ok(s.number_min_max(0, 0, 10)),
      test.ok(s.number_min_max(10, 0, 10)),

      test.ok(s.number_min_max(3, __, 10)),
      test.ok(s.number_min_max(23, 0, __)),
      test.fail(s.number_min_max(23, 0, 10)),

      test.collect($.val, s.number_min_max($.val, 3, 6), 3, 4, 5, 6),
    ),
  },
  box_length: {
    rule__params: l($.box, $.length),
    rule__primitive: function* (it, box, length) {
      ensure(box, "box");
      if (!it.unify(length, k(box.args.length))) return;
      yield it.result();
    },
  },
  test__box_length: {
    rule__params: l(),
    rule__body: seq(
      test.collect($.len, s.box_length(s.foo(), $.len), 0),
      test.collect($.len, s.box_length(s.bar(1, 2, 3), $.len), 3),
    ),
  },
  box_tag_list: {
    rule__params: l($.box, $.tag, $.list),
    rule__primitive: function* (it, aBox, tag, list) {
      if (aBox.tag === "box") {
        const { id, args } = aBox;
        if (it.unify(tag, k(id)) && it.unify(list, box("", args))) {
          yield it.result();
        }
      } else if (tag.tag === "string" && list.tag === "box") {
        if (it.unify(aBox, box(tag.value, list.args))) {
          yield it.result();
        }
      }
    },
  },
  test__box_tag_list: {
    rule__params: l(),
    rule__body: seq(
      test.collect(
        l($.tag, $.list),
        s.box_tag_list(s.foo(123, 456), $.tag, $.list),
        l("foo", l(123, 456)),
      ),
      test.collect($.box, s.box_tag_list($.box, "bar", l(789)), s.bar(789)),
    ),
  },
  box_at_value: {
    rule__params: l($.box, $.index, $.value),
    rule__primitive: function* (it, aBox, index, value) {
      ensure(aBox, "box");
      if (index.tag === "number") {
        const i = index.value;
        if (i < 0 || i >= aBox.args.length) return;
        if (it.unify(value, aBox.args[i])) {
          yield it.result();
        }
      } else {
        for (let i = 0; i < aBox.args.length; i++) {
          const ns = it.fork();
          if (ns.unify(index, k(i)) && ns.unify(value, aBox.args[i])) {
            yield ns.result();
          }
        }
      }
    },
  },
  test__box_at_value: {
    rule__params: l(),
    rule__body: seq(
      // get
      test.collect($.value, s.box_at_value(s.pair(123, 456), 0, $.value), 123),
      // iter
      test.collect(
        l($.index, $.value),
        s.box_at_value(s.pair(123, 456), $.index, $.value),
        l(0, 123),
        l(1, 456),
      ),
      // find
      test.collect($.index, s.box_at_value(s.pair(123, 456), $.index, 456), 1),
    ),
  },
  box_at_value_updated: {
    rule__params: l($.box, $.index, $.value, $.updated),
    rule__primitive: function* (it, b, index, value, updated) {
      ensure(b, "box");
      ensure(index, "number");
      const i = index.value;

      if (i < 0 || i >= b.args.length) return;
      const nextArgs = b.args.slice();
      nextArgs[i] = value;
      if (it.unify(updated, box(b.id, nextArgs))) {
        yield it.result();
      }
    },
  },
  test__box_at_value_updated: {
    rule__params: l(),
    rule__body: seq(
      test.collect(
        $.value,
        s.box_at_value_updated(s.foo("a", "b"), 0, 123, $.value),
        s.foo(123, "b"),
      ),
    ),
  },
  box_from_to_slice: {
    rule__params: l($.box, $.from, $.to, $.slice),
    rule__primitive: function* (it, b, from, to, slice) {
      ensure(b, "box");
      const fromVal = from.tag == "number" ? from.value : 0;
      const toVal = to.tag == "number" ? to.value : b.args.length;
      if (
        it.unify(from, k(fromVal)) &&
        it.unify(to, k(toVal)) &&
        it.unify(slice, box(b.id, b.args.slice(fromVal, toVal)))
      ) {
        yield it.result();
      }
    },
  },
  test__box_from_to_slice: {
    rule__params: l(),
    rule__body: seq(
      // all outputs
      test.collect(
        l($.from, $.to, $.slice),
        s.box_from_to_slice(l("a", "b", "c"), $.from, $.to, $.slice),
        l(0, 3, l("a", "b", "c")),
      ),
      // subset
      test.collect(
        $.slice,
        s.box_from_to_slice(l("a", "b", "c"), 1, __, $.slice),
        l("b", "c"),
      ),
    ),
  },
  box_box_append: {
    rule__params: l($.left, $.right, $.append),
    rule__primitive: function* (state, left, right, append) {
      if (left.tag == "box" && right.tag == "box") {
        if (left.tag !== right.tag) return;
        if (left.args.length === 0) {
          if (state.unify(right, append)) yield state.result();
        } else {
          if (state.unify(append, box(left.id, left.args.concat(right.args))))
            yield state.result();
        }
        return;
      }
      ensure(append, "box");
      const unifySplit = (st: Process, split: number) =>
        st.unify(left, {
          tag: "box",
          id: append.id,
          args: append.args.slice(0, split),
        }) &&
        st.unify(right, {
          tag: "box",
          id: append.id,
          args: append.args.slice(split),
        });

      if (left.tag == "box" && unifySplit(state, left.args.length)) {
        yield state.result();
      } else if (
        right.tag == "box" &&
        unifySplit(state, append.args.length - right.args.length)
      ) {
        yield state.result();
      } else {
        for (let i = 0; i <= append.args.length; i++) {
          const ns = state.fork();
          if (unifySplit(ns, i)) yield ns.result();
        }
      }
    },
  },
  test__box_box_append: {
    rule__params: l(),
    rule__body: seq(
      // concat
      test.collect(
        $.append,
        s.box_box_append(l("a"), l("b", "c"), $.append),
        l("a", "b", "c"),
      ),
      // cons
      test.collect(
        l($.head, $.tail),
        s.box_box_append(l($.head), $.tail, l("a", "b", "c")),
        l("a", l("b", "c")),
      ),
      // stack
      test.collect(
        l($.stack, $.pop),
        s.box_box_append($.stack, l($.pop), l("a", "b", "c")),
        l(l("a", "b"), "c"),
      ),
      // scan
      test.collect(
        $.left,
        s.box_box_append($.left, __, l("a", "b", "c")),
        l(),
        l("a"),
        l("a", "b"),
        l("a", "b", "c"),
      ),
    ),
  },

  log: {
    rule__params: l(),
    rule__rest_params: $.messages,
    rule__primitive: function* (it, ...args) {
      console.log(...args.map((arg) => printValue(it.resolve(arg))));
      yield it.result();
    },
  },
  id: {
    rule__params: l($.id),
    rule__primitive: function* (it, id) {
      if (it.unify(id, k(crypto.randomUUID()))) yield it.result();
    },
  },
  timestamp: {
    rule__params: l($.timestamp),
    rule__primitive: function* (it, ts) {
      if (it.unify(ts, k(Date.now()))) yield it.result();
    },
  },
  tx: {
    rule__params: l($.tx),
    rule__primitive: function* (it, tx) {
      if (it.unify(tx, k(it.processManager.db.beginTx()))) yield it.result();
    },
  },
  commit: {
    rule__params: l($.tx),
    rule__primitive: function* (it, tx) {
      ensure(tx, "number");
      it.processManager.db.commitTx(tx.value);
      yield it.result();
    },
  },
  rollback: {
    rule__params: l($.tx),
    rule__primitive: function* (it, tx) {
      ensure(tx, "number");
      it.processManager.db.rollbackTx(tx.value);
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
      value = it.resolve(value);
      it.processManager.db.updateTx(
        tx.value,
        id.value,
        field.value,
        valueExpr(value),
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

      it.processManager.db.updateTx(tx.value, id.value, field.value, null);
      yield it.result();
    },
  },
  tx_delete_record__primitive: {
    rule__params: l($.tx, $.id),
    rule__primitive: function* (it, tx, id) {
      ensure(tx, "number");
      ensure(id, "string");

      it.processManager.db.insertTx(tx.value, id.value, null);
      yield it.result();
    },
  },
  // just id -> field -> value
  record_field_value__primitive: {
    rule__params: l($.id, $.field, $.value),
    rule__primitive: function* (it, id, field, value) {
      ensure(id, "string");
      ensure(field, "string");

      const rec = it.processManager.db.get(id.value);
      if (!rec) return;
      const val = rec[field.value];
      if (val == null) return;
      if (it.unify(it.exprValue(val), value)) yield it.result();
    },
  },
  index_field_record__primitive: {
    rule__params: l($.index, $.field, $.id),
    rule__primitive: function* (it, index, field, id) {
      ensure(field, "string");

      const idx = it.processManager.db.getIndex(field.value);
      if (!idx) return;

      const indexExpr = valueExpr(index);
      for (const [{ entityId }] of idx.tree.getRange(
        { value: indexExpr, entityId: "" },
        { value: indexExpr, entityId: "~" },
      )) {
        const ns = it.fork();
        if (ns.unify(id, k(entityId))) yield ns.result();
      }
    },
  },
  record_field__primitive: {
    rule__params: l($.id, $.field),
    rule__primitive: function* (it, id, field) {
      ensure(id, "string");
      const rec = it.processManager.db.get(id.value);
      if (!rec) return;
      if (field.tag === "string") {
        if (field.value in rec) yield it.result();
      } else {
        for (const f in rec) {
          const ns = it.fork();
          if (ns.unify(field, k(f))) yield ns.result();
        }
      }
    },
  },
  record__primitive: {
    rule__params: l($.id),
    rule__primitive: function* (it, id) {
      if (id.tag === "string") {
        if (it.processManager.db.get(id.value)) yield it.result();
      } else {
        for (const key in it.processManager.db.keys()) {
          const ns = it.fork();
          if (ns.unify(id, k(key))) yield ns.result();
        }
      }
    },
  },

  send: {
    rule__params: l($.pid, $.message),
    rule__primitive: function* (it, pid, message) {
      if (pid.tag === "number" || pid.tag === "string") {
        it.processManager.send(pid.value, it.resolve(message));
        yield it.result();
      }
    },
  },
});
