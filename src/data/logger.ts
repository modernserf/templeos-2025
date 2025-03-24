import { l, s, $, __, seq, x, xfn, u } from "../expr";
import { pkg } from "../pkg";

export const { rules: logging } = pkg("logging", {
  _log: {
    db__schema: "schema",
    file__name: "Log record",
    schema__fields: l(),
  },
  _default_log: {
    db__schema: "_log",
    file__name: "Default log",
  },
  _entry: {
    db__schema: "schema",
    file__name: "Log entry",
    schema__fields: l(
      s.field("_entry_log"),
      s.field("_data"),
      s.field("_level"),
      s.field("time__created"),
    ),
  },
  _entry_log: {
    db__schema: "field",
    file__name: "Log entry parent",
    field__type: s.t_ref("_log"),
    field__index: s.ref(),
  },
  _data: {
    db__schema: "field",
    file__name: "Log data",
    field__type: s.any_type(),
  },
  _t_level: {
    rule__params: l($.t),
    rule__body: s.enum($.t, s.debug(), s.info(), s.warn(), s.error()),
  },
  _level: {
    db__schema: "field",
    file__name: "Log level",
    field__type: s._t_level(),
  },

  current_logger: {
    rule__params: l("_default_log"),
  },

  write_log: {
    rule__params: l($.log, $.level, $.data),
    rule__body: seq(
      s.timestamp($.ts),
      s.id($.id),
      s.db__update(
        l(
          s.update($.id, "db__schema", "_entry"),
          s.update($.id, "_entry_log", $.log),
          s.update($.id, "_level", $.level),
          s.update($.id, "_data", $.data),
          s.update($.id, "time__created", $.ts),
        ),
      ),
    ),
  },
  log_debug: {
    rule__params: l($.data),
    rule__body: s.write_log(x.current_logger(), s.debug(), $.data),
  },

  _view_log: {
    db__schema: "view",
    file__name: "Log",
    view__subject: s.schema("_log"),
    rule__params: l($.out, $.log_id, $._state),
    rule__body: s.cond(
      s.table(
        $.out,
        l(),
        x.table_section(
          x.table_header(l(), "time", "level", "message"),
          xfn($.o)(
            s._entry_log($.log_id, $.entry),
            s.table_row(
              $.o,
              l(),
              x.view__time(x.time__created($.entry)),
              x.view__expr(x._level($.entry)),
              x.view__expr(x._data($.entry)),
            ),
          ),
        ),
      ),
      u($.out, "Log is empty"),
    ),
  },
});
