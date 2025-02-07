import { expect, test } from "vitest";
import { s, exprOrd, Expr, __, $ } from "./expr";

function shuffle(xs: Expr[]): Expr[] {
  const array = xs.slice();
  for (let i = array.length - 1; i > 0; i--) {
    const randomIndex = Math.floor(Math.random() * (i + 1));
    [array[i], array[randomIndex]] = [array[randomIndex], array[i]];
  }
  return array;
}

test("var helper", () => {
  expect($.x).toEqual($("x"));
});

test("sort", () => {
  const items = [
    __,
    __,
    $.x,
    $.x,
    $.y,
    -123,
    123,
    "goodbye",
    "hello",
    "hello, world",
    s("hello"),
    s("hello", 123),
    s("hello", 123),
    s("hello", "goodbye"),
  ];

  for (let i = 0; i < 100; i++) {
    expect(shuffle(items).sort(exprOrd.cmp)).toEqual(items);
  }
});
