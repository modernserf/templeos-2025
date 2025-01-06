import { expect, test } from "vitest";
import { DB, q } from "./db";

test("basic queries", () => {
  const db = new DB();
  db.bulkInsert({
    foo: { value: 123 },
    bar: { baz: 456, quux: 789 },
  });
  const query = q("foo", "bar")
    .get("foo", "value", "value")
    .get("bar", "baz", "baz")
    .get("bar", "quux", "quux");
  expect(db.query1(query, { foo: "foo", bar: "bar" })).toEqual({
    foo: "foo",
    bar: "bar",
    value: 123,
    baz: 456,
    quux: 789,
  });
});

test("indexes", () => {
  const db = new DB();
  db.bulkInsert({
    foo: { value: 123, idx: "hello" },
    bar: { value: 456, idx: "hello" },
    baz: { value: 789, idx: "goodbye" },
  });
  db.createIndex("idx");
  const query = q("key") //
    .index("id", "idx", "key")
    .get("id", "value", "value");
  expect([...db.queryAll(query, { key: "hello" })]).toEqual([
    { id: "foo", key: "hello", value: 123 },
    { id: "bar", key: "hello", value: 456 },
  ]);
  expect([...db.queryAll(query, { key: "goodbye" })]).toEqual([
    { id: "baz", key: "goodbye", value: 789 },
  ]);
});

test("update", () => {
  const db = new DB();
  db.bulkInsert({
    foo: { value: 123, idx: "hello" },
    bar: { value: 456, idx: "hello" },
    baz: { value: 789, idx: "goodbye" },
  });
  db.createIndex("idx");
  let didChange = false;
  db.addEventListener(() => {
    didChange = true;
  });

  expect(didChange).toBe(false);

  const update = q("id", "key") //
    .update("id", "idx", "key");
  db.update(update, { id: "foo", key: "goodbye" });

  expect(didChange).toBe(true);

  const query = q("key") //
    .index("id", "idx", "key")
    .get("id", "value", "value");
  expect(new Set(db.queryAll(query, { key: "goodbye" }))).toEqual(
    new Set([
      { id: "foo", key: "goodbye", value: 123 },
      { id: "baz", key: "goodbye", value: 789 },
    ])
  );
});

test("delete", () => {
  const db = new DB();
  db.bulkInsert({
    foo: { value: 123, idx: "hello" },
    bar: { value: 456, idx: "hello" },
    baz: { value: 789, idx: "goodbye" },
  });
  db.createIndex("idx");

  const update = q("bar", "key")
    .deleteRecord("bar")
    .index("id", "idx", "key")
    .get("id", "value", "value");

  expect([...db.queryAll(update, { bar: "bar", key: "hello" })]).toEqual([
    { bar: "bar", id: "foo", value: 123, key: "hello" },
  ]);
});

test("insert", () => {
  const db = new DB();
  db.createIndex("idx");

  const update = q("rec").id("id").insert("id", "rec");
  db.update(update, { rec: { value: 123, idx: "hello" } });

  const query = q("key").index("id", "idx", "key").get("id", "value", "value");
  expect(db.query1(query, { key: "hello" })).toMatchObject({ value: 123 });
});
