import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { generateStandardReportHtml, generateModernReportHtml } from './reportHtmlTemplates';

/**
 * Generates a PDF report using expo-print and optionally shares it.
 */
export async function generateAndShareReportPDF(
    reportData: any,
    orgSettings: any,
    isModern: boolean = false
) {
    try {
        // Choose the template based on web parity settings
        const html = isModern 
            ? generateModernReportHtml(reportData, orgSettings)
            : generateStandardReportHtml(reportData, orgSettings);

        // Generate the PDF
        const { uri } = await Print.printToFileAsync({
            html,
            width: 595, // strict A4 width in px (794 is web scale, 595 is point scale)
            height: 842, // A4 height
        });

        console.log('PDF Generated at:', uri);

        // Share the generated PDF
        if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(uri, {
                UTI: '.pdf',
                mimeType: 'application/pdf',
                dialogTitle: `Student Report - ${reportData.student_name || 'Rillcod'}`
            });
        }

        return uri;
    } catch (error) {
        console.error('Error generating report PDF:', error);
        throw error;
    }
}
