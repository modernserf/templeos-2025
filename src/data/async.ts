import { Rec } from ".";
import { l, s, $, __, seq } from "../expr";
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
      s.spawn(__, seq($.left, s.send($.self, s.race(s.left(), $.id)))),
      s.spawn(__, seq($.right, s.send($.self, s.race(s.right(), $.id)))),
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
} satisfies Record<string, Rec>;
