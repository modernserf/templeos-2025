import { Rec } from ".";
import { l, s, $, __, u, seq } from "../expr";
import { test } from "./test_utils";

export const core = {
  // types
  any_type: {
    db__schema: "type",
    file__name: "Any",
    db__default_value: l(),
    db__default_view: "view__any_type",
    rule__params: l($.item),
    rule__body: s.ok(),
  },
  string: {
    db__schema: "type",
    file__name: "String",
    db__default_value: "",
    db__default_view: "view__string_type",
    rule__params: l($.item),
    rule__body: s.type_value(s.string(), $.item),
  },
  number: {
    db__schema: "type",
    file__name: "Number",
    db__default_value: 0,
    rule__params: l($.item),
    rule__body: s.type_value(s.number(), $.item),
  },
  box: {
    db__schema: "type",
    file__description: l(
      "A box is a data structure with a tag and a list of values.",
    ),
    db__default_value: l(),
    rule__params: l($.item),
    rule__body: s.type_value(s.box(), $.item),
  },
  list: {
    db__schema: "type",
    file__description: l(
      "A list is a box with the empty string for a tag and an arbitrary number of values.",
    ),
    db__default_value: l(),
    rule__params: l($.item),
    rule__body: s.box_tag_list($.item, "", __),
  },
  var: {
    db__schema: "type",
    rule__params: l($.item),
    rule__body: s.type_value(s.var(), $.item),
  },
  time: {
    db__schema: "type",
    file__name: "Time",
    db__default_value: 0,
    db__default_view: "view__time_type",
  },
  ref: {
    db__schema: "type",
    file__name: "Ref",
    file__description: l("A record id."),
    db__default_value: "",
    db__default_view: "view__ref",
    // db__type: s.number(),
  },
  multi_ref: {
    db__schema: "type",
    file__name: "Multi ref",
    file__description: l(
      "A list of record ids, which are indexed individually.",
    ),
    db__default_value: l(),
    // db__type: s("list,s.number()),
  },
  // schemas
  // TODO: calling schema on record ID should check conformance
  schema: {
    db__schema: "schema",
    file__name: "Schema",
    file__description: l("Schema for schema definitions"),
    db__fields: l(s.field("db__fields")),
  },
  field: {
    db__schema: "schema",
    file__name: "Field",
    file__description: l("Schema for field definitions"),
    db__fields: l(s.field_optional("db__index")),
  },
  any_record: {
    db__schema: "schema",
    file__name: "Any Record",
    file__description: l("Fallback schema for any type of record"),
    db__fields: l(),
  },
  type: {
    db__schema: "schema",
    file__name: "Type",
    file__description: l("Schema for type definitions"),
    db__fields: l(s.field("db__type")),
  },
  form: {
    db__schema: "schema",
    file__name: "Form",
    file__description: l("A self rendering form UI"),
    db__fields: l(s.field("rule__params"), s.field("rule__body")),
  },
  // fields
  // TODO: foo_field($.value, $.id) -> value_record_field($.value, $.id, "foo_field")
  db__schema: {
    db__schema: "field",
    file__name: "DB Schema",
    file__description: l("schema used to validate & render this record"),
    // db__type: s.ref( "schema" as const),
    db__type: "ref",
    db__index: s.ref(),
  },
  db__fields: {
    db__schema: "field",
    file__name: "DB Fields",
    // db__type: s(
    //   "list",
    //   s(
    //     "oneof",
    //     s.box( "field", fieldRef),
    //     s.box( "field__optional", fieldRef),
    //     s.box( "field__default", fieldRef, s.any())
    //   )
    // ),
  },
  db__type: {
    db__schema: "field",
    file__name: "Field type",
    db__type: "ref",
    // db__type: s.ref( "schema" as const),
    db__index: s.ref(),
  },
  db__index: {
    db__schema: "field",
    file__name: "Field index",
    file__description: l(
      "If set, the field is indexed using an index of this type.",
    ),
    // db__type: s(
    //   "oneof",
    //   s.box( "ref"),
    //   s.box( "multiRef"),
    //   s.box( "sorted"),
    //   s.box( "unique")
    // ),
    db__index: s.sorted(),
  },
  db__default_view: {
    db__schema: "field",
    file__name: "Default view",
    file__description: l(
      "the default view for this entity ",
      "(e.g. a type, field or schema).",
    ),
  },
  db__default_value: {
    db__schema: "field",
    file__name: "Default value",
  },
  time__created: {
    db__schema: "field",
    file__name: "Time created",
    db__type: "time",
    db__index: s.sorted(),
  },
  rule__params: {
    db__schema: "field",
    file__name: "Rule params",
    // db__type: s.list( s.any()),
  },
  rule__rest_params: {
    db__schema: "field",
    file__name: "Rule rest params",
  },
  rule__body: {
    db__schema: "field",
    file__name: "Rule body",
    db__default_view: "view__rule__body",
    // db__type: s.box(),
  },
  file__name: {
    db__schema: "field",
    file__name: "File name",
    file__description: l("field used for name in tab header & file explorer"),
    db__type: "string",
  },
  file__description: {
    db__schema: "field",
    file__name: "File description",
    file__description: l("describes the content of the record"),
    db__type: "text",
  },
  view__schema: {
    db__schema: "field",
    file__name: "View for schema",
    file__description: l("the schema that this view is supposed to render"),
    db__type: "ref",
    // db__type: s.ref( "schema" as const),
    db__index: s.ref(),
  },
  // utilities
  // TODO: check performance on this, maybe want native impl for this
  append_box_prefix: {
    file__description: l(
      "prepend elements of prefix to box, keeping box's tag",
    ),
    rule__params: l($.updated, $.target, $.left),
    rule__body: seq(
      s.box_tag_list($.target, $.tag, $.right),
      s.append_left_right($.next, $.left, $.right),
      s.box_tag_list($.updated, $.tag, $.next),
    ),
  },
  append_box_suffix: {
    file__description: l("append elements of suffix to box, keeping box's tag"),
    rule__params: l($.updated, $.target, $.right),
    rule__body: seq(
      s.box_tag_list($.target, $.tag, $.left),
      s.append_left_right($.next, $.left, $.right),
      s.box_tag_list($.updated, $.tag, $.next),
    ),
  },
  call: {
    rule__params: l($.id),
    rule__rest_params: $.args,
    rule__body: seq(s.box_tag_list($.callable, $.id, $.args), $.callable),
  },
  apply: {
    rule__params: l($.target, $.args),
    rule__body: seq(
      s.append_box_suffix($.callable, $.target, $.args),
      $.callable,
    ),
  },
  preply: {
    rule__params: l($.target, $.args),
    rule__body: seq(
      s.append_box_prefix($.callable, $.target, $.args),
      $.callable,
    ),
  },
  empty: {
    rule__params: l($.box),
    rule__body: s.box_tag_list($.box, __, l()),
  },
  nonempty: {
    rule__params: l($.box),
    rule__body: s.if_then_else(
      s.box_tag_list($.box, __, l()),
      s.fail(),
      s.ok(),
    ),
  },
  cond: {
    file__description: l("pattern match on a list of (if, then) pairs"),
    rule__params: l(l($.if, $.then)),
    rule__rest_params: $.else,
    rule__body: s.if_then_else(
      $.if,
      $.then,
      s.if_then_else(u($.else, l()), s.fail(), s.apply(s.cond(), $.else)),
    ),
  },
  test__cond: {
    test__group: "core",
    rule__params: l(),
    rule__body: seq(
      test.collect(
        $.result,
        s.cond(
          l(u(123, 456), u($.result, "foo")),
          l(u(456, 456), u($.result, "bar")),
          l(s.ok(), u($.result, "baz")),
        ),
        "bar",
      ),
      test.collect(
        $.result,
        s.cond(
          l(u(123, 789), u($.result, "foo")),
          l(u(456, 789), u($.result, "bar")),
          l(s.ok(), u($.result, "baz")),
        ),
        "baz",
      ),
      test.fail(
        s.cond(
          l(u(123, 789), u($.result, "foo")),
          l(u(456, 789), u($.result, "bar")),
        ),
      ),
    ),
  },
  match: {
    rule__params: l($.pattern, $.match),
    rule__rest_params: $.rest,
    rule__body: s.if_then_else(
      u($.pattern, $.match),
      s.ok(),
      seq(s.nonempty($.rest), s.apply(s.match($.pattern), $.rest)),
    ),
  },
  match_cond: {
    rule__params: l($.pattern, l($.match, $.then)),
    rule__rest_params: $.rest,
    rule__body: s.if_then_else(
      u($.pattern, $.match),
      $.then,
      seq(s.nonempty($.rest), s.apply(s.match_cond($.pattern), $.rest)),
    ),
  },
  test__match: {
    test__group: "core",
    rule__params: l(),
    rule__body: seq(
      test.collect(
        $.result,
        s.match(s.foo($.result), s.foo(123), s.bar(456)),
        123,
      ),
      test.collect(
        $.result,
        s.match(s.bar($.result), s.foo(123), s.bar(456)),
        456,
      ),
      test.fail(s.match(s.baz($.result), s.foo(123), s.bar(456))),
    ),
  },
  test__match_cond: {
    test__group: "core",
    rule__params: l(),
    rule__body: seq(
      test.collect(
        $.result,
        s.match_cond(
          s.foo($.pat),
          l(s.foo(123), u($.result, l($.pat))),
          l(s.bar(456), u($.result, l($.pat, $.pat))),
          l(__, u($.result, l())),
        ),
        l(123),
      ),

      test.collect(
        $.result,
        s.match_cond(
          s.bar($.pat),
          l(s.foo(123), u($.result, l($.pat))),
          l(s.bar(456), u($.result, l($.pat, $.pat))),
          l(__, u($.result, l())),
        ),
        l(456, 456),
      ),

      test.collect(
        $.result,
        s.match_cond(
          s.baz($.pat),
          l(s.foo(123), u($.result, l($.pat))),
          l(s.bar(456), u($.result, l($.pat, $.pat))),
          l(__, u($.result, "ok")),
        ),
        "ok",
      ),

      test.fail(
        s.match_cond(
          s.baz($.pat),
          l(s.foo(123), u($.result, l($.pat))),
          l(s.bar(456), u($.result, l($.pat, $.pat))),
        ),
      ),
    ),
  },
  each_item_do: {
    file__description: l(
      "for each item in collection, run do block but discard results (e.g. for side effects). succeed if collection is empty.",
    ),
    rule__params: l($.collection, $.item, $.do),
    rule__body: s.if_then_else(
      u($.collection, l()),
      s.ok(),
      s.collect(__, seq(s.list_item($.collection, $.item), $.do), __),
    ),
  },

  if_var: {
    file__description: l("if arg is var, run body"),
    rule__params: l($.arg, $.body),
    rule__body: s.if_then_else(s.var($.arg), $.body, s.ok()),
  },
  test__var: {
    test__group: "core",
    rule__params: l(),
    rule__body: seq(
      test.ok(s.var($.x)),
      test.ok(s.var(__)),
      test.fail(s.var(123)),
    ),
  },

  test__typechecks: {
    test__group: "core",
    rule__params: l(),
    rule__body: seq(
      test.ok(s.string("hello")),
      test.ok(s.number(123)),
      test.ok(s.box(l())),
      test.ok(s.box(s.atom())),
      test.fail(s.string(s.atom())),
      test.fail(s.number("123")),
      test.fail(s.box("")),
    ),
  },
  expr_value: {
    rule__params: l($.expr, $.value),
    rule__body: seq(
      s.type_value($.type, $.value),
      s.match_cond(
        $.type,
        l(s.var(), seq(s.var_name($.value, $.name), u($.expr, s.var($.name)))),
        l(s.number(), u($.expr, s.number($.value))),
        l(s.string(), u($.expr, s.string($.value))),
        l(
          s.box(),
          seq(
            s.box_tag_list($.value, $.tag, $.list_2),
            u($.expr, s.box($.tag, $.list_2)),
          ),
        ),
      ),
    ),
  },

  // expr
  expr: {
    file__description: l("evaluate box tree as expression"),
    rule__params: l($.out, $.expr),
    rule__body: seq(
      s.collect_item_in(
        $.changes,
        l($.i, $.rendered),
        seq(
          s.value_box_index($.arg, $.expr, $.i),
          s.box($.arg),
          s.cond(
            l(u(s.expr($.next), $.arg), s.expr($.rendered, $.next)),
            l(
              s.box_tag_list($.arg, "children", $.children),
              s.apply(s.children($.rendered), $.children),
            ),
            // TODO:  quote
          ),
        ),
      ),
      s.updated_box_changelist($.updated, $.expr, $.changes),

      s.preply($.updated, l($.out)),
    ),
  },
  children: {
    rule__params: l($.out),
    rule__rest_params: $.children,
    rule__body: s.collect_item_in(
      $.out,
      $.rendered,
      seq(
        s.value_box_index($.value, $.children, __), //
        s.expr($.rendered, $.value),
      ),
    ),
  },

  test__expr: {
    test__group: "core",
    rule__params: l(),
    rule__body: seq(
      test.collect(
        $.result,
        s.expr($.result, s.append_left_right(l(1, 2, 3), l(4, 5))),
        l(1, 2, 3, 4, 5),
      ),

      test.collect(
        $.result,
        s.expr(
          $.result,
          s.append_left_right(
            s.expr(s.append_left_right(l(1, 2), l(3))),
            l(4, 5),
          ),
        ),
        l(1, 2, 3, 4, 5),
      ),

      test.collect(
        $.result,
        s.expr(
          $.result,
          s.append_left_right(s.children(s("=", 1), s("=", 2)), l(3, 4, 5)),
        ),
        l(1, 2, 3, 4, 5),
      ),
    ),
  },

  pipe: {
    rule__params: l($.out, $.in, $.first),
    rule__rest_params: $.rest,
    rule__body: s.if_then_else(
      s.empty($.rest),
      s.preply($.first, l($.out, $.in)),
      seq(
        s.preply($.first, l($.next, $.in)),
        s.apply(s.pipe($.out, $.next), $.rest),
      ),
    ),
  },
  test__pipe: {
    test__group: "core",
    rule__params: l(),
    rule__body: seq(
      test.collect(
        $.result,
        s.pipe(
          $.result,
          l(1, 2),
          s.append_left_right(l(3)),
          s.append_left_right(l(4, 5)),
        ),

        l(1, 2, 3, 4, 5),
      ),
    ),
  },

  // db
  record_field_value: {
    rule__params: l($.id, $.field, $.value),
    rule__body: s.cond(
      l(s.nonvar($.id), s.value_record_field($.value, $.id, $.field)),
      l(s.nonvar($.value), s.record_index_field($.id, $.value, $.field)),
      l(s.ok(), s.throw(s.not_yet_implemented("record_field_value modes"))),
    ),
  },

  view__any_record: {
    file__name: "Default viewer",
    view__schema: "any_record",
    rule__params: l($.out, $.id, $.state),
    rule__body: s.view__string($.out, "TODO: views"),
  },
} satisfies Record<string, Rec>;
