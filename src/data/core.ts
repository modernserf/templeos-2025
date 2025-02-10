import { Rec, Field } from ".";
import { l, s, r, $, u, __, view, Expr } from "../expr";
import { db } from "./db";
import { test } from "./test_utils";

export const dbf = {
  field: (field: Field) => s("field", field),
  field_optional: (field: Field) => s("field_optional", field),
};

export const rootView = (output: Expr) =>
  r(
    s.collect(
      $.view,
      s.fork(
        view.app_menu($.view),
        r(s.db__schema($.window, "window"), view.window($.window, $.view)),
      ),
      $.content,
    ),
    u(s.Html("div", l(), $.content), output),
  );

export const core = {
  // types
  any_type: {
    db__schema: "type",
    file__name: "Any",
    db__default_value: l(),
    db__default_view: "view__any_type",
  },
  string: {
    db__schema: "type",
    file__name: "String",
    db__default_value: "",
    db__default_view: "view__string_type",
    rule__params: l($.item),
    rule__body: s.value_type($.item, s.string()),
  },
  number: {
    db__schema: "type",
    file__name: "Number",
    db__default_value: 0,
    rule__params: l($.item),
    rule__body: s.value_type($.item, s.number()),
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
  any_record: {
    db__schema: "schema",
    file__name: "Any Record",
    file__description: l("Fallback schema for any type of record"),
    db__fields: l(),
  },
  schema: {
    db__schema: "schema",
    file__name: "Schema",
    file__description: l("Schema for schema definitions"),
    db__fields: l(dbf.field("db__fields")),
  },
  type: {
    db__schema: "schema",
    file__name: "Type",
    file__description: l("Schema for type definitions"),
    db__fields: l(dbf.field("db__type")),
  },
  field: {
    db__schema: "schema",
    file__name: "Field",
    file__description: l("Schema for field definitions"),
    db__fields: l(dbf.field_optional("db__index")),
  },
  form: {
    db__schema: "schema",
    file__name: "Form",
    file__description: l("A self rendering form UI"),
    db__fields: l(dbf.field("rule__params"), dbf.field("rule__body")),
  },

  // fields
  time__created: {
    db__schema: "field",
    file__name: "Time created",
    db__type: "time",
    db__index: s.sorted(),
  },
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
  // rules
  test__unknown_rule: {
    test__group: "primitives",
    rule__params: l(),
    rule__body: r(
      test.throw(s.doesNotExist(123), s.unknown_rule("doesNotExist")),
    ),
  },
  test__invalid_clause: {
    test__group: "primitives",
    rule__params: l(),
    rule__body: r(test.throw(r(1), s.expected_type("box", 1))),
  },
  test__not_callable_example: {
    db__schema: "any_record",
  },
  test__not_callable: {
    test__group: "primitives",
    rule__params: l(),
    rule__body: r(
      test.throw(
        s.test__not_callable_example(),
        s.invalid_rule("test__not_callable_example"),
      ),
    ),
  },
  test__wrong_args: {
    test__group: "primitives",
    rule__params: l(),
    rule__body: r(
      test.throw(s("=", 123), s.expected_received(u(__, __), s("=", 123))),
    ),
  },
  "%": {
    rule__params: l(),
    rule__rest_params: $.comments,
    rule__body: r(),
  },
  // primitives
  fail: {
    rule__params: l(),
  },
  test__fail: {
    test__group: "primitives",
    rule__params: l(),
    rule__body: test.fail(s.fail()),
  },
  ok: {
    rule__params: l(),
  },
  test__ok: {
    test__group: "primitives",
    rule__params: l(),
    rule__body: test.ok(s.ok()),
  },
  "=": {
    rule__params: l($.left, $.right),
  },
  "test__=": {
    test__group: "primitives",
    rule__params: l(),
    rule__body: r(
      test.ok(u(1, 1)),
      test.ok(u(1, __)),
      test.collect(
        l($.left, $.right),
        u(l($.left, 456), l(123, $.right)),
        l(123, 456),
      ),
    ),
  },
  "/=": {
    rule__params: l($.left, $.right),
  },
  "test__/=": {
    test__group: "primitives",
    rule__params: l(),
    rule__body: r(
      test.ok(s("/=", 1, 2)),
      test.ok(s("/=", 1, "foo")),
      test.fail(s("/=", 1, 1)),

      test.ok(s("/=", 1, $.x)),
      test.collect($.x, r(s("/=", 1, $.x), u($.x, 2)), 2),
      test.fail(s("/=", 1, $.x), u($.y, 1), u($.x, $.y)),

      test.ok(s("/=", s.foo(1), s.foo($.x))),
      test.ok(s("/=", s.foo(1), s.foo($.x)), u($.x, 2)),
      test.fail(s("/=", s.foo(1), s.foo($.x)), u($.x, 1)),
    ),
  },
  do: {
    rule__params: l(),
    rule__rest_params: $.items,
  },
  test__do: {
    test__group: "primitives",
    rule__params: l(),
    rule__body: r(
      test.ok(r()),
      test.ok(r(s.ok())),
      test.fail(r(s.ok(), s.fail())),

      test.fail(r(u($.x, 1), u($.x, 2))),
    ),
  },
  fork: {
    rule__params: l(),
    rule__rest_params: $.items,
  },
  test__fork: {
    test__group: "primitives",
    rule__params: l(),
    rule__body: r(
      test.fail(s("fork")),
      test.ok(s("fork", s.ok())),
      test.ok(s("fork", s.ok(), s.fail())),

      test.collect($.x, s("fork", u($.x, 1), u($.x, 2)), 1, 2),
    ),
  },
  "¬": {
    rule__params: l($.goal),
  },
  "test__¬": {
    test__group: "primitives",
    rule__params: l(),
    rule__body: r(test.fail(s("¬", s.ok())), test.ok(s("¬", s.fail()))),
  },
  if_then_else: {
    rule__params: l($.if, $.then, $.else),
  },
  test__if_then_else: {
    test__group: "primitives",
    rule__params: l(),
    rule__body: r(
      test.collect(
        $.result,
        s.if_then_else(s.ok(), u($.result, 123), u($.result, 456)),
        123,
      ),
      test.collect(
        $.result,
        s.if_then_else(s.fail(), u($.result, 123), u($.result, 456)),
        456,
      ),
      test.collect(
        $.result,
        s.if_then_else(
          s.ok(),
          s.fork(u($.result, 123), u($.result, 789)),
          u($.result, 456),
        ),
        123,
        789,
      ),
      test.collect(
        $.result,
        s.if_then_else(
          s.list_item(l(123, 789), $.item),
          u($.result, s.item($.item)),
          u($.result, 456),
        ),
        s.item(123),
        s.item(789),
      ),
      test.collect(
        $.result,
        s.if_then_else(
          s.list_item(l(), $.item),
          u($.result, s.item($.item)),
          u($.result, s.empty()),
        ),
        s.empty(),
      ),
    ),
  },
  call: {
    rule__params: l($.id),
    rule__rest_params: $.args,
  },
  test__call: {
    test__group: "primitives",
    rule__params: l(),
    rule__body: r(test.collect($.result, s.call("=", 123, $.result), 123)),
  },
  throw: {
    rule__params: l($.error),
  },
  test__throw: {
    test__group: "primitives",
    rule__params: l(),
    rule__body: r(test.throw(s.throw(s.foo(123)), s.foo(123))),
  },
  try_error_catch: {
    rule__params: l($.try, $.error, $.catch),
  },
  test__try_error_catch: {
    test__group: "primitives",
    rule__params: l(),
    rule__body: r(
      test.collect(
        $.result,
        s.try_error_catch(
          s.throw(s.foo(123)),
          s.foo($.arg),
          u($.result, $.arg),
        ),
        123,
      ),

      test.throw(
        s.try_error_catch(
          s.throw(s.foo(123)),
          s.bar($.arg),
          u($.result, $.arg),
        ),
        s.foo(123),
      ),
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
    test__group: "rules",
    rule__params: l(),
    rule__body: r(
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
      r(s.nonempty($.rest), s.apply(s.match($.pattern), $.rest)),
    ),
  },
  match_cond: {
    rule__params: l($.pattern, l($.match, $.then)),
    rule__rest_params: $.rest,
    rule__body: s.if_then_else(
      u($.pattern, $.match),
      $.then,
      r(s.nonempty($.rest), s.apply(s.match_cond($.pattern), $.rest)),
    ),
  },
  test__match: {
    test__group: "rules",
    rule__params: l(),
    rule__body: r(
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
    test__group: "rules",
    rule__params: l(),
    rule__body: r(
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
      s.collect(__, r(s.list_item($.collection, $.item), $.do), __),
    ),
  },
  collect_empty: {
    rule__params: l($.pattern, $.goal, $.result),
    rule__body: s.if_then_else(
      s.collect($.pattern, $.goal, $.result),
      s.ok(),
      u($.result, l()),
    ),
  },

  if_var: {
    file__description: l("if arg is var, run body"),
    rule__params: l($.arg, $.body),
    rule__body: s.if_then_else(s.var($.arg), $.body, r()),
  },

  test__value_type: {
    test__group: "rules",
    rule__params: l(),
    rule__body: r(
      test.ok(s.value_type(__, s.var())),
      test.ok(s.value_type($.x, s.var())),
      test.ok(s.value_type(123, s.number())),
      test.ok(s.value_type("hello", s.string())),
      test.ok(s.value_type(s.id(123, "hello"), s.box())),
      test.ok(s.value_type(l(__, __), s.box())),

      u($.y, 123),
      test.ok(s.value_type($.y, s.number())),
    ),
  },
  var: {
    rule__params: l($.item),
    rule__body: s.value_type($.item, s.var()),
  },
  test__var: {
    test__group: "rules",
    rule__params: l(),
    rule__body: r(
      test.ok(s.var($.x)),
      test.ok(s.var(__)),
      test.fail(s.var(123)),
    ),
  },
  nonvar: {
    rule__params: l($.item),
    rule__body: r(s.value_type($.item, $.type), s("/=", $.type, s.var())),
  },
  test__nonvar: {
    test__group: "rules",
    rule__params: l(),
    rule__body: r(
      test.ok(s.nonvar(123)),
      test.ok(s.nonvar(l($.x))),
      test.fail(s.nonvar(__)),
      test.fail(s.nonvar($.x)),
    ),
  },
  test__typechecks: {
    test__group: "rules",
    rule__params: l(),
    rule__body: r(
      test.ok(s.string("hello")),
      test.ok(s.number(123)),
      test.ok(s.box(l())),
      test.ok(s.box(s.atom())),
      test.fail(s.string(s.atom())),
      test.fail(s.number("123")),
      test.fail(s.box("")),
    ),
  },
  constrain_type: {
    rule__params: l($.item, $.type),
    rule__body: s.value_constraint($.item, s.value_type($.item, $.type)),
  },
  test__constraints: {
    test__group: "rules",
    rule__params: l(),
    rule__body: r(
      test.ok(r(s.constrain_type($.x, s.string()), u($.x, "hello"))),
      test.fail(r(s.constrain_type($.x, s.string()), u($.x, 123))),
      // odd that this fails here but not in the other test
      test.fail(
        s.constrain_type($.x, s.string()),
        s.constrain_type($.x, s.number()),
      ),
      test.fail(
        s.constrain_type($.x, s.number()),
        s.constrain_type($.x, s.string()),
        u($.x, 1),
      ),
      test.fail(
        s.constrain_type($.x, s.string()),
        s.constrain_type($.x, s.number()),
        u($.x, 1),
      ),
      test.fail(
        s.constrain_type($.x, s.string()),
        s.constrain_type($.y, s.number()),
        u($.x, $.y),
        u($.y, 1),
      ),
    ),
  },
  value_expr: {
    rule__params: l($.value, $.expr),
    rule__body: r(
      s.value_type($.value, $.type),
      s.match_cond(
        $.type,
        l(s.var(), r(s.var_name($.value, $.name), u($.expr, s.var($.name)))),
        l(s.number(), u($.expr, s.number($.value))),
        l(s.string(), u($.expr, s.string($.value))),
        l(
          s.box(),
          r(
            s.box_tag_list($.value, $.tag, $.list_2),
            u($.expr, s.box($.tag, $.list_2)),
          ),
        ),
      ),
    ),
  },
  view__id_field: {
    rule__params: l($.entity, $.field, $.out),
    rule__body: s.cond(
      l(
        s.get_field_value($.field, "db__default_view", $.view),
        s.call($.view, $.entity, $.field, $.out),
      ),
      l(
        r(
          db.get($.field, "db__type", $.type),
          db.get($.type, "db__default_view", $.view),
        ),
        s.call($.view, $.entity, $.field, $.out),
      ),
      l(
        db.get("any_type", "db__default_view", $.view),
        s.call($.view, $.entity, $.field, $.out),
      ),
    ),
  },

  // type views
  view__any_type: {
    rule__params: l($.id, $.field, $.out),
    rule__body: r(db.get($.id, $.field, $.value), view.expr($.value, $.out)),
  },
  view__string_type: {
    rule__params: l($.id, $.field, $.out),
    rule__body: r(db.get($.id, $.field, $.value), view.string($.value, $.out)),
  },
  view__time_type: {
    rule__params: l($.id, $.field, $.out),
    rule__body: r(db.get($.id, $.field, $.ts), view.time($.ts, $.out)),
  },
  view__ref: {
    rule__params: l($.id, $.field, $.out),
    rule__body: r(
      db.get($.id, $.field, $.value),
      view.file_link($.value, $.out),
    ),
  },

  view__rule__body: {
    rule__params: l($.id, $.field, $.out),
    rule__body: r(db.get($.id, $.field, $.body), view.expr($.body, $.out)),
  },

  // schema views
  view__any_record_fields: {
    rule__params: l($.id, $.state, $.out),
    rule__body: view.render(
      view.table(
        l(),
        s.children(
          view.table_header(
            l(),
            s.children(view.string("Field"), view.string("Value")),
          ),
        ),
        s.children(
          view.table_row(view.string("id"), view.string($.id)),
          view.iter(
            s.get_field_value($.id, $.field, __),
            l(
              view.table_row(
                l(),
                s.children(
                  view.file_link($.field),
                  view.id_field($.id, $.field),
                ),
              ),
            ),
          ),
        ),
      ),
      $.out,
    ),
  },
  view__any_record_refs: {
    rule__params: l($.id, $.state, $.out),
    rule__body: view.render(
      view.table(
        l(),
        s.children(
          view.table_header(
            l(),
            s.children(view.string("Field"), view.string("Ref")),
          ),
        ),
        s.children(
          view.iter(
            r(
              s.fork(s.db__index($.f, s.ref()), s.db__index($.f, s.multiRef())),
              s.get_field_value($.ref, $.f, $.id),
            ),
            l(
              view.table_row(
                l(),
                s.children(view.file_link($.f), view.file_link($.ref)),
              ),
            ),
          ),
        ),
      ),
      $.out,
    ),
  },

  view__any_record: {
    file__name: "Default viewer",
    view__schema: "any_record",
    rule__params: l($.id, $.state, $.out),
    rule__body: view.render(
      view.column(
        l(),
        s.children(
          view.any_record_fields($.id, $.state),
          view.any_record_refs($.id, $.state),
        ),
      ),
      $.out,
    ),
  },

  view__any_record_add_field: {
    rule__params: l($.id, $.out),
    rule__body: r(
      s.collect(
        s.option($.field_id, $.field_name),
        r(
          s.db__schema($.field_id, "field"),
          s.file__name($.field_id, $.field_name),
        ),
        $.fields,
      ),
      view.menu(
        "Add field...",
        $.fields,
        l(s.change($.new_field_id), s._add_field($.id, $.new_field_id)),
        $.out,
      ),
    ),
  },
  view__any_record_edit: {
    file__name: "Default editor",
    view__schema: "any_record",
    rule__params: l($.id, $.state, $.out),
    rule__body: r(
      s.collect(
        $.row,
        s.fork(
          r(
            view.string("id", $.field_label),
            view.string($.id, $.field_value),
            view.table_row(l(), l($.field_label, $.field_value), $.row),
          ),
          r(
            s.get_field_value($.id, $.field, $.value),
            view.button(
              l(s.class("DeleteExpr")),
              "×",
              l(s.click(__), db.with_tx($.tx, db.delete($.tx, $.id, $.field))),
              $.button,
            ),
            view.file_link($.field, $.link),
            view.row(l(), l($.button, $.link), $.field_label),
            view.expr_edit(
              $.value,
              l(
                $.next,
                db.with_tx($.tx, db.update($.tx, $.id, $.field, $.next)),
              ),
              $.field_value,
            ),
            view.table_row(l(), l($.field_label, $.field_value), $.row),
          ),
        ),
        $.rows,
      ),
      view.string("Field", $.k),
      view.string("Value", $.v),
      view.table_header(l(), l($.k, $.v), $.header),
      view.table(l(), l($.header), $.rows, $.table),
      view.any_record_add_field($.id, $.add_menu),
      view.column(l(), l($.table, $.add_menu), $.out),
    ),
  },
  view__schema_field: {
    rule__params: l($.field_def, $.out),
    rule__body: s.match_cond(
      $.field_def,
      l(s.field($.field_id), view.file_link($.field_id, $.out)),
      l(
        s.field_optional($.field_id),
        view.render(
          view.row(
            l(),
            s.children(view.file_link($.field_id), view.string("(optional)")),
          ),
          $.out,
        ),
      ),
    ),
  },
  view__schema_: {
    file__name: "Schema viewer",
    view__schema: "schema",
    rule__params: l($.id, $.state, $.out),
    rule__body: view.render(
      view.column(
        l(),
        s.children(
          view.string("Fields:"),
          view.iter(
            r(s.db__fields($.id, $.fields), s.list_item($.fields, $.field)),
            l(view.schema_field($.field)),
          ),
          view.spacer("1rem"),
          view.string("Views:"),
          view.iter(s.view__schema($.view, $.id), l(view.file_info($.view))),
          view.spacer("1rem"),
          view.string("Items:"),
          view.iter(s.db__schema($.record, $.id), l(view.file_info($.record))),

          view.button(
            l(),
            "New item",
            l(
              s.click(__),
              s.with_tx(
                $.tx,
                r(
                  s.new__default($.tx, $.item_id, $.id),
                  s.new__window($.tx, __, s.location($.item_id)),
                ),
              ),
            ),
          ),
        ),
      ),
      $.out,
    ),
  },
  view__form: {
    file__name: "Form",
    view__schema: "form",
    rule__params: l($.id, $.state, $.out),
    rule__body: s.call($.id, $.id, $.state, $.out),
  },

  view__dispatch: {
    rule__params: l(l($.param, $.handler), $.message),
    rule__body: r(u($.param, $.message), $.handler),
  },
  view____match_dispatch_next: {
    rule__params: l($.on_change, $.message, $.rest),
    rule__body: s.if_then_else(
      u($.rest, l()),
      view.dispatch($.on_change, $.message),
      s.apply(view.match_dispatch($.on_change, $.message), $.rest),
    ),
  },
  view__match_dispatch: {
    rule__params: l($.on_change, $.message, $.case),
    rule__rest_params: $.rest,
    rule__body: r(
      s.match_cond(
        $.case,
        l(
          l($.pattern, $.mapped),
          s.if_then_else(
            u($.message, $.pattern),
            view.dispatch($.on_change, $.mapped),
            s.__match_dispatch_next($.on_change, $.message, $.rest),
          ),
        ),
        l(
          l($.pattern, $.mapped, $.body),
          s.if_then_else(
            u($.message, $.pattern),
            r($.body, view.dispatch($.on_change, $.mapped)),
            s.__match_dispatch_next($.on_change, $.message, $.rest),
          ),
        ),
      ),
    ),
  },

  // built in UI elements
  view__file_link: {
    rule__params: l($.id, $.out),
    rule__body: r(
      s.get_default($.id, "file__name", $.name, $.id),
      view.link(l(), $.name, s.location($.id), $.out),
    ),
  },
  view__file_info: {
    rule__params: l($.id, $.out),
    rule__body: r(
      s.collect(
        $.view,
        s.fork(
          r(
            s.db__schema($.id, $.schema),
            s.fork(view.file_link($.schema, $.view), view.string(": ", $.view)),
          ),
          view.file_link($.id, $.view),
        ),
        $.main_info,
      ),
      view.row(l(), $.main_info, $.row),
      s.cond(
        l(
          s.file__description($.id, $.description),
          r(
            view.text($.description, $.d),
            view.column(l(), l($.row, $.d), $.out),
          ),
        ),
        l(s.ok(), view.column(l(), l($.row), $.out)),
      ),
    ),
  },
} satisfies Record<string, Rec>;
