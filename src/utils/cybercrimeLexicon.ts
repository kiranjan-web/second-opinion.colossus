export interface CybercrimeRule {
  id: string;
  category:
    | 'Telecom / Utility / Courier Lure'
    | 'Authority Impersonation'
    | 'Criminal Accusation'
    | 'Intimidation & Indirect Coercion'
    | 'Isolation & Secrecy'
    | 'Remote Access & Surveillance'
    | 'Direct & Indirect OTP / PIN Phishing'
    | 'Financial Coercion & Refund Tricks';
  phase: number;
  pattern: RegExp;
  label: string;
  plainAdvice: string;
}

export const CYBERCRIME_RULES: CybercrimeRule[] = [
  // Phase 1: Telecom / Courier / Utility / Refund / Lure Hooks (Direct & Indirect)
  {
    id: 'hook-courier',
    category: 'Telecom / Utility / Courier Lure',
    phase: 1,
    pattern:
      /\b(fedex|dhl|bluedart|courier( service)?|customs clearance|unclaimed parcel|seized parcel|parcel|address incomplete)\b/i,
    label: 'Fake courier or seized parcel story',
    plainAdvice: 'Do not pay small delivery fees or share IDs for a parcel you never ordered.',
  },
  {
    id: 'hook-trai-utility',
    category: 'Telecom / Utility / Courier Lure',
    phase: 1,
    pattern:
      /\b(trai|dot|sim ?(card)?|sim (block|suspend|deactivat|disconnect)|number will be blocked|press 9|kyc( update| expired| pending| suspend| verification)?|(electricity|power|gas|water|bank|fastag|credit card).{0,25}(cut|disconnect|block|suspend|close).{0,20}(today|tonight|hours|minutes)?|lottery|prize money|refund scam|task scam|telegram task)\b/i,
    label: 'Fake SIM, KYC, or utility disconnection scare',
    plainAdvice: 'Real banks, SIM providers, and electricity boards never demand urgent action on a random call.',
  },

  // Phase 2: Authority Impersonation
  {
    id: 'auth-agency',
    category: 'Authority Impersonation',
    phase: 2,
    pattern:
      /\b(cyber ?crime( cell)?|cyber ?cell|cbi|central bureau|enforcement directorate|ed officer|ncb|narcotics|customs( department)?|mumbai police|delhi police|crime branch|police|ips officer|dcp|inspector|rbi|sebi|income tax|supreme court|high court|magistrate|trai officer)\b/i,
    label: 'Caller pretending to be Police, CBI, RBI, or Court',
    plainAdvice: 'Real Police, CBI, and RBI officers never investigate cases or demand money over phone or video calls.',
  },
  {
    id: 'auth-transfer',
    category: 'Authority Impersonation',
    phase: 2,
    pattern:
      /\b(police station( se)?|thana( se)?|cyber cell se|badge number|fir( copy)?|official recording|senior officer)\b/i,
    label: 'Fake police transfer or badge pretext',
    plainAdvice: 'Hang up and dial 1930 or your local police station directly to verify.',
  },

  // Phase 3: Criminal Accusation & Framing
  {
    id: 'accuse-crime',
    category: 'Criminal Accusation',
    phase: 3,
    pattern:
      /\b(money laundering|hawala|terror funding|narcotics|drugs|mdma|heroin|cocaine|illegal parcel|fake passport|scam account|black money|pmla|tax evasion|fraud case|criminal case|scam|fraud)\b/i,
    label: 'False accusation of crime or illegal parcel',
    plainAdvice: 'Scammers invent fake crimes to panic you. Stay calm and hang up.',
  },
  {
    id: 'accuse-id',
    category: 'Criminal Accusation',
    phase: 3,
    pattern:
      /\b(aadhaar|pan card|bank account.{0,20}(opened|laundering|blocked|frozen)|linked to.{0,20}(fraud|laundering|crime)|compromised account)\b/i,
    label: 'Claiming your Aadhaar, PAN, or bank is linked to a crime',
    plainAdvice: 'Never share Aadhaar, PAN, or bank details to "prove" you are innocent.',
  },

  // Phase 4: Direct & Indirect Intimidation, Coercion & Urgency Pressure
  {
    id: 'intim-arrest',
    category: 'Intimidation & Indirect Coercion',
    phase: 4,
    pattern:
      /\b(digital arrest|house arrest|virtual custody|custody|arrest warrant|non-bailable warrant|nbw|warrant|lookout notice|cbi raid|police raid|police team.{0,20}(door|coming|dispatched)|seize (your|all) property|freeze( (your|all))?( (bank )?account)?|bank freeze|account freeze|coercion|coerce|blackmail|extort(ion)?|sextortion|leak.{0,15}video|defamation|bail|jail|imprisonment|legal action|penalty)\b/i,
    label: 'Arrest, blackmail, or bank freeze threat',
    plainAdvice: '"Digital Arrest" is 100% fake—Indian law has no video-call arrest. Disconnect now.',
  },
  {
    id: 'intim-indirect-pressure',
    category: 'Intimidation & Indirect Coercion',
    phase: 4,
    pattern:
      /\b((if you )?(hang up|cut the call|disconnect).{0,25}(guilt|guilty|confession|arrest|action|problem|police|trouble)|last warning|final warning|final chance|within \d+ minutes|don'?t waste time|act right now|stay on (the )?line|under cyber watch|watching your phone)\b/i,
    label: 'Indirect pressure to stop you from hanging up',
    plainAdvice: 'Pressuring you not to hang up or threatening guilt if you disconnect is a classic scam trick. Cut the call.',
  },

  // Phase 5: Direct & Indirect Isolation & Secrecy Orders
  {
    id: 'iso-silence',
    category: 'Isolation & Secrecy',
    phase: 5,
    pattern:
      /\b(don'?t tell|do not tell|tell no one|kisi ko mat batana|kisi ko mat bolna|yargu helbedi|keep( this)?( a)? secret|confidential(ity)?|national security( protocol)?|official secrets( act)?|nobody( at home)? needs to know|no one needs to know|just between us|protect.{0,20}(reputation|izzat))\b/i,
    label: 'Telling you to hide this call from your family',
    plainAdvice: 'ANY caller telling you not to tell your family is a scammer. Talk to your family immediately.',
  },
  {
    id: 'iso-physical',
    category: 'Isolation & Secrecy',
    phase: 5,
    pattern:
      /\b(separate room|lock( the| your)? door|door lock( maadi)?|alone in( a| the)? room|do not cut the call|don'?t hang up|disconnect from everyone|turn off notifications|flight mode)\b/i,
    label: 'Ordering you to lock your room or cut off others',
    plainAdvice: 'Do NOT lock your door or isolate yourself. Hang up and call a family member.',
  },

  // Phase 6: Forced Surveillance & Remote Access
  {
    id: 'surv-video',
    category: 'Remote Access & Surveillance',
    phase: 6,
    pattern:
      /\b(skype|whatsapp video|zoom video|video call|keep( your)? camera on|camera facing you|video verification|24.?7 monitoring|show your room|show your surroundings|surveillance)\b/i,
    label: 'Forcing you onto a live video call',
    plainAdvice: 'Never stay on a video call for "police verification". End the video call immediately.',
  },
  {
    id: 'surv-remote',
    category: 'Remote Access & Surveillance',
    phase: 6,
    pattern:
      /\b(anydesk|teamviewer|quicksupport|rustdesk|screen ?share|share( your)? screen|download apk|install.{0,15}apk|remote access|remote desktop)\b/i,
    label: 'Asking to see your screen or install a remote app',
    plainAdvice: 'Installing AnyDesk/TeamViewer or sharing your screen lets scammers empty your bank account.',
  },

  // Phase 6: Direct & Indirect OTP / Verification Code / PIN Phishing
  {
    id: 'phish-otp-direct',
    category: 'Direct & Indirect OTP / PIN Phishing',
    phase: 6,
    pattern:
      /\b(otp|one time password|otp batao|cvv|atm pin|upi pin|mpin|netbanking password|password|card number|expiry date|phishing|click this link|verify kyc link)\b/i,
    label: 'Asking directly for OTP, PIN, CVV, or password',
    plainAdvice: 'NEVER tell anyone your OTP, UPI PIN, or CVV—even if they claim to be from your bank or police.',
  },
  {
    id: 'phish-otp-indirect',
    category: 'Direct & Indirect OTP / PIN Phishing',
    phase: 6,
    pattern:
      /\b((4|5|6|four|five|six)[ -]?digit (code|number|pin)|(verification|security|confirmation|cancellation|refund|reference|secret|booking|tracking) (code|number|pin)|(tell|read|send|forward|confirm|give|share|check).{0,25}(code|number|message|sms).{0,25}(came|received|arrived|phone|mobile|box|inbox)|code aaya|number aaya|message mein.{0,20}(code|number)|batao.{0,15}(number|code)|screenshot of.{0,15}(sms|message|code)|enter.{0,15}pin to (receive|get|claim|accept))\b/i,
    label: 'Indirectly asking for SMS code / "verification number" / PIN for refund',
    plainAdvice: 'Disguised OTP trick! Calling it a "6-digit verification/refund code" or asking for your PIN to receive money is a scam.',
  },

  // Phase 7: Financial Coercion, Accidental Transfer & Refund Tricks
  {
    id: 'fin-transfer',
    category: 'Financial Coercion & Refund Tricks',
    phase: 7,
    pattern:
      /\b(rtgs|imps|neft|upi|wire transfer|bank transfer|transfer money|send money|pay now|urgent transfer|secret account|verification account|escrow( account)?|safe custody account|refundable deposit|clearance fee|verification fee|custom duty|bribe|clear your biometrics|liquidate.{0,20}(fd|fixed deposit|mutual fund)|upi collect|approve.{0,15}request|tap accept|gift card|crypto wallet|usdt|bitcoin)\b/i,
    label: 'Demanding money transfer, UPI approval, or FD liquidation',
    plainAdvice: 'Never transfer money to any "verification/RBI account" or tap Approve to receive a refund.',
  },
  {
    id: 'fin-indirect-scam',
    category: 'Financial Coercion & Refund Tricks',
    phase: 7,
    pattern:
      /\b((sent|transferred).{0,20}(by mistake|accidentally).{0,25}(send|return|refund)|pay.{0,15}(small fee|rs\.?\s*\d+).{0,20}(claim|receive|unlock)|family emergency.{0,25}(send money|transfer|don'?t call))\b/i,
    label: 'Accidental transfer, small-fee unlock, or fake family emergency scam',
    plainAdvice: 'Verify independently by calling your family member or checking your official bank app first.',
  },
];

export interface TriggerMatch {
  phrase: string;
  category: CybercrimeRule['category'];
  phase: number;
  label: string;
  plainAdvice: string;
}

export function scanCybercrimeTriggers(text: string): TriggerMatch[] {
  const matches: TriggerMatch[] = [];
  const seen = new Set<string>();

  for (const rule of CYBERCRIME_RULES) {
    const globalRegex = new RegExp(rule.pattern.source, 'gi');
    let m: RegExpExecArray | null;
    while ((m = globalRegex.exec(text)) !== null) {
      const phrase = m[0].trim();
      const key = `${rule.id}:${phrase.toLowerCase()}`;
      if (phrase && !seen.has(key)) {
        seen.add(key);
        matches.push({
          phrase,
          category: rule.category,
          phase: rule.phase,
          label: rule.label,
          plainAdvice: rule.plainAdvice,
        });
      }
    }
  }

  return matches.sort((a, b) => b.phase - a.phase);
}

export function getCommonManSummary(
  phase: number,
  matches: TriggerMatch[]
): { headline: string; reason: string; action: string } {
  if (phase >= 5) {
    return {
      headline: 'DANGER: Likely Scam Call — Hang Up Now',
      reason:
        matches[0]?.label ?? 'Caller is trying to isolate you, steal codes, or force a payment.',
      action:
        matches[0]?.plainAdvice ??
        'Cut the call right away. Never share codes, install apps, or send money. Call family or dial 1930.',
    };
  }
  if (phase >= 3) {
    return {
      headline: 'HIGH RISK: Scam Tactics Detected',
      reason: matches[0]?.label ?? 'Caller is using fear, accusations, or urgency pressure.',
      action:
        matches[0]?.plainAdvice ??
        'Do not panic or obey urgent orders. Disconnect and verify with your family or bank.',
    };
  }
  if (phase >= 1) {
    return {
      headline: 'BE CAREFUL: Suspicious Call Pattern',
      reason: matches[0]?.label ?? 'Caller mentioned an unexpected parcel, KYC, or authority claim.',
      action:
        matches[0]?.plainAdvice ??
        'Do not share personal details or SMS codes. Verify independently on an official helpline.',
    };
  }
  return {
    headline: 'Call Looks Safe',
    reason: 'No direct or indirect OTP, scam, or pressure tricks spotted.',
    action: 'Keep listening normally. Second Voice will beep if anything suspicious comes up.',
  };
}

export function highlightTranscriptSegments(
  text: string,
  extraPhrases: string[] = []
): Array<{ text: string; isTrigger: boolean; phase?: number; category?: string }> {
  const matches = scanCybercrimeTriggers(text);
  const spans: Array<{ start: number; end: number; phase: number; category: string }> = [];

  for (const rule of CYBERCRIME_RULES) {
    const g = new RegExp(rule.pattern.source, 'gi');
    let m: RegExpExecArray | null;
    while ((m = g.exec(text)) !== null) {
      spans.push({
        start: m.index,
        end: m.index + m[0].length,
        phase: rule.phase,
        category: rule.category,
      });
    }
  }

  for (const phrase of extraPhrases) {
    const clean = phrase.trim();
    if (clean.length < 3) continue;
    const escaped = clean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const g = new RegExp(escaped, 'gi');
    let m: RegExpExecArray | null;
    while ((m = g.exec(text)) !== null) {
      spans.push({
        start: m.index,
        end: m.index + m[0].length,
        phase: matches[0]?.phase ?? 4,
        category: 'AI Flagged Trigger',
      });
    }
  }

  if (spans.length === 0) {
    return [{ text, isTrigger: false }];
  }

  spans.sort((a, b) => a.start - b.start || b.end - a.end);
  const merged: typeof spans = [];
  for (const s of spans) {
    const last = merged[merged.length - 1];
    if (!last || s.start >= last.end) {
      merged.push(s);
    } else if (s.end > last.end) {
      last.end = s.end;
      last.phase = Math.max(last.phase, s.phase);
    }
  }

  const result: Array<{ text: string; isTrigger: boolean; phase?: number; category?: string }> = [];
  let cursor = 0;
  for (const span of merged) {
    if (span.start > cursor) {
      result.push({ text: text.slice(cursor, span.start), isTrigger: false });
    }
    result.push({
      text: text.slice(span.start, span.end),
      isTrigger: true,
      phase: span.phase,
      category: span.category,
    });
    cursor = span.end;
  }
  if (cursor < text.length) {
    result.push({ text: text.slice(cursor), isTrigger: false });
  }
  return result;
}
