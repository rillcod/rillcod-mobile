/// <reference path="../deno-ambient.d.ts" />
/**
 * Edge Function: assign-teacher-schools
 *
 * Atomically replaces a teacher's school assignments.
 * Accepts a list of school IDs (with one marked primary).
 * Admin-only. Fires the sync trigger automatically via DB.
 *
 * POST /functions/v1/assign-teacher-schools
 * Body: { teacher_id: string, schools: { school_id: string, is_primary: boolean }[] }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Verify the caller is an authenticated admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: callerProfile, error: profileError } = await callerClient
      .from('portal_users')
      .select('id, role')
      .single();

    if (profileError || callerProfile?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Forbidden: admin role required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { teacher_id, schools } = body as {
      teacher_id: string;
      schools: { school_id: string; is_primary?: boolean }[];
    };

    if (!teacher_id || !Array.isArray(schools)) {
      return new Response(JSON.stringify({ error: 'teacher_id and schools[] are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (schools.length === 0) {
      return new Response(JSON.stringify({ error: 'At least one school is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Ensure exactly one primary school
    const hasPrimary = schools.some(s => s.is_primary);
    const normalizedSchools = schools.map((s, i) => ({
      teacher_id,
      school_id: s.school_id,
      is_primary: hasPrimary ? !!s.is_primary : i === 0,
      assigned_by: callerProfile.id,
    }));

    // Use service role for the atomic operation
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Verify teacher exists and has role=teacher
    const { data: teacher, error: teacherError } = await adminClient
      .from('portal_users')
      .select('id, role')
      .eq('id', teacher_id)
      .single();

    if (teacherError || teacher?.role !== 'teacher') {
      return new Response(JSON.stringify({ error: 'Teacher not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify all school IDs exist and are approved
    const schoolIds = normalizedSchools.map(s => s.school_id);
    const { data: validSchools, error: schoolsError } = await adminClient
      .from('schools')
      .select('id')
      .in('id', schoolIds)
      .eq('status', 'approved');

    if (schoolsError) throw schoolsError;

    const validIds = new Set((validSchools ?? []).map((s: any) => s.id));
    const invalidIds = schoolIds.filter(id => !validIds.has(id));
    if (invalidIds.length > 0) {
      return new Response(
        JSON.stringify({ error: `Schools not approved or not found: ${invalidIds.join(', ')}` }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Atomic replace: delete existing → insert new
    // The DB trigger (trg_sync_teacher_primary_school) will update portal_users automatically
    const { error: deleteError } = await adminClient
      .from('teacher_schools')
      .delete()
      .eq('teacher_id', teacher_id);

    if (deleteError) throw deleteError;

    const { data: inserted, error: insertError } = await adminClient
      .from('teacher_schools')
      .insert(normalizedSchools)
      .select('id, school_id, is_primary');

    if (insertError) throw insertError;

    return new Response(JSON.stringify({ success: true, assignments: inserted }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message ?? 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
