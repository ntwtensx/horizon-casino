// client/src/utils/eventTones.js
// 🎨 ศูนย์รวมสูตรจับคู่สีสเปกตรัม 19 เฉดผสม (ใช้ร่วมกันทั้ง การ์ดอีเวนท์, ช่องสล็อต 3 ช่อง หน้า-หลัง และสมุดแสตมป์ 158 ดวง)

export const FOIL_TONES = new Set([
  'gold-yellow',
  'violet-pink',
  'purple-gold',
  'prism-chaos',
  'sky-cyan',
  'lm-garden',
  'lm-sakura',
  'lm-meadow',
  'lm-beach',
  'lm-river'
]);

const hashIndex = (str, len) => {
  let h = 0;
  const s = String(str || '');
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % len;
};

// จับคู่เฉดสีจากไอคอนและข้อความสั้น (ใช้ร่วมกันทั้งช่องสล็อตและแสตมป์)
function matchToneFromKeywords(text = '', icon = '') {
  const s = `${icon} ${text}`;

  // แลนด์มาร์ก 5 โซน
  if (s.includes('🪴') || s.includes('สวนต้นไม้')) return 'lm-garden';
  if (s.includes('🌸') || s.includes('ซากุระ')) return 'lm-sakura';
  if (s.includes('🪻') || s.includes('ทุ่งดอกไม้')) return 'lm-meadow';
  if (s.includes('🏖️') || s.includes('ชายหาด')) return 'lm-beach';
  if (s.includes('🏞️') || s.includes('แม่น้ำภูเขา')) return 'lm-river';

  // แดงเพลิง–ส้มเข้ม
  if (/🚨|🔨|🪓|💥|🔫|🕳️|ยึดทรัพย์|ขวานผ่า|กระเป๋าตังค์หล่น|ลืมกระเป๋า|ทิ้งกระเป๋า|พัดกระเป๋า|รูเล็ตต์/.test(s)) {
    return 'crimson-red';
  }
  // คราม–น้ำเงิน
  if (/🕵️|⚖️|📜|ปปง\.|ฟ้องร้อง|ศาลคาเฟ่/.test(s)) return 'indigo-blue';
  // น้ำเงินมิดไนท์–แดงไซเรน
  if (/🐈‍⬛|🥷|🏦|ตู้เซฟ|โจรย่องเบา|ปล้นสุลต่าน/.test(s)) return 'navy-crimson';
  // ม่วงเข้ม–เหลืองสายฟ้า
  if (/😈|⚡|🚩|ความโลภ|ย้อนศร|ล้มยักษ์|ปฏิวัติ/.test(s)) return 'purple-gold';
  // ฟ้าใส–ครามอ่อน
  if (/👼|🛡️|🌧️|🪟|🕊️|🧊|🫧|ปลดหนี้|ประกันภัย|มหาทาน|ผ้าม่าน|เมตตา|บลู|โซดา/.test(s)) {
    return 'sky-cyan';
  }
  // รุ้งพาสเทลผสมหลายสี
  if (/☯️|🌀|🃏|🪞|🌈|🦄|ชะตาเล่นตลก|เฉลี่ยสุข|กระจกเงา|ตรรกะวิบัติ|กาแล็กซี/.test(s)) {
    return 'prism-chaos';
  }
  // เหลืองทอง–แชมเปญ
  if (/7️⃣|👑|🚀|💎|🎲|🏆|🥇|💰|🍯|🍮|777|แจ็กพอต|ขอทานเศรษฐี|เต๋าทองคำ|น้ำผึ้ง|พุดดิ้ง/.test(s)) {
    return 'gold-yellow';
  }
  // ส้มคาราเมล–พีช
  if (/🍪|🐷|📸|🔥|🥐|🍊|🍑|🧇|คุกกี้|กระปุกหมู|ไวรัล|คาราเมล|ครัวซองต์|พีช|ส้ม/.test(s)) {
    return 'orange-peach';
  }
  // แสด–ส้มปะการัง
  if (/👯|📣|🧾|🦈|💣|💬|🧋|☕|🍫|เพื่อนยืม|แก๊งเพื่อน|เหมาเลี้ยง|ปลาดุก|ระเบิด|ชานม|มอคค่า|เอสเปรสโซ/.test(s)) {
    return 'tangerine-coral';
  }
  // แดงกุหลาบ–ชมพูเบอร์รี่
  if (/📝|💢|🍓|🍒|🧁|ค้ำประกัน|หมั่นไส้|สตรอว์|เบอร์รี่|เชอร์รี/.test(s)) {
    return 'rose-berry';
  }
  // ม่วง–ชมพู
  if (/🧶|⛓️|💞|🧲|🎭|🔄|🍇|โซ่ล่าม|สลับกระเป๋า|แม่เหล็ก|อยากรวย|อยากจน|ลาเวนเดอร์|เผือก|อัญชัน/.test(s)) {
    return 'violet-pink';
  }
  // เขียวมะนาว–เหลือง
  if (/🤝|🍋|🍍|ยืมเงินเพื่อน|ลาภลอย|เลมอน|ยูซุ|มะนาว/.test(s)) return 'lime-yellow';
  // เขียวสด–มิ้นต์
  if (/🍀|🏹|🤑|🍵|🥝|โรบินฮู้ด|เก็บกระเป๋า|พบกระเป๋า|มัทฉะ|ชาเขียว|มิ้นต์/.test(s)) {
    return 'green-mint';
  }

  return '';
}

// 1️⃣ สีของการ์ดสรุปผลอีเวนท์หลัก (EventDisplay)
export function resolveEventTone(outcome) {
  if (!outcome) return 'zero';
  const hdr = `${outcome.categoryHeader || ''} ${outcome.headline || ''}`;
  const sid = String(outcome.stampId || '');
  const tx = outcome.txType || '';
  const type = outcome.outcomeType || 'ZERO';

  if (outcome.seizeBank || tx === 'SEIZURE' || sid === 'MC_SEIZURE') return 'crimson-red';
  if (outcome.bankDirect) return 'navy-crimson';
  if (sid.startsWith('AB_')) return 'prism-chaos';
  if (sid.startsWith('EX_')) return 'rose-berry';
  if (sid.startsWith('BN_')) return 'lime-yellow';

  if (tx === 'LANDMARK' || sid.startsWith('LM_') || hdr.includes('ริมหน้าต่าง')) {
    if (hdr.includes('รีวิว') || sid === 'LM_ACT_VIRAL') return 'orange-peach';
    if (hdr.includes('ผ้าม่าน') || sid === 'LM_ACT_CURTAIN') return 'sky-cyan';
    if (hdr.includes('ฟ้องร้อง') || sid === 'LM_ACT_SUE_TAKE' || sid === 'LM_ACT_SUE_KICK') return 'indigo-blue';
    const lmHit = matchToneFromKeywords(hdr);
    return lmHit || 'teal-emerald';
  }

  const kwTone = matchToneFromKeywords(hdr, outcome.slots?.[0]?.icon || '');
  if (kwTone) return kwTone;

  if (tx === 'FRIEND_OUT') return 'tangerine-coral';
  if (tx === 'FRIEND_IN') return 'lime-yellow';
  if (type === 'JACKPOT') return 'gold-yellow';
  if (type === 'MIRACLE') return 'violet-pink';
  if (type === 'WIN') return 'green-mint';
  if (type === 'DIVIDER') return 'crimson-red';
  if (type === 'THEFT') return 'navy-crimson';
  if (type === 'TAX') return 'rose-berry';
  return 'zero';
}

// 2️⃣ สีพื้นหลังด้านหน้าช่องสล็อต (การ์ดเมนูคาเฟ่ 3 ช่อง)
const MENU_FALLBACK_TONES = ['orange-peach', 'sky-cyan', 'violet-pink', 'lm-sakura', 'lime-yellow', 'lm-garden'];

export function resolveMenuCardTone(menuItem, idx = 0) {
  if (!menuItem) return MENU_FALLBACK_TONES[idx % MENU_FALLBACK_TONES.length];
  const hit = matchToneFromKeywords(`${menuItem.label || ''} ${menuItem.sub || ''}`, menuItem.icon || '');
  if (hit) return hit;

  const mt = String(menuItem.menuTone || '');
  if (mt.includes('matcha') || mt.includes('green')) return 'green-mint';
  if (mt.includes('rose') || mt.includes('berry') || mt.includes('sakura')) return 'lm-sakura';
  if (mt.includes('lavender') || mt.includes('purple')) return 'violet-pink';
  if (mt.includes('sky') || mt.includes('blue') || mt.includes('ocean')) return 'sky-cyan';
  if (mt.includes('honey') || mt.includes('gold')) return 'gold-yellow';
  if (mt.includes('coral') || mt.includes('spice')) return 'tangerine-coral';

  return MENU_FALLBACK_TONES[hashIndex(`${menuItem.icon}${menuItem.label}${idx}`, MENU_FALLBACK_TONES.length)];
}

// 3️⃣ สีพื้นหลังด้านหลังช่องสล็อตแต่ละช่อง (ช่อง 1–3 ตอนพลิกการ์ด)
const SLOT_PALETTE_POS = ['green-mint', 'lime-yellow', 'gold-yellow', 'sky-cyan', 'violet-pink', 'orange-peach'];
const SLOT_PALETTE_NEG = ['rose-berry', 'tangerine-coral', 'crimson-red', 'indigo-blue', 'navy-crimson', 'purple-gold'];

export function resolveSlotCardTone(slotItem, idx = 0, outcome = null) {
  const eventTone = outcome ? resolveEventTone(outcome) : 'zero';
  if (!slotItem) return eventTone;

  // ช่องที่ 3 (จุดไคลแมกซ์) ยึดโทนสเปกตรัมของอีเวนท์หลักเพื่อให้ระเบิดสีเข้าชุดกัน
  if (idx === 2 && eventTone !== 'zero') return eventTone;

  // ตรวจจับสีเฉพาะจากไอคอนและข้อความของช่องนั้นๆ เองก่อน
  const kwTone = matchToneFromKeywords(`${slotItem.label || ''} ${slotItem.sub || ''}`, slotItem.icon || '');
  if (kwTone) return kwTone;

  const raw = slotItem.tone || 'zero';
  if (raw === 'mult') return 'gold-yellow';
  if (raw === 'miracle') return idx === 0 ? 'sky-cyan' : 'violet-pink';
  if (raw === 'win') return SLOT_PALETTE_POS[hashIndex(`${slotItem.label}${idx}`, SLOT_PALETTE_POS.length)];
  if (raw === 'divide') return 'crimson-red';
  if (raw === 'tax') return SLOT_PALETTE_NEG[hashIndex(`${slotItem.label}${idx}`, SLOT_PALETTE_NEG.length)];

  // ช่องตั้งต้นที่เป็น 'zero' แต่ตัวอีเวนท์จริงมีสีสัน ➔ ดึงสีผสมนวลๆ ของอีเวนท์มาเติมไม่ให้จืด
  if (outcome && outcome.outcomeType !== 'ZERO' && eventTone !== 'zero') {
    return eventTone;
  }
  return 'zero';
}

// 4️⃣ สีพื้นหลังของแสตมป์ทุกดวงในสมุดสะสม 158 ดวง (และป้ายปลดล็อกแสตมป์ใหม่)
const STAMP_PALETTES = {
  EXPENSE: ['rose-berry', 'tangerine-coral', 'crimson-red', 'indigo-blue', 'navy-crimson', 'orange-peach'],
  BOON: ['green-mint', 'lime-yellow', 'gold-yellow', 'sky-cyan', 'teal-emerald', 'orange-peach'],
  ABSURD: ['prism-chaos', 'violet-pink', 'purple-gold', 'sky-cyan', 'indigo-blue', 'tangerine-coral'],
  MIRACLE: ['violet-pink', 'gold-yellow', 'sky-cyan', 'purple-gold', 'orange-peach', 'green-mint'],
  LANDMARK: ['lm-garden', 'lm-sakura', 'lm-meadow', 'lm-beach', 'lm-river', 'teal-emerald']
};

export function resolveStampTone(stamp) {
  if (!stamp) return 'violet-pink';
  const id = String(stamp.id || '');
  const cat = String(stamp.category || '');

  // แสตมป์แลนด์มาร์ก 5 โซน ใช้สีประจำโซนเป๊ะๆ
  if (id.includes('GARDEN')) return 'lm-garden';
  if (id.includes('SAKURA')) return 'lm-sakura';
  if (id.includes('MEADOW')) return 'lm-meadow';
  if (id.includes('BEACH')) return 'lm-beach';
  if (id.includes('RIVER')) return 'lm-river';

  // แสตมป์พิเศษจับคู่จากคีย์เวิร์ด + ไอคอน
  const kwTone = matchToneFromKeywords(`${stamp.title || ''} ${stamp.desc || ''}`, stamp.icon || '');
  if (kwTone) return kwTone;

  // กระจายเฉดผสมสีเต็มรุ้งอย่างคงที่ตามหมวดของแสตมป์ (ดวงเดิมได้สีเดิมเสมอ ไม่สลับไปมา)
  const pool = STAMP_PALETTES[cat] || STAMP_PALETTES.MIRACLE;
  return pool[hashIndex(`${id}:${stamp.title}`, pool.length)];
}