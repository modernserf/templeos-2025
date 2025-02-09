import { Rec } from "./data";
import { ruleCore } from "./rule__core";
import { ruleDB } from "./rule_db";
import { ruleStruct } from "./rule_box";
import { ruleType } from "./rule_type";

export const rules = {
  ...ruleCore,
  ...ruleType,
  ...ruleStruct,
  ...ruleDB,
} satisfies Record<string, Rec>;
