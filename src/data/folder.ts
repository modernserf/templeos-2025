import { dbf } from "./core";
import { Rec } from ".";
import { l, s, $, view } from "../expr";

export const folderData = {
  // schemas
  folder: {
    db__schema: "schema",
    file__name: "Folder",
    file__description: l("A collection of records"),
    db__fields: l(dbf.field("rule__params"), dbf.field("rule__body")),
  },

  folder__items: {
    db__schema: "field",
    file__name: "File folder items",
    file__description: l("ids of files in folder"),
    db__type: "multi_ref",
    db__index: s.multiRef(),
  },

  view__folder_list: {
    file__name: "Folder - List",
    view__schema: "folder",
    rule__params: l($.id, $.state, $.out),
    rule__body: view.render(
      view.column(
        l(),
        s.children(
          view.iter(s.file__description($.id, $.desc), l(view.text($.desc))),
          view.iter(
            s.folder__items($.id, $.item),
            l(view.row(l(), s.children(view.file_info($.item)))),
          ),
        ),
      ),
      $.out,
    ),
  },
  view__folder_icon: {
    file__name: "Folder - Icon",
    view__schema: "folder",
    rule__params: l($.id, $.state, $.out),
    rule__body: view.render(
      view.column(
        l(),
        s.children(
          view.iter(s.file__description($.id, $.desc), l(view.text($.desc))),
          view.row(
            l(),
            s.children(
              view.iter(
                s.folder__items($.id, $.item),
                l(
                  view.column(
                    l(),
                    s.children(view.icon(), view.file_link($.item)),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
      $.out,
    ),
  },

  // views
} satisfies Record<string, Rec>;
