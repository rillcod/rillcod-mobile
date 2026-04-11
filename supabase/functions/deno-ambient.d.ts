/**
 * Minimal `Deno` global for editor / `tsc` when files are opened outside Deno.
 * Runtime is Deno on Supabase Edge Functions.
 */
declare global {
  // eslint-disable-next-line no-var
  var Deno: {
    serve(handler: (req: Request) => Response | Promise<Response>): void;
    env: {
      get(key: string): string | undefined;
    };
  };
}

export {};
