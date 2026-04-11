/** Parent-facing copy aligned with web `buildShareMessage` on assignment detail. */
export function buildAssignmentWhatsAppShareMessage(
  assignment: {
    title: string;
    due_date: string | null;
    max_points: number | null;
    assignment_type: string | null;
    instructions: string | null;
    courses?: { title: string | null; programs?: { name: string | null } | null } | null;
  },
  opts?: { portalBaseUrl?: string; assignmentId?: string },
): string {
  const course =
    assignment.courses?.title ||
    assignment.courses?.programs?.name ||
    'STEM / AI / Coding';
  const due = assignment.due_date
    ? new Date(assignment.due_date).toLocaleDateString('en-NG', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;
  const pts = assignment.max_points ?? 100;
  const rawType = assignment.assignment_type || 'Assignment';
  const type = rawType.charAt(0).toUpperCase() + rawType.slice(1);
  let msg = `📚 *${type}: ${assignment.title}*\n`;
  msg += `📖 Course: ${course}\n`;
  if (due) msg += `📅 Due: *${due}*\n`;
  msg += `🏆 Total marks: ${pts}\n`;
  if (assignment.instructions) {
    const brief =
      assignment.instructions.length > 200
        ? `${assignment.instructions.slice(0, 200).trimEnd()}…`
        : assignment.instructions;
    msg += `\n📝 *Instructions:*\n${brief}\n`;
  }
  msg += `\nDear Parent/Guardian, please ensure your child completes and submits this assignment before the due date.\n`;
  const base = (opts?.portalBaseUrl || 'https://rillcod.com').replace(/\/$/, '');
  if (opts?.assignmentId) {
    msg += `\n🔗 View on portal: ${base}/dashboard/assignments/${opts.assignmentId}`;
  }
  msg += `\n\n_Rillcod Technologies — www.rillcod.com_`;
  return msg;
}
