import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
  Image,
  Linking,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { useAuth } from '../../contexts/AuthContext';
import { assignmentService } from '../../services/assignment.service';
import { expertAiService } from '../../services/expertAi.service';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { COLORS } from '../../constants/colors';
import { FONT_FAMILY, FONT_SIZE } from '../../constants/typography';
import { SPACING, RADIUS } from '../../constants/spacing';
import { ROUTES } from '../../navigation/routes';
import { uploadToR2, mimeFromExt, getR2SignedViewUrl } from '../../lib/r2';
import { buildAssignmentWhatsAppShareMessage } from '../../lib/assignmentShare';

interface AssignmentQuestion {
  question_text: string;
  question_type?: string | null;
  points?: number | null;
  options?: string[] | null;
}

interface Assignment {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  max_points: number | null;
  assignment_type: string | null;
  instructions: string | null;
  is_active: boolean | null;
  class_id: string | null;
  course_id: string | null;
  lesson_id: string | null;
  created_by: string | null;
  questions: AssignmentQuestion[];
  metadata: any;
  courses?: { title: string | null; programs?: { name: string | null } | null } | null;
  classes?: { name: string | null } | null;
}

interface Submission {
  id: string;
  portal_user_id: string | null;
  student_name: string;
  status: string | null;
  grade: number | null;
  feedback: string | null;
  submitted_at: string | null;
  submission_text: string | null;
  file_url?: string | null;
  answers: any;
}

const TYPE_COLOR: Record<string, string> = {
  quiz: COLORS.info,
  project: '#7c3aed',
  homework: COLORS.success,
  exam: COLORS.admin,
  coding: COLORS.accent,
  essay: COLORS.gold,
};

const GRADE_PRESETS = [100, 90, 80, 70, 60, 40];

function isLikelyImageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const path = url.split('?')[0].toLowerCase();
  return /\.(png|jpe?g|gif|webp|bmp|heic)$/i.test(path);
}

function isLikelyPdfUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return /\.pdf(\?|$)/i.test(url.split('?')[0]);
}

async function openUrlSafe(url: string) {
  try {
    const ok = await Linking.canOpenURL(url);
    if (ok) await Linking.openURL(url);
    else Alert.alert('Cannot open', 'This device cannot open this link.');
  } catch {
    Alert.alert('Cannot open', 'Try again or copy the link from the web portal.');
  }
}

/** Resolves private R2 objects to a signed GET URL, then shows image and/or open-in-browser controls. */
function SubmissionAttachmentView({ fileUrl }: { fileUrl: string }) {
  const [resolved, setResolved] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [imgErr, setImgErr] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setImgErr(false);
    void (async () => {
      const v = await getR2SignedViewUrl(fileUrl);
      if (!cancelled) {
        setResolved(v ?? fileUrl);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fileUrl]);

  const uri = resolved ?? fileUrl;
  const showImage = isLikelyImageUrl(fileUrl) && !isLikelyPdfUrl(fileUrl) && !imgErr;

  if (loading) {
    return <ActivityIndicator style={{ marginVertical: 10 }} color={COLORS.primary} />;
  }

  const photoStyle = {
    width: '100%' as const,
    height: 220,
    borderRadius: RADIUS.md,
    marginTop: SPACING.sm,
    backgroundColor: COLORS.bg,
  };

  return (
    <View style={{ gap: SPACING.sm }}>
      {showImage ? (
        <TouchableOpacity onPress={() => void openUrlSafe(uri)} activeOpacity={0.9}>
          <Image source={{ uri }} style={photoStyle} resizeMode="contain" onError={() => setImgErr(true)} />
        </TouchableOpacity>
      ) : null}
      {imgErr || !showImage ? (
        <TouchableOpacity
          onPress={() => void openUrlSafe(uri)}
          style={{ alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 12, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.info + '44', backgroundColor: COLORS.info + '10' }}
        >
          <Text style={{ fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.info }}>
            {isLikelyPdfUrl(fileUrl) ? 'View PDF (opens externally)' : isLikelyImageUrl(fileUrl) ? 'Open image externally' : 'View attachment'}
          </Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity onPress={() => void openUrlSafe(uri)}>
          <Text style={{ fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.info, marginTop: 2 }}>Open full size</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

async function openWhatsAppWithMessage(message: string) {
  const enc = encodeURIComponent(message);
  const app = `whatsapp://send?text=${enc}`;
  const web = `https://wa.me/?text=${enc}`;
  try {
    if (await Linking.canOpenURL(app)) await Linking.openURL(app);
    else await Linking.openURL(web);
  } catch {
    Alert.alert('WhatsApp', 'Unable to open WhatsApp on this device.');
  }
}

function normalizeQuestions(raw: any): AssignmentQuestion[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((question: any) => ({
    question_text: question?.question_text ?? 'Question',
    question_type: question?.question_type ?? 'essay',
    points: question?.points ?? 1,
    options: Array.isArray(question?.options) ? question.options : null,
  }));
}

export default function AssignmentDetailScreen({ route, navigation }: any) {
  const { assignmentId } = route.params ?? {};
  const { profile } = useAuth();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [mySubmission, setMySubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submissionText, setSubmissionText] = useState('');
  const [filePublicUrl, setFilePublicUrl] = useState<string | null>(null);
  const [filePreviewUri, setFilePreviewUri] = useState<string | null>(null);
  /** Signed or public URL for in-app preview when there is no local preview URI. */
  const [resolvedUploadViewUrl, setResolvedUploadViewUrl] = useState<string | null>(null);
  /** Display name for last picked PDF (local UX only; cleared on reload). */
  const [pendingAttachmentName, setPendingAttachmentName] = useState<string | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [gradingId, setGradingId] = useState<string | null>(null);
  const [gradeInput, setGradeInput] = useState('');
  const [feedbackInput, setFeedbackInput] = useState('');
  const [generatingFeedback, setGeneratingFeedback] = useState(false);

  const canGrade = profile?.role === 'admin' || profile?.role === 'teacher' || profile?.role === 'school';

  const canEditAssignment =
    !!assignment &&
    canGrade &&
    !!assignment.class_id &&
    (profile?.role === 'admin' ||
      profile?.role === 'school' ||
      (profile?.role === 'teacher' &&
        (assignment.created_by === profile.id || !assignment.created_by)));

  const load = useCallback(async () => {
    if (!assignmentId || !profile) return;
    try {
      const { assignment: asgn, submissions: subs } = await assignmentService.getAssignmentDetail(assignmentId, profile.id, canGrade);
      
      if (asgn) {
        setAssignment({
          ...(asgn as any),
          questions: normalizeQuestions((asgn as any).questions),
        });
      }

      setSubmissions(subs as any[]);

      if (!canGrade) {
        const mine = (subs as any[]).find((s) => s.portal_user_id === profile.id) ?? null;
        setMySubmission(mine);
        setSubmissionText(mine?.submission_text ?? '');
        const fu = mine?.file_url ?? null;
        setFilePublicUrl(fu);
        setFilePreviewUri(null);
        setPendingAttachmentName(null);
      } else {
        setFilePublicUrl(null);
        setFilePreviewUri(null);
        setPendingAttachmentName(null);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  }, [assignmentId, canGrade, profile]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!filePublicUrl || filePreviewUri) {
      setResolvedUploadViewUrl(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const v = await getR2SignedViewUrl(filePublicUrl);
      if (!cancelled) setResolvedUploadViewUrl(v ?? filePublicUrl);
    })();
    return () => {
      cancelled = true;
    };
  }, [filePublicUrl, filePreviewUri]);
  
  const generateAiFeedback = async (submission: Submission) => {
    if (!assignment || !gradeInput) {
      Alert.alert('Grade required', 'Enter a score first to help the AI contextualize feedback.');
      return;
    }
    setGeneratingFeedback(true);
    try {
      const result = await expertAiService.generate({
        type: 'report-feedback',
        topic: assignment.title,
        studentName: submission.student_name,
        overallScore: gradeInput,
        courseName: assignment.courses?.title ?? 'this course',
        programName: assignment.courses?.programs?.name ?? undefined,
      });
      const comment = result.key_strengths + ' ' + result.areas_for_growth;
      setFeedbackInput(comment.trim());
    } catch (error: any) {
      Alert.alert('AI Feedback', error.message || 'Generation failed');
    } finally {
      setGeneratingFeedback(false);
    }
  };

  const saveGrade = async (submissionId: string) => {
    const grade = Number(gradeInput);
    if (!assignment) return;
    if (Number.isNaN(grade) || grade < 0 || grade > (assignment.max_points ?? 100)) {
      Alert.alert('Invalid grade', `Enter a score between 0 and ${assignment.max_points ?? 100}.`);
      return;
    }

    setSaving(true);
    try {
      await assignmentService.gradeSubmission({
        submissionId: submissionId,
        graderId: profile?.id ?? '',
        grade,
        feedback: feedbackInput
      });
      await load();
      setGradingId(null);
      setGradeInput('');
      setFeedbackInput('');
    } catch (error: any) {
      Alert.alert('Grading failed', error?.message ?? 'Could not save grade.');
    } finally {
      setSaving(false);
    }
  };

  const uploadPickedAsset = async (uri: string, mimeHint?: string | null): Promise<string> => {
    if (!profile?.id) throw new Error('Not signed in');
    const ext = (uri.split('.').pop() || 'jpg').split('?')[0].toLowerCase();
    const safeExt = ext.length > 5 ? 'jpg' : ext;
    const key = `assignment-submissions/${profile.id}/${Date.now()}.${safeExt}`;
    const mime = mimeHint || mimeFromExt(safeExt);
    const url = await uploadToR2(uri, key, mime);
    if (!url) throw new Error('Upload did not return a URL');
    return url;
  };

  const uploadPickedPdf = async (localUri: string, mimeHint: string | null): Promise<string> => {
    if (!profile?.id) throw new Error('Not signed in');
    const key = `assignment-submissions/${profile.id}/${Date.now()}.pdf`;
    const mime = mimeHint && mimeHint.includes('pdf') ? mimeHint : 'application/pdf';
    const url = await uploadToR2(localUri, key, mime);
    if (!url) throw new Error('Upload did not return a URL');
    return url;
  };

  const pickFromLibrary = async () => {
    if (!profile || mySubmission?.grade != null) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission', 'Photo library access is needed to attach a picture.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.75,
      allowsMultipleSelection: false,
    });
    if (res.canceled || !res.assets?.[0]?.uri) return;
    const asset = res.assets[0];
    const localUri = asset.uri;
    setUploadingFile(true);
    try {
      const url = await uploadPickedAsset(localUri, asset.mimeType ?? null);
      setFilePublicUrl(url);
      setFilePreviewUri(localUri);
      setPendingAttachmentName(null);
    } catch (e: any) {
      Alert.alert('Upload failed', e?.message ?? 'Could not upload file');
    } finally {
      setUploadingFile(false);
    }
  };

  const pickFromCamera = async () => {
    if (!profile || mySubmission?.grade != null) return;
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission', 'Camera access is needed to take a submission photo.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.75 });
    if (res.canceled || !res.assets?.[0]?.uri) return;
    const asset = res.assets[0];
    const localUri = asset.uri;
    setUploadingFile(true);
    try {
      const url = await uploadPickedAsset(localUri, asset.mimeType ?? 'image/jpeg');
      setFilePublicUrl(url);
      setFilePreviewUri(localUri);
      setPendingAttachmentName(null);
    } catch (e: any) {
      Alert.alert('Upload failed', e?.message ?? 'Could not upload photo');
    } finally {
      setUploadingFile(false);
    }
  };

  const pickPdf = async () => {
    if (!profile || mySubmission?.grade != null) return;
    setUploadingFile(true);
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (res.canceled) return;
      const file = res.assets?.[0];
      if (!file?.uri) {
        Alert.alert('PDF', 'Could not read the selected file.');
        return;
      }
      const name = (file.name && file.name.trim()) || 'submission.pdf';
      const url = await uploadPickedPdf(file.uri, file.mimeType ?? null);
      setFilePublicUrl(url);
      setFilePreviewUri(null);
      setPendingAttachmentName(name);
    } catch (e: any) {
      Alert.alert('Upload failed', e?.message ?? 'Could not upload PDF');
    } finally {
      setUploadingFile(false);
    }
  };

  const clearAttachment = () => {
    setFilePublicUrl(null);
    setFilePreviewUri(null);
    setPendingAttachmentName(null);
  };

  const shareToParentsWhatsApp = () => {
    if (!assignment) return;
    const msg = buildAssignmentWhatsAppShareMessage(
      {
        title: assignment.title,
        due_date: assignment.due_date,
        max_points: assignment.max_points,
        assignment_type: assignment.assignment_type,
        instructions: assignment.instructions,
        courses: assignment.courses,
      },
      {
        assignmentId: assignment.id,
        portalBaseUrl: process.env.EXPO_PUBLIC_PORTAL_WEB_ORIGIN || 'https://rillcod.com',
      },
    );
    void openWhatsAppWithMessage(msg);
  };

  const submitAssignment = async () => {
    if (!assignment || !profile) return;
    const textOk = submissionText.trim().length > 0;
    const fileOk = !!filePublicUrl;
    if (!textOk && !fileOk) {
      Alert.alert('Submission required', 'Write an answer or attach a photo or PDF before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      await assignmentService.submitAssignment({
        assignmentId: assignment.id,
        userId: profile.id,
        submissionText: submissionText,
        existingSubmissionId: mySubmission?.id,
        fileUrl: filePublicUrl,
      });
      await load();
      Alert.alert('Submitted', 'Your assignment has been submitted.');
    } catch (error: any) {
      Alert.alert('Submission failed', error?.message ?? 'Could not submit assignment.');
    } finally {
      setSubmitting(false);
    }
  };

  const typeColor = TYPE_COLOR[assignment?.assignment_type ?? ''] ?? COLORS.info;
  const isOverdue = !!assignment?.due_date && new Date(assignment.due_date) < new Date();
  const gradedCount = submissions.filter((submission) => submission.status === 'graded').length;
  const pendingCount = submissions.filter((submission) => submission.status === 'submitted').length;
  const scorePercent = useMemo(() => {
    if (!assignment || !mySubmission || mySubmission.grade == null) return null;
    return Math.round((mySubmission.grade / (assignment.max_points ?? 100)) * 100);
  }, [assignment, mySubmission]);

  if (loading) {
    return <View style={styles.loadWrap}><ActivityIndicator color={COLORS.info} size="large" /></View>;
  }

  if (!assignment) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title="Assignment" onBack={() => navigation.goBack()} />
        <View style={styles.emptyWrap}><Text style={styles.emptyText}>Assignment not found.</Text></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader
        title="Assignment"
        onBack={() => navigation.goBack()}
        accentColor={typeColor}
        rightAction={
          canEditAssignment
            ? {
                label: 'Edit',
                color: typeColor,
                onPress: () =>
                  navigation.navigate(ROUTES.CreateAssignment, {
                    assignmentId: assignment.id,
                    classId: assignment.class_id ?? undefined,
                    className: assignment.classes?.name ?? 'Class',
                  }),
              }
            : undefined
        }
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }}>
          <View style={styles.infoCard}>
            <LinearGradient colors={[typeColor + '10', 'transparent']} style={StyleSheet.absoluteFill} />
            <View style={styles.typeRow}>
              <View style={[styles.typePill, { backgroundColor: typeColor + '20' }]}>
                <Text style={[styles.typeText, { color: typeColor }]}>{assignment.assignment_type ?? 'assignment'}</Text>
              </View>
              {isOverdue && (
                <View style={[styles.typePill, { backgroundColor: COLORS.error + '20' }]}>
                  <Text style={[styles.typeText, { color: COLORS.error }]}>Overdue</Text>
                </View>
              )}
            </View>
            <Text style={styles.title}>{assignment.title}</Text>
            {assignment.courses?.title ? <Text style={styles.courseText}>{assignment.courses.title}</Text> : null}
            {assignment.description ? <Text style={styles.description}>{assignment.description}</Text> : null}
            {assignment.instructions ? (
              <View style={styles.instructionsCard}>
                <Text style={styles.instructionsLabel}>Instructions</Text>
                <Text style={styles.instructionsText}>{assignment.instructions}</Text>
              </View>
            ) : null}
            <View style={styles.metaRow}>
              {assignment.due_date ? <View style={styles.metaItem}><Text style={styles.metaText}>Due {new Date(assignment.due_date).toLocaleDateString('en-GB')}</Text></View> : null}
              <View style={styles.metaItem}><Text style={styles.metaText}>{assignment.max_points ?? 100} pts</Text></View>
              {assignment.questions.length > 0 ? <View style={styles.metaItem}><Text style={styles.metaText}>{assignment.questions.length} questions</Text></View> : null}
            </View>
          </View>
        </MotiView>

        {canGrade && assignment ? (
          <View style={styles.shareRow}>
            <TouchableOpacity style={styles.waBtn} onPress={shareToParentsWhatsApp} activeOpacity={0.85}>
              <Text style={styles.waBtnText}>Share to parents (WhatsApp)</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {assignment.questions.length > 0 && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Question Outline</Text>
            {assignment.questions.map((question, index) => (
              <View key={`${assignment.id}-q-${index}`} style={styles.questionRow}>
                <Text style={styles.questionIndex}>{index + 1}.</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.questionText}>{question.question_text}</Text>
                  <Text style={styles.questionMeta}>{question.question_type ?? 'essay'} · {question.points ?? 1} pts</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {canGrade ? (
          <>
            <View style={styles.summaryRow}>
              <View style={styles.summaryCard}><Text style={styles.summaryLabel}>Submissions</Text><Text style={styles.summaryValue}>{submissions.length}</Text></View>
              <View style={styles.summaryCard}><Text style={styles.summaryLabel}>Pending</Text><Text style={[styles.summaryValue, { color: COLORS.warning }]}>{pendingCount}</Text></View>
              <View style={styles.summaryCard}><Text style={styles.summaryLabel}>Graded</Text><Text style={[styles.summaryValue, { color: COLORS.success }]}>{gradedCount}</Text></View>
            </View>

            <Text style={styles.subsTitle}>Student Submissions</Text>
            {submissions.length === 0 ? (
              <View style={styles.emptySubmit}><Text style={styles.emptyText}>No submissions yet.</Text></View>
            ) : (
              submissions.map((submission, index) => {
                const pct = submission.grade != null ? Math.round((submission.grade / (assignment.max_points ?? 100)) * 100) : null;
                const gradeColor = pct != null ? (pct >= 70 ? COLORS.success : pct >= 50 ? COLORS.warning : COLORS.error) : COLORS.textMuted;
                const isGrading = gradingId === submission.id;
                return (
                  <MotiView key={submission.id} from={{ opacity: 0, translateX: -8 }} animate={{ opacity: 1, translateX: 0 }} transition={{ delay: index * 35 }}>
                    <View style={styles.subCard}>
                      <View style={styles.subTop}>
                        <View style={styles.avatar}><Text style={styles.avatarText}>{submission.student_name.charAt(0).toUpperCase()}</Text></View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.subName}>{submission.student_name}</Text>
                          <Text style={styles.subDate}>{submission.submitted_at ? `Submitted ${new Date(submission.submitted_at).toLocaleDateString('en-GB')}` : 'No timestamp'}</Text>
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: gradeColor + '20' }]}>
                          <Text style={[styles.statusText, { color: gradeColor }]}>{submission.status ?? 'pending'}</Text>
                        </View>
                      </View>

                      {submission.submission_text ? <Text style={styles.submissionText}>{submission.submission_text}</Text> : null}
                      {submission.file_url ? <SubmissionAttachmentView fileUrl={submission.file_url} /> : null}
                      {submission.feedback ? <Text style={styles.feedback}>Feedback: {submission.feedback}</Text> : null}
                      {pct != null ? <Text style={[styles.scoreText, { color: gradeColor }]}>{submission.grade}/{assignment.max_points ?? 100} · {pct}%</Text> : null}

                      {isGrading ? (
                        <View style={styles.gradeForm}>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetRow}>
                            {GRADE_PRESETS.map((pctValue) => (
                              <TouchableOpacity
                                key={pctValue}
                                style={styles.presetBtn}
                                onPress={() => setGradeInput(String(Math.round((pctValue / 100) * (assignment.max_points ?? 100))))}
                              >
                                <Text style={styles.presetText}>{pctValue}%</Text>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                          <TextInput style={styles.gradeInput} value={gradeInput} onChangeText={setGradeInput} keyboardType="numeric" placeholder={`Score (max ${assignment.max_points ?? 100})`} placeholderTextColor={COLORS.textMuted} />
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                            <Text style={styles.instructionsLabel}>FEEDBACK</Text>
                            <TouchableOpacity onPress={() => generateAiFeedback(submission)} disabled={generatingFeedback}>
                              {generatingFeedback ? (
                                <ActivityIndicator size="small" color={COLORS.primary} />
                              ) : (
                                <Text style={{ fontFamily: FONT_FAMILY.bodyBold, fontSize: 10, color: COLORS.primary }}>✦ GENERATE WITH AI</Text>
                              )}
                            </TouchableOpacity>
                          </View>
                          <TextInput style={[styles.gradeInput, styles.feedbackInput]} value={feedbackInput} onChangeText={setFeedbackInput} placeholder="Feedback (optional)" placeholderTextColor={COLORS.textMuted} multiline />
                          <View style={styles.gradeActions}>
                            <TouchableOpacity onPress={() => { setGradingId(null); setGradeInput(''); setFeedbackInput(''); }} style={styles.cancelBtn}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
                            <TouchableOpacity onPress={() => saveGrade(submission.id)} style={styles.saveBtn} disabled={saving}>{saving ? <ActivityIndicator color={COLORS.white100} size="small" /> : <Text style={styles.saveText}>Save Grade</Text>}</TouchableOpacity>
                          </View>
                        </View>
                      ) : (
                        <TouchableOpacity
                          onPress={() => {
                            setGradingId(submission.id);
                            setGradeInput(submission.grade != null ? String(submission.grade) : '');
                            setFeedbackInput(submission.feedback ?? '');
                          }}
                          style={styles.gradeBtn}
                        >
                          <Text style={styles.gradeBtnText}>{submission.grade != null ? 'Edit Grade' : 'Grade Submission'}</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </MotiView>
                );
              })
            )}
          </>
        ) : (
          <>
            {mySubmission?.grade != null && (
              <View style={styles.resultBanner}>
                <Text style={styles.resultTitle}>Your Result</Text>
                <Text style={styles.resultScore}>{mySubmission.grade}/{assignment.max_points ?? 100}{scorePercent != null ? ` · ${scorePercent}%` : ''}</Text>
                {mySubmission.feedback ? <Text style={styles.resultFeedback}>{mySubmission.feedback}</Text> : null}
              </View>
            )}

            {mySubmission?.file_url ? (
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Submitted file</Text>
                <SubmissionAttachmentView fileUrl={mySubmission.file_url} />
              </View>
            ) : null}

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>{mySubmission ? 'Update Submission' : 'Submit Assignment'}</Text>
              <Text style={styles.attachHint}>
                Attach a photo (camera or library) or a PDF. You can submit text only, a file only, or both.
              </Text>
              <View style={styles.attachRow}>
                <TouchableOpacity style={styles.attachChip} onPress={pickFromCamera} disabled={uploadingFile || submitting || !!mySubmission?.grade}>
                  <Text style={styles.attachChipText}>Take photo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.attachChip} onPress={pickFromLibrary} disabled={uploadingFile || submitting || !!mySubmission?.grade}>
                  <Text style={styles.attachChipText}>Choose photo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.attachChip} onPress={pickPdf} disabled={uploadingFile || submitting || !!mySubmission?.grade}>
                  <Text style={styles.attachChipText}>Choose PDF</Text>
                </TouchableOpacity>
                {(filePreviewUri || filePublicUrl) && !mySubmission?.grade ? (
                  <TouchableOpacity style={styles.attachChipClear} onPress={clearAttachment}>
                    <Text style={styles.attachChipClearText}>Remove</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              {uploadingFile ? <ActivityIndicator style={{ marginVertical: 8 }} color={COLORS.primary} /> : null}
              {(filePreviewUri || filePublicUrl) && isLikelyImageUrl(filePreviewUri || filePublicUrl || '') ? (
                <Image
                  source={{ uri: filePreviewUri || resolvedUploadViewUrl || filePublicUrl || '' }}
                  style={styles.previewPhoto}
                  resizeMode="contain"
                />
              ) : filePublicUrl && isLikelyPdfUrl(filePublicUrl) ? (
                <View style={{ marginBottom: SPACING.sm, gap: 6 }}>
                  {pendingAttachmentName ? (
                    <Text style={{ fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary }} numberOfLines={2}>
                      PDF · {pendingAttachmentName}
                    </Text>
                  ) : null}
                  <TouchableOpacity onPress={() => void openUrlSafe(resolvedUploadViewUrl || filePublicUrl)}>
                    <Text style={styles.linkText}>Preview / open PDF</Text>
                  </TouchableOpacity>
                </View>
              ) : filePublicUrl ? (
                <TouchableOpacity onPress={() => void openUrlSafe(resolvedUploadViewUrl || filePublicUrl)}>
                  <Text style={styles.linkText}>View uploaded file</Text>
                </TouchableOpacity>
              ) : null}
              <TextInput
                style={styles.submissionInput}
                multiline
                placeholder={assignment.assignment_type === 'coding' ? 'Paste your code, explanation, or answer here...' : 'Write your answer here...'}
                placeholderTextColor={COLORS.textMuted}
                value={submissionText}
                onChangeText={setSubmissionText}
              />
              <TouchableOpacity
                style={styles.submitBtn}
                onPress={submitAssignment}
                disabled={submitting || uploadingFile || !!mySubmission?.grade}
              >
                {submitting ? <ActivityIndicator color={COLORS.white100} size="small" /> : <Text style={styles.submitBtnText}>{mySubmission ? 'Save Submission' : 'Submit Work'}</Text>}
              </TouchableOpacity>
              {mySubmission?.submitted_at ? <Text style={styles.submitMeta}>Last submitted {new Date(mySubmission.submitted_at).toLocaleString('en-GB')}</Text> : null}
            </View>
          </>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  loadWrap: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: SPACING.xl },
  infoCard: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.xl, padding: SPACING.md, marginBottom: SPACING.md, overflow: 'hidden', gap: SPACING.sm },
  typeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  typePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full },
  typeText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: 10, textTransform: 'capitalize' },
  title: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.xl, color: COLORS.textPrimary },
  courseText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.warning },
  description: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, lineHeight: 20 },
  instructionsCard: { backgroundColor: COLORS.bg, borderRadius: RADIUS.md, padding: SPACING.sm, borderWidth: 1, borderColor: COLORS.border },
  instructionsLabel: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.info, marginBottom: 4 },
  instructionsText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, lineHeight: 20 },
  metaRow: { flexDirection: 'row', gap: SPACING.md, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },
  sectionCard: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md, backgroundColor: COLORS.bgCard },
  sectionTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: SPACING.sm },
  questionRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.sm },
  questionIndex: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.sm, color: COLORS.primary },
  questionText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  questionMeta: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },
  summaryRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  summaryCard: { flex: 1, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, padding: SPACING.md },
  summaryLabel: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  summaryValue: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.lg, color: COLORS.textPrimary, marginTop: 4 },
  subsTitle: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.base, color: COLORS.textPrimary, marginBottom: SPACING.sm },
  subCard: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.sm, gap: SPACING.sm, backgroundColor: COLORS.bgCard },
  subTop: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.admin },
  avatarText: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.sm, color: COLORS.white100 },
  subName: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  subDate: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
  statusText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: 10, textTransform: 'capitalize' },
  submissionText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, lineHeight: 20 },
  feedback: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.info, fontStyle: 'italic' },
  scoreText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm },
  gradeBtn: { paddingVertical: 10, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.info + '40', alignItems: 'center' },
  gradeBtnText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.info },
  gradeForm: { gap: SPACING.sm, paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.border },
  presetRow: { gap: 6 },
  presetBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.md, backgroundColor: COLORS.info + '15', borderWidth: 1, borderColor: COLORS.info + '30' },
  presetText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.info },
  gradeInput: { backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 10, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  feedbackInput: { minHeight: 80, textAlignVertical: 'top' },
  gradeActions: { flexDirection: 'row', gap: SPACING.sm },
  cancelBtn: { flex: 1, paddingVertical: 10, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  cancelText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
  saveBtn: { flex: 2, paddingVertical: 10, borderRadius: RADIUS.md, backgroundColor: COLORS.success, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.white100 },
  resultBanner: { borderWidth: 1, borderColor: COLORS.success + '40', backgroundColor: COLORS.success + '12', borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md },
  resultTitle: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.success, textTransform: 'uppercase', letterSpacing: 1 },
  resultScore: { fontFamily: FONT_FAMILY.display, fontSize: FONT_SIZE.lg, color: COLORS.textPrimary, marginTop: 4 },
  resultFeedback: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 6 },
  submissionInput: { minHeight: 160, textAlignVertical: 'top', backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, padding: SPACING.md, fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textPrimary },
  submitBtn: { marginTop: SPACING.md, backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  submitBtnText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.white100 },
  submitMeta: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 8 },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptySubmit: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
  shareRow: { marginBottom: SPACING.md },
  waBtn: {
    backgroundColor: '#25D36622',
    borderWidth: 1,
    borderColor: '#25D36655',
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  waBtnText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: '#25D366' },
  attachHint: { fontFamily: FONT_FAMILY.body, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginBottom: SPACING.sm, lineHeight: 18 },
  attachRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.sm },
  attachChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
  },
  attachChipText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.primaryLight },
  attachChipClear: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.error + '44' },
  attachChipClearText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.xs, color: COLORS.error },
  previewPhoto: { width: '100%', height: 200, borderRadius: RADIUS.md, marginBottom: SPACING.sm, backgroundColor: COLORS.bg },
  subPhoto: { width: '100%', height: 220, borderRadius: RADIUS.md, marginTop: SPACING.sm, backgroundColor: COLORS.bg },
  linkText: { fontFamily: FONT_FAMILY.bodySemi, fontSize: FONT_SIZE.sm, color: COLORS.info, marginTop: 4 },
});
