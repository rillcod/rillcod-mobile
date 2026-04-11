// No external imports for types needed since we accept 'any' as generic payloads

export function letterGrade(pct: number) {
    if (pct >= 85) return { g: 'A', label: 'Excellent', color: '#1a6b3c', bg: '#dcfce7' };
    if (pct >= 70) return { g: 'B', label: 'Very Good', color: '#1a4d8c', bg: '#dbeafe' };
    if (pct >= 55) return { g: 'C', label: 'Good', color: '#7c6b15', bg: '#fef9c3' };
    if (pct >= 45) return { g: 'D', label: 'Pass', color: '#8c3a14', bg: '#ffedd5' };
    return { g: 'E', label: 'Fail', color: '#8c1414', bg: '#fee2e2' };
}

const tailwindCDN = `<script src="https://cdn.tailwindcss.com"></script>`;
const fonts = `<link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">`;

/** Build learning milestones HTML snippet. */
function milestonesHtml(milestones: any): string {
    let miles: string[] = [];
    if (Array.isArray(milestones)) miles = milestones.filter(Boolean);
    else if (typeof milestones === 'string' && milestones) {
        try { miles = JSON.parse(milestones); } catch { miles = milestones.split('\n').filter(Boolean); }
    }
    if (!miles.length) return '';
    return `
    <div style="margin-top:6px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:8px 12px;">
        <p style="font-size:9px;font-weight:900;color:#64748b;text-transform:uppercase;letter-spacing:.12em;margin-bottom:5px;">Learning Milestones</p>
        ${miles.map(m => `<div style="display:flex;align-items:flex-start;gap:5px;margin-bottom:3px;"><span style="font-size:10px;color:#4f46e5;flex-shrink:0;margin-top:1px;">✓</span><p style="font-size:11px;font-weight:500;color:#1e293b;line-height:1.4;">${m}</p></div>`).join('')}
    </div>`;
}

/** Fee status badge styles */
const FEE_STATUS: Record<string, { bg: string; text: string; label: string }> = {
    paid:        { bg: '#d1fae5', text: '#065f46', label: 'PAID' },
    outstanding: { bg: '#fee2e2', text: '#991b1b', label: 'OUTSTANDING' },
    partial:     { bg: '#fef3c7', text: '#92400e', label: 'PARTIAL PAYMENT' },
    sponsored:   { bg: '#dbeafe', text: '#1e40af', label: 'SPONSORED' },
    waived:      { bg: '#ede9fe', text: '#5b21b6', label: 'WAIVED' },
};

export function generateStandardReportHtml(report: any, orgSettings: any): string {
    const today = report.report_date
        ? new Date(report.report_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
        : '—';

    const theory      = Number(report.theory_score)      || 0;
    const practical   = Number(report.practical_score)   || 0;
    const attendance  = Number(report.attendance_score)  || 0;
    const participation = Number(report.participation_score) || 0;
    // Examination 40% · Evaluation 20% · Assignment 20% · Project Engagement 20%
    const computed = Math.round(theory * 0.4 + practical * 0.2 + attendance * 0.2 + participation * 0.2);
    const overall  = Number(report.overall_score) > 0 ? Number(report.overall_score) : computed;
    const grade    = letterGrade(overall);
    const showCertificate = overall >= 45 || report.has_certificate === true;

    const org = {
        name:    orgSettings?.org_name    || 'Rillcod Technologies',
        tagline: orgSettings?.org_tagline || 'Excellence in Educational Technology',
        address: orgSettings?.org_address || '26 Ogiesoba Avenue, GRA, Benin City',
        phone:   orgSettings?.org_phone   || '08116600091',
        email:   orgSettings?.org_email   || 'support@rillcod.com',
        logo:    orgSettings?.logo_url    || 'https://rillcod.com/logo.png',
    };

    const hasPayment = !!report.fee_status;
    const feeStyle   = report.fee_status ? (FEE_STATUS[report.fee_status] ?? null) : null;
    const isDevelopment = report.school_section !== 'school'; // boot-camp / tech programme style

    // qualifier pills (Project Work / Homework / Participation)
    const qualifiers = [
        { label: 'Project Work',  value: report.projects_grade,     color: '#8b5cf6', bg: '#ede9fe' },
        { label: 'Homework',      value: report.homework_grade,      color: '#0891b2', bg: '#e0f2fe' },
        { label: 'Participation', value: report.participation_grade, color: '#059669', bg: '#d1fae5' },
    ].filter(q => q.value);

    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        ${tailwindCDN}
        <style>
            @media print {
                @page { size: A4; margin: 0; }
                body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
        </style>
    </head>
    <body class="bg-gray-100 flex justify-center py-10 print:py-0">
        <div id="report-card" class="bg-white text-gray-900 font-sans relative overflow-hidden shrink-0 flex flex-col"
             style="width:794px;height:1123px;border:4px solid #1a1a2e;margin:0 auto;-webkit-print-color-adjust:exact;print-color-adjust:exact;">

            <!-- Background blobs -->
            <div style="position:absolute;top:0;right:0;width:400px;height:400px;background:#eef2ff;opacity:.4;border-radius:50%;filter:blur(64px);z-index:0;margin-top:-160px;margin-right:-160px;"></div>
            <div style="position:absolute;bottom:0;left:0;width:500px;height:500px;background:#ede9fe;opacity:.35;border-radius:50%;filter:blur(80px);z-index:0;margin-bottom:-160px;margin-left:-160px;"></div>
            <div style="position:absolute;inset:0;border:1px solid #f1f5f9;margin:14px;pointer-events:none;z-index:0;"></div>

            <!-- ── HEADER ── -->
            <div style="position:relative;padding:18px 40px 12px 40px;background:#fff;border-bottom:2px solid #e5e7eb;border-left:6px solid #1a1a2e;z-index:10;">
                <div style="position:absolute;top:0;right:0;width:120px;height:120px;background:#eef2ff;transform:skewX(12deg);margin-right:-60px;"></div>
                <div style="display:flex;align-items:center;justify-content:space-between;position:relative;z-index:10;">
                    <div style="display:flex;align-items:center;gap:20px;">
                        <img src="${org.logo}" style="width:60px;height:60px;object-fit:contain;" crossorigin="anonymous" />
                        <div>
                            <h1 style="font-size:18px;font-weight:900;letter-spacing:-.04em;text-transform:uppercase;line-height:1;margin-bottom:3px;color:#111827;">${org.name}</h1>
                            <p style="font-size:10px;font-weight:700;color:#7c3aed;text-transform:uppercase;letter-spacing:.3em;">${org.tagline}</p>
                            <p style="font-size:9px;font-weight:600;color:#9ca3af;margin-top:2px;">
                                ${org.phone ? `📞 ${org.phone}` : ''}${org.phone && org.email ? ' · ' : ''}${org.email ? `✉ ${org.email}` : ''}
                            </p>
                        </div>
                    </div>
                    <div style="text-align:right;">
                        <div style="display:inline-block;padding:3px 12px;background:#fffbeb;border:1px solid #fde68a;border-radius:100px;margin-bottom:6px;">
                            <span style="font-size:10px;font-weight:900;color:#b45309;text-transform:uppercase;letter-spacing:.12em;">Official Record</span>
                        </div>
                        <h2 style="font-size:22px;font-weight:900;color:#111827;text-transform:uppercase;letter-spacing:-.03em;">Progress Report</h2>
                    </div>
                </div>
            </div>

            <!-- ── STATS BAR ── -->
            <div style="background:#f9fafb;border-bottom:1px solid #f3f4f6;padding:8px 40px;display:flex;justify-content:space-between;align-items:center;z-index:10;">
                <div style="display:flex;gap:28px;">
                    <div>
                        <p style="font-size:8px;font-weight:900;color:#9ca3af;text-transform:uppercase;letter-spacing:.15em;margin-bottom:2px;">ID</p>
                        <p style="font-size:11px;font-weight:900;color:#111827;">${(report.id || 'PREVIEW').toString().slice(0,8).toUpperCase()}</p>
                    </div>
                    <div>
                        <p style="font-size:8px;font-weight:900;color:#9ca3af;text-transform:uppercase;letter-spacing:.15em;margin-bottom:2px;">Date</p>
                        <p style="font-size:11px;font-weight:900;color:#111827;">${today}</p>
                    </div>
                    ${report.school_name ? `<div>
                        <p style="font-size:8px;font-weight:900;color:#9ca3af;text-transform:uppercase;letter-spacing:.15em;margin-bottom:2px;">School</p>
                        <p style="font-size:11px;font-weight:900;color:#111827;">${report.school_name}</p>
                    </div>` : ''}
                </div>
                <div style="display:flex;align-items:center;gap:20px;">
                    ${hasPayment && feeStyle ? `<div>
                        <p style="font-size:8px;font-weight:900;color:#9ca3af;text-transform:uppercase;letter-spacing:.15em;margin-bottom:2px;">${report.fee_label || 'Fee'}</p>
                        <div style="display:flex;align-items:center;gap:6px;">
                            ${report.fee_amount ? `<span style="font-size:11px;font-weight:900;color:#111827;">₦${report.fee_amount}</span>` : ''}
                            <span style="padding:2px 8px;border-radius:100px;font-size:9px;font-weight:900;background:${feeStyle.bg};color:${feeStyle.text};">${feeStyle.label}</span>
                        </div>
                    </div>` : ''}
                    <div>
                        <p style="font-size:8px;font-weight:900;color:#9ca3af;text-transform:uppercase;letter-spacing:.15em;margin-bottom:2px;">Verify</p>
                        <p style="font-size:11px;font-weight:900;color:#111827;">rillcod.com/verify</p>
                    </div>
                </div>
            </div>

            <!-- ── BODY ── -->
            <div style="flex:1;padding:16px 32px;display:flex;flex-direction:column;gap:10px;min-height:0;z-index:10;">

                <!-- Profile + Performance grid -->
                <div style="display:grid;grid-template-columns:4fr 8fr;gap:20px;align-items:stretch;">

                    <!-- Left — identity -->
                    <div style="display:flex;flex-direction:column;gap:6px;">
                        <!-- Student panel -->
                        <div style="background:#fff;border-radius:24px;padding:12px 18px;border:1px solid #e5e7eb;border-left:5px solid #1a1a2e;">
                            <p style="font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:.25em;color:#9ca3af;margin-bottom:6px;">Student Participant</p>
                            <p style="font-size:16px;font-weight:900;color:#111827;line-height:1.2;margin-bottom:4px;">${report.student_name || '—'}</p>
                            <div style="height:1px;background:#e5e7eb;margin:8px 0;"></div>
                            <div style="display:flex;flex-direction:column;gap:5px;">
                                <div>
                                    <p style="font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:.12em;color:#9ca3af;">Programme</p>
                                    <p style="font-size:12px;font-weight:700;color:#374151;">${report.course_name || '—'}</p>
                                </div>
                                <div>
                                    <p style="font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:.12em;color:#9ca3af;">Class / Section</p>
                                    <p style="font-size:12px;font-weight:700;color:#374151;">${report.section_class || '—'}</p>
                                </div>
                                <div>
                                    <p style="font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:.12em;color:#9ca3af;">${isDevelopment ? 'Duration' : 'Academic Term'}</p>
                                    <p style="font-size:12px;font-weight:700;color:#374151;">${isDevelopment ? (report.course_duration || report.report_term || '—') : `${report.report_term || '—'}${report.report_period ? ` · ${report.report_period}` : ''}`}</p>
                                </div>
                            </div>
                        </div>
                        <!-- Modules -->
                        <div style="background:#f1f5f9;border:1px solid #cbd5e1;border-radius:10px;padding:6px 12px;">
                            <p style="font-size:8px;font-weight:900;color:#64748b;text-transform:uppercase;letter-spacing:.1em;margin-bottom:2px;">Current Module</p>
                            <p style="font-size:12px;font-weight:700;color:#1e293b;line-height:1.3;">${report.current_module || '—'}</p>
                        </div>
                        <div style="background:#ede9fe;border:1px solid #c4b5fd;border-radius:10px;padding:6px 12px;">
                            <p style="font-size:8px;font-weight:900;color:#7c3aed;text-transform:uppercase;letter-spacing:.1em;margin-bottom:2px;">Upcoming Module</p>
                            <p style="font-size:12px;font-weight:700;color:#4c1d95;line-height:1.3;">${report.next_module || '—'}</p>
                        </div>
                    </div>

                    <!-- Right — metrics -->
                    <div style="display:flex;flex-direction:column;gap:10px;">
                        <div style="display:flex;align-items:center;gap:12px;">
                            <h3 style="font-size:11px;font-weight:900;color:#111827;text-transform:uppercase;letter-spacing:.15em;white-space:nowrap;">Final Performance Assessment</h3>
                            <div style="height:2px;flex:1;background:#f3f4f6;"></div>
                        </div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;flex:1;">
                            <!-- Score bars -->
                            <div style="background:#f9fafb;border:1px solid #f3f4f6;border-radius:16px;padding:14px 18px;display:flex;flex-direction:column;gap:10px;">
                                <!-- Scoring key -->
                                <div style="border-bottom:1px solid #e5e7eb;padding-bottom:5px;display:flex;flex-wrap:wrap;align-items:center;gap:3px;">
                                    <span style="font-size:7px;font-weight:900;color:#9ca3af;text-transform:uppercase;letter-spacing:.15em;margin-right:3px;">Key</span>
                                    ${[
                                        { label:'Exam',   pts:40, color:'#4f46e5' },
                                        { label:'Eval',   pts:20, color:'#0891b2' },
                                        { label:'Assign', pts:20, color:'#059669' },
                                        { label:'Proj',   pts:20, color:'#7c3aed' },
                                    ].map((k,i) => `${i>0?'<span style="color:#d1d5db;font-size:7px;"> · </span>':''}<span style="display:inline-flex;align-items:center;gap:2px;"><span style="width:5px;height:5px;border-radius:50%;background:${k.color};display:inline-block;"></span><span style="font-size:7px;font-weight:800;color:${k.color};">${k.label}</span><span style="font-size:7px;font-weight:500;color:#9ca3af;">/${k.pts}</span></span>`).join('')}
                                    <span style="font-size:7px;font-weight:700;color:#6b7280;margin-left:3px;">= 100</span>
                                </div>
                                ${[
                                    { label:'Examination (40%)', value:theory,       color:'#6366f1' },
                                    { label:'Evaluation (20%)',  value:practical,     color:'#06b6d4' },
                                    { label:'Assignment (20%)',  value:attendance,    color:'#10b981' },
                                    { label:'Project Eng (20%)',value:participation, color:'#8b5cf6' },
                                ].map(m => `
                                <div style="display:flex;flex-direction:column;gap:4px;">
                                    <div style="display:flex;justify-content:space-between;align-items:flex-end;">
                                        <span style="font-size:9px;font-weight:900;color:#9ca3af;text-transform:uppercase;letter-spacing:.08em;">${m.label}</span>
                                        <span style="font-size:12px;font-weight:900;color:${m.color};">${m.value}%</span>
                                    </div>
                                    <div style="height:7px;width:100%;background:#e5e7eb;border-radius:100px;overflow:hidden;">
                                        <div style="height:100%;border-radius:100px;background:${m.color};width:${m.value}%;"></div>
                                    </div>
                                </div>`).join('')}
                            </div>
                            <!-- Grade box -->
                            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;background:#f9fafb;border-radius:28px;padding:14px;border:1px solid #e5e7eb;border-left:4px solid #1a1a2e;text-align:center;">
                                <span style="font-size:28px;">✦</span>
                                <p style="font-size:10px;font-weight:900;color:#9ca3af;text-transform:uppercase;letter-spacing:.2em;margin:6px 0 2px;">Final Weighted Grade</p>
                                <h3 style="font-size:72px;font-weight:900;color:${grade.color};line-height:1;">${grade.g}</h3>
                                <div style="margin-top:10px;padding:4px 16px;background:#fff;border:1px solid #e5e7eb;border-radius:100px;">
                                    <span style="font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.12em;color:#374151;">${grade.label}</span>
                                </div>
                                <p style="font-size:18px;font-weight:900;color:#6b7280;margin-top:8px;">${overall}%</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- ── Qualifiers row ── -->
                ${qualifiers.length > 0 ? `
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    ${qualifiers.map(q => `
                    <div style="flex:1;min-width:0;background:${q.bg};border:1px solid ${q.color}30;border-radius:10px;padding:5px 10px;">
                        <p style="font-size:8px;font-weight:900;color:${q.color};text-transform:uppercase;letter-spacing:.1em;opacity:.8;">${q.label}</p>
                        <p style="font-size:11px;font-weight:600;color:#1e293b;line-height:1.3;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${q.value}</p>
                    </div>`).join('')}
                </div>` : ''}

                <!-- ── Qualitative ── -->
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;max-height:130px;overflow:hidden;">
                    <div style="padding:12px 16px;background:rgba(209,250,229,.5);border:1px solid #a7f3d0;border-radius:16px;">
                        <h4 style="font-size:11px;font-weight:900;color:#065f46;text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px;">Core Strengths</h4>
                        <p style="font-size:11px;line-height:1.6;color:rgba(6,95,70,.85);font-weight:500;display:-webkit-box;-webkit-line-clamp:5;-webkit-box-orient:vertical;overflow:hidden;">
                            ${report.key_strengths || 'The student shows consistent effort and a dedicated approach to theoretical concepts, displaying high focus during complex sessions.'}
                        </p>
                    </div>
                    <div style="padding:12px 16px;background:rgba(255,251,235,.7);border:1px solid #fde68a;border-radius:16px;">
                        <h4 style="font-size:11px;font-weight:900;color:#92400e;text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px;">Growth Focus</h4>
                        <p style="font-size:11px;line-height:1.6;color:rgba(120,53,15,.85);font-weight:500;display:-webkit-box;-webkit-line-clamp:5;-webkit-box-orient:vertical;overflow:hidden;">
                            ${report.areas_for_growth || 'Further immersion in practical projects will help build implementation confidence and speed in real-world environments.'}
                        </p>
                    </div>
                </div>

                <!-- ── Certificate ── -->
                ${showCertificate ? `
                <div style="background:linear-gradient(135deg,#fffbeb,#fef9e7);border:1px solid #fde68a;border-radius:20px;padding:10px 18px;text-align:center;position:relative;overflow:hidden;margin-top:2px;">
                    <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:6px;">
                        <div style="height:1px;width:28px;background:linear-gradient(to right,transparent,#e4a817);opacity:.6;"></div>
                        <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#fef08a,#fcd34d);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(234,168,23,.3);">
                            <span style="font-size:16px;">👑</span>
                        </div>
                        <div style="height:1px;width:28px;background:linear-gradient(to left,transparent,#e4a817);opacity:.6;"></div>
                    </div>
                    <h4 style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.14em;color:#a16207;margin-bottom:3px;">Academic Excellence Award</h4>
                    <p style="font-size:10px;color:#b45309;line-height:1.5;font-style:italic;font-weight:400;max-width:460px;margin:0 auto;opacity:.9;">
                        ${report.certificate_text || `This document officially recognises that ${report.student_name} has successfully completed the intensive study programme in ${report.course_name}.`}
                    </p>
                </div>` : ''}

                <!-- ── Signatures & QR ── -->
                <div style="padding-top:8px;border-top:2px solid #f3f4f6;margin-top:auto;">
                    <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:12px;">
                        <!-- Signature -->
                        <div style="flex-shrink:0;">
                            <p style="font-size:9px;font-weight:900;color:#9ca3af;text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px;">Signatory Authority</p>
                            <div style="width:160px;height:1px;background:#111827;margin-bottom:4px;"></div>
                            <p style="font-size:11px;font-weight:900;color:#111827;">Mr Osahon</p>
                            <p style="font-size:9px;font-weight:700;color:#9ca3af;text-transform:uppercase;">Director, ${org.name}</p>
                        </div>

                        <!-- Payment notice -->
                        ${report.show_payment_notice ? `
                        <div style="flex:1;background:#fffbeb;border:1.5px solid #fcd34d;border-radius:10px;padding:10px 14px;text-align:center;">
                            <p style="font-size:8px;font-weight:900;color:#92400e;text-transform:uppercase;letter-spacing:.14em;margin-bottom:2px;">Next Term Fee Payment</p>
                            <p style="font-size:17px;font-weight:900;color:#78350f;line-height:1;">₦20,000 &nbsp;·&nbsp; RILLCOD LTD</p>
                            <p style="font-size:17px;font-weight:900;color:#78350f;line-height:1.3;">Providus Bank · <span style="color:#92400e;">7901178957</span></p>
                            <p style="font-size:8px;font-weight:700;color:#b45309;">Use student name as reference · Send proof to admin</p>
                        </div>` : ''}

                        <!-- QR Code -->
                        <div style="flex-shrink:0;display:flex;flex-direction:column;align-items:center;gap:4px;">
                            <div style="padding:8px;background:#fff;border:3px solid #f3f4f6;border-radius:20px;box-shadow:0 1px 4px rgba(0,0,0,.06);">
                                <img src="https://api.qrserver.com/v1/create-qr-code/?size=72x72&data=https://rillcod.com/verify/${(report.id || 'preview').toString().slice(0,8)}" style="width:72px;height:72px;display:block;" />
                            </div>
                            <p style="font-size:9px;font-weight:900;color:#111827;letter-spacing:.25em;text-transform:uppercase;">VERIFY ${(report.id || 'PREVIEW').toString().slice(0,8).toUpperCase()}</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Footer strip -->
            <div style="position:absolute;bottom:0;left:0;right:0;height:6px;background:linear-gradient(to right,#7c3aed,#4f46e5,#10b981);"></div>
        </div>
    </body>
    </html>
    `;
}

export function generateModernReportHtml(report: any, orgSettings: any): string {
    const isIndustrial = report.template_id === 'industrial';
    const isExecutive  = report.template_id === 'executive';

    const accent      = isIndustrial ? '#000000' : isExecutive ? '#C5A059' : '#4f46e5';
    const accentDark  = isExecutive  ? '#1A1A2E' : accent;
    const accentLight = isIndustrial ? '#f5f5f5' : isExecutive ? '#FFFDF7' : '#eef2ff';
    const panelBorder = isIndustrial ? '2px solid #000000' : isExecutive ? '1px solid #C5A059' : '1px solid #e0e7ff';
    const radius      = isIndustrial || isExecutive ? '0px' : '16px';
    const bgClass     = isIndustrial ? 'font-mono bg-white' : 'font-sans bg-white';

    const theory      = Number(report.theory_score)      || 0;
    const practical   = Number(report.practical_score)   || 0;
    const attendance  = Number(report.attendance_score)  || 0;
    const participation = Number(report.participation_score) || 0;
    const computed = Math.round(theory * 0.4 + practical * 0.2 + attendance * 0.2 + participation * 0.2);
    const overall  = Number(report.overall_score) > 0 ? Number(report.overall_score) : computed;
    const grade    = letterGrade(overall);
    const showCertificate = overall >= 45 || report.has_certificate === true;

    const today = report.report_date ? new Date(report.report_date).toLocaleDateString('en-GB') : '—';

    const qualifiers = [
        { label: 'Project Work',  value: report.projects_grade,     color: '#8b5cf6', bg: '#ede9fe' },
        { label: 'Homework',      value: report.homework_grade,      color: '#0891b2', bg: '#e0f2fe' },
        { label: 'Participation', value: report.participation_grade, color: '#059669', bg: '#d1fae5' },
    ].filter(q => q.value);

    const org = {
        name:    orgSettings?.org_name    || 'Rillcod',
        tagline: orgSettings?.org_tagline || 'Excellence',
        logo:    orgSettings?.logo_url    || 'https://rillcod.com/logo.png',
    };

    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        ${tailwindCDN}
        ${fonts}
        <style>
            body { font-family: ${isIndustrial ? "'Space Mono', monospace" : "inherit"}; }
            @media print {
                @page { size: A4; margin: 0; }
                body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
        </style>
    </head>
    <body class="bg-gray-100 flex justify-center py-10 print:py-0">
        <div id="modern-report-card" class="${bgClass} text-black relative flex flex-col mx-auto"
             style="width:210mm;height:297mm;padding:12mm 18mm 10mm 18mm;box-sizing:border-box;overflow:hidden;${isIndustrial ? 'border:12px solid #000;' : isExecutive ? 'border:10px solid #1A1A2E;' : ''}">

            ${!isIndustrial && !isExecutive ? `<div style="position:absolute;inset:6mm;border:1.5px solid rgba(79,70,229,.15);border-radius:20px;pointer-events:none;"></div>` : ''}

            <!-- HEADER -->
            <div style="position:relative;z-index:10;display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:10px;margin-bottom:8px;border-bottom:${isIndustrial ? '4px solid #000' : isExecutive ? '3px solid #C5A059' : '1px solid #e5e7eb'};">
                <div style="display:flex;align-items:center;gap:14px;">
                    <img src="${org.logo}" style="width:48px;height:48px;object-fit:contain;${isIndustrial || isExecutive ? `filter:brightness(0) invert(1);background:${accentDark};padding:8px;` : ''}" crossorigin="anonymous" />
                    <div>
                        <h1 style="font-size:20px;font-weight:900;text-transform:uppercase;letter-spacing:-.04em;font-style:italic;line-height:1;margin-bottom:4px;color:${isExecutive ? '#1A1A2E' : '#000'};">${org.name}</h1>
                        <p style="font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:.3em;color:${accent};">${org.tagline}</p>
                    </div>
                </div>
                <div style="text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:5px;">
                    <div style="padding:4px 14px;background:${accentDark};color:#fff;font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:.3em;font-style:italic;border-radius:${radius};">Progress Report</div>
                    <p style="font-size:17px;font-weight:900;font-style:italic;line-height:1;color:${isExecutive ? '#1A1A2E' : '#000'};">${(report.id || 'PREVIEW').toString().slice(0,8)}</p>
                    <p style="font-size:8px;font-weight:900;color:#6b7280;text-transform:uppercase;letter-spacing:.15em;">${today}</p>
                </div>
            </div>

            <!-- IDENTITY GRID -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
                <div style="background:${accentLight};border:${panelBorder};border-radius:${radius};padding:10px 14px;">
                    <p style="font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:.3em;color:${accent};margin-bottom:6px;">Authorized Recipient</p>
                    <h3 style="font-size:15px;font-weight:900;text-transform:uppercase;line-height:1.15;margin-bottom:8px;color:${isExecutive ? '#1A1A2E' : '#000'};">${report.student_name || '—'}</h3>
                    <p style="font-size:7px;font-weight:900;color:#9ca3af;text-transform:uppercase;letter-spacing:.15em;">Class: <span style="font-size:11px;color:#000;">${report.section_class || '—'}</span></p>
                </div>
                <div style="background:${accentLight};border:${panelBorder};border-radius:${radius};padding:10px 14px;">
                    <p style="font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:.3em;color:${accent};margin-bottom:6px;">Operational Domain</p>
                    <h3 style="font-size:15px;font-weight:900;text-transform:uppercase;line-height:1.15;margin-bottom:8px;color:${isExecutive ? '#1A1A2E' : '#000'};">${report.course_name || '—'}</h3>
                    ${report.current_module || report.next_module ? `
                    <div style="display:flex;flex-direction:column;gap:4px;margin-top:4px;">
                        ${report.current_module ? `<p style="font-size:8px;font-weight:700;color:#6b7280;">Module: ${report.current_module}</p>` : ''}
                        ${report.next_module ? `<p style="font-size:8px;font-weight:700;color:${accent};">Next: ${report.next_module}</p>` : ''}
                    </div>` : ''}
                </div>
            </div>

            <!-- ASSESSMENT MATRIX -->
            <div style="display:grid;grid-template-columns:8fr 4fr;gap:12px;margin-bottom:8px;">
                <div style="background:#fff;border:${panelBorder};border-radius:${radius};padding:12px 14px;">
                    <div style="border-bottom:1px solid #e5e7eb;padding-bottom:5px;margin-bottom:8px;font-size:7px;font-weight:900;color:#9ca3af;text-transform:uppercase;">
                        Scoring Matrix: Exam(40) · Eval(20) · Assign(20) · Project(20)
                    </div>
                    ${[
                        { label:'Examination', value:theory,       color:accent },
                        { label:'Evaluation',  value:practical,     color:accent },
                        { label:'Assignment',  value:attendance,    color:accent },
                        { label:'Proj. Eng',   value:participation, color:accent },
                    ].map(m => `
                    <div style="display:flex;flex-direction:column;gap:5px;margin-bottom:7px;">
                        <div style="display:flex;justify-content:space-between;font-size:8px;font-weight:900;text-transform:uppercase;">
                            <span>${m.label}</span><span style="font-size:13px;color:${m.color};">${m.value}%</span>
                        </div>
                        <div style="height:5px;width:100%;background:#f8fafc;overflow:hidden;border-radius:3px;">
                            <div style="height:100%;width:${m.value}%;background:${m.color};border-radius:3px;"></div>
                        </div>
                    </div>`).join('')}
                </div>
                <div style="background:${isIndustrial ? '#000' : isExecutive ? '#1A1A2E' : '#4f46e5'};border-radius:${radius};padding:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;">
                    <p style="font-size:7px;font-weight:900;text-transform:uppercase;letter-spacing:.4em;color:${isExecutive ? '#C5A059' : 'rgba(255,255,255,.55)'};margin-bottom:4px;">Composite</p>
                    <h3 style="font-size:72px;font-weight:900;font-style:italic;line-height:1;color:${isIndustrial ? '#fff' : isExecutive ? '#C5A059' : '#fff'};margin-bottom:6px;">${grade.g}</h3>
                    <div style="padding:4px 12px;background:${isIndustrial || isExecutive ? accentDark : '#fff'};border-radius:${radius};margin-bottom:6px;">
                        <span style="font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:.2em;color:${isIndustrial ? '#fff' : isExecutive ? '#C5A059' : '#111827'};">${grade.label}</span>
                    </div>
                    <p style="font-size:15px;font-weight:900;font-style:italic;color:${isExecutive ? 'rgba(197,160,89,.7)' : 'rgba(255,255,255,.65)'};">${overall}%</p>
                </div>
            </div>

            <!-- Qualifiers -->
            ${qualifiers.length > 0 ? `
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">
                ${qualifiers.map(q => `
                <div style="flex:1;min-width:0;background:${q.bg};border:1px solid ${q.color}40;border-radius:8px;padding:4px 10px;">
                    <p style="font-size:7px;font-weight:900;color:${q.color};text-transform:uppercase;letter-spacing:.1em;">${q.label}</p>
                    <p style="font-size:10px;font-weight:600;color:#1e293b;line-height:1.3;">${q.value}</p>
                </div>`).join('')}
            </div>` : ''}

            <!-- QUALITATIVE -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;flex:1;">
                <div style="background:${isExecutive ? '#FFFDF7' : '#f0fdf4'};border:${panelBorder};border-radius:${radius};padding:10px 14px;">
                    <p style="font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:.3em;color:#059669;margin-bottom:5px;">Precision Strengths</p>
                    <p style="font-size:11px;line-height:1.55;color:#166534;font-weight:500;font-style:italic;">${report.key_strengths || 'Cognitive patterns indicate high analytical precision and consistent effort.'}</p>
                </div>
                <div style="background:${isExecutive ? '#FFFDF7' : '#fff7ed'};border:${panelBorder};border-radius:${radius};padding:10px 14px;">
                    <p style="font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:.3em;color:#dc2626;margin-bottom:5px;">Growth Vectors</p>
                    <p style="font-size:11px;line-height:1.55;color:#7c2d12;font-weight:500;font-style:italic;">${report.areas_for_growth || 'Transition to complex architectural modelling and practical implementation recommended.'}</p>
                </div>
            </div>

            <!-- Certificate (modern) -->
            ${showCertificate ? `
            <div style="background:linear-gradient(135deg,#fffbeb,#fef9e7);border:1px solid #fde68a;border-radius:${radius};padding:8px 16px;text-align:center;margin-bottom:8px;">
                <h4 style="font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.14em;color:#a16207;margin-bottom:2px;">Academic Excellence Award</h4>
                <p style="font-size:9px;color:#b45309;line-height:1.5;font-style:italic;">${report.certificate_text || `This document recognises that ${report.student_name} has successfully completed the study programme in ${report.course_name}.`}</p>
            </div>` : ''}

            <!-- FOOTER -->
            <div style="padding-top:10px;border-top:${isIndustrial ? '4px solid #000' : isExecutive ? '2px solid #C5A059' : '1px solid #e5e7eb'};margin-top:auto;">
                <div style="display:flex;justify-content:space-between;align-items:flex-end;">
                    <div>
                        <p style="font-size:8px;font-weight:900;color:#9ca3af;text-transform:uppercase;letter-spacing:.15em;margin-bottom:4px;">Signatory Authority</p>
                        <div style="width:160px;height:1px;background:${isExecutive ? '#C5A059' : '#111827'};margin-bottom:4px;"></div>
                        <p style="font-size:11px;font-weight:900;text-transform:uppercase;font-style:italic;">Director, ${org.name}</p>
                    </div>
                    <div style="display:flex;flex-direction:column;align-items:center;gap:4px;">
                        <img src="https://api.qrserver.com/v1/create-qr-code/?size=60x60&data=https://rillcod.com/verify/${(report.id || 'preview').toString().slice(0,8)}" style="width:60px;height:60px;" />
                        <p style="font-size:7px;font-weight:900;text-transform:uppercase;letter-spacing:.4em;color:${accent};">Verify Secure Hash</p>
                    </div>
                </div>
            </div>

            <div style="position:absolute;bottom:0;left:0;right:0;height:6px;background:${accentDark};"></div>
        </div>
    </body>
    </html>
    `;
}

function isFuturistic(id: string) {
    return !id || id === 'futuristic';
}
