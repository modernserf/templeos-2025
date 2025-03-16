import { l, s, $, __, seq, u, fn } from "../expr";
import { pkg } from "../pkg";
import { test } from "./test_utils";

export const asyncRules = pkg("async", {
  sleep: {
    rule__params: l($.duration),
    rule__body: seq(
      s.self($.self),
      s.id($.id),
      s.ms_duration($.time_ms, $.duration),
      s.send_async($.self, s.wake($.id), $.time_ms),
      s.receive(s.wake($.id)),
    ),
  },
  _test_sleep: {
    test__group: "async",
    rule__params: l(),
    rule__body: seq(
      test.ok(
        seq(
          s.timestamp($.before),
          s.sleep(s.seconds(0.01)),
          s.timestamp($.after),
          s.not_equal($.before, $.after),
        ),
      ),
    ),
  },
  async_join: {
    rule__params: l($.left, $.right),
    rule__body: seq(
      s.self($.self),
      s.id($.id),
      s.spawn(__, seq($.left, s.send($.self, s.left($.id)))),
      s.spawn(__, seq($.right, s.send($.self, s.right($.id)))),
      s.receive(s.left($.id)),
      s.receive(s.right($.id)),
    ),
  },
  _test_async_join: {
    test__group: "async",
    rule__params: l(),
    rule__body: seq(
      s.agent($.agent, l()),
      s.async_join(
        seq(s.sleep(10), s.agent_push($.agent, s.left())),
        seq(s.sleep(20), s.agent_push($.agent, s.right())),
      ),
      s.agent_push($.agent, s.after()),
      test.ok(s.agent_get(l(s.left(), s.right(), s.after()), $.agent)),
    ),
  },
  async_race: {
    file__description: l("Note that race does not cancel the slower process"),
    rule__params: l($.left, $.right),
    rule__body: seq(
      s.self($.self),
      s.id($.id),
      s.spawn_link(__, seq($.left, s.send($.self, s.race(s.left(), $.id)))),
      s.spawn_link(__, seq($.right, s.send($.self, s.race(s.right(), $.id)))),
      s.receive(s.race(__, $.id)),
    ),
  },
  _test_async_race: {
    test__group: "async",
    rule__params: l(),
    rule__body: seq(
      s.agent($.agent, l()),
      s.async_race(
        seq(s.sleep(10), s.agent_push($.agent, s.left())),
        seq(s.sleep(20), s.agent_push($.agent, s.right())),
      ),
      s.agent_push($.agent, s.after()),
      test.ok(s.agent_get(l(s.left(), s.after()), $.agent)),
      s.sleep(20),
      test.ok(s.agent_get(l(s.left(), s.after(), s.right()), $.agent)),
    ),
  },

  agent: {
    rule__params: l($.pid, $.init_state),
    rule__body: s.spawn_link(
      $.pid,
      s.loop_iter(
        $.next,
        $.prev,
        $.init_state,
        seq(
          s.receive($.e),
          s.match_cond(
            $.e,
            l(
              s.get($.pid, $.ref),
              seq(s.send($.pid, s.get($.ref, $.prev)), u($.next, $.prev)),
            ),
            l(s.update($.fn), s.ensure_det(s.apply(l($.next, $.prev), $.fn))),
          ),
        ),
      ),
    ),
  },

  agent_get: {
    rule__params: l($.value, $.agent),
    rule__body: seq(
      s.id($.ref),
      s.self($.self),
      s.send($.agent, s.get($.self, $.ref)),
      s.receive(s.get($.ref, $.value)),
    ),
  },
  agent_update: {
    rule__params: l($.agent, $.fn),
    rule__body: s.send($.agent, s.update($.fn)), //
  },
  agent_set: {
    rule__params: l($.agent, $.value),
    rule__body: s.send($.agent, s.update(fn($.out, __)(u($.out, $.value)))),
  },
  agent_push: {
    rule__params: l($.agent, $.value),
    rule__body: s.agent_update($.agent, s.append_left_right(l($.value))),
  },
  agent_pop: {
    rule__params: l($.agent, $.value),
    rule__body: seq(
      s.agent_get($.stack, $.agent),
      s.append_left_right($.stack, $.popped, l($.value)),
      // TODO: sync update that provides access to prev & next
      s.agent_set($.agent, $.popped),
    ),
  },

  _test_agent: {
    test__group: "async",
    rule__params: l(),
    rule__body: seq(
      test.collect(
        $.res,
        seq(
          s.agent($.agent, l(123)),
          s.agent_push($.agent, 456),
          s.agent_get($.res, $.agent),
        ),
        l(123, 456),
      ),
    ),
  },
});
