import { expect, test } from "vitest";
import { asc, desc, Tree } from "./btree";

test("next tree", () => {
  const tree = new Tree<number, number>(asc);
  const COUNT = 100;

  for (let i = 0; i < COUNT; i++) {
    tree.insert(Math.floor(Math.random() * 1000), i);
  }

  const items = Array.from(tree.entries());
  const sorted = items.slice().sort(([k0], [k1]) => k0 - k1);

  expect(items.length).toBe(COUNT);
  expect(items).toEqual(sorted);
});

test("desc tree", () => {
  const tree = new Tree<number, number>(desc);
  const COUNT = 100;

  for (let i = 0; i < COUNT; i++) {
    tree.insert(Math.floor(Math.random() * 1000), i);
  }

  const items = Array.from(tree.entries());
  const sorted = items.slice().sort(([k0], [k1]) => k1 - k0);

  expect(items.length).toBe(COUNT);
  expect(items).toEqual(sorted);
});

test("range", () => {
  const tree = new Tree<number, number>(asc);
  const COUNT = 1000;

  for (let i = 0; i < COUNT; i++) {
    tree.insert(Math.floor(Math.random() * 1000), i);
  }

  const items = Array.from(tree.range(250, 750));
  const filtered = Array.from(tree.entries())
    .filter(([k]) => 250 <= k && k <= 750)
    .sort(([k0], [k1]) => k0 - k1);

  expect(items.map(([k]) => k)).toEqual(filtered.map(([k]) => k));
});

test("delete", () => {
  const tree = new Tree<number, number>(asc);
  const COUNT = 100;

  for (let i = 0; i < COUNT; i++) {
    tree.insert(Math.floor(Math.random() * 1000), i);
  }

  const initItems = Array.from(tree.entries());
  const toRemove = Array.from(tree.range(100, 109));
  for (const [k, v] of toRemove) {
    tree.delete(k, v);
  }

  const afterRemoval = Array.from(tree.entries());
  const filtered = initItems
    .filter(([k]) => !(100 <= k && k <= 109))
    .sort(([k0], [k1]) => k0 - k1);

  expect(afterRemoval).toEqual(filtered);
});
