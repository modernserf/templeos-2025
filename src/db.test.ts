import { expect, test } from "vitest";
import { DB, whereValue } from "./db";
import { s } from "./expr";

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

test("ref index", () => {
  const db = init({
    parent__id: {
      db__schema: "schema__field",
      db__index: s("ref"),
    },
    root: { value: 1 },
    foo: { value: 123, parent__id: "root" },
    bar: { value: 456, parent__id: "root" },
    baz: { value: 789, parent__id: "foo" },
  });
  const idx = db.getIndex("parent__id")!;
  expect(idx).not.toBe(null);

  expect(Array.from(idx.tree.where(whereValue("root")))).toEqual([
    [{ entityId: "bar", value: "root" }, null],
    [{ entityId: "foo", value: "root" }, null],
  ]);

  db.update("bar", "parent__id", "foo");

  expect(Array.from(idx.tree.where(whereValue("root")))).toEqual([
    [{ entityId: "foo", value: "root" }, null],
  ]);
  expect(Array.from(idx.tree.where(whereValue("foo")))).toEqual([
    [{ entityId: "bar", value: "foo" }, null],
    [{ entityId: "baz", value: "foo" }, null],
  ]);
});
