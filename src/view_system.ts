import { Rec } from "./data";
import { l, r, s, $, __, view, u } from "./expr";
import { f } from "./field";
import { db } from "./rule_db";

export const viewSystem = {
  // view helpers
  // utilities
  location_view: {
    rule__params: l($.location, $.view),
    rule__body: s.fork(
      // location for view type
      r(
        s.nonvar($.view),
        f.view__schema($.view, $.schema),
        f.db__schema($.location, $.schema),
      ),
      // view for location type
      r(
        s.nonvar($.location),
        f.db__schema($.location, $.schema),
        f.view__schema($.view, $.schema),
      ),
      // view for any type
      f.view__schema($.view, "schema__any"),
    ),
  },
  view_menu: {
    file__name: "View menu",
    file__description: l("the view selection menu on window chrome"),
    rule__params: l($.window, $.id, $.selectedView, $.out),
    rule__body: r(
      s.collect(
        s.option($.view, $.name),
        r(view.location_view($.id, $.view), f.file__name($.view, $.name)),
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
            f.window__currentHistory($.window, $.history),
            db.update($.tx, $.history, "history__view", $.nextView),
          ),
        ),
        $.out,
      ),
    ),
  },
  window: {
    file__name: "Window",
    rule__params: l($.window, $.out),
    rule__body: r(
      f.window__currentHistory($.window, $.history),
      f.browser__currentWindow("browser", $.currentWindow),
      f.history__location($.history, $.id),
      s.set_context("window_id", $.window),
      s.set_context("history_id", $.history),
      s.get_default($.id, "file__name", $.name, $.id),
      s.limit(
        1,
        s.fork(
          // view from params
          f.history__view($.history, $.view),
          // view from id
          view.location_view($.id, $.view),
        ),
      ),
      view.window_bar($.window, $.id, $.view, $.name, $.window_bar),
      s.try_error_catch(
        r(
          s.call($.view, $.id, $.history, $.main_content),
          u(
            $.out,
            s.WindowContainer(
              $.window,
              $.currentWindow,
              s.on__selectWindow($.window),
              s.on__back($.window),
              s.on__forward($.window),
              l($.window_bar, $.main_content),
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
  window_bar: {
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
  app_menu: {
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
                f.browser__currentWindow("browser", $.window),
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
                f.browser__currentWindow("browser", $.window),
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
} satisfies Record<string, Rec>;
