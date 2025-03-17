import { Rec } from "../data";
import { test } from "../data/test_utils";
import { $, l, s, seq, u, alt, __ } from "../expr";
import { Value, box, k, printValue, valueExpr } from "../value";
import {
  ensure,
  ensurePid,
  Exception,
  resolveDeep,
  RulePrimitive,
  State,
} from "../process";

function compilePrimitives(
  map: Record<
    string,
    Pick<Rec, "test__group" | "rule__params" | "rule__body"> & {
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

function dif(left: Value, right: Value) {
  if (left.tag === "fresh") return false;
  if (right.tag === "fresh") return false;
  if (left.tag === "var") return dif(left.fact.value, right);
  if (right.tag === "var") return dif(left, right.fact.value);
  if (left.tag === "number" && right.tag === "number") {
    return left.value !== right.value;
  }
  if (left.tag === "string" && right.tag === "string") {
    return left.value !== right.value;
  }
  if (
    left.tag === "box" &&
    right.tag === "box" &&
    left.id === right.id &&
    left.args.length === right.args.length
  ) {
    for (let i = 0; i < left.args.length; i++) {
      if (dif(left.args[i], right.args[i])) return true;
    }
    return false;
  }
  return true;
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
  unify: {
    rule__params: l($.left, $.right),
    rule__primitive: function* (it, left, right) {
      if (it.unify(left, right)) yield it.result();
    },
  },
  not_equal: {
    rule__params: l($.left, $.right),
    rule__primitive: function* (it, left, right) {
      if (dif(left, right)) yield it.result();
    },
  },
  seq2: {
    rule__params: l($.before, $.after),
    rule__primitive: function* (it, before, after) {
      const gen = it.eval(before);
      let next = gen.next();
      while (!next.done) {
        if (next.value.tag === "result") {
          yield* next.value.result.eval(after);
          next = gen.next();
        } else {
          next = gen.next(yield next.value);
        }
      }
    },
  },
  alt2: {
    rule__params: l($.before, $.after),
    rule__primitive: function* (it, before, after) {
      const s = it.choice();
      yield* it.eval(before);
      it.backtrack(s);
      yield* it.eval(after);
    },
  },

  block: {
    rule__params: l($.out, $.goal),
    rule__primitive: function* (it, out, goal) {
      const s = it.choice();
      let value: Value;

      const gen = it.eval(goal);
      let next = gen.next();
      while (!next.done) {
        if (next.value.tag === "result") {
          value = resolveDeep(out);
          next = gen.next();
        } else {
          const result = yield next.value;
          next = gen.next(result);
        }
      }
      it.backtrack(s);
      if (value! && it.unify(out, value)) yield it.result();
    },
  },

  loop_iter: {
    rule__params: l($.next, $.state, $.init, $.goal),
    rule__primitive: function* (it, nextState, state, initState, goal) {
      let value = resolveDeep(initState);
      while (true) {
        const s = it.choice();
        if (!it.unify(value, state)) return;
        const gen = it.eval(goal);
        let next = gen.next();
        let didSucceed = false;
        while (!next.done) {
          if (next.value.tag === "result") {
            value = resolveDeep(nextState);
            didSucceed = true;
            next = gen.next();
            yield it.result();
          } else {
            next = gen.next(yield next.value);
          }
        }
        if (!didSucceed) return;
        it.backtrack(s);
      }
    },
  },
  test__loop_iter: {
    test__group: "primitives",
    rule__params: l(),
    rule__body: seq(
      s.expect_collect(
        l($.result, $.next),
        s.limit(3, s.loop_iter($.next, $.result, 0, s.inc($.next, $.result))),
        l(0, 1),
        l(1, 2),
        l(2, 3),
      ),
    ),
  },

  if_then_else: {
    rule__params: l($.if, $.then, $.else),
    rule__primitive: function* (it, if_, then_, else_) {
      const s = it.choice();
      const gen = it.eval(if_);
      let next = gen.next();
      let didSucceed = false;
      while (!next.done) {
        if (next.value.tag === "result") {
          didSucceed = true;
          it.cut(s);
          yield* next.value.result.eval(then_);
          next = gen.next();
        } else {
          next = gen.next(yield next.value);
        }
      }

      if (!didSucceed) {
        it.backtrack(s);
        yield* it.eval(else_);
      }
    },
  },
  test__if_then_else: {
    test__group: "primitives",
    rule__params: l(),
    rule__body: seq(
      test.collect(
        $.result,
        s.if_then_else(s.ok(), u($.result, "foo"), u($.result, "bar")),
        "foo",
      ),
      test.collect(
        $.result,
        s.if_then_else(s.fail(), u($.result, "foo"), u($.result, "bar")),
        "bar",
      ),
      test.fail(s.if_then_else(s.ok(), s.fail(), s.ok())),

      test.collect(
        $.result,
        s.if_then_else(
          alt(u($.foo, 1), u($.foo, 2)),
          u($.result, $.foo),
          s.ok(),
        ),
        1,
        2,
      ),
    ),
  },
  throw: {
    rule__params: l($.error),
    rule__primitive: function* (_, error) {
      throw new Exception(resolveDeep(error));
    },
  },
  try_error_catch: {
    rule__params: l($.try, $.error, $.catch),
    rule__primitive: function* (it, try_, error_, catch_) {
      const s = it.choice();
      try {
        yield* it.eval(try_);
      } catch (e) {
        if (e instanceof Exception) {
          it.backtrack(s);
          if (it.unify(e.error, error_)) {
            yield* it.eval(catch_);
            return;
          }
        }
        throw e;
      }
    },
  },
  try_error_trace_catch: {
    rule__params: l($.try, $.error, $.trace, $.catch),
    rule__primitive: function* (it, try_, error_, trace_, catch_) {
      const s = it.choice();
      try {
        yield* it.eval(try_);
      } catch (e) {
        if (e instanceof Exception) {
          it.backtrack(s);
          if (it.unify(e.error, error_) && it.unify(box("", e.trace), trace_)) {
            yield* it.eval(catch_);
            return;
          }
        }
        throw e;
      }
    },
  },
  collect_item_in: {
    rule__params: l($.out, $.pattern, $.goal),
    rule__primitive: function* (it, out, pattern, goal) {
      const matches: Value[] = [];
      const s = it.choice();

      const gen = it.eval(goal);
      let next = gen.next();
      while (!next.done) {
        if (next.value.tag === "result") {
          matches.push(resolveDeep(pattern));
          next = gen.next();
        } else {
          next = gen.next(yield next.value);
        }
      }
      it.backtrack(s);

      if (it.unify(out, box("", matches))) yield it.result();
    },
  },
  self: {
    rule__params: l($.pid),
    rule__primitive: function* (it, pid) {
      if (it.unify(pid, k(it.pid))) yield it.result();
    },
  },
  send: {
    rule__params: l($.pid, $.message),
    rule__primitive: function* (it, pid, message) {
      ensurePid(pid);
      it.pm.send(pid.value, resolveDeep(message));
      yield it.result();
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
  flush: {
    rule__params: l($.messages),
    rule__primitive: function* (it, messages) {
      const ms = it.pm.flush(it.pid);
      if (it.unify(messages, box("", ms))) yield it.result();
    },
  },
  spawn: {
    rule__params: l($.pid, $.goal),
    rule__primitive: function* (it, pid, goal) {
      if (pid.tag === "number" || pid.tag === "string") {
        it.pm.spawn(goal, pid.value);
        yield it.result();
      } else {
        const pidResult = it.pm.spawn(goal);
        if (!it.unify(pid, k(pidResult))) throw new Error("tod");
        yield it.result();
      }
    },
  },
  spawn_link: {
    rule__params: l($.pid, $.goal),
    rule__primitive: function* (it, pid, goal) {
      if (pid.tag === "number" || pid.tag === "string") {
        it.pm.spawn(goal, pid.value, it.pid);
        yield it.result();
      } else {
        const pidResult = it.pm.spawn(goal, undefined, it.pid);
        if (!it.unify(pid, k(pidResult))) throw new Error("tod");
        yield it.result();
      }
    },
  },
  send_async: {
    rule__params: l($.pid, $.message, $.timeout),
    rule__primitive: function* (it, pid, message, timeout) {
      ensure(timeout, "number");
      ensurePid(pid);
      setTimeout(() => {
        it.pm.sendAsync(pid.value, resolveDeep(message));
      }, timeout.value);
      yield it.result();
    },
  },
  link: {
    rule__params: l($.pid),
    rule__primitive: function* (it, pid) {
      ensurePid(pid);
      it.pm.link(it.pid, pid.value);
      yield it.result();
    },
  },
  unlink: {
    rule__params: l($.pid),
    rule__primitive: function* (it, pid) {
      ensurePid(pid);
      it.pm.unlink(it.pid, pid.value);
      yield it.result();
    },
  },
  exit: {
    rule__params: l($.pid, $.reason),
    rule__primitive: function* (it, pid, reason) {
      ensurePid(pid);
      it.pm.exit(it.pid, pid.value, reason);
      yield it.result();
    },
  },
  test__link: {
    test__group: "core",
    rule__params: l(),
    rule__body: seq(
      s.agent($.agent, l(123)),
      s.spawn($.foo, seq(s.receive(__), s.throw(s.fail()))),
      s.spawn(
        $.bar,
        seq(
          s.link($.foo),
          s.agent_push($.agent, 456),
          s.send($.foo, l()),
          // yield to allow linked process to fail
          s.sleep(1),
          s.agent_push($.agent, 789),
        ),
      ),
      s.sleep(10),
      test.collect($.res, s.agent_get($.res, $.agent), l(123, 456)),
    ),
  },
  test__exit: {
    test__group: "core",
    rule__params: l(),
    rule__body: seq(
      s.agent($.agent, l(123)),
      s.spawn(
        $.bar,
        seq(
          s.agent_push($.agent, 456),
          // yield to allow parent process to kill
          s.sleep(1),
          s.agent_push($.agent, 789),
        ),
      ),
      s.exit($.bar, s.kill()),
      test.collect($.res, s.agent_get($.res, $.agent), l(123, 456)),
    ),
  },
  trap_exit: {
    rule__params: l(),
    rule__primitive: function* (it) {
      it.pm.setFlags(it.pid, { trapExit: true });
      yield it.result();
    },
  },
  test__trap_exit: {
    test__group: "core",
    rule__params: l(),
    rule__body: seq(
      s.agent($.agent, l(123)),
      s.spawn($.foo, seq(s.receive(__), s.throw(s.fail()))),
      s.spawn(
        $.bar,
        seq(
          s.trap_exit(),
          s.link($.foo),
          s.agent_push($.agent, 456),
          s.send($.foo, l()),
          // yield to allow linked process to fail
          s.sleep(1),
          s.receive(s.exit($.foo, s.fail())),

          s.agent_push($.agent, 789),
        ),
      ),
      s.sleep(10),
      test.collect($.res, s.agent_get($.res, $.agent), l(123, 456, 789)),
    ),
  },
  active_process: {
    rule__params: l($.pid),
    rule__primitive: function* (it, pid) {
      ensurePid(pid);
      if (it.pm.processes.has(pid.value)) yield it.result();
    },
  },

  type_value: {
    rule__params: l($.type, $.value),
    rule__primitive: function* (it, type, value) {
      const t = value.tag === "fresh" ? "var" : value.tag;
      if (it.unify(type, box(t, []))) yield it.result();
    },
  },
  test__type_value: {
    test__group: "core",
    rule__params: l(),
    rule__body: seq(
      test.ok(s.type_value(s.var(), __)),
      test.ok(s.type_value(s.var(), $.x)),
      test.ok(s.type_value(s.number(), 123)),
      test.ok(s.type_value(s.string(), "hello")),
      test.ok(s.type_value(s.box(), s.id(123, "hello"))),
      test.ok(s.type_value(s.box(), l(__, __))),

      s.unify($.y, 123),
      test.ok(s.type_value(s.number(), $.y)),
    ),
  },

  limit: {
    rule__params: l($.limit, $.goal),
    rule__primitive: function* (it, limit, goal) {
      ensure(limit, "number");
      let count = 0;

      const gen = it.eval(goal);
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
    test__group: "primitives",
    rule__params: l(),
    rule__body: test.collect(
      $.item,
      s.limit(
        3,
        alt(
          s.unify($.item, 1),
          s.unify($.item, 2),
          s.unify($.item, 3),
          s.unify($.item, 4),
          s.unify($.item, 5),
        ),
      ),
      1,
      2,
      3,
    ),
  },
  ensure_limit: {
    rule__params: l($.limit, $.goal),
    rule__primitive: function* (it, limit, goal) {
      ensure(limit, "number");
      let count = 0;

      const gen = it.eval(goal);
      let next = gen.next();
      while (!next.done) {
        if (next.value.tag === "result") {
          yield next.value;
          count += 1;
          if (count > limit.value) {
            throw new Exception(box("ensure_limit", [limit, goal]));
          }
          next = gen.next();
        } else {
          const result = yield next.value;
          next = gen.next(result);
        }
      }
    },
  },
  ident_var: {
    rule__params: l($.ident, $.var),
    rule__primitive: function* (it, ident, v) {
      ensure(v, "var");
      if (it.unify(ident, k(v.fact.name))) yield it.result();
    },
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
    test__group: "primitives",
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
    test__group: "primitives",
    rule__params: l(),
    rule__body: seq(
      test.ok(s.string_substring("foobar", "oo")),
      test.fail(s.string_substring("foobar", "baz")),
    ),
  },
  string_length: {
    rule__params: l($.len, $.str),
    rule__primitive: function* (it, len, str) {
      ensure(str, "string");
      if (it.unify(len, k(str.value.length))) yield it.result();
    },
  },
  string_char: {
    rule__params: l($.char, $.string, $.index),
    rule__primitive: function* (it, char, string, index) {
      ensure(string, "string");
      ensure(index, "number");
      if (it.unify(char, k(string.value.charAt(index.value))))
        yield it.result();
    },
  },
  string_char_code: {
    rule__params: l($.code, $.string, $.index),
    rule__primitive: function* (it, code, string, index) {
      ensure(string, "string");
      ensure(index, "number");
      if (it.unify(code, k(string.value.charCodeAt(index.value))))
        yield it.result();
    },
  },
  string_slice: {
    rule__params: l($.slice, $.string, $.from, $.to),
    rule__primitive: function* (it, slice, string, from, to) {
      ensure(string, "string");
      ensure(from, "number");
      ensure(to, "number");
      if (it.unify(slice, k(string.value.slice(from.value, to.value)))) {
        yield it.result();
      }
    },
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
          yield* it.unifyChoice(num, k(i));
        }
      }
    },
  },
  test__number_min_max: {
    test__group: "primitives",
    rule__params: l(),
    rule__body: seq(
      test.fail(s.number_min_max(10, 10, 0)),

      test.ok(s.number_min_max(3, 0, 10)),
      test.ok(s.number_min_max(0, 0, 10)),
      test.ok(s.number_min_max(10, 0, 10)),

      test.ok(s.number_min_max(3, __, 10)),
      test.ok(s.number_min_max(23, 0, __)),
      test.fail(s.number_min_max(23, 0, 10)),

      test.collect($.val, s.number_min_max($.val, 3, 6), 3, 4, 5, 6),
    ),
  },
  length_box: {
    rule__params: l($.length, $.box),
    rule__primitive: function* (it, length, box) {
      ensure(box, "box");
      if (!it.unify(length, k(box.args.length))) return;
      yield it.result();
    },
  },
  test__length_box: {
    test__group: "primitives",
    rule__params: l(),
    rule__body: seq(
      test.collect($.len, s.length_box($.len, s.foo()), 0),
      test.collect($.len, s.length_box($.len, s.bar(1, 2, 3)), 3),
    ),
  },
  box: {
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
  test__box: {
    test__group: "primitives",
    rule__params: l(),
    rule__body: seq(
      test.collect(
        l($.tag, $.list),
        s.box(s.foo(123, 456), $.tag, $.list),
        l("foo", l(123, 456)),
      ),
      test.collect($.box, s.box($.box, "bar", l(789)), s.bar(789)),
    ),
  },
  // Why this order?
  // value = box[index]
  // expr(value, value_box_index(box, index))
  // pipe(value, box, value_box_index(index))
  value_box_index: {
    rule__params: l($.value, $.box, $.index),
    rule__primitive: function* (it, value, b, index) {
      ensure(b, "box");
      if (index.tag === "number") {
        const i = index.value;
        if (i < 0 || i >= b.args.length) return;
        if (it.unify(value, b.args[i])) {
          yield it.result();
        }
      } else {
        for (let i = 0; i < b.args.length; i++) {
          yield* it.unifyChoice(
            box("", [index, value]),
            box("", [k(i), b.args[i]]),
          );
        }
      }
    },
  },
  test__value_box_index: {
    test__group: "primitives",
    rule__params: l(),
    rule__body: seq(
      // get
      test.collect(
        $.value,
        s.value_box_index($.value, s.pair(123, 456), 0),
        123,
      ),
      // iter
      test.collect(
        l($.index, $.value),
        s.value_box_index($.value, s.pair(123, 456), $.index),
        l(0, 123),
        l(1, 456),
      ),
      // find
      test.collect(
        $.index,
        s.value_box_index(456, s.pair(123, 456), $.index),
        1,
      ),
    ),
  },
  updated_box_index_value: {
    rule__params: l($.updated, $.box, $.index, $.value),
    rule__primitive: function* (it, updated, b, index, value) {
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
  test__updated_box_index_value: {
    test__group: "primitives",
    rule__params: l(),
    rule__body: seq(
      test.collect(
        $.value,
        s.updated_box_index_value($.value, s.foo("a", "b"), 0, 123),
        s.foo(123, "b"),
      ),
    ),
  },
  updated_box_changelist: {
    rule__params: l($.updated, $.box, $.changelist),
    rule__primitive: function* (it, updated, b, changelist) {
      ensure(b, "box");
      ensure(changelist, "box");
      const nextArgs = b.args.slice();
      for (let i = 0; i < changelist.args.length; i++) {
        const pair: Value = changelist.args[i];
        ensure(pair, "box");
        const [index, value]: Value[] = pair.args;
        ensure(index, "number");
        if (index.value < 0 || index.value >= b.args.length) return;
        nextArgs[index.value] = value;
      }
      if (it.unify(updated, box(b.id, nextArgs))) yield it.result();
    },
  },
  slice_box_from_to: {
    rule__params: l($.slice, $.box, $.from, $.to),
    rule__primitive: function* (it, slice, b, from, to) {
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
  test__slice_box_from_to: {
    test__group: "primitives",
    rule__params: l(),
    rule__body: seq(
      // all outputs
      test.collect(
        l($.from, $.to, $.slice),
        s.slice_box_from_to($.slice, l("a", "b", "c"), $.from, $.to),
        l(0, 3, l("a", "b", "c")),
      ),
      // subset
      test.collect(
        $.slice,
        s.slice_box_from_to($.slice, l("a", "b", "c"), 1, __),
        l("b", "c"),
      ),
    ),
  },
  append_left_right: {
    rule__params: l($.append, $.left, $.right),
    rule__primitive: function* (state, append, left, right) {
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
      const unifySplit = (st: State, split: number) =>
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
          const s = state.choice();
          if (unifySplit(state, i)) yield state.result();
          state.backtrack(s);
        }
      }
    },
  },
  test__append_left_right: {
    test__group: "primitives",
    rule__params: l(),
    rule__body: seq(
      // concat
      s.expect_collect(
        $.append,
        s.append_left_right($.append, l("a"), l("b", "c")),
        l("a", "b", "c"),
      ),
      // cons
      test.collect(
        l($.head, $.tail),
        s.append_left_right(l("a", "b", "c"), l($.head), $.tail),
        l("a", l("b", "c")),
      ),
      // stack
      test.collect(
        l($.stack, $.pop),
        s.append_left_right(l("a", "b", "c"), $.stack, l($.pop)),
        l(l("a", "b"), "c"),
      ),
      // scan
      test.collect(
        $.left,
        s.append_left_right(l("a", "b", "c"), $.left, __),
        l(),
        l("a"),
        l("a", "b"),
        l("a", "b", "c"),
      ),
    ),
  },
  timestamp_date: {
    rule__params: l($.ts, $.date),
    rule__primitive: function* (it, ts, date) {
      ensure(ts, "number");
      const d = new Date(ts.value);

      const dateBox = box("date", [
        k(d.getFullYear()),
        k(d.getMonth() + 1),
        k(d.getDate()),
        k(d.getHours()),
        k(d.getMinutes()),
        k(d.getSeconds()),
        k(d.getMilliseconds()),
      ]);
      if (it.unify(date, dateBox)) yield it.result();
    },
  },
  // // TODO: set process flag
  // begin_trace: {
  //   rule__params: l(),
  //   rule__primitive: function* (it) {
  //     it.__trace = true;
  //     yield it.result();
  //   },
  // },
  // end_trace: {
  //   rule__params: l(),
  //   rule__primitive: function* (it) {
  //     it.__trace = false;
  //     yield it.result();
  //   },
  // },
  log: {
    rule__params: $.messages,
    rule__primitive: function* (it, ...args) {
      console.log(...args.map((arg) => printValue(arg)));
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
  random: {
    rule__params: l($.rand),
    rule__primitive: function* (it, rand) {
      if (it.unify(rand, k(Math.random()))) yield it.result();
    },
  },
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
  add__primitive: {
    rule__params: l($.sum, $.left, $.right),
    rule__primitive: function* (it, sum, left, right) {
      ensure(left, "number");
      ensure(right, "number");
      if (it.unify(sum, k(left.value + right.value))) yield it.result();
    },
  },
  sub__primitive: {
    rule__params: l($.sum, $.left, $.right),
    rule__primitive: function* (it, sum, left, right) {
      ensure(left, "number");
      ensure(right, "number");
      if (it.unify(sum, k(left.value - right.value))) yield it.result();
    },
  },
  mul__primitive: {
    rule__params: l($.sum, $.left, $.right),
    rule__primitive: function* (it, sum, left, right) {
      ensure(left, "number");
      ensure(right, "number");
      if (it.unify(sum, k(left.value * right.value))) yield it.result();
    },
  },
  fdiv__primitive: {
    rule__params: l($.sum, $.left, $.right),
    rule__primitive: function* (it, sum, left, right) {
      ensure(left, "number");
      ensure(right, "number");
      if (it.unify(sum, k(left.value / right.value))) yield it.result();
    },
  },
  divrem__primitive: {
    rule__params: l($.div, $.mod, $.left, $.right),
    rule__primitive: function* (it, div, rem, left, right) {
      ensure(left, "number");
      ensure(right, "number");
      const q = Math.trunc(left.value / right.value);
      const r = left.value % right.value;
      if (it.unify(div, k(q)) && it.unify(rem, k(r))) yield it.result();
    },
  },
  mod__primitive: {
    rule__params: l($.mod, $.left, $.right),
    rule__primitive: function* (it, mod, left, right) {
      ensure(left, "number");
      ensure(right, "number");
      const n = left.value;
      const d = right.value;
      if (it.unify(mod, k(((n % d) + d) % d))) yield it.result();
    },
  },
  trunc__primitive: {
    rule__params: l($.trunc, $.frac, $.value),
    rule__primitive: function* (it, trunc, frac, value) {
      ensure(value, "number");
      const t = Math.trunc(value.value);
      const f = value.value - t;
      if (it.unify(trunc, k(t)) && it.unify(frac, k(f))) yield it.result();
    },
  },
  ord__string: {
    rule__params: l($.ord, $.left, $.right),
    rule__primitive: function* (it, ord, left, right) {
      ensure(left, "string");
      ensure(right, "string");

      switch (left.value.localeCompare(right.value)) {
        case -1:
          if (it.unify(ord, box("lt", []))) yield it.result();
          break;
        case 0:
          if (it.unify(ord, box("eq", []))) yield it.result();
          break;
        case 1:
          if (it.unify(ord, box("gt", []))) yield it.result();
      }
    },
  },
  ord__number: {
    rule__params: l($.ord, $.left, $.right),
    rule__primitive: function* (it, ord, left, right) {
      ensure(left, "number");
      ensure(right, "number");

      if (left.value < right.value) {
        if (it.unify(ord, box("lt", []))) yield it.result();
      } else if (left.value === right.value) {
        if (it.unify(ord, box("eq", []))) yield it.result();
      } else {
        if (it.unify(ord, box("gt", []))) yield it.result();
      }
    },
  },
  resolve_deep: {
    rule__params: l($.resolved, $.value),
    rule__primitive: function* (it, res, val) {
      if (it.unify(res, resolveDeep(val))) yield it.result();
    },
  },
});
