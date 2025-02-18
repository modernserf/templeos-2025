import { Rec } from ".";
import { l, seq, s, $, Expr, Box, List } from "../expr";

type ClickParam = Box<"meta_key", []>;
type ClickEvent = Box<"click", [List<ClickParam>]>;
export type ButtonEvent = ClickEvent;

export type ChangeEvent = Box<"change", [Expr]>;
export type FocusEvent = Box<"focus", []>;
export type BlurEvent = Box<"blur", []>;
export type InputEvent = ChangeEvent | FocusEvent | BlurEvent;

export const viewForm = {
  view__button: {
    rule__params: l(
      s.Button($.params, $.label, $.event, $.handler),
      $.params,
      $.label,
      l($.event, $.handler),
    ),
  },
  view__input: {
    rule__params: l(
      s.Input($.props, $.value, $.next, $.handler),
      $.props,
      $.value,
      l($.next, $.handler),
    ),
  },
  view__select: {
    rule__params: l(
      s.Select($.params, $.value, $.options, $.next, $.handler),
      $.params,
      $.value,
      $.options,
      l($.next, $.handler),
    ),
  },
  view__menu: {
    rule__params: l($.out, $.params, $.label, $.options, $.on_change),
    rule__body: seq(
      s.append_left_right($.menu_options, l(s.option("", $.label)), $.options),
      s.view__select($.out, $.params, $.label, $.menu_options, $.on_change),
    ),
  },
  view__fit_content_input: {
    rule__params: l($.out, $.value, $.on_change),
    rule__body: s.view__input(
      $.out,
      l(s.class("Input--fitContent"), s.debounce(300)),
      $.value,
      $.on_change,
    ),
  },
} satisfies Record<string, Rec>;
