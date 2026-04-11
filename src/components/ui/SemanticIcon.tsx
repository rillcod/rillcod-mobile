import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

export type SemanticGlyph = string;

/** Maps legacy 2-letter dashboard codes to Ionicons (outline, modern, monochrome via `color`). */
const GLYPH_TO_ION: Record<string, ComponentProps<typeof Ionicons>['name']> = {
  SC: 'business-outline',
  TC: 'person-outline',
  ST: 'people-outline',
  /** People hub — unified directory & bulk roster */
  PH: 'git-network-outline',
  AP: 'shield-checkmark-outline',
  /** Approvals / registration queue */
  AQ: 'clipboard-outline',
  RV: 'wallet-outline',
  AN: 'analytics-outline',
  GR: 'ribbon-outline',
  PM: 'card-outline',
  TX: 'repeat-outline',
  NW: 'newspaper-outline',
  CL: 'grid-outline',
  LS: 'book-outline',
  AT: 'calendar-outline',
  AS: 'document-text-outline',
  CB: 'laptop-outline',
  RB: 'create-outline',
  PG: 'code-slash-outline',
  RP: 'bar-chart-outline',
  OV: 'pie-chart-outline',
  PR: 'trending-up-outline',
  AL: 'notifications-outline',
  MG: 'chatbubbles-outline',
  CH: 'people-circle-outline',
  IV: 'receipt-outline',
  PF: 'chatbox-outline',
  LR: 'library-outline',
  LB: 'trophy-outline',
  CT: 'medal-outline',
  AI: 'sparkles-outline',
  EN: 'person-add-outline',
  ID: 'id-card-outline',
  WB: 'trash-outline',
  US: 'people-outline',
  GD: 'school-outline',
  RS: 'document-attach-outline',
  PN: 'time-outline',
  /** Parents directory (CRM) */
  PA: 'people-circle-outline',
  /** Bulk CSV / batch registration */
  BR: 'cloud-upload-outline',
  /** Live / video sessions */
  LV: 'videocam-outline',
  /** IoT lab */
  IT: 'hardware-chip-outline',
  /** Timetable (distinct from attendance calendar) */
  TT: 'calendar-outline',
  /** Staff certificate management */
  MC: 'ribbon-outline',
  /** Settings (avoid reusing ST = students) */
  SG: 'settings-outline',
  /** Projects (lab / coursework) */
  PJ: 'rocket-outline',
  /** Learner portfolio showcase */
  PO: 'briefcase-outline',
  /** Secondary “library / stacks” cue when LR is used for Learning tab */
  BK: 'albums-outline',
  /** School billing / fee desk */
  BL: 'wallet-outline',
  /** Bulk payments wizard */
  BP: 'layers-outline',
  /** Staff CSV import (students) */
  IM: 'document-text-outline',
};

export function SemanticIcon({
  code,
  color,
  size = 18,
}: {
  code: SemanticGlyph;
  color: string;
  size?: number;
}) {
  const key = (code ?? '').trim().toUpperCase();
  const name = GLYPH_TO_ION[key] ?? 'ellipse-outline';
  return <Ionicons name={name} size={size} color={color} />;
}
