import { supabase } from '../lib/supabase';
import type { Database } from '../types/supabase';

export interface TemplateVariables {
  [key: string]: string | number;
}

export class TemplateService {
  /**
   * Renders a template by replacing {{variable}} with actual values
   */
  render(content: string, variables: TemplateVariables): string {
    return content.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => {
      return variables[key] !== undefined ? String(variables[key]) : match;
    });
  }

  async getTemplate(name: string, type: 'email' | 'sms') {
    const { data, error } = await supabase
      .from('notification_templates')
      .select('*')
      .eq('name', name)
      .eq('type', type)
      .eq('is_active', true)
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error(`Template "${name}" of type ${type} not found`);

    return data;
  }

  /** Load a DB template and substitute `{{var}}` placeholders in subject + body. */
  async compose(name: string, type: 'email' | 'sms', variables: TemplateVariables) {
    const row = await this.getTemplate(name, type);
    return {
      subject: row.subject ? this.render(row.subject, variables) : null,
      content: this.render(row.content, variables),
    };
  }
}

export const templateService = new TemplateService();
