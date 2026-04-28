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

interface Window {
  router: {
    handleRouting: () => Promise<void>;
    navigateTo: (path: string) => void;
    setCurrentUser: (user: unknown) => void;
    getCurrentUser: (options?: { force: boolean }) => Promise<unknown>;
  };
}
