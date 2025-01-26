import { expect, test } from "vitest";
import { Ord, numberOrd, Tree } from "./tree";

test("set", () => {
  const tree = new Tree(numberOrd);
  const keys = [10, 5, 1, 25, 20, 3];

  for (const [value, key] of keys.entries()) {
    expect(tree.set(key, value)).toBe(null);
  }

  expect(tree.size()).toEqual(keys.length);

  for (const [value, key] of keys.entries()) {
    expect(tree.get(key)).toEqual(value);
  }

  expect(tree.set(keys[1], -1)).toEqual(1);
  expect(tree.get(keys[1])).toEqual(-1);
  expect(tree.size()).toEqual(keys.length);
});

test("delete", () => {
  const tree = new Tree(numberOrd);
  const keys = [10, 5, 1, 25, 20, 3];

  for (const [value, key] of keys.entries()) {
    tree.set(key, value);
  }

  expect(tree.delete(69)).toBe(null);

  for (const [value, key] of keys.entries()) {
    expect(tree.size()).toBe(keys.length - value);
    expect(tree.delete(key)).toBe(value);
  }
});

test("complex keys", () => {
  type K = { a: number; b: number };
  const ord: Ord<K> = {
    cmp(left, right) {
      return numberOrd.cmp(left.a, right.a) || numberOrd.cmp(left.b, right.b);
    },
  };
  const tree = new Tree<K, null>(ord);
  const keys = [
    { a: 3, b: 3 },
    { a: 1, b: 10 },
    { a: 2, b: 25 },
    { a: 1, b: 5 },
    { a: 2, b: 1 },
    { a: 3, b: 10 },
    { a: 1, b: 25 },
  ];

  for (const key of keys) {
    tree.set(key, null);
  }

  const a1s = tree.where({
    order: "desc",
    cmp(item) {
      return numberOrd.cmp(1, item.a);
    },
  });

  expect(Array.from(a1s)).toEqual([
    [{ a: 1, b: 25 }, null],
    [{ a: 1, b: 10 }, null],
    [{ a: 1, b: 5 }, null],
  ]);
});
