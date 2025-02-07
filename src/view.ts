import { Rec } from "./data";
import { l, r, s, $, Expr, __, AnyStruct, fork, eq } from "./expr";
import { f } from "./field";
import { db } from "./rule";
import { test } from "./test_utils";

export const view = new Proxy(
  {},
  {
    get(_, key: string) {
      return (...args: Expr[]) => s(`view__${key}`, ...args);
    },
  },
) as Record<string, (...args: Expr[]) => AnyStruct>;

export const rootView = r(
  view.app_menu(),
  f.db__schema($.window, "schema__window"),
  view.window($.window),
);

const baseViews = {
  // primitives
  spacer: {
    rule__params: l($.space),
    rule__body: s.view(
      s.Html("div", l(s.class("Spacer"), s.style("flexBasis", $.space)), r()),
    ),
  },
  row: {
    rule__params: l(),
    rule__rest_params: $.children_list,
    rule__body: r(
      s.struct_tag_list($.children, ";", $.children_list),
      view.children($.children, $.children_rendered),
      s.view(s.Html("div", l(s.class("Row")), $.children_rendered)),
    ),
  },
  column: {
    rule__params: l(),
    rule__rest_params: $.children_list,
    rule__body: r(
      s.struct_tag_list($.children, ";", $.children_list),
      view.children($.children, $.children_rendered),
      s.view(s.Html("div", l(s.class("Column")), $.children_rendered)),
    ),
  },
  local_state: {
    rule__params: l($.init_value, $.value, $.next, $.on_change, $.children),
    rule__body: s.view(
      s.LocalState($.init_value, $.value, $.next, $.on_change, $.children),
    ),
  },
  string: {
    rule__params: l($.string),
    rule__body: s.view(s.String($.string)),
  },
  button: {
    rule__params: l($.string, $.on_click),
    rule__body: s.view(s.Button(l(), $.string, __, $.on_click)),
  },
  input: {
    rule__params: l($.props, $.value, $.next, $.on_change),
    rule__body: s.view(s.Input($.props, $.value, $.next, $.on_change)),
  },
  select: {
    rule__params: l($.value, $.options, $.next, $.on_change),
    rule__body: s.view(s.Select(l(), $.value, $.options, $.next, $.on_change)),
  },
  link: {
    rule__params: l($.label, $.location),
    rule__rest_params: $.rest_params,
    rule__body: r(
      s.match(l($.params), $.rest_params, l(l())),
      s.get_context("window_id", $.window),
      s.view(
        s.Button(
          l(s.class("Link")),
          $.label,
          $.event,
          s.cond(
            l(eq($.event, s.click(1)), s.on__newWindow($.location)),
            l(
              s.list_item($.params, s.target("new")),
              s.on__newWindow($.location),
            ),
            l(s.ok(), s.on__push($.window, $.location)),
          ),
        ),
      ),
    ),
  },
  test__link: {
    test__group: "views",
    rule__params: l(),
    rule__body: r(
      test.view(
        r(
          s.set_context("window_id", "test_window_id"),
          view.link("hello", s.location("test_link")),
        ),
        s.Button(
          l(s.class("Link")),
          "hello",
          $.event,
          s.cond(
            l(
              eq($.event, s.click(1)),
              s.on__newWindow(s.location("test_link")),
            ),
            l(
              s.list_item(l(), s.target("new")),
              s.on__newWindow(s.location("test_link")),
            ),
            l(s.ok(), s.on__push("test_window_id", s.location("test_link"))),
          ),
        ),
      ),
    ),
  },
  icon: {
    rule__params: l(),
    rule__body: s.view(s.Icon()),
  },

  table: {
    file__description: l("Render a table. Fails if there are no rows."),
    rule__params: l($.props, $.header, $.body),
    rule__body: r(
      view.children($.body, $.body_rendered),
      s.view(
        s.Html(
          "table",
          $.props,
          fork(
            s.view(s.Html("thead", l(), $.header)),
            s.view(s.Html("tbody", l(), $.body_rendered)),
          ),
        ),
      ),
    ),
  },
  table_header: {
    rule__params: l($.props),
    rule__rest_params: $.items,
    rule__body: s.view(
      s.Html(
        "tr",
        $.props,
        r(s.list_item($.items, $.item), s.view(s.Html("th", l(), $.item))),
      ),
    ),
  },
  table_row: {
    rule__params: l($.props),
    rule__rest_params: $.items,
    rule__body: s.view(
      s.Html(
        "tr",
        $.props,
        r(s.list_item($.items, $.item), s.view(s.Html("td", l(), $.item))),
      ),
    ),
  },
  menu: {
    rule__params: l($.label, $.options, $.next, $.on_change),
    rule__body: r(
      s.list_list_append(l(s.option("", $.label)), $.options, $.menu_options),
      view.select("", $.menu_options, $.next, $.on_change),
    ),
  },
  text_section: {
    rule__params: l($.header, $.body),
    rule__body: s.view(
      s.Html(
        "section",
        l(),
        r(
          s.view(s.Html("header", l(), view.text($.header))),
          view.text($.body),
        ),
      ),
    ),
  },
  text_node: {
    rule__params: l($.node),
    rule__body: s.match_cond(
      $.node,
      l(s.link($.label, $.location), view.link($.label, $.location)),
      l(s.section($.header, $.body), view.text_section($.header, $.body)),
      l(__, r(s.string($.node), view.string($.node))),
    ),
  },
  text: {
    rule__params: l($.text),
    rule__body: s.view(
      s.Html(
        "div",
        l(s.class("Text")),
        r(s.list_item($.text, $.node), view.text_node($.node)),
      ),
    ),
  },
  // view utilities
  children: {
    file__description: l(
      "Runs a goal, collects emitted views, and fails if no views are yielded. This is useful for preventing wrapper components from rendering if are empty.",
    ),
    rule__params: l($.get_children, $.children),
    rule__body: r(
      s.collect_view($.get_children, $.children_collected),
      eq($.children, r(s.list_item($.children_collected, $.v), s.view($.v))),
    ),
  },
  id_field: {
    rule__params: l($.entity, $.field),
    rule__body: s.cond(
      l(
        s.get_field_value($.field, "db__default_view", $.view),
        s.call($.view, $.entity, $.field),
      ),
      l(
        r(
          db.get($.field, "db__type", $.type),
          db.get($.type, "db__default_view", $.view),
        ),
        s.call($.view, $.entity, $.field),
      ),
      l(
        db.get("type__any", "db__default_view", $.view),
        s.call($.view, $.entity, $.field),
      ),
    ),
  },

  rule: {
    file__description: l("renders a struct formatted as a rule"),
    rule__params: l($.data),
    rule__body: s.cond(
      l(
        s.struct($.data),
        r(
          s.struct_tag_list($.data, $.tag, $.list),
          s("%", "Todo: get these from db"),
          s.cond(
            l(s.match($.tag, ",", ";"), view.rule__postfix($.tag, $.list)),
            l(s.match($.tag, "=", "/="), view.rule__infix($.tag, $.list)),
            l(
              s.match(
                $.tag,
                "view__row",
                "view__column",
                "view__table",
                "view__table_header",
                "view__table_row",
                "view__table_column",
              ),
              view.rule__tuple($.tag, l(), $.list),
            ),
            l(s.ok(), view.rule__tuple($.tag, $.list, l())),
          ),
        ),
      ),
      l(s.ok(), view.expr($.data)),
    ),
  },
  rule__postfix: {
    rule__params: l($.tag, $.list),
    rule__body: view.column(
      r(
        s.list_item($.list, $.item),
        view.row(view.rule($.item), view.file_link($.tag)),
      ),
    ),
  },
  rule__infix: {
    rule__params: l($.tag, $.list),
    rule__body: r(
      s.list_list_append($.rest, l($.last), $.list),
      view.row(
        r(
          s.list_item($.rest, $.item),
          view.expr($.item),
          view.string(" "),
          view.file_link($.tag),
          view.string(" "),
        ),
        view.expr($.last),
      ),
    ),
  },
  rule__tuple: {
    rule__params: l($.tag, $.list, $.rest),
    rule__body: view.row(
      view.file_link($.tag),
      view.string("( "),
      view.column(
        view.row(
          r(s.list_item($.list, $.item), view.expr($.item), view.string(" ")),
        ),
        r(s.list_item($.rest, $.rest_item), view.rule($.rest_item)),
      ),
      view.string(")"),
    ),
  },

  expr: {
    file__name: "Any : View",
    rule__params: l($.data),
    rule__body: fork(
      r(s.var_name($.data, $.var_name), view.string($.var_name)),
      r(
        s.string($.data),
        view.row(view.string('"'), view.string($.data), view.string('"')),
      ),
      r(s.number($.data), view.string($.data)),
      r(s.struct($.data), view.struct($.data)),
    ),
  },
  struct: {
    rule__params: l($.data),
    rule__body: r(
      s.struct_tag_list($.data, $.tag, $.args),
      s.cond(
        l(s.match($.tag, ";", ","), view.rule($.data)),
        l(s.match($.tag, "="), view.operator_binary($.tag, $.args)),
        l(s.ok(), view.tuple($.tag, $.args)),
      ),
    ),
  },
  operator_binary: {
    rule__params: l($.id, l($.l, $.r)),
    rule__body: view.row(view.expr($.l), view.string($.id), view.expr($.r)),
  },
  operator_chain: {
    rule__params: l($.op, $.args),
    rule__body: s.match_cond(
      $.args,
      l(l(), s.ok()),
      l(l($.single), view.expr($.single)),
      l(
        __,
        r(
          s.list_list_append(l($.head), $.tail, $.args),
          view.column(
            view.expr($.head),
            r(
              s.list_item($.tail, $.item),
              view.row(view.string($.op), view.expr($.item)),
            ),
          ),
        ),
      ),
    ),
  },
  tuple: {
    rule__params: l($.id, $.args),
    rule__body: view.row(
      view.string($.id),
      view.string("( "),
      r(
        s.list_item($.args, $.arg), //
        view.expr($.arg),
        view.string(" "),
      ),
      view.string(")"),
    ),
  },

  // type editors
  fit_content_input: {
    rule__params: l($.value, $.next, $.on_change),
    rule__body: view.input(
      l(s.class("Input--fitContent")),
      $.value,
      $.next,
      $.on_change,
    ),
  },
  expr_edit: {
    file__name: "Any : Edit",
    rule__params: l($.data, $.next, $.on_change),
    rule__body: fork(
      r(
        s.var_name($.data, $.var_name),
        view.fit_content_input($.var_name, $.next, $.on_change),
      ),
      r(s.string($.data), view.fit_content_input($.data, $.next, $.on_change)),
      r(
        s.number($.data),
        view.fit_content_input(
          $.data,
          $.next_str,
          r(s.string_number($.next_str, $.next), $.on_change),
        ),
      ),
      r(s.struct($.data), view.struct_edit($.data, $.next, $.on_change)),
    ),
  },
  struct_edit: {
    file__name: "Any Struct : Edit",
    rule__params: l($.data, $.next, $.on_change),
    rule__body: r(
      s.struct_tag_list($.data, $.id, $.args),
      view.row(
        view.fit_content_input(
          $.id,
          $.next_id,
          r(s.struct_tag_list($.next, $.next_id, $.args), $.on_change),
        ),
        view.string("("),
        view.column(
          r(
            s.struct_at_value($.data, $.i, $.arg),
            view.row(
              view.button(
                "×",
                r(
                  s.list_at_removed_splice($.args, $.i, l(__), $.next),
                  s.struct_tag_list($.next, $.id, $.next_args),
                  $.on_change,
                ),
              ),
              view.expr_edit(
                $.arg,
                $.arg_next,
                r(
                  s.struct_at_value_updated($.data, $.i, $.arg_next, $.next),
                  $.on_change,
                ),
              ),
            ),
          ),
          view.struct_add_field(
            $.next_arg,
            r(s._struct_push($.data, $.next_arg, $.next), $.on_change),
          ),
        ),

        view.string(")"),
      ),
    ),
  },

  struct_add_field: {
    rule__params: l($.next, $.on_change),
    rule__body: r(
      view.menu(
        "+",
        l(
          s.option("string", "string"),
          s.option("number", "number"),
          s.option("struct", "struct"),
          s.option("var", "var"),
        ),
        $.next_type,
        r(
          s.match(
            l($.next_type, $.next),
            l("string", ""),
            l("number", 0),
            l("struct", l()),
            l("var", $("")),
          ),
          $.on_change,
        ),
      ),
    ),
  },

  // type views
  type__any: {
    rule__params: l($.id, $.field),
    rule__body: r(db.get($.id, $.field, $.value), view.expr($.value)),
  },
  type__string: {
    rule__params: l($.id, $.field),
    rule__body: r(
      db.get($.id, $.field, $.value), //
      view.string($.value),
    ),
  },
  type__time: {
    rule__params: l($.id, $.field),
    rule__body: r(
      db.get($.id, $.field, $.value), //
      view.string($.value),
    ),
  },
  type__ref: {
    rule__params: l($.id, $.field),
    rule__body: r(
      db.get($.id, $.field, $.value), //
      view.file_link($.value),
    ),
  },
  type__text: {
    rule__params: l($.id, $.field),
    rule__body: r(db.get($.id, $.field, $.text), view.text($.text)),
  },

  tag_edit: {
    rule__params: l($.tag, $.on_delete),
    rule__body: view.row(view.button("x", $.on_delete), view.file_link($.tag)),
  },
  add_tag_menu: {
    rule__params: l($.selected, $.on_add),
    rule__body: r(
      s.collect(
        s.option($.tag_opt, $.name),
        r(
          f.db__schema($.tag_opt, "schema__tag"),
          f.file__name($.tag_opt, $.name),
        ),
        $.tag_opts,
      ),
      view.menu("Add tag", $.tag_opts, $.selected, $.on_add),
    ),
  },

  // field views
  file__tags: {
    rule__params: l($.id, $.field),
    rule__body: view.row(
      r(
        f.file__tags($.id, $.tag),
        view.tag_edit(
          $.tag,
          db.with_tx($.tx, db.delete($.tx, $.id, "file__tags", $.tag)),
        ),
        view.spacer("0.25rem"),
      ),
      view.add_tag_menu(
        $.selected,
        db.with_tx($.tx, db.update($.tx, $.id, "file__tags", $.selected)),
      ),
    ),
  },
  rule__body: {
    rule__params: l($.id, $.field),
    rule__body: r(db.get($.id, $.field, $.body), view.rule($.body)),
  },

  // schema views
  schema__any: {
    file__name: "Default viewer",
    view__schema: "schema__any",
    rule__params: l($.id, $.state),
    rule__body: view.column(
      view.table(
        l(),
        view.table_header(l(), view.string("Field"), view.string("Value")),
        r(
          view.table_row(l(), view.string("id"), view.string($.id)),
          s.get_field_value($.id, $.field, __),
          view.table_row(
            l(),
            view.file_link($.field),
            view.id_field($.id, $.field),
          ),
        ),
      ),
      r(
        view.string("References"),
        view.table(
          l(),
          view.table_header(l(), view.string("Field"), view.string("Ref")),
          r(
            fork(f.db__index($.f, s.ref()), f.db__index($.f, s.multiRef())),
            s.get_field_value($.ref, $.f, $.id),
            view.table_row(l(), view.file_link($.f), view.file_link($.ref)),
          ),
        ),
      ),
    ),
  },
  schema__any_add_field: {
    rule__params: l($.id),
    rule__body: r(
      s.collect(
        s.option($.field_id, $.field_name),
        r(
          f.db__schema($.field_id, "schema__field"),
          f.file__name($.field_id, $.field_name),
        ),
        $.fields,
      ),
      view.menu(
        "Add field...",
        $.fields,
        $.new_field_id,
        s._add_field($.id, $.new_field_id),
      ),
    ),
  },
  schema__any_edit: {
    file__name: "Default editor",
    view__schema: "schema__any",
    rule__params: l($.id, $.state),
    rule__body: view.column(
      view.table(
        l(),
        view.table_header(l(), view.string("Field"), view.string("Value")),
        r(
          view.table_row(l(), view.string("id"), view.string($.id)),
          r(
            s.get_field_value($.id, $.field, $.value),
            view.table_row(
              l(),
              view.row(
                view.button(
                  "×",
                  db.with_tx($.tx, db.delete($.tx, $.id, $.field)),
                ),
                view.file_link($.field),
              ),
              view.expr_edit(
                $.value,
                $.next,
                db.with_tx($.tx, db.update($.tx, $.id, $.field, $.next)),
              ),
            ),
          ),
        ),
      ),
      view.schema__any_add_field($.id),
    ),
  },
  schema__schema: {
    file__name: "Schema viewer",
    view__schema: "schema__schema",
    rule__params: l($.id, $.state),
    rule__body: view.column(
      view.row(f.file__description($.id, $.desc), view.text($.desc)),
      view.column(
        r(
          view.string("Fields:"),
          f.db__fields($.id, $.fields),
          s.list_item($.fields, $.field),
          s.match_cond(
            $.field,
            l(s.field($.field_id), view.file_link($.field_id)),
            l(
              s.field_optional($.field_id),
              view.row(view.file_link($.field_id), view.string("(optional)")),
            ),
          ),
        ),
      ),
      view.column(
        r(
          view.string("Views:"),
          f.view__schema($.view, $.id),
          view.row(view.file_info($.view)),
        ),
      ),
      view.column(
        r(
          view.string("Items:"),
          f.db__schema($.record, $.id),
          view.row(view.file_info($.record)),
        ),
      ),
      view.button(
        "New item",
        s.with_tx(
          $.tx,
          r(
            s.new__default($.tx, $.item_id, $.id),
            s.new__window($.tx, __, s.location($.item_id)),
          ),
        ),
      ),
    ),
  },
  schema__form: {
    file__name: "Form",
    view__schema: "schema__form",
    rule__params: l($.id, $.state),
    rule__body: s.call($.id, $.id, $.state),
  },
  schema__text: {
    file__name: "Text viewer",
    view__schema: "schema__text",
    rule__params: l($.id, $.state),
    rule__body: view.column(
      view.spacer("2rem"),
      view.row(
        view.spacer("2rem"),
        r(f.text__content($.id, $.text), view.row(view.text($.text))),
        view.spacer("2rem"),
      ),
      view.spacer("2rem"),
    ),
  },
  schema__tag: {
    file__name: "Tag items",
    view__schema: "schema__tag",
    rule__params: l($.tag, $.state),
    rule__body: view.column(
      r(f.file__description($.tag, $.desc), view.text($.desc)),
      r(f.file__tags($.file, $.tag), view.row(view.file_info($.file))),
    ),
  },
  schema__folder_list: {
    file__name: "Folder - List",
    view__schema: "schema__folder",
    rule__params: l($.id, $.state),
    rule__body: view.column(
      r(f.file__description($.id, $.desc), view.text($.desc)),
      r(f.folder__items($.id, $.item), view.row(view.file_info($.item))),
    ),
  },
  schema__folder_icon: {
    file__name: "Folder - Icon",
    view__schema: "schema__folder",
    rule__params: l($.id, $.state),
    rule__body: view.column(
      r(f.file__description($.id, $.desc), view.text($.desc)),
      view.row(
        r(
          f.folder__items($.id, $.item),
          view.column(view.icon(), view.file_link($.item)),
        ),
      ),
    ),
  },
  schema__window: {
    file__name: "Window - History",
    view__schema: "schema__window",
    rule__params: l($.id, $.state),
    rule__body: view.column(
      r(
        f.history__window($.history, $.id),
        view.row(
          r(f.history__location($.history, $.h_id), view.file_link($.h_id)),
          r(
            f.history__view($.history, $.h_view),
            view.string(":"),
            view.file_link($.h_view),
          ),
          r(
            f.time__created($.history, $.ts),
            // TODO: adjust for timezone
            s.timestamp_date(
              $.ts,
              s.date(__, __, __, $.hour, $.minute, $.second, __),
            ),
            view.string("-"),
            view.string($.hour),
            view.string(":"),
            view.string($.minute),
            view.string(":"),
            view.string($.second),
          ),
        ),
      ),
    ),
  },
  // built in UI elements

  file_link: {
    rule__params: l($.id),
    rule__body: r(
      s.get_default($.id, "file__name", $.name, $.id),
      view.link($.name, s.location($.id)),
    ),
  },
  file_info: {
    rule__params: l($.id),
    rule__body: view.column(
      view.row(
        r(
          f.db__schema($.id, $.schema),
          view.file_link($.schema),
          view.string(": "),
        ),
        view.file_link($.id),
      ),
      r(f.file__description($.id, $.description), view.text($.description)),
    ),
  },
  view_menu: {
    file__name: "View menu",
    file__description: l("the view selection menu on window chrome"),
    rule__params: l($.window, $.id, $.selectedView),
    rule__body: r(
      s.collect(
        s.option($.view, $.name),
        r(s.rule__location_view($.id, $.view), f.file__name($.view, $.name)),
        $.options,
      ),
      view.select(
        $.selectedView,
        $.options,
        $.nextView,
        db.with_tx(
          $.tx,
          f.window__currentHistory($.window, $.history),
          db.update($.tx, $.history, "history__view", $.nextView),
        ),
      ),
    ),
  },
  window: {
    file__name: "Window",
    rule__params: l($.window),
    rule__body: r(
      f.window__currentHistory($.window, $.history),
      f.browser__currentWindow("browser", $.currentWindow),
      f.history__location($.history, $.id),
      s.set_context("window_id", $.window),
      s.set_context("history_id", $.history),
      s.get_default($.id, "file__name", $.name, $.id),
      s.first(
        // view from params
        f.history__view($.history, $.view),
        // view from id
        s.rule__location_view($.id, $.view),
      ),
      s.view(
        s.WindowContainer(
          $.window,
          $.currentWindow,
          r(
            view.window_bar($.window, $.id, $.view, $.name),
            s.call($.view, $.id, $.history),
          ),
        ),
      ),
    ),
  },
  window_close_button: {
    rule__params: l($.window),
    rule__body: s.view(
      s.Button(
        l(s.class("AppWindow__closeButton")),
        "",
        __,
        s.on__closeWindow($.window),
      ),
    ),
  },
  window_bar: {
    rule__params: l($.window, $.id, $.view, $.name),
    rule__body: s.view(
      s.Html(
        "header",
        l(s.class("AppWindow__header")),
        fork(
          view.window_close_button($.window),
          s.view(
            s.Html("h1", l(s.class("AppWindow__title")), view.string($.name)),
          ),
          view.view_menu($.window, $.id, $.view),
        ),
      ),
    ),
  },
  app_menu: {
    file__name: "App menu",
    rule__params: l(),
    rule__body: view.row(
      view.button(
        "←",
        r(f.browser__currentWindow("browser", $.window), s.on__back($.window)),
      ),
      view.button(
        "→",
        r(
          f.browser__currentWindow("browser", $.window),
          s.on__forward($.window),
        ),
      ),
      view.button("new window", r(s.on__newWindow(s.location("omnibox")))),
    ),
  },
} satisfies Record<string, Rec>;

export const views = Object.fromEntries(
  Object.entries(baseViews).map(([key, value]) => [`view__${key}`, value]),
);
