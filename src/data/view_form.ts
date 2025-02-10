import { Rec } from ".";
import { l, r, s, $, Expr, view, Struct, List } from "../expr";

type ClickParam = Struct<"meta_key", []>;
type ClickEvent = Struct<"click", [List<ClickParam>]>;
export type ButtonEvent = ClickEvent;

export type ChangeEvent = Struct<"change", [Expr]>;
export type FocusEvent = Struct<"focus", []>;
export type BlurEvent = Struct<"blur", []>;
export type InputEvent = ChangeEvent | FocusEvent | BlurEvent;

export const viewForm = {
  view__button: {
    rule__params: l(
      $.params,
      $.label,
      l($.event, $.handler),
      s.Button($.params, $.label, $.event, $.handler),
    ),
    rule__body: r(),
  },
  view__input: {
    rule__params: l(
      $.props,
      $.value,
      l($.next, $.handler),
      s.Input($.props, $.value, $.next, $.handler),
    ),
    rule__body: r(),
  },
  view__select: {
    rule__params: l(
      $.params,
      $.value,
      $.options,
      l($.next, $.handler),
      s.Select(l(), $.value, $.options, $.next, $.handler),
    ),
    rule__body: r(),
  },
  view__menu: {
    rule__params: l($.label, $.options, $.on_change, $.out),
    rule__body: r(
      s.box_box_append(l(s.option("", $.label)), $.options, $.menu_options),
      view.select(l(), $.label, $.menu_options, $.on_change, $.out),
    ),
  },
  view__fit_content_input: {
    rule__params: l($.value, $.on_change, $.out),
    rule__body: view.input(
      l(s.class("Input--fitContent"), s.debounce(300)),
      $.value,
      $.on_change,
      $.out,
    ),
  },
} satisfies Record<string, Rec>;
