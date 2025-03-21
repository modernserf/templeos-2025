import { test } from "./test_utils";
import { $, l, s, seq, u, alt, __ } from "../expr";
import { Value, box } from "../value";
import { ensure, resolveDeep } from "../process";
import { pkg } from "../pkg";

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

export const { rules: controlRules, rulePrimitives: controlPrimitives } = pkg(
  "control",
  {
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
            next = gen.next(yield next.value);
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

    resolve_deep: {
      rule__params: l($.resolved, $.value),
      rule__primitive: function* (it, res, val) {
        if (it.unify(res, resolveDeep(val))) yield it.result();
      },
    },
    apply__primitive: {
      rule__params: l($.args, $.fn),
      rule__primitive: function* (it, args, fn) {
        ensure(args, "box");
        ensure(fn, "box");
        const fullFn = box(fn.id, [...args.args, ...fn.args]);
        yield* it.eval(fullFn);
      },
    },
  },
);
