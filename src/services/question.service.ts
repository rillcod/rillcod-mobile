import { supabase } from '../lib/supabase';
import type { Database } from '../types/supabase';
import { cbtService } from './cbt.service';

export type QuestionType = 'multiple_choice' | 'true_false' | 'short_answer' | 'essay' | 'matching' | 'fill_in_blank';

export interface QuestionInput {
  exam_id: string;
  question_text: string;
  question_type: QuestionType;
  points: number;
  order_index?: number;
  options: any;
  correct_answer: any;
  explanation?: string;
}

export class QuestionService {
  async listQuestions(examId: string) {
    const { data, error } = await supabase
      .from('exam_questions')
      .select('*')
      .eq('exam_id', examId)
      .order('order_index', { ascending: true });

    if (error) throw error;
    return data ?? [];
  }

  async createQuestion(input: QuestionInput) {
    const { data, error } = await supabase
      .from('exam_questions')
      .insert([input])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateQuestion(id: string, input: Partial<QuestionInput>) {
    const { data, error } = await supabase
      .from('exam_questions')
      .update(input)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteQuestion(id: string) {
    const { error } = await supabase
      .from('exam_questions')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return true;
  }

  // ─── CBT (`cbt_questions`) — used by exam editor; legacy methods above target `exam_questions`. ───

  listCbtQuestionsForExam(examId: string) {
    return cbtService.listCbtQuestionRows(examId);
  }

  listCbtQuestionIdsForExam(examId: string) {
    return cbtService.listCbtQuestionIdsForExam(examId);
  }

  deleteCbtQuestion(id: string) {
    return cbtService.deleteCbtQuestion(id);
  }

  updateCbtQuestion(id: string, payload: Database['public']['Tables']['cbt_questions']['Update']) {
    return cbtService.updateCbtQuestion(id, payload);
  }

  insertCbtQuestion(payload: Database['public']['Tables']['cbt_questions']['Insert']) {
    return cbtService.insertCbtQuestion(payload);
  }
}

export const questionService = new QuestionService();
