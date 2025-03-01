import { Rec } from ".";
import { l, s, $, __, seq, u } from "../expr";
import { test } from "./test_utils";

export const asyncRules = {
  // TODO: duration type
  sleep: {
    rule__params: l($.time_ms),
    rule__body: seq(
      s.self($.self),
      s.id($.id),
      s.send_async($.self, s.wake($.id), $.time_ms),
      s.receive(s.wake($.id)),
    ),
  },
  test__sleep: {
    test__group: "async",
    rule__params: l(),
    rule__body: seq(
      test.ok(
        seq(
          s.timestamp($.before),
          s.sleep(10),
          s.timestamp($.after),
          s("/=", $.before, $.after),
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
  test__async_join: {
    test__group: "async",
    rule__params: l(),
    rule__body: seq(
      test.collect(
        l($.left, $.right),
        seq(
          s.self($.self),
          s.async_join(
            seq(s.sleep(10), s.send($.self, s.left_result("foo"))),
            seq(s.sleep(20), s.send($.self, s.right_result("bar"))),
          ),
          s.receive(s.left_result($.left)),
          s.receive(s.right_result($.right)),
        ),
        l("foo", "bar"),
      ),
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
  test__async_race: {
    test__group: "async",
    rule__params: l(),
    rule__body: seq(
      test.collect(
        $.result,
        seq(
          s.self($.self),
          s.async_race(
            seq(s.sleep(10), s.send($.self, s.race("foo"))),
            seq(s.sleep(20), s.send($.self, s.race("bar"))),
          ),
          s.receive(s.race($.result)),
          s.receive(s.race("bar")),
        ),
        "foo",
      ),
    ),
  },

  agent: {
    rule__params: l($.pid, $.init_state),
    rule__body: seq(
      s.spawn_link(
        $.pid,
        seq(
          s.loop_fail(
            $.next,
            $.prev,
            $.init_state,
            seq(
              s.receive($.e),
              s.match_cond(
                $.e,
                l(s.get($.pid, $.ref), s.send($.pid, s.get($.ref, $.prev))),
                l(
                  s.update($.out, $.prev, $.goal),
                  s.if_then_else($.goal, u($.next, $.out), s.ok()),
                ),
              ),
              s.if_var($.next, u($.next, $.prev)),
              s.fail(),
            ),
          ),
          s.log("agent exit"),
        ),
      ),
    ),
  },
  agent__get: {
    rule__params: l($.value, $.agent),
    rule__body: seq(
      s.id($.ref),
      s.self($.self),
      s.send($.agent, s.get($.self, $.ref)),
      s.receive(s.get($.ref, $.value)),
    ),
  },
  agent__update: {
    rule__params: l($.agent, $.out, $.in, $.goal),
    rule__body: seq(
      s.send($.agent, s.update($.out, $.in, $.goal)), //
    ),
  },

  agent__push: {
    rule__params: l($.agent, $.value),
    rule__body: s.agent__update(
      $.agent,
      $.next,
      $.prev,
      s.append_left_right($.next, $.prev, l($.value)),
    ),
  },
  agent__pop: {
    rule__params: l($.agent, $.value),
    rule__body: seq(
      s.agent__get($.stack, $.agent),
      s.append_left_right($.stack, $.popped, l($.value)),
      // TODO: sync update that provides access to prev & next
      s.agent__update($.agent, $.next, __, u($.next, $.popped)),
    ),
  },

  test__agent: {
    test__group: "async",
    rule__params: l(),
    rule__body: seq(
      test.collect(
        $.res,
        seq(
          s.agent($.agent, l(123)),
          s.agent__push($.agent, 456),
          s.agent__get($.res, $.agent),
        ),
        l(123, 456),
      ),
    ),
  },
} satisfies Record<string, Rec>;
