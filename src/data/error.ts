import { l, s, $, u, seq } from "../expr";
import { pkg } from "../pkg";
import { ensure, Exception, resolveDeep } from "../process";
import { box } from "../value";

export const { rules: error, rulePrimitives: errorPrimitives } = pkg("error", {
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
  result: {
    rule__params: l($.res, $.fn),
    rule__body: s.try_error_catch(
      seq(s.call($.fn, $.value), u($.res, s.ok($.value))),
      $.err,
      u($.res, s.error($.err)),
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
  ensure_det: {
    rule__params: l($.goal),
    rule__body: seq(
      s.cond(s.ensure_limit(1, $.goal), s.throw(s.expected_det($.goal))),
    ),
  },
  no_match: {
    rule__params: l($.message),
    rule__body: s.throw(s.no_match($.message)),
  },
  expected_received: {
    rule__params: l($.expected, $.received),
    rule__body: s.throw(s.expected_received($.expected, $.received)),
  },
  expected_type: {
    rule__params: l($.type, $.value),
    rule__body: s.throw(s.expected_type($.type, $.value)),
  },
  todo: {
    rule__params: l($.msg),
    rule__body: s.throw(s.todo($.msg)),
  },
  expected_ok: {
    rule__params: l($.goal),
    rule__body: s.throw(s.expected_ok($.goal)),
  },
});
