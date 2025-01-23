import { expect, test } from "vitest";

import { DB } from "./db";
import { State } from "./state";
import { Rec } from "./schema";
import { R, k, v } from "./rule_builder";
import { flatMap } from "./iter";
import { rulePrimitiveRecs } from "./rule_primitive";

function init(data: Record<string, Rec>) {
  const db = new DB<Rec>();
  db.bulkInsert(rulePrimitiveRecs);
  db.bulkInsert(data);

  return State.root(db);
}

test("get 1", () => {
  const state = init({
    foo: { file__name: "hello" },
    bar: { file__name: "goodbye" },
  });

  const query = R() //
    .get(k("foo"), k("file__name"), v("value"))
    .build();

  const result = flatMap(function* (res) {
    if (res.tag === "result") yield res.state.resolve(v("value"));
  }, state.runRule(query, []));

  expect(Array.from(result)).toEqual(["hello"]);
});

test("get fields", () => {
  const state = init({
    foo: { file__name: "hello", file__description: "desc 1" },
    bar: { file__name: "goodbye", file__description: "desc 2" },
  });

  const query = R() //
    .get(k("foo"), v("field"), v("value"))
    .build();

  const result = flatMap(function* (res) {
    if (res.tag === "result")
      yield {
        field: res.state.resolve(v("field")),
        value: res.state.resolve(v("value")),
      };
  }, state.runRule(query, []));

  expect(Array.from(result)).toEqual([
    { field: "file__name", value: "hello" },
    { field: "file__description", value: "desc 1" },
  ]);
});

test("eq", () => {
  const state = init({
    foo: { file__name: "hello", file__description: "desc 1" },
    bar: { file__name: "goodbye", file__description: "desc 2" },
  });

  const query = R() //
    .get(k("foo"), v("field"), v("value"))
    .eq(v("value"), k("hello"))
    .build();

  const result = flatMap(function* (res) {
    if (res.tag === "result") {
      yield {
        field: res.state.resolve(v("field")),
        value: res.state.resolve(v("value")),
      };
    }
  }, state.runRule(query, []));

  expect(Array.from(result)).toEqual([{ field: "file__name", value: "hello" }]);
});

test("get index", () => {
  const state = init({
    history__window: {
      db__schema: "schema__field",
      field__index: "ref",
    },
    window_1: { file__name: "window 1" },
    window_2: { file__name: "window 2" },
    foo: { file__name: "foo", history__window: "window_1" },
    bar: { file__name: "bar", history__window: "window_1" },
    baz: { file__name: "baz", history__window: "window_2" },
  });

  const query = R()
    .get(v("id"), k("history__window"), k("window_1"))
    .get(v("id"), k("file__name"), v("name"))
    .build();

  const result = flatMap(function* (res) {
    if (res.tag === "result") {
      yield res.state.resolve(v("name"));
    }
  }, state.runRule(query, []));

  expect(Array.from(result)).toEqual(["bar", "foo"]);
});

test("db rule", () => {
  const state = init({
    foo: { file__name: "hello", file__description: "desc 1" },
    bar: { file__name: "goodbye", file__description: "desc 2" },
    get_description: R("id", "value") //
      .get(v("id"), k("file__description"), v("value"))
      .build(),
  });

  const query = R()
    .r("get_description", [k("foo"), v("description")])
    .build();

  const result = flatMap(function* (res) {
    if (res.tag === "result") {
      yield res.state.resolve(v("description"));
    }
  }, state.runRule(query, []));

  expect(Array.from(result)).toEqual(["desc 1"]);
});
