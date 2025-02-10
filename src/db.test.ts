import { expect, test } from "vitest";
import { DB } from "./db";

type Id = string;
type Rec = Record<string, unknown>;

function init(data: Record<Id, Rec>): DB<Rec> {
  const db = new DB<Rec>();
  for (const [id, record] of Object.entries(data)) {
    db.insert(id, record);
  }
  return db;
}

test("get", () => {
  const db = init({
    foo: { value: 123 },
    bar: { baz: 456, quux: 789 },
  });

  expect(db.get("foo")).toEqual({ value: 123 });
  expect(db.get("bar")).toEqual({ baz: 456, quux: 789 });
  expect(db.get("baz")).toEqual(null);
});

test("keys", () => {
  const db = init({
    foo: { value: 123 },
    bar: { baz: 456, quux: 789 },
  });

  expect(Array.from(db.keys())).toEqual(["foo", "bar"]);
});

test("update", () => {
  const db = init({
    foo: { value: 123 },
    bar: { baz: 456, quux: 789 },
  });
  db.update("bar", "baz", 321);
  db.update("bar", "xyzzy", 999);

  expect(db.get("bar")).toEqual({ baz: 321, quux: 789, xyzzy: 999 });
});
