import { Field, FieldSchema, Rec } from "./schema";

export class SchemaBuilder {
  private fields: FieldSchema[] = [];
  constructor(private props: Rec) {}
  desc(description: string): this {
    this.props.file__description = description;
    return this;
  }
  field(id: Field, defaultValue?: unknown): this {
    this.fields.push({ id, defaultValue });
    return this;
  }
  build(): Rec {
    return {
      ...this.props,
      db__schema: "schema__schema",
      db__fields: this.fields,
    };
  }
}

export function S(name: string) {
  return new SchemaBuilder({
    file__name: name,
  });
}
