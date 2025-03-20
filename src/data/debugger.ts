import { l, s, $, __, seq, x } from "../expr";
import { pkg_ } from "../pkg";
import { printValue } from "../value";

export const { rules: debug, rulePrimitives: debugPrim } = pkg_("debug", {
  // TODO: set process flag
  begin_trace: {
    rule__params: l(),
    rule__primitive: function* (it) {
      it.__trace = true;
      yield it.result();
    },
  },
  end_trace: {
    rule__params: l(),
    rule__primitive: function* (it) {
      it.__trace = false;
      yield it.result();
    },
  },
  log: {
    rule__params: $.messages,
    rule__primitive: function* (it, ...args) {
      console.log(...args.map((arg) => printValue(arg)));
      yield it.result();
    },
  },
  log_trace: {
    rule__params: $.messages,
    rule__primitive: function* (it, ...args) {
      if (it.__trace) {
        console.log(...args.map((arg) => printValue(arg)));
      }
      yield it.result();
    },
  },
  init_debugger: {
    rule__params: l(),
    rule__body: seq(
      s.event_bus("debugger"),
      s.event_subscribe(__, "debugger", s._handle_event()),
    ),
  },
  _handle_event: {
    rule__params: l($.e),
    rule__body: s.match_cond(
      $.e,
      l(
        s.break($.pid, $.ref),
        seq(
          s.on__new_window(
            s.location(
              "view__debugger",
              "view__debugger",
              s.debugger($.pid, $.ref),
            ),
          ),
        ),
      ),
    ),
  },
  debugger: {
    rule__params: l(),
    rule__body: seq(
      s.self($.self),
      s.id($.ref),
      s.event_send("debugger", s.break($.self, $.ref)),
      s.receive(s.resume($.ref)),
    ),
  },
  _resume: {
    rule__params: l($.pid, $.ref),
    rule__body: s.send($.pid, s.resume($.ref)),
  },
  view__debugger: {
    db__schema: "view",
    file__name: "Debugger",
    view__subject: s.self(),
    rule__params: l($.out, $._id, $.state),
    rule__body: seq(
      s.current_window($.window),
      s.get_state(s.debugger($.pid, $.ref), $.state, s.none()),
      s.column(
        $.out,
        l(s.style("padding", "1rem")),
        x.view__button(
          l(),
          "Resume",
          s.on_click(
            seq(s._resume($.pid, $.ref), s.on__close_window($.window)),
          ),
        ),
      ),
    ),
  },
});
