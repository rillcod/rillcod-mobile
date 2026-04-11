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

export function generateStandardReportHtml(report: any, orgSettings: any): string {
    const today = report.report_date
        ? new Date(report.report_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
        : '—';

    const theory = Number(report.theory_score) || 0;
    const practical = Number(report.practical_score) || 0;
    const attendance = Number(report.attendance_score) || 0;
    const participation = Number(report.participation_score) || 0;
    const computed = Math.round(theory * 0.4 + practical * 0.2 + attendance * 0.2 + participation * 0.2);
    const overall = Number(report.overall_score) > 0 ? Number(report.overall_score) : computed;
    const grade = letterGrade(overall);
    const showCertificate = overall >= 45 || report.has_certificate === true;

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
        <div id="report-card" class="bg-white text-gray-900 font-sans relative overflow-hidden shrink-0 flex flex-col" style="width: 794px; height: 1123px; border: 4px solid #1a1a2e;">
            <div class="absolute top-0 right-0 w-[400px] h-[400px] bg-indigo-50/50 rounded-full blur-3xl -z-10 -mr-40 -mt-40"></div>
            <div class="absolute bottom-0 left-0 w-[500px] h-[500px] bg-violet-50/50 rounded-full blur-3xl -z-10 -ml-40 -mb-40"></div>
            <div class="absolute inset-0 border-[1px] border-gray-100 m-4 pointer-events-none"></div>

            <div class="relative pt-5 pb-3 px-10 bg-white border-b border-gray-200" style="border-bottom: 2px solid #e5e7eb; border-left: 6px solid #1a1a2e;">
                <div class="flex items-center justify-between relative z-10">
                    <div class="flex items-center gap-6">
                        <img src="${orgSettings?.logo_url || 'https://rillcod.com/logo.png'}" class="w-16 h-16 object-contain" />
                        <div>
                            <h1 class="text-xl font-black tracking-tighter uppercase leading-none mb-1 text-gray-900">${orgSettings?.org_name || 'Rillcod Technologies'}</h1>
                            <p class="text-[11px] font-bold text-violet-600 uppercase tracking-[0.3em]">${orgSettings?.org_tagline || 'Excellence in EdTech'}</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <h2 class="text-2xl font-black text-gray-900 uppercase tracking-tighter">Progress Report</h2>
                    </div>
                </div>
            </div>

            <!-- Stats Bar -->
            <div class="bg-gray-50 border-y border-gray-100 px-10 py-2 flex justify-between items-center">
                <div class="flex gap-8">
                    <div>
                        <p class="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">ID</p>
                        <p class="text-[12px] font-black text-gray-900">${(report.id || 'PREVIEW').toString().slice(0, 8).toUpperCase()}</p>
                    </div>
                    <div>
                        <p class="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Date</p>
                        <p class="text-[12px] font-black text-gray-900">${today}</p>
                    </div>
                    <div>
                        <p class="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">School</p>
                        <p class="text-[12px] font-black text-gray-900">${report.school_name || 'Rillcod Academy'}</p>
                    </div>
                </div>
            </div>

            <div class="flex-1 px-8 py-4 flex flex-col gap-3">
                <div class="grid grid-cols-12 gap-6 items-stretch">
                    <div class="col-span-4 flex flex-col gap-2">
                        <div class="bg-white rounded-3xl px-5 py-3 border border-gray-200" style="border-left: 5px solid #1a1a2e;">
                            <p class="text-[10px] font-black uppercase tracking-[0.25em] text-gray-400 mb-2">Student Participant</p>
                            <p class="text-lg font-black text-gray-900 leading-tight mb-1">${report.student_name || '—'}</p>
                            <div class="h-px bg-gray-200 my-2.5"></div>
                            <div class="space-y-1.5">
                                <div>
                                    <p class="text-[10px] font-black uppercase tracking-widest text-gray-400">Programme</p>
                                    <p class="text-[13px] font-bold text-gray-700">${report.course_name || '—'}</p>
                                </div>
                                <div>
                                    <p class="text-[10px] font-black uppercase tracking-widest text-gray-400">Class / Section</p>
                                    <p class="text-[13px] font-bold text-gray-700">${report.section_class || '—'}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="col-span-8 flex flex-col gap-3">
                        <div class="flex items-center gap-4">
                            <h3 class="text-[12px] font-black text-gray-900 uppercase tracking-[0.15em] shrink-0">Final Performance Assessment</h3>
                            <div class="h-[2px] w-full bg-gray-50 flex items-center"><div class="h-[2px] w-8 bg-violet-600/30"></div></div>
                        </div>
                        <div class="flex-1 grid grid-cols-2 gap-5">
                            <div class="bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 flex flex-col gap-3">
                                <!-- Metrics -->
                                <div class="space-y-1.5">
                                    <div class="flex justify-between items-end">
                                        <span class="text-[11px] font-black text-gray-400 uppercase tracking-widest">Examination</span>
                                        <span class="text-sm font-black" style="color:#6366f1">${theory}%</span>
                                    </div>
                                    <div class="h-2 w-full bg-gray-200 rounded-full"><div class="h-full rounded-full bg-indigo-500" style="width: ${theory}%"></div></div>
                                </div>
                                <div class="space-y-1.5">
                                    <div class="flex justify-between items-end">
                                        <span class="text-[11px] font-black text-gray-400 uppercase tracking-widest">Evaluation</span>
                                        <span class="text-sm font-black" style="color:#06b6d4">${practical}%</span>
                                    </div>
                                    <div class="h-2 w-full bg-gray-200 rounded-full"><div class="h-full rounded-full bg-cyan-500" style="width: ${practical}%"></div></div>
                                </div>
                                <div class="space-y-1.5">
                                    <div class="flex justify-between items-end">
                                        <span class="text-[11px] font-black text-gray-400 uppercase tracking-widest">Assignment</span>
                                        <span class="text-sm font-black" style="color:#10b981">${attendance}%</span>
                                    </div>
                                    <div class="h-2 w-full bg-gray-200 rounded-full"><div class="h-full rounded-full bg-emerald-500" style="width: ${attendance}%"></div></div>
                                </div>
                            </div>
                            <!-- Grade -->
                            <div class="flex flex-col items-center justify-center bg-gray-50 rounded-[32px] p-4 relative overflow-hidden border border-gray-200" style="border-left: 4px solid #1a1a2e;">
                                <p class="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Final Weighted Grade</p>
                                <h3 class="text-7xl font-black" style="color: ${grade.color}">${grade.g}</h3>
                                <div class="mt-4 px-4 py-1.5 bg-white rounded-full border border-gray-200">
                                    <span class="text-xs font-black uppercase tracking-widest text-gray-700">${grade.label}</span>
                                </div>
                                <p class="text-xl font-black text-gray-500 mt-3">${overall}%</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- QUALITATIVE -->
                <div class="flex-1 grid grid-cols-2 gap-4 mt-6">
                    <div class="p-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl">
                        <h4 class="text-[12px] font-black text-emerald-900 mb-2 uppercase tracking-wide">Core Strengths</h4>
                        <p class="text-[12px] leading-relaxed text-emerald-900/80 font-medium">
                            ${report.key_strengths || 'Consistent effort and dedicated approach to core concepts.'}
                        </p>
                    </div>
                    <div class="p-4 bg-amber-50/50 border border-amber-100 rounded-2xl">
                        <h4 class="text-[12px] font-black text-amber-900 mb-2 uppercase tracking-wide">Growth Focus</h4>
                        <p class="text-[12px] leading-relaxed text-amber-900/80 font-medium">
                            ${report.areas_for_growth || 'Further immersion in practical projects recommended.'}
                        </p>
                    </div>
                </div>

                 <!-- CERTIFICATE -->
                ${showCertificate ? `
                <div style="background: linear-gradient(135deg, #fffbeb 0%, #fef9e7 100%); border: 1px solid #fde68a; border-radius: 24px; padding: 10px 20px; text-align: center; margin-top: 10px;">
                    <h4 style="font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.14em; color: #a16207; margin-bottom: 3px;">Academic Excellence Award</h4>
                    <p style="font-size: 10.5px; color: #b45309; line-height: 1.5; font-style: italic; font-weight: 400;">
                        ${report.certificate_text || `This document officially recognizes that ${report.student_name} has successfully completed the intensive study programme in ${report.course_name}.`}
                    </p>
                </div>
                ` : ''}

                <!-- FOOTER & SIGNATURE -->
                <div class="pt-4 border-t-2 border-gray-100 mt-auto">
                    <div class="flex items-end justify-between">
                        <div>
                            <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Signatory Authority</p>
                            <div class="w-48 h-px bg-gray-900 mb-2"></div>
                            <p class="text-xs font-black text-gray-900">Official Signatory</p>
                            <p class="text-[10px] font-bold text-gray-400 uppercase">${orgSettings?.org_name || 'Rillcod Technologies'}</p>
                        </div>
                        <div class="text-center">
                            <img src="https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=https://rillcod.com/verify/${report.id?.slice(0,8) || 'preview'}" alt="QR Code" class="w-16 h-16 mx-auto mb-2 border border-gray-200 rounded-lg p-1"/>
                            <p class="text-[8px] font-black text-gray-900 tracking-[0.25em] uppercase">VERIFY ${report.id?.slice(0, 8).toUpperCase() || 'PREVIEW'}</p>
                        </div>
                    </div>
                </div>

            </div>
            <div class="absolute bottom-0 left-0 right-0 h-2 bg-gradient-to-r from-violet-600 via-indigo-600 to-emerald-500"></div>
        </div>
    </body>
    </html>
    `;
}

export function generateModernReportHtml(report: any, orgSettings: any): string {
    const isIndustrial = report.template_id === 'industrial';
    const isExecutive = report.template_id === 'executive';
    
    // Default to Futuristic styles
    const accent = isIndustrial ? '#000000' : isExecutive ? '#C5A059' : '#4f46e5';
    const accentDark = isExecutive ? '#1A1A2E' : accent;
    const accentLight = isIndustrial ? '#f5f5f5' : isExecutive ? '#FFFDF7' : '#eef2ff';
    const panelBorder = isIndustrial ? '2px solid #000000' : isExecutive ? '1px solid #C5A059' : '1px solid #e0e7ff';
    const radius = isIndustrial || isExecutive ? '0px' : '16px';
    const bgClass = isIndustrial ? 'font-mono bg-white' : 'font-sans bg-white';

    const theory = Number(report.theory_score) || 0;
    const practical = Number(report.practical_score) || 0;
    const attendance = Number(report.attendance_score) || 0;
    const participation = Number(report.participation_score) || 0;
    const computed = Math.round(theory * 0.4 + practical * 0.2 + attendance * 0.2 + participation * 0.2);
    const overall = Number(report.overall_score) > 0 ? Number(report.overall_score) : computed;
    const grade = letterGrade(overall);
    
    const today = report.report_date ? new Date(report.report_date).toLocaleDateString('en-GB') : '—';

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
        <div id="modern-report-card" class="${bgClass} text-black relative flex flex-col mx-auto" style="width: 210mm; height: 297mm; padding: 12mm 18mm 10mm 18mm; box-sizing: border-box; overflow: hidden; ${isIndustrial ? 'border: 12px solid #000;' : isExecutive ? 'border: 10px solid #1A1A2E;' : ''}">
            
            ${isFuturistic(report.template_id) ? `<div style="position: absolute; inset: 6mm; border: 1.5px solid rgba(79,70,229,0.15); border-radius: 20px; pointer-events: none;"></div>` : ''}
            
            <!-- HEADER -->
            <div style="position: relative; z-index: 10; display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 10px; margin-bottom: 8px; border-bottom: ${isIndustrial ? '4px solid #000' : isExecutive ? '3px solid #C5A059' : '1px solid #e5e7eb'};">
                <div style="display: flex; align-items: center; gap: 14px;">
                    <img src="${orgSettings?.logo_url || 'https://rillcod.com/logo.png'}" style="width: 48px; height: 48px; object-fit: contain; ${isIndustrial || isExecutive ? 'filter: brightness(0) invert(1); background: '+accentDark+'; padding: 8px;' : ''}" />
                    <div>
                        <h1 style="font-size: 20px; font-weight: 900; text-transform: uppercase; letter-spacing: -0.04em; font-style: italic; line-height: 1; margin-bottom: 4px; color: ${isExecutive ? '#1A1A2E' : '#000'}">${orgSettings?.org_name || 'Rillcod'}</h1>
                        <p style="font-size: 8px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.3em; color: ${accent};">${orgSettings?.org_tagline || 'Excellence'}</p>
                    </div>
                </div>
                <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 5px;">
                    <div style="padding: 4px 14px; background: ${accentDark}; color: #fff; font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.3em; font-style: italic; border-radius: ${radius};">Progress Report</div>
                    <p style="font-size: 17px; font-weight: 900; font-style: italic; line-height: 1; color: ${isExecutive ? '#1A1A2E' : '#000'}">${(report.id || 'PREVIEW').toString().slice(0,8)}</p>
                    <p style="font-size: 8px; font-weight: 900; color: #6b7280; text-transform: uppercase; letter-spacing: 0.15em;">${today}</p>
                </div>
            </div>

            <!-- IDENTITY GRID -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
                <div style="background: ${accentLight}; border: ${panelBorder}; border-radius: ${radius}; padding: 10px 14px;">
                    <p style="font-size: 8px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.3em; color: ${accent}; margin-bottom: 6px;">Authorized Recipient</p>
                    <h3 style="font-size: 15px; font-weight: 900; text-transform: uppercase; line-height: 1.15; margin-bottom: 8px; color: ${isExecutive ? '#1A1A2E' : '#000'}">${report.student_name || '—'}</h3>
                    <p style="font-size: 7px; font-weight: 900; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.15em;">Class: <span style="font-size: 11px; color: #000">${report.section_class || '—'}</span></p>
                </div>
                <div style="background: ${accentLight}; border: ${panelBorder}; border-radius: ${radius}; padding: 10px 14px;">
                    <p style="font-size: 8px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.3em; color: ${accent}; margin-bottom: 6px;">Operational Domain</p>
                    <h3 style="font-size: 15px; font-weight: 900; text-transform: uppercase; line-height: 1.15; margin-bottom: 8px; color: ${isExecutive ? '#1A1A2E' : '#000'}">${report.course_name || '—'}</h3>
                </div>
            </div>

            <!-- ASSESSMENT MATRIX -->
            <div style="display: grid; grid-template-columns: 8fr 4fr; gap: 12px; margin-bottom: 10px;">
                <div style="background: #fff; border: ${panelBorder}; border-radius: ${radius}; padding: 12px 14px;">
                    <div style="border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; margin-bottom: 9px; font-size: 7px; font-weight: 900; color: #9ca3af; text-transform: uppercase;">
                        Scoring Matrix: Exam(40) · Eval(20) · Assign(20) · Project(20)
                    </div>
                    
                    <div style="display: flex; flex-direction: column; gap: 9px;">
                        <div style="display: flex; justify-content: space-between; font-size: 8px; font-weight: 900; text-transform: uppercase;"><span>Examination</span><span style="font-size: 13px; color: ${accent}">${theory}%</span></div>
                        <div style="height: 5px; width: 100%; background: #f8fafc; overflow: hidden;"><div style="height: 100%; width: ${theory}%; background: ${accent};"></div></div>
                        
                        <div style="display: flex; justify-content: space-between; font-size: 8px; font-weight: 900; text-transform: uppercase;"><span>Evaluation</span><span style="font-size: 13px; color: ${accent}">${practical}%</span></div>
                        <div style="height: 5px; width: 100%; background: #f8fafc; overflow: hidden;"><div style="height: 100%; width: ${practical}%; background: ${accent};"></div></div>
                        
                        <div style="display: flex; justify-content: space-between; font-size: 8px; font-weight: 900; text-transform: uppercase;"><span>Assignment</span><span style="font-size: 13px; color: ${accent}">${attendance}%</span></div>
                        <div style="height: 5px; width: 100%; background: #f8fafc; overflow: hidden;"><div style="height: 100%; width: ${attendance}%; background: ${accent};"></div></div>
                    </div>
                </div>

                <div style="background: ${isIndustrial ? '#000' : isExecutive ? '#1A1A2E' : '#4f46e5'}; border-radius: ${radius}; padding: 14px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;">
                    <p style="font-size: 7px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.4em; color: ${isExecutive ? '#C5A059' : 'rgba(255,255,255,0.55)'}; margin-bottom: 4px;">Composite</p>
                    <h3 style="font-size: 76px; font-weight: 900; font-style: italic; line-height: 1; color: ${isIndustrial ? '#fff' : isExecutive ? '#C5A059' : '#fff'}; margin-bottom: 6px;">${grade.g}</h3>
                    <div style="padding: 4px 12px; background: ${isIndustrial || isExecutive ? accentDark : '#fff'}; border-radius: ${radius}; margin-bottom: 6px;">
                        <span style="font-size: 8px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.2em; color: ${isIndustrial ? '#fff' : isExecutive ? '#C5A059' : '#111827'}">${grade.label}</span>
                    </div>
                    <p style="font-size: 15px; font-weight: 900; font-style: italic; color: ${isExecutive ? 'rgba(197,160,89,0.7)' : 'rgba(255,255,255,0.65)'};">${overall}%</p>
                </div>
            </div>

            <!-- QUALITATIVE -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; flex: 1;">
                <div style="background: ${isExecutive ? '#FFFDF7' : '#f0fdf4'}; border: ${panelBorder}; border-radius: ${radius}; padding: 10px 14px;">
                    <p style="font-size: 8px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.3em; color: #059669; margin-bottom: 5px;">Precision Strengths</p>
                    <p style="font-size: 11px; line-height: 1.55; color: #166534; font-weight: 500; font-style: italic;">${report.key_strengths || 'Cognitive patterns indicate high analytical precision.'}</p>
                </div>
                <div style="background: ${isExecutive ? '#FFFDF7' : '#fff7ed'}; border: ${panelBorder}; border-radius: ${radius}; padding: 10px 14px;">
                    <p style="font-size: 8px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.3em; color: #dc2626; margin-bottom: 5px;">Growth Vectors</p>
                    <p style="font-size: 11px; line-height: 1.55; color: #7c2d12; font-weight: 500; font-style: italic;">${report.areas_for_growth || 'Transition to complex architectural modeling recommended.'}</p>
                </div>
            </div>

            <!-- FOOTER -->
            <div style="padding-top: 10px; border-top: ${isIndustrial ? '4px solid #000' : isExecutive ? '2px solid #C5A059' : '1px solid #e5e7eb'}; margin-top: auto;">
                <div style="display: flex; justify-content: space-between; align-items: flex-end;">
                    <div>
                        <p style="font-size: 8px; font-weight: 900; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.15em; margin-bottom: 4px;">Signatory Authority</p>
                        <div style="width: 160px; height: 1px; background: ${isExecutive ? '#C5A059' : '#111827'}; margin-bottom: 4px;"></div>
                        <p style="font-size: 11px; font-weight: 900; text-transform: uppercase; font-style: italic;">Director, Rillcod</p>
                    </div>
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
                        <img src="https://api.qrserver.com/v1/create-qr-code/?size=60x60&data=https://rillcod.com/verify/${report.id?.slice(0,8) || 'preview'}" />
                        <p style="font-size: 7px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.4em; color: ${accent};">Verify Secure Hash</p>
                    </div>
                </div>
            </div>
            
            <div style="position: absolute; bottom: 0; left: 0; right: 0; height: 6px; background: ${accentDark};"></div>
        </div>
    </body>
    </html>
    `;
}

function isFuturistic(id: string) {
    return !id || id === 'futuristic';
}
