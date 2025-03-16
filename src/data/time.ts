import { pkg } from "../pkg";
import { l, s, $, __, seq, u, x } from "../expr";

export const time = pkg("time", {
  // TODO: timestamp, time-location, duration constructors
  t_timestamp: {
    file__name: "Time",
    rule__params: l($.t),
    rule__body: s.number($.t),
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
      s.is_number($.duration),
      u($.ms, $.duration),
      u($.ms, x($.duration)),
    ),
  },
  _test_conversions: {
    test__group: "time",
    rule__params: l(),
    rule__body: seq(
      s.expect_ok(u(x(s.milliseconds(2000)), x(s.seconds(2)))),
      s.expect_ok(u(x(s.hours(48)), x(s.days(2)))),
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
        s.view__string($.hour),
        s.view__string(":"),
        s.view__string($.minute),
        s.view__string(":"),
        s.view__string($.second),
      ),
    ),
  },
});
