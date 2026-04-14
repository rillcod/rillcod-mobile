import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Asset } from 'expo-asset';

export interface InvoiceItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface InvoiceData {
  number: string;
  date: string;
  items: InvoiceItem[];
  amount: number;
  currency: string;
  studentName: string;
  schoolName: string;
  schoolAddress?: string;
  status: string;
  notes?: string;
}

/**
 * InvoicePDFService - Mobile port of the Smart Document engine.
 */
export const invoicePDFService = {
  /**
   * Generates a PDF for an invoice/receipt and triggers the OS share sheet.
   */
  async generateAndShare(data: InvoiceData, template: 'classic' | 'bold' = 'classic') {
    const html = this.getHTML(data, template);
    
    try {
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch (err) {
      console.error('PDF Generation failed:', err);
      throw err;
    }
  },

  getHTML(data: InvoiceData, template: 'classic' | 'bold') {
    const symbol = data.currency === 'NGN' ? '₦' : '$';
    const accent = template === 'bold' ? '#f59e0b' : '#4f46e5';
    const isBold = template === 'bold';
    
    const itemsHtml = data.items.map(item => `
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid ${isBold ? '#ffffff10' : '#f1f5f9'};">
          <div style="font-weight: 800; font-size: 14px;">${item.description}</div>
        </td>
        <td style="padding: 12px 0; text-align: center; border-bottom: 1px solid ${isBold ? '#ffffff10' : '#f1f5f9'};">
          ${item.quantity}
        </td>
        <td style="padding: 12px 0; text-align: right; border-bottom: 1px solid ${isBold ? '#ffffff10' : '#f1f5f9'};">
          ${symbol}${item.unit_price.toLocaleString()}
        </td>
        <td style="padding: 12px 0; text-align: right; border-bottom: 1px solid ${isBold ? '#ffffff10' : '#f1f5f9'};">
          <div style="font-weight: 900;">${symbol}${item.total.toLocaleString()}</div>
        </td>
      </tr>
    `).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;900&display=swap" rel="stylesheet">
        <style>
          body {
            font-family: 'Outfit', sans-serif;
            margin: 0;
            padding: 40px;
            background-color: ${isBold ? '#0f0f1f' : '#ffffff'};
            color: ${isBold ? '#ffffff' : '#1e293b'};
          }
          .header { display: flex; justify-content: space-between; margin-bottom: 60px; }
          .logo-box { width: 60px; height: 60px; background: white; padding: 10px; border-radius: 12px; }
          .title { font-size: 48px; font-weight: 900; text-transform: uppercase; color: ${accent}; margin: 20px 0 10px; }
          .ref-box { display: flex; gap: 20px; color: ${isBold ? '#ffffff60' : '#64748b'}; font-size: 12px; font-weight: 700; text-transform: uppercase; }
          .client-box { margin-bottom: 40px; }
          .client-label { font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; color: ${isBold ? '#ffffff40' : '#94a3b8'}; border-bottom: 1px solid ${isBold ? '#ffffff10' : '#f1f5f9'}; padding-bottom: 8px; margin-bottom: 15px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
          th { text-align: left; font-size: 10px; font-weight: 900; text-transform: uppercase; color: ${isBold ? '#ffffff40' : '#94a3b8'}; padding-bottom: 15px; }
          .summary { display: flex; justify-content: flex-end; }
          .summary-box { width: 250px; }
          .total-row { display: flex; justify-content: space-between; align-items: baseline; border-top: 2px solid ${isBold ? '#ffffff20' : '#1e293b'}; padding-top: 15px; margin-top: 15px; }
          .total-amt { font-size: 28px; font-weight: 900; color: ${isBold ? '#ffffff' : '#1e293b'}; }
          .footer { margin-top: auto; border-top: 1px solid ${isBold ? '#ffffff10' : '#f1f5f9'}; padding-top: 30px; display: flex; justify-content: space-between; align-items: center; }
          .status-badge { background: ${accent}20; color: ${accent}; padding: 6px 12px; border-radius: 8px; font-size: 10px; font-weight: 900; text-transform: uppercase; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div style="font-weight: 900; font-size: 20px; text-transform: uppercase;">
              Rillcod <span style="color: ${accent}">Academy</span>
            </div>
            <div class="title">Invoice</div>
            <div class="ref-box">
              <div>Ref: ${data.number}</div>
              <div>Date: ${data.date}</div>
            </div>
          </div>
          <div style="text-align: right;">
            <div class="status-badge">${data.status}</div>
            <div style="margin-top: 15px; font-size: 12px; font-weight: 700;">${data.schoolName}</div>
            <div style="font-size: 10px; color: ${isBold ? '#ffffff40' : '#64748b'}; margin-top: 4px;">${data.schoolAddress || 'Digital Learning Hub, Edo State'}</div>
          </div>
        </div>

        <div class="client-box">
          <div class="client-label">Bill To</div>
          <div style="font-weight: 900; font-size: 18px; text-transform: uppercase;">${data.studentName}</div>
          <div style="font-size: 12px; color: ${isBold ? '#ffffff60' : '#64748b'}; margin-top: 4px;">Official Student Account</div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th style="text-align: center;">Qty</th>
              <th style="text-align: right;">Price</th>
              <th style="text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div class="summary">
          <div class="summary-box">
            <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: 700; color: ${isBold ? '#ffffff60' : '#64748b'};">
              <span>Subtotal</span>
              <span>${symbol}${data.amount.toLocaleString()}</span>
            </div>
            <div class="total-row">
              <span style="font-size: 10px; font-weight: 900; text-transform: uppercase; color: ${isBold ? '#ffffff40' : '#94a3b8'};">Total Amount</span>
              <span class="total-amt">${symbol}${data.amount.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div class="footer">
          <div style="font-size: 9px; text-transform: uppercase; color: ${isBold ? '#ffffff20' : '#cbd5e1'}; letter-spacing: 4px;">
            System Generated • Rillcod Finance
          </div>
          <div style="text-align: right;">
             <div style="font-size: 10px; font-weight: 900;">Accounts Department</div>
             <div style="font-size: 8px; color: ${isBold ? '#ffffff40' : '#94a3b8'}; text-transform: uppercase;">Authorized Signature</div>
          </div>
        </div>
      </body>
      </html>
    `;
  }
};
