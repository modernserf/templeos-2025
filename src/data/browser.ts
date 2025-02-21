import { Rec } from ".";
import { l, s, $, seq, u, __, alt, f } from "../expr";
import { db } from "./db";

export const browserData = {
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
    rule__body: seq(
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

  view__component: {
    rule__params: l($.component),
    rule__body: seq(
      s.loop(
        seq(
          s.receive(s.mount($.renderer)),
          s.self($.self),
          s.send($.self, s.render()),
          s.loop(
            seq(
              s.receive(s.render()),
              s.preply($.component, l($.out)),
              s.send($.renderer, $.out),
            ),
          ),
        ),
      ),
    ),
  },
  dispatch: {
    rule__params: l($.message),
    rule__body: s.send("dispatcher", $.message),
  },
  dispatcher: {
    rule__params: l(),
    rule__body: seq(
      s.loop(
        seq(
          s.receive($.message),
          s.match_cond(
            $.message,
            l(
              s.render_window($.window),
              seq(
                s.send($.window, s.render()),
                s.send("local_storage", s.update()),
              ),
            ),
            l(
              s.render_root(),
              seq(
                s.send("root_view_manager", s.render()),
                s.send("local_storage", s.update()),
              ),
            ),
            l(s.clear_storage(), s.send("local_storage", s.clear())),
          ),
        ),
      ),
    ),
  },

  // views
  view__desktop: {
    rule__params: l($.out),
    rule__body: s.expr(
      $.out,
      s.view__html(
        "div",
        l(),
        s.children(
          s.view__app_menu(),
          s.expr_iter(
            s.record_field_value($.window, "db__schema", "window"),
            s(
              "=",
              s.Receiver(s.view__component(s.view__window($.window)), $.window),
            ),
          ),
        ),
      ),
    ),
  },

  record_view: {
    rule__params: l($.id, $.view),
    rule__body: alt(
      // id for view type
      seq(
        s.nonvar($.view),
        f.view__schema($.view, $.schema),
        f.db__schema($.id, $.schema),
      ),
      // view for id type
      seq(
        s.nonvar($.id),
        f.db__schema($.id, $.schema),
        f.view__schema($.view, $.schema),
      ),
      // view for any type
      f.view__schema($.view, "any_record"),
    ),
  },
  view__view_menu: {
    file__name: "View menu",
    file__description: l("the view selection menu on window chrome"),
    rule__params: l($.out, $.window, $.id, $.selected),
    rule__body: seq(
      s.collect_item_in(
        $.options,
        s.option($.view, $.name),
        seq(s.record_view($.id, $.view), f.file__name($.view, $.name)),
      ),
      s.view__select(
        $.out,
        l(),
        $.selected,
        $.options,
        seq(
          s.receive(s.change($.next_view)),
          db.with_tx(
            $.tx,
            s.window__current_history($.window, $.history),
            db.update($.tx, $.history, "history__view", $.next_view),
          ),
        ),
      ),
    ),
  },
  view__window_container: {
    rule__params: l(
      s.WindowContainer(
        $.window,
        $.current_window,
        seq(
          s.receive($.event),
          s.match_cond(
            $.event,
            l(s.select_window(), s.on__select_window($.window)),
            l(s.back(), s.on__back($.window)),
            l(s.forward(), s.on__forward($.window)),
          ),
        ),
        $.children,
      ),
      $.window,
      $.current_window,
      $.children,
    ),
  },

  view__window_content: {
    rule__params: l($.out, $.view, $.id, $.window, $.history),
    rule__body: seq(
      s.set_context("window_id", $.window),
      s.set_context("history_id", $.history),
      s.call($.view, $.out, $.id, $.history),
    ),
  },

  view__window: {
    file__name: "Window",
    rule__params: l($.out, $.window),
    rule__body: seq(
      f.window__current_history($.window, $.history),
      f.browser__current_window("browser", $.current_window),
      f.history__id($.history, $.id),
      s.if_then_else(f.file__name($.id, $.name), s.ok(), u($.name, $.id)),
      s.limit(
        1,
        alt(
          // view from params
          f.history__view($.history, $.view),
          // view from id
          s.record_view($.id, $.view),
        ),
      ),

      s.try_error_catch(
        seq(
          s.expr(
            $.out,
            s.view__window_container(
              $.window,
              $.current_window,
              s.children(
                s.view__window_bar($.window, $.id, $.view, $.name),
                s.view__html(
                  "div",
                  l(s.class("AppWindow__content")),
                  s.children(
                    s.view__window_content($.view, $.id, $.window, $.history),
                  ),
                ),
              ),
            ),
          ),
        ),
        $.error,
        seq(
          s.log("error", $.error),
          s.expr(
            $.out,
            s.view__window_container(
              $.window,
              $.current_window,
              s.children(
                s.view__window_bar($.window, $.id, $.view, "Home"),
                s.view__html(
                  "div",
                  l(s.class("AppWindow__content")),
                  s.children(s.view__string("Error, see console for details")),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  },
  view__window_bar: {
    rule__params: l($.out, $.window, $.id, $.view, $.name),
    rule__body: seq(
      f.window__current_history($.window, $.history),
      s.if_then_else(
        f.history__back($.history, __),
        u($.back_class, "AppWindow__nav"),
        u($.back_class, "AppWindow__nav AppWindow__nav--disabled"),
      ),
      s.if_then_else(
        f.history__forward($.history, __),
        u($.forward_class, "AppWindow__nav"),
        u($.forward_class, "AppWindow__nav AppWindow__nav--disabled"),
      ),
      s.expr(
        $.out,
        s.view__row(
          l(s.class("AppWindow__header")),
          s.children(
            s.view__button(
              l(s.class("AppWindow__closeButton")),
              "",
              seq(
                s.receive($.e),
                u($.e, s.click(__)),
                s.on__close_window($.window),
              ),
            ),
            s.view__html(
              "h1",
              l(s.class("AppWindow__title")),
              s.children(s.view__string($.name)),
            ),
            s.expr_iter(s.timestamp($.ts), s.view__string($.ts)),

            s.view__html("div", l(s.style("flex", "1 0 auto")), l()),
            s.view__button(
              l(s.class($.back_class)),
              "←",
              seq(s.receive($.e), u($.e, s.click(__)), s.on__back($.window)),
            ),
            s.view__button(
              l(s.class($.forward_class)),
              "→",
              seq(s.receive($.e), u($.e, s.click(__)), s.on__forward($.window)),
            ),
            s.view__view_menu($.window, $.id, $.view),
          ),
        ),
      ),
    ),
  },
  view__app_menu: {
    file__name: "App menu",
    rule__params: l($.out),
    rule__body: s.expr(
      $.out,
      s.view__row(
        l(
          s.style("backgroundColor", "white"),
          s.style("borderBottom", "1px solid black"),
        ),
        s.children(
          s.view__menu(
            l(s.class("AppMenu")),
            "Menu",
            l(
              s.option("home", "Home"),
              s.option("omnibox", "Search"),
              s.option("reset", "Reset"),
            ),
            seq(
              s.receive(s.change($.app_menu)),
              s.match_cond(
                $.app_menu,
                l("home", s.on__new_window(s.location("home"))),
                l("omnibox", s.on__new_window(s.location("omnibox"))),
                l("reset", s.dispatch(s.clear_storage())),
              ),
            ),
          ),
        ),
      ),
    ),
  },
  // view__window_history: {
  //   file__name: "Window - History",
  //   view__schema: "window",
  //   rule__params: l($.id, $.state, $.out),
  //   rule__body: view.render(
  //     view.table(
  //       l(),
  //       s.children(
  //         view.table_header(
  //           l(),
  //           s.children(
  //             view.string("id"),
  //             view.string("view"),
  //             view.string("time"),
  //           ),
  //         ),
  //       ),
  //       s.children(
  //         view.iter(
  //           s.history__window($.history, $.id),
  //           l(
  //             view.table_row(
  //               l(),
  //               s.children(
  //                 view.id_field($.history, "history__id"),
  //                 view.or_default(
  //                   view.id_field($.history, "history__view"),
  //                   view.string(""),
  //                 ),
  //                 view.id_field($.history, "time__created"),
  //               ),
  //             ),
  //           ),
  //         ),
  //       ),
  //     ),
  //     $.out,
  //   ),
  // },

  new__window: {
    rule__params: l($.tx, $.window, $.location),
    rule__body: seq(
      s.if_var($.window, s.id($.window)),
      s.new__history($.tx, $.history, $.window, $.location),
      db.update($.tx, $.window, "db__schema", "window"),
      db.update($.tx, $.window, "window__current_history", $.history),
    ),
  },

  new__history: {
    rule__params: l($.tx, $.history, $.window, $.location),
    rule__body: seq(
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
        s.ok(),
      ),
      s.each_item_do(
        $.params,
        s.param($.param_field, $.param_value),
        db.update($.tx, $.history, $.param_field, $.param_value),
      ),
    ),
  },

  // event handlers
  on__select_window: {
    rule__params: l($.window),
    rule__body: db.with_tx(
      $.tx,
      db.update($.tx, "browser", "browser__current_window", $.window),
      s.dispatch(s.render_root()),
    ),
  },
  on__new_window: {
    rule__params: l($.location),
    rule__body: db.with_tx(
      $.tx,
      s.new__window($.tx, __, $.location),
      s.dispatch(s.render_root()),
    ),
  },
  on__close_window: {
    rule__params: l($.window),
    rule__body: db.with_tx(
      $.tx,
      db.delete($.tx, $.window),
      s.dispatch(s.render_root()),
    ),
  },
  on__push: {
    rule__params: l($.window, $.location),
    rule__body: db.with_tx(
      $.tx,
      f.window__current_history($.window, $.prev),
      s.new__history($.tx, $.next, $.window, $.location),
      db.update($.tx, $.next, "history__back", $.prev),
      db.update($.tx, $.prev, "history__forward", $.next),
      db.update($.tx, $.window, "window__current_history", $.next),
      s.dispatch(s.render_window($.window)),
    ),
  },

  on__back: {
    rule__params: l($.window),
    rule__body: db.with_tx(
      $.tx,
      f.window__current_history($.window, $.forward),
      f.history__back($.forward, $.back),
      db.update($.tx, $.window, "window__current_history", $.back),
      db.update($.tx, $.back, "history__forward", $.forward),
      db.delete($.tx, $.forward, "history__back"),
      s.dispatch(s.render_window($.window)),
    ),
  },
  on__forward: {
    rule__params: l($.window),
    rule__body: db.with_tx(
      $.tx,
      f.window__current_history($.window, $.back),
      f.history__forward($.back, $.forward),

      db.update($.tx, $.window, "window__current_history", $.forward),
      db.update($.tx, $.forward, "history__back", $.back),
      db.delete($.tx, $.back, "history__forward"),
      s.dispatch(s.render_window($.window)),
    ),
  },
} satisfies Record<string, Rec>;

export const browserInitState = {
  root_history: {
    db__schema: "history",
    history__window: "root_window",
    history__id: "schema",
  },
  root_window: {
    db__schema: "window",
    window__current_history: "root_history",
  },
  browser: {
    file__name: "Browser state",
    browser__current_window: "root_window",
  },
} satisfies Record<string, Rec>;
