/**
 * Ambient modules for Deno `https://esm.sh/...` imports (editor + `tsc -p` only).
 */

declare module 'https://esm.sh/aws4fetch@1.0.20' {
  export class AwsClient {
    constructor(init: {
      accessKeyId: string;
      secretAccessKey: string;
      service: string;
      region: string;
    });
    sign(
      input: Request,
      init?: { aws?: { signQuery?: boolean }; expiresIn?: number },
    ): Promise<Request>;
  }
}

declare module 'https://esm.sh/@supabase/supabase-js@2.49.1' {
  export type SupabaseClient = import('@supabase/supabase-js').SupabaseClient;
  export function createClient(
    supabaseUrl: string,
    supabaseKey: string,
    options?: unknown,
  ): import('@supabase/supabase-js').SupabaseClient;
}

declare module 'https://esm.sh/@supabase/supabase-js@2' {
  export type SupabaseClient = import('@supabase/supabase-js').SupabaseClient;
  export function createClient(
    supabaseUrl: string,
    supabaseKey: string,
    options?: unknown,
  ): import('@supabase/supabase-js').SupabaseClient;
}
