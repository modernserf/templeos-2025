import { l, s, $, __, fn, xfn, x } from "../expr";
import { pkg } from "../pkg";

export const { rules: codeExplorerData } = pkg("code_explorer", {
  code_explorer: {
    db__schema: "view",
    file__name: "Code explorer",
    view__subject: s.self(),
    view__params_type: s.search__view_params_type(),
    rule__params: l($.out, $._id, $.state),
    rule__body: s.search__view(
      $.out,
      $.state,
      l(s.limit(20)),
      fn($.id, $.search)(
        s.rule__params(__, $.id),
        s.none(s.test__group(__, $.id)),
        s.string_substring($.id, $.search),
      ),
      fn($.o, $.id)(
        s.rule__params($.params, $.id),
        s.box($.box, $.id, $.params),
        s.html(
          $.o,
          "div",
          l(
            s.style("margin", "0.25rem 0.5rem 0.25rem"),
            s.style("width", "100%"),
          ),
          x.view__expr($.box),
          xfn($.u)(
            s.file__description($.desc, $.id),
            s.view__text($.u, $.desc),
          ),
        ),
      ),
    ),
  },
});
