import { pkg } from "../pkg";
import { l, s, $, __, seq, u, x } from "../expr";

export const time = pkg("time", {
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
