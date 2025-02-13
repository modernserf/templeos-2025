import { Rec } from "../data";
import { $, l } from "./expr";
import { Process } from "./process";
import { ProcessGen, ProcessNext, RulePrimitive } from "./process_manager";
import { box, Exception, Value } from "./value";

function compilePrimitives(
  map: Record<
    string,
    Pick<Rec, "rule__params" | "rule__rest_params"> & {
      rule__primitive: RulePrimitive;
    }
  >,
) {
  const out: {
    rules: Record<string, Rec>;
    rulePrimitives: Record<string, RulePrimitive>;
  } = { rules: {}, rulePrimitives: {} };

  for (const key in map) {
    const { rule__primitive, ...rec } = map[key];
    out.rulePrimitives[key] = rule__primitive;
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
  if_then_else: {
    rule__params: l($.if, $.then, $.else),
    rule__primitive: function* (it, if_, then_, else_) {
      const didSucceed = yield* seq_(it.fork().eval(if_), then_);
      if (!didSucceed) yield* it.eval(else_);
    },
  },
  throw: {
    rule__params: l($.error),
    // eslint-disable-next-line require-yield
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
});
