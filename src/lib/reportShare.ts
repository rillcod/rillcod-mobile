import { Alert, Platform, Share } from 'react-native';

/** Plain-text summary for WhatsApp / SMS / email when PDF is not needed. */
export function buildStudentProgressReportTextSummary(params: {
  studentName: string;
  courseName: string;
  term: string;
  period: string;
  overallGrade: string;
  overallScore: number;
  strengths: string;
  growth: string;
  assessment: string;
}): string {
  return [
    'Student progress report',
    `Student: ${params.studentName}`,
    `Course: ${params.courseName || '—'}`,
    `${params.term || '—'} — ${params.period || '—'}`,
    '',
    `Overall: ${params.overallGrade} (${params.overallScore}%)`,
    '',
    'Strengths:',
    params.strengths.trim() || '—',
    '',
    'Areas for growth:',
    params.growth.trim() || '—',
    '',
    'Instructor assessment:',
    params.assessment.trim() || '—',
  ].join('\n');
}

export async function sharePlainText(title: string, message: string): Promise<void> {
  try {
    await Share.share(Platform.OS === 'ios' ? { title, message } : { title, message });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!/cancel|dismiss|not share/i.test(msg)) {
      Alert.alert('Share failed', msg || 'Could not open the share sheet.');
    }
  }
}
