import { Rec } from "./data";
import { ruleCore } from "./rule__core";
import { ruleDB } from "./rule_db";
import { ruleBox } from "./rule_box";
import { ruleType } from "./rule_type";

export const rules = {
  ...ruleCore,
  ...ruleType,
  ...ruleBox,
  ...ruleDB,
} satisfies Record<string, Rec>;
