import { test } from "../data/test_utils";
import { $, l, s, seq, __ } from "../expr";
import { k } from "../value";
import { pkg } from "../pkg";
import { ensure } from "../process";

export const { rules: stringRules, rulePrimitives: stringPrimitives } = pkg(
  "string",
  {
    string_number: {
      rule__params: l($.string, $.number),
      rule__primitive: function* (it, string, number) {
        if (string.tag == "string") {
          const parsed = Number(string.value);
          if (Number.isFinite(parsed)) {
            if (!it.unify(k(parsed), number)) return;
            yield it.result();
          }
        } else if (number.tag == "number") {
          const strung = String(number.value);
          if (!it.unify(k(strung), string)) return;
          yield it.result();
        }
      },
    },
    test__string_number: {
      test__group: "primitives",
      rule__params: l(),
      rule__body: seq(
        test.collect($.number, s.string_number("123", $.number), 123),
        test.collect($.string, s.string_number($.string, 123), "123"),
        test.fail(s.string_number("not a number", $.number)),
      ),
    },
    string_substring: {
      rule__params: l($.string, $.sub),
      rule__primitive: function* (it, string, sub) {
        ensure(string, "string");
        ensure(sub, "string");
        if (string.value.toLowerCase().match(sub.value.toLowerCase())) {
          yield it.result();
        }
      },
    },
    test__string_substring: {
      test__group: "primitives",
      rule__params: l(),
      rule__body: seq(
        test.ok(s.string_substring("foobar", "oo")),
        test.fail(s.string_substring("foobar", "baz")),
      ),
    },
    string_length: {
      rule__params: l($.len, $.str),
      rule__primitive: function* (it, len, str) {
        ensure(str, "string");
        if (it.unify(len, k(str.value.length))) yield it.result();
      },
    },
    string_char: {
      rule__params: l($.char, $.string, $.index),
      rule__primitive: function* (it, char, string, index) {
        ensure(string, "string");
        ensure(index, "number");
        if (it.unify(char, k(string.value.charAt(index.value))))
          yield it.result();
      },
    },
    string_char_code: {
      rule__params: l($.code, $.string, $.index),
      rule__primitive: function* (it, code, string, index) {
        ensure(string, "string");
        ensure(index, "number");
        if (it.unify(code, k(string.value.charCodeAt(index.value))))
          yield it.result();
      },
    },
    string_slice: {
      rule__params: l($.slice, $.string, $.from, $.to),
      rule__primitive: function* (it, slice, string, from, to) {
        ensure(string, "string");
        ensure(from, "number");
        ensure(to, "number");
        if (it.unify(slice, k(string.value.slice(from.value, to.value)))) {
          yield it.result();
        }
      },
    },
  },
);
