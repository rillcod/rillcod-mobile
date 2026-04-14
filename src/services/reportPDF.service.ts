import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

interface Report {
  course_name: string;
  report_term: string;
  theory_score: number | null;
  practical_score: number | null;
  attendance_score: number | null;
  participation_score?: number | null;
  overall_score: number | null;
  overall_grade: string | null;
  report_date: string | null;
  instructor_name: string | null;
  key_strengths: string | null;
  areas_for_growth: string | null;
  instructor_assessment?: string | null;
  learning_milestones?: string[] | null;
}

export const progressReportPDFService = {
  /**
   * Generates a premium HTML template for a progress report.
   */
  generateHTML: (report: Report, studentName: string) => `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;900&display=swap');
          body {
            font-family: 'Outfit', sans-serif;
            padding: 40px;
            color: #0f172a;
            background: #fff;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 4px solid #0f172a;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .logo-text {
            font-size: 28px;
            font-weight: 900;
            letter-spacing: -1px;
            color: #0f172a;
          }
          .report-meta {
            text-align: right;
          }
          .report-meta h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 900;
            text-transform: uppercase;
          }
          .report-meta p {
            margin: 5px 0 0;
            font-size: 14px;
            color: #64748b;
          }
          .student-info {
            margin-bottom: 40px;
          }
          .student-info h2 {
            font-size: 32px;
            margin: 0;
            letter-spacing: -0.5px;
          }
          .student-info p {
            margin: 5px 0 0;
            font-size: 16px;
            font-weight: 700;
            color: #f59e0b;
            text-transform: uppercase;
          }
          .scores-grid {
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 20px;
            margin-bottom: 40px;
          }
          .score-card {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            padding: 20px;
            text-align: center;
          }
          .score-label {
            font-size: 10px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #64748b;
            margin-bottom: 8px;
          }
          .score-value {
            font-size: 24px;
            font-weight: 900;
          }
          .score-grade {
            font-size: 48px;
            font-weight: 900;
            color: #0f172a;
          }
          .section {
            margin-bottom: 30px;
          }
          .section-title {
            font-size: 12px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            color: #64748b;
            margin-bottom: 10px;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 5px;
          }
          .section-content {
            font-size: 14px;
            line-height: 1.6;
            color: #334155;
          }
          .milestones-list {
            margin: 0;
            padding-left: 20px;
          }
          .milestones-list li {
            margin-bottom: 8px;
          }
          .footer {
            margin-top: 60px;
            padding-top: 20px;
            border-top: 1px solid #e2e8f0;
            font-size: 12px;
            color: #64748b;
            display: flex;
            justify-content: space-between;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo-text">RILLCOD<span style="color: #f59e0b">ACADEMY</span></div>
          <div class="report-meta">
            <h1>Progress Report</h1>
            <p>${report.report_term}</p>
          </div>
        </div>

        <div class="student-info">
          <h2>${studentName}</h2>
          <p>${report.course_name}</p>
        </div>

        <div class="scores-grid">
          <div class="score-card">
            <div class="score-label">Theory</div>
            <div class="score-value">${report.theory_score ?? '—'}%</div>
          </div>
          <div class="score-card">
            <div class="score-label">Practical</div>
            <div class="score-value">${report.practical_score ?? '—'}%</div>
          </div>
          <div class="score-card">
            <div class="score-label">Attendance</div>
            <div class="score-value">${report.attendance_score ?? '—'}%</div>
          </div>
          <div class="score-card">
            <div class="score-label">Project Engagement</div>
            <div class="score-value">${report.participation_score ?? '—'}%</div>
          </div>
          <div class="score-card" style="background: #0f172a; color: #fff;">
            <div class="score-label" style="color: #94a3b8;">Grade</div>
            <div class="score-grade" style="color: #f59e0b;">${report.overall_grade ?? '—'}</div>
            <div style="font-size: 12px; font-weight: 900;">${report.overall_score ?? '—'}%</div>
          </div>
        </div>

        ${report.key_strengths ? `
          <div class="section">
            <div class="section-title">Key Strengths</div>
            <div class="section-content">${report.key_strengths}</div>
          </div>
        ` : ''}

        ${report.areas_for_growth ? `
          <div class="section">
            <div class="section-title">Areas for Growth</div>
            <div class="section-content">${report.areas_for_growth}</div>
          </div>
        ` : ''}

        ${report.instructor_assessment ? `
          <div class="section">
            <div class="section-title">Instructor Assessment</div>
            <div class="section-content">${report.instructor_assessment}</div>
          </div>
        ` : ''}

        ${report.learning_milestones && report.learning_milestones.length > 0 ? `
          <div class="section">
            <div class="section-title">Learning Milestones</div>
            <ul class="milestones-list section-content">
              ${report.learning_milestones.map(m => `<li>${m}</li>`).join('')}
            </ul>
          </div>
        ` : ''}

        <div class="footer">
          <div>Report Date: ${report.report_date ? new Date(report.report_date).toLocaleDateString() : '—'}</div>
          <div>Instructor: ${report.instructor_name || '—'}</div>
          <div>© 2025 Rillcod Academy</div>
        </div>
      </body>
    </html>
  `,

  /**
   * Generates and prints the report to a PDF file, then shares it.
   */
  shareReportPDF: async (report: Report, studentName: string) => {
    const html = progressReportPDFService.generateHTML(report, studentName);
    
    try {
      const { uri } = await Print.printToFileAsync({ html });
      
      if (Platform.OS === 'ios') {
        await Sharing.shareAsync(uri);
      } else {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: \`Progress Report: \${studentName}\`,
          UTI: 'com.adobe.pdf',
        });
      }
    } catch (error) {
      console.error('Failed to generate/share report PDF:', error);
      throw error;
    }
  },
};
