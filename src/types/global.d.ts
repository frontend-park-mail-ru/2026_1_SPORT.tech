// src/types/global.d.ts

// Для CSS файлов
declare module '*.css' {
  const content: string;
  export default content;
}

// Для HBS шаблонов
declare module '*.hbs' {
  const content: string;
  export default content;
}

// Расширение Handlebar
declare module 'handlebars' {
  export interface TemplateDelegate {
    (context: Record<string, unknown>): string;
  }
  export function compile(source: string): TemplateDelegate;
  export const templates: Record<string, TemplateDelegate>;
}

// Расширение Window
interface Window {
  Handlebars: typeof Handlebars & {
    templates: Record<string, Handlebars.TemplateDelegate>;
  };
  router: {
    handleRouting: () => Promise<void>;
    navigateTo: (path: string) => void;
    setCurrentUser: (user: unknown) => void;
    getCurrentUser: (options?: { force: boolean }) => Promise<unknown>;
  };
}
