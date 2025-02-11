import { Rec } from ".";
import { l, s, $, r, u, view, __ } from "../expr";
import { db } from "./db";

export const browser = {
  // schemas
  window: {
    db__schema: "schema",
    file__name: "Window",
    file__description: l("A window"),
    db__fields: l(db.field("window__current_history")),
  },
  history: {
    db__schema: "schema",
    file__name: "History",
    file__description: l("A history entry"),
    db__fields: l(
      db.field("history__window"),
      db.field("history__id"),
      db.field_optional("history__view"),
      db.field("history__forward"),
      db.field("history__back"),
    ),
  },

  // fields
  history__id: {
    db__schema: "field",
    file__name: "History id ref",
    db__type: "ref",
  },
  history__view: {
    db__schema: "field",
    file__name: "History view ref",
    db__type: "ref",
  },
  history__back: {
    db__schema: "field",
    file__name: "History back ref",
    db__type: "ref",
    // db__type: s.ref( "history" as const),
  },
  history__forward: {
    db__schema: "field",
    file__name: "History forward ref",
    db__type: "ref",
    // db__type: s.ref( "history" as const),
  },
  history__window: {
    db__schema: "field",
    file__name: "History window ref",
    db__type: "ref",
    // db__type: s.ref( "window"),
  },
  window__current_history: {
    db__schema: "field",
    file__name: "Window current history ref",
    db__type: "ref",
    // db__type: s.ref( "history" as const),
  },
  browser__current_window: {
    db__schema: "field",
    file__name: "Focused window in browser",
    db__type: "ref",
    // db__type: s.ref( "window" ),
  },

  location: {
    db__schema: "type",
    file__name: "location",
    file__description: l(
      "A location is a what a link points to. It is a box containing the record ID, with an optional view ID and parameters",
    ),
    rule__params: l($.item),
    rule__body: s.location_id_view_params($.item, __, __, __),
  },
  location_id_view_params: {
    file__description: l("destruct a location into its constituent parts"),
    rule__params: l($.location, $.id, $.view, $.params),
    rule__body: r(
      s.nonvar($.location),
      s.match(
        $.location,
        s.location($.id),
        s.location($.id, $.view),
        s.location($.id, $.view, $.params),
      ),
      s.if_var($.params, u($.params, l())),
    ),
  },

  // views
  view__location_view: {
    rule__params: l($.location, $.view),
    rule__body: s.fork(
      // location for view type
      r(
        s.nonvar($.view),
        s.view__schema($.view, $.schema),
        s.db__schema($.location, $.schema),
      ),
      // view for location type
      r(
        s.nonvar($.location),
        s.db__schema($.location, $.schema),
        s.view__schema($.view, $.schema),
      ),
      // view for any type
      s.view__schema($.view, "any_record"),
    ),
  },
  view__view_menu: {
    file__name: "View menu",
    file__description: l("the view selection menu on window chrome"),
    rule__params: l($.window, $.id, $.selectedView, $.out),
    rule__body: r(
      s.collect(
        s.option($.view, $.name),
        r(view.location_view($.id, $.view), s.file__name($.view, $.name)),
        $.options,
      ),
      view.select(
        l(),
        $.selectedView,
        $.options,
        l(
          s.change($.nextView),
          db.with_tx(
            $.tx,
            s.window__current_history($.window, $.history),
            db.update($.tx, $.history, "history__view", $.nextView),
          ),
        ),
        $.out,
      ),
    ),
  },
  view__window: {
    file__name: "Window",
    rule__params: l($.window, $.out),
    rule__body: r(
      s.window__current_history($.window, $.history),
      s.browser__current_window("browser", $.currentWindow),
      s.history__id($.history, $.id),
      s.set_context("window_id", $.window),
      s.set_context("history_id", $.history),
      s.get_default($.id, "file__name", $.name, $.id),
      s.limit(
        1,
        s.fork(
          // view from params
          s.history__view($.history, $.view),
          // view from id
          view.location_view($.id, $.view),
        ),
      ),
      view.window_bar($.window, $.id, $.view, $.name, $.window_bar),
      s.try_error_catch(
        r(
          s.call($.view, $.id, $.history, $.main_content),
          view.html(
            "div",
            l(s.class("AppWindow__content")),
            l($.main_content),
            $.main_content_wrapped,
          ),
          u(
            $.out,
            s.WindowContainer(
              $.window,
              $.currentWindow,
              s.on__selectWindow($.window),
              s.on__back($.window),
              s.on__forward($.window),
              l($.window_bar, $.main_content_wrapped),
            ),
          ),
        ),
        $.error,
        r(
          s.log("error", $.error),
          view.string("Error, see console for details", $.error_message),
          u(
            $.out,
            s.WindowContainer(
              $.window,
              $.currentWindow,
              l($.window_bar, $.error_message),
            ),
          ),
        ),
      ),
    ),
  },
  view__window_bar: {
    rule__params: l($.window, $.id, $.view, $.name, $.out),
    rule__body: r(
      view.view_menu($.window, $.id, $.view, $.menu),
      view.string($.name, $.window_title),
      view.button(
        l(s.class("AppWindow__closeButton")),
        "",
        l(__, s.on__closeWindow($.window)),
        $.close_button,
      ),
      u(
        $.out,
        s.Html(
          "header",
          l(s.class("AppWindow__header")),
          l(
            $.close_button,
            s.Html("h1", l(s.class("AppWindow__title")), l($.window_title)),
            $.menu,
          ),
        ),
      ),
    ),
  },
  view__app_menu: {
    file__name: "App menu",
    rule__params: l($.out),
    rule__body: r(
      s.collect(
        $.view,
        s.fork(
          view.button(
            l(),
            "←",
            l(
              s.click(__),
              r(
                s.browser__current_window("browser", $.window),
                s.on__back($.window),
              ),
            ),
            $.view,
          ),
          view.button(
            l(),
            "→",
            l(
              s.click(__),
              r(
                s.browser__current_window("browser", $.window),
                s.on__forward($.window),
              ),
            ),
            $.view,
          ),
          view.button(
            l(),
            "new window",
            l(s.click(__), r(s.on__newWindow(s.location("omnibox")))),
            $.view,
          ),
        ),
        $.items,
      ),
      view.row(l(), $.items, $.out),
    ),
  },
  view__window_history: {
    file__name: "Window - History",
    view__schema: "window",
    rule__params: l($.id, $.state, $.out),
    rule__body: view.render(
      view.table(
        l(),
        s.children(
          view.table_header(
            l(),
            s.children(
              view.string("id"),
              view.string("view"),
              view.string("time"),
            ),
          ),
        ),
        s.children(
          view.iter(
            s.history__window($.history, $.id),
            l(
              view.table_row(
                l(),
                s.children(
                  view.id_field($.history, "history__id"),
                  view.or_default(
                    view.id_field($.history, "history__view"),
                    view.string(""),
                  ),
                  view.id_field($.history, "time__created"),
                ),
              ),
            ),
          ),
        ),
      ),
      $.out,
    ),
  },

  new__window: {
    rule__params: l($.tx, $.window, $.location),
    rule__body: r(
      s.if_var($.window, s.id($.window)),
      s.new__history($.tx, $.history, $.window, $.location),
      db.update($.tx, $.window, "db__schema", "window"),
      db.update($.tx, $.window, "window__current_history", $.history),
    ),
  },

  new__history: {
    rule__params: l($.tx, $.history, $.window, $.location),
    rule__body: r(
      s.if_var($.history, s.id($.history)),
      s.timestamp($.ts),
      s.location_id_view_params($.location, $.id, $.view, $.params),
      db.update($.tx, $.history, "db__schema", "history"),
      db.update($.tx, $.history, "time__created", $.ts),
      db.update($.tx, $.history, "history__window", $.window),
      db.update($.tx, $.history, "history__id", $.id),
      s.if_then_else(
        s.nonvar($.view),
        db.update($.tx, $.history, "history__view", $.view),
        r(),
      ),
      s.each_item_do(
        $.params,
        s.param($.param_field, $.param_value),
        db.update($.tx, $.history, $.param_field, $.param_value),
      ),
    ),
  },

  // event handlers
  on__selectWindow: {
    rule__params: l($.window),
    rule__body: db.with_tx(
      $.tx,
      db.update($.tx, "browser", "browser__current_window", $.window),
    ),
  },
  on__newWindow: {
    rule__params: l($.location),
    rule__body: db.with_tx($.tx, s.new__window($.tx, __, $.location)),
  },
  on__closeWindow: {
    rule__params: l($.window),
    rule__body: db.with_tx($.tx, db.delete($.tx, $.window)),
  },
  on__push: {
    rule__params: l($.window, $.location),
    rule__body: db.with_tx(
      $.tx,
      s.window__current_history($.window, $.prev),
      s.new__history($.tx, $.next, $.window, $.location),
      db.update($.tx, $.next, "history__back", $.prev),
      db.update($.tx, $.prev, "history__forward", $.next),
      db.update($.tx, $.window, "window__current_history", $.next),
    ),
  },

  on__back: {
    rule__params: l($.window),
    rule__body: db.with_tx(
      $.tx,
      s.window__current_history($.window, $.forward),
      s.history__back($.forward, $.back),
      db.update($.tx, $.window, "window__current_history", $.back),
      db.update($.tx, $.back, "history__forward", $.forward),
      db.delete($.tx, $.forward, "history__back"),
    ),
  },
  on__forward: {
    rule__params: l($.window),
    rule__body: db.with_tx(
      $.tx,
      s.window__current_history($.window, $.back),
      s.history__forward($.back, $.forward),

      db.update($.tx, $.window, "window__current_history", $.forward),
      db.update($.tx, $.forward, "history__back", $.back),
      db.delete($.tx, $.back, "history__forward"),
    ),
  },
} satisfies Record<string, Rec>;

export const browserInitState = {
  rootHistory: {
    db__schema: "history",
    history__window: "rootWindow",
    history__id: "home",
  },
  rootWindow: {
    db__schema: "window",
    window__current_history: "rootHistory",
  },
  browser: {
    file__name: "Browser state",
    browser__current_window: "rootWindow",
  },
} satisfies Record<string, Rec>;
