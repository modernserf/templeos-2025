import { pkg } from "../pkg";
import { l, s, $, __, seq, u, x } from "../expr";
import { box, k } from "../value";
import { ensure } from "../process";

export const { rules: time, rulePrimitives: timePrim } = pkg("time", {
  t_date: {
    rule__params: l($.t),
    rule__body: s.enum(
      $.t,
      s.date(
        s.number(), // year
        s.number(), // month
        s.number(), // day
        s.number(), // hour
        s.number(), // minute
        s.number(), // second
        s.number(), // ms
      ),
    ),
  },
  t_timestamp: {
    rule__params: l(s.number()),
  },
  time__created: {
    db__schema: "field",
    file__name: "Time created",
    field__type: s.t_timestamp(),
    field__index: s.sorted(),
  },
  timestamp: {
    rule__params: l($.timestamp),
    rule__primitive: function* (it, ts) {
      if (it.unify(ts, k(Date.now()))) yield it.result();
    },
  },
  _date_timestamp: {
    rule__params: l($.date, $.timestamp),
    rule__primitive: function* (it, date, ts) {
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
  _timestamp_date: {
    rule__params: l($.timestamp, $.date),
    rule__primitive: function* (it, ts, date) {
      ensure(date, "box");
      if (date.id !== "date") return;
      const [year, month, day, hour, minute, second, ms] = date.args;
      ensure(year, "number");
      ensure(month, "number");
      ensure(day, "number");
      ensure(hour, "number");
      ensure(minute, "number");
      ensure(second, "number");
      ensure(ms, "number");
      const d = new Date(
        year.value,
        month.value - 1,
        day.value,
        hour.value,
        minute.value,
        second.value,
        ms.value,
      );
      const tsVal = d.getTime();
      if (it.unify(ts, k(tsVal))) yield it.result();
    },
  },
  date_timestamp: {
    rule__params: l($.date, $.ts),
    rule__body: s.if_then_else(
      s.number($.ts),
      s._date_timestamp($.date, $.ts),
      s._timestamp_date($.ts, $.date),
    ),
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
      s.date_timestamp(
        s.date(__, __, __, $.hour, $.minute, $.second, __),
        $.ts,
      ),
      s.html($.out, "span", l(), $.hour, ":", $.minute, ":", $.second),
    ),
  },
});
