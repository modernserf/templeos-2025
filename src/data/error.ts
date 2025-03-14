import { l, s, $ } from "../expr";
import { pkg } from "../pkg";

export const error = pkg("error", {
  unknown_message: {
    rule__params: l($.message),
    rule__body: s.throw(s.unknown_message($.message)),
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
