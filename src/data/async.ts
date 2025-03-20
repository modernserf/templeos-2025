import { l, s, $, __, seq, u, fn, x } from "../expr";
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
    rule__body: s.agent_update($.agent, s.append(l($.value))),
  },
  agent_pop: {
    rule__params: l($.agent, $.value),
    rule__body: seq(
      s.agent_get($.stack, $.agent),
      s.append($.stack, $.popped, l($.value)),
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

  _t_event_bus_state: {
    rule__params: l($.t),
    rule__body: s.tuple($.t, s.list_of(s.pid())),
  },
  _t_event_bus_message: {
    rule__params: l($.t, $.t_event),
    rule__body: s.enum(
      $.t,
      s.event($.t_event),
      s.subscribe(s.pid(), s.pid(), s.string()),
      s.unsubscribe(s.pid(), s.pid(), s.string()),
      s.close(),
    ),
  },

  event_bus: {
    rule__params: l($.pid),
    rule__body: s.spawn_link(
      $.pid,
      s.loop_iter(
        $.next,
        l($.subscribers),
        l(l()),
        seq(
          s.receive($.message),
          s.match_cond(
            $.message,
            l(
              s.event($.e),
              seq(s._publish($.e, $.subscribers), u($.next, l($.subscribers))),
            ),
            l(
              s.subscribe($.sub, $.parent, $.ref),
              seq(
                s._subscribe($.next_subscribers, $.subscribers, $.sub),
                s.send($.parent, s.ok($.ref)),
                u($.next, l($.next_subscribers)),
              ),
            ),
            l(
              s.unsubscribe($.sub, $.parent, $.ref),
              seq(
                s._unsubscribe($.next_subscribers, $.subscribers, $.sub),
                s.send($.parent, s.ok($.ref)),
                u($.next, l($.next_subscribers)),
              ),
            ),
            l(s.close(), seq(s._unsubscribe_all($.subscribers), s.fail())),
          ),
        ),
      ),
    ),
  },

  event_send: {
    rule__params: l($.pid, $.event),
    rule__body: s.send($.pid, s.event($.event)),
  },
  event_subscribe: {
    rule__params: l($.sub, $.bus, $.fn),
    rule__body: seq(
      s.spawn_link(
        $.sub,
        s.loop(
          seq(
            s.receive($.message),
            s.match_cond(
              $.message,
              l(
                s.event($.e),
                s.if_then_else(s.call($.fn, $.e), s.ok(), s.ok()),
              ),
              l(s.unsubscribe(), s.fail()),
            ),
          ),
        ),
      ),
      s.id($.ref),
      s.self($.self),
      s.send($.bus, s.subscribe($.sub, $.self, $.ref)),
      s.receive(s.ok($.ref)),
    ),
  },
  event_unsubscribe: {
    rule__params: l($.sub, $.bus),
    rule__body: seq(
      s.id($.ref),
      s.self($.self),
      s.send($.bus, s.unsubscribe($.sub, $.self, $.ref)),
      s.receive(s.ok($.ref)),
    ),
  },
  event_close: {
    rule__params: l($.bus),
    rule__body: s.send($.bus, s.close()),
  },

  _publish: {
    rule__params: l($.event, $.subscribers),
    rule__body: seq(
      s($.sub).in($.subscribers),
      s.send($.sub, s.event($.event)),
    ),
  },
  _subscribe: {
    rule__params: l($.next, $.prev, $.sub),
    rule__body: s.if_then_else(
      s($.sub).in($.prev),
      u($.next, $.prev),
      s.append($.next, $.prev, l($.sub)),
    ),
  },
  _unsubscribe: {
    rule__params: l($.next, $.prev, $.sub),
    rule__body: seq(
      s.filter_list($.next, $.prev, s.not_equal($.sub)),
      s.send($.sub, s.unsubscribe()),
    ),
  },
  _unsubscribe_all: {
    rule__params: l($.subscribers),
    rule__body: seq(s($.sub).in($.subscribers), s.send($.sub, s.unsubscribe())),
  },

  _test_event_bus: {
    test__group: "async",
    rule__params: l(),
    rule__body: seq(
      s.event_bus($.bus),
      s.agent($.a, l()),
      s.agent($.b, l()),

      s.event_subscribe(
        $._a_sub,
        $.bus,
        fn($.e)(
          s.match_cond(
            $.e,
            l(s.a($.value), s.agent_push($.a, $.value)),
            l(s.ab($.value), s.agent_push($.a, $.value)),
            l(__, s.ok()),
          ),
        ),
      ),

      s.event_subscribe(
        $.b_sub,
        $.bus,
        fn($.e)(
          s.match_cond(
            $.e,
            l(s.b($.value), s.agent_push($.b, $.value)),
            l(s.ab($.value), s.agent_push($.b, $.value)),
            l(__, s.ok()),
          ),
        ),
      ),

      s.event_send($.bus, s.a(123)),
      s.event_send($.bus, s.b(456)),
      s.event_send($.bus, s.ab(789)),
      s.sleep(1),
      s.expect_eq(x.agent_get($.a), l(123, 789)),
      s.expect_eq(x.agent_get($.b), l(456, 789)),

      s.event_unsubscribe($.b_sub, $.bus),
      s.event_send($.bus, s.ab(42)),
      s.sleep(1),
      s.expect_eq(x.agent_get($.a), l(123, 789, 42)),
      s.expect_eq(x.agent_get($.b), l(456, 789)),

      s.event_close($.bus),
      s.event_send($.bus, s.ab(69)),
      s.sleep(1),
      s.expect_eq(x.agent_get($.a), l(123, 789, 42)),
      s.expect_eq(x.agent_get($.b), l(456, 789)),
    ),
  },
});
