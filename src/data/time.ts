import { pkg_ } from "../pkg";
import { l, s, $, __, seq, u, x } from "../expr";
import { box, k } from "../value";
import { ensure } from "../process";

export const { rules: time, rulePrimitives: timePrim } = pkg_("time", {
  timestamp: {
    rule__params: l($.timestamp),
    rule__primitive: function* (it, ts) {
      if (it.unify(ts, k(Date.now()))) yield it.result();
    },
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

  // TODO: timestamp, time-location, duration constructors
  t_timestamp: {
    rule__params: l(s.number()),
  },
  milliseconds: {
    rule__params: l($.ms, $.ms),
  },
  seconds: {
    rule__params: l($.ms, $.s),
    rule__body: s.product($.ms, $.s, 1000),
  },
  minutes: {
    rule__params: l($.ms, $.m),
    rule__body: s.product($.ms, $.m, 1000 * 60),
  },
  hours: {
    rule__params: l($.ms, $.h),
    rule__body: s.product($.ms, $.h, 1000 * 60 * 60),
  },
  days: {
    rule__params: l($.ms, $.m),
    rule__body: s.product($.ms, $.m, 1000 * 60 * 60 * 24),
  },
  ms_duration: {
    rule__params: l($.ms, $.duration),
    rule__body: s.if_then_else(
      s.number($.duration),
      u($.ms, $.duration),
      s.call($.duration, $.ms),
    ),
  },
  _test_conversions: {
    test__group: "time",
    rule__params: l(),
    rule__body: seq(
      s.expect_ok(u(x.milliseconds(2000), x.seconds(2))),
      s.expect_ok(u(x.hours(48), x.days(2))),
    ),
  },

  view__time: {
    rule__params: l($.out, $.ts),
    rule__body: seq(
      // TODO: adjust for timezone
      s.timestamp_date(
        $.ts,
        s.date(__, __, __, $.hour, $.minute, $.second, __),
      ),
      s.html(
        $.out,
        "span",
        l(),
        x.view__string($.hour),
        x.view__string(":"),
        x.view__string($.minute),
        x.view__string(":"),
        x.view__string($.second),
      ),
    ),
  },
});
