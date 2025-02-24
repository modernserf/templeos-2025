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
      db.field_optional("history__params"),
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
  history__params: {
    db__schema: "field",
    file__name: "History view params",
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

  current_window: {
    rule__params: l($.window),
    rule__body: f.browser__current_window("browser", $.window),
  },

  view__component: {
    rule__params: l($.render),
    rule__body: seq(
      s.loop(
        seq(
          s.receive(s.mount($.vc_renderer)),
          s.self($.self),
          s.send($.self, s.render()),
          s.loop(
            seq(
              s.receive(s.render()),
              s.preply($.render, l($.out)),
              s.send($.vc_renderer, $.out),
            ),
          ),
        ),
      ),
    ),
  },

  render_root: {
    rule__params: l(),
    rule__body: s.send("root_view_manager", s.render()),
  },

  boot: {
    rule__params: l($.pid),
    rule__body: seq(
      s.init_clipboard(),
      s.init__db_server(),
      s.spawn($.pid, s.view__desktop_component()),
    ),
  },

  view__desktop_component: {
    rule__params: l(),
    rule__body: s.loop(
      seq(
        s.self($.self),
        s.receive(s.mount($.root_view)),
        s.send($.self, s.render()),
        s.db__subscribe_callback(
          $.sub,
          s.record("browser"),
          s.send($.self, s.render()),
        ),
        s.loop(
          seq(
            s.receive($.e),
            s.match_cond(
              $.e,
              l(
                s.render(),
                seq(s.view__desktop($.out), s.send($.root_view, $.out)),
              ),
              l(s.unmount(), seq(s.db__unsubscribe($.sub), s.fail())),
            ),
          ),
        ),
      ),
    ),
  },

  // views
  view__desktop: {
    rule__params: l($.out),
    rule__body: s.html(
      $.out,
      "div",
      l(),
      s.view__app_menu(),
      s.expr_iter(
        s.record_field_value($.window, "db__schema", "window"),
        s.view__receive(s.view__window_component($.window), $.window),
      ),
    ),
  },

  view__receive: {
    rule__params: l($.out, $.proc, $.maybe_pid),
    rule__body: u($.out, s.Receiver($.proc, $.maybe_pid)),
  },

  view__window_component: {
    rule__params: l($.window),
    rule__body: seq(
      s.loop(
        seq(
          s.receive(s.mount($.vc_renderer)),
          s.self($.self),
          s.send($.self, s.render()),
          f.window__current_history($.self, $.history),
          f.history__id($.history, $.id),
          s.db__subscribe_callback(
            $.p1,
            s.record($.window),
            s.send($.self, s.render()),
          ),
          s.db__subscribe_callback(
            $.p2,
            s.record($.history),
            s.send($.self, s.render()),
          ),
          s.db__subscribe_callback(
            $.p3,
            s.record($.id),
            s.send($.self, s.render()),
          ),

          s.loop(
            seq(
              s.receive($.e),
              s.match_cond(
                $.e,
                l(
                  s.render(),
                  seq(
                    s.view__window($.out, $.window),
                    s.send($.vc_renderer, $.out),
                  ),
                ),
                l(
                  s.unmount(),
                  seq(
                    s.db__unsubscribe($.p1),
                    s.db__unsubscribe($.p2),
                    s.db__unsubscribe($.p3),
                    s.fail(),
                  ),
                ),
              ),
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
          s.ensure_var($.e),
          s.receive($.e),
          u($.e, s.change($.next_view)),
          s.on__set_view_menu($.window, $.next_view),
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
        $.rendered_children,
      ),
      $.window,
      $.current_window,
    ),
    rule__rest_params: $.children,
    rule__body: seq(s.expr_children($.rendered_children, $.children)),
  },

  view__window_content: {
    rule__params: l($.out, $.view, $.id, $.window, $.history),
    rule__body: seq(s.call($.view, $.out, $.id, $.history)),
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

      s.try_error_trace_catch(
        seq(
          s.view__window_container(
            $.out,
            $.window,
            $.current_window,

            s.view__window_bar($.window, $.id, $.view, $.name),
            s.html(
              "div",
              l(s.class("AppWindow__content")),
              s.view__window_content($.view, $.id, $.window, $.history),
            ),
          ),
        ),
        $.error,
        $.trace,
        seq(
          s.log("error", $.error, $.trace),
          s.view__window_container(
            $.out,
            $.window,
            $.current_window,

            s.view__window_bar($.window, $.id, $.view, "Home"),
            s.html(
              "div",
              l(s.class("AppWindow__content")),
              s.view__string("Error, see console for details"),
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
      s.row(
        $.out,
        l(s.class("AppWindow__header")),
        s.view__button(
          l(s.class("AppWindow__closeButton")),
          "",
          seq(
            s.receive($.e),
            u($.e, s.click(__)),
            s.on__close_window($.window),
          ),
        ),
        s.html("h1", l(s.class("AppWindow__title")), s.view__string($.name)),
        s.expr_iter(s.timestamp($.ts), s.view__string($.ts)),

        s.html("div", l(s.style("flex", "1 0 auto"))),
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
  },
  view__app_menu: {
    file__name: "App menu",
    rule__params: l($.out),
    rule__body: s.row(
      $.out,
      l(
        s.style("backgroundColor", "white"),
        s.style("borderBottom", "1px solid black"),
      ),
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
            l("reset", s.db__reset()),
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
    rule__params: l($.out, $.window, $.location),
    rule__body: seq(
      s.if_var($.window, s.id($.window)),
      s.new__history($.h, $.history, $.window, $.location),
      s.append_left_right(
        $.out,
        $.h,
        l(
          s.update($.window, "db__schema", "window"),
          s.update($.window, "window__current_history", $.history),
        ),
      ),
    ),
  },
  new__history: {
    rule__params: l($.out, $.history, $.window, $.location),
    rule__body: seq(
      s.if_var($.history, s.id($.history)),
      s.timestamp($.ts),
      s.location_id_view_params($.location, $.id, $.view, $.params),

      s.collect_item_in(
        $.out,
        s.update($.history, $.f, $.v),
        alt(
          u(l($.f, $.v), l("db__schema", "history")),
          u(l($.f, $.v), l("time__created", $.ts)),
          u(l($.f, $.v), l("history__window", $.window)),
          u(l($.f, $.v), l("history__id", $.id)),
          seq(s.nonvar($.view), u(l($.f, $.v), l("history__view", $.view))),
          seq(
            s.nonvar($.params),
            u(l($.f, $.v), l("history__params", $.params)),
          ),
        ),
      ),
    ),
  },

  get_state: {
    rule__params: l($.value, $.state, $.default),
    rule__body: s.value_record_field_default(
      $.value,
      $.state,
      "history__params",
      $.default,
    ),
  },
  set_state: {
    rule__params: l($.state, $.value),
    rule__body: seq(
      s.db__update(l(s.update($.state, "history__params", $.value))),
      f.history__window($.state, $.window),
    ),
  },

  // event handlers
  on__set_view_menu: {
    rule__params: l($.window, $.next_view),
    rule__body: seq(
      f.window__current_history($.window, $.history),
      s.db__update(l(s.update($.history, "history__view", $.next_view))),
    ),
  },
  on__select_window: {
    rule__params: l($.window),
    rule__body: seq(
      s.db__update(l(s.update("browser", "browser__current_window", $.window))),
    ),
  },
  on__new_window: {
    rule__params: l($.location),
    rule__body: seq(
      s.new__window($.out, __, $.location),
      s.db__update($.out),
      s.render_root(),
    ),
  },
  on__close_window: {
    rule__params: l($.window),
    rule__body: seq(s.db__update(l(s.delete($.window))), s.render_root()),
  },
  on__push: {
    rule__params: l($.window, $.location),
    rule__body: seq(
      f.window__current_history($.window, $.prev),
      s.new__history($.h, $.next, $.window, $.location),
      s.append_left_right(
        $.batch,
        $.h,
        l(
          s.update($.next, "history__back", $.prev),
          s.update($.prev, "history__forward", $.next),
          s.update($.window, "window__current_history", $.next),
        ),
      ),
      s.db__update($.batch),
    ),
  },

  on__back: {
    rule__params: l($.window),
    rule__body: seq(
      f.window__current_history($.window, $.forward),
      f.history__back($.forward, $.back),
      s.db__update(
        l(
          s.update($.window, "window__current_history", $.back),
          s.update($.back, "history__forward", $.forward),
          s.delete($.forward, "history__back"),
        ),
      ),
    ),
  },
  on__forward: {
    rule__params: l($.window),
    rule__body: seq(
      f.window__current_history($.window, $.back),
      f.history__forward($.back, $.forward),
      s.db__update(
        l(
          s.update($.window, "window__current_history", $.forward),
          s.update($.forward, "history__back", $.back),
          s.delete($.back, "history__forward"),
        ),
      ),
    ),
  },
} satisfies Record<string, Rec>;

export const browserInitState = {
  root_history: {
    db__schema: "history",
    history__window: "root_window",
    history__id: "home",
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
