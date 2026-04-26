// src/types/handlebars.d.ts

declare module '*.hbs' {
  const content: string;
  export default content;
}

declare module 'handlebars' {
  export interface TemplateDelegate {
    (context: Record<string, unknown>): string;
  }

  export function compile(source: string): TemplateDelegate;
  export const templates: Record<string, TemplateDelegate>;
}

declare var Handlebars: {
  templates: Record<string, (context: Record<string, unknown>) => string>;
  compile(source: string): (context: Record<string, unknown>) => string;
};
