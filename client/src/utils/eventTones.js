// client/src/utils/eventTones.js
// 🎨 ศูนย์รวมสูตรจับคู่สี Cute Flowers Pastel (12 พาเลตต์ดอกไม้ + 5 แลนด์มาร์ก + โทนพิเศษ)
// ใช้ร่วมกันทั้ง การ์ดอีเวนท์, ช่องสล็อต 3 ช่อง (หน้าเมนู–หลังอีเวนท์) และสมุดแสตมป์ 158 ดวง

export const FOIL_TONES = new Set([
  'gold-yellow',
  'sunflower-glow',
  'violet-pink',
  'lavender-field',
  'purple-gold',
  'violet-dream',
  'prism-chaos',
  'wildflower-meadow',
  'sky-cyan',
  'forget-me-not',
  'hydrangea-dreams',
  'bluebell-magic',
  'cherry-blossom',
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

// จับคู่เฉดสีดอกไม้จากไอคอนและข้อความสั้น (ใช้ร่วมกันทั้งช่องสล็อตและแสตมป์)
function matchToneFromKeywords(text = '', icon = '') {
  const s = `${icon} ${text}`;

  // แลนด์มาร์ก 5 โซน
  if (s.includes('🪴') || s.includes('สวนต้นไม้')) return 'lm-garden';
  if (s.includes('🌸') || s.includes('ซากุระ')) return 'lm-sakura';
  if (s.includes('🪻') || s.includes('ทุ่งดอกไม้')) return 'lm-meadow';
  if (s.includes('🏖️') || s.includes('ชายหาด')) return 'lm-beach';
  if (s.includes('🏞️') || s.includes('แม่น้ำภูเขา')) return 'lm-river';

  // แดงกุหลาบเข้ม: ยึดทรัพย์, ขวานผ่า, รูเล็ตต์, ทำกระเป๋าหล่น
  if (/🚨|🔨|🪓|💥|🔫|🕳️|ยึดทรัพย์|ขวานผ่า|กระเป๋าตังค์หล่น|ลืมกระเป๋า|ทิ้งกระเป๋า|พัดกระเป๋า|รูเล็ตต์/.test(s)) {
    return 'crimson-red';
  }
  // 08 Hydrangea Dreams: ปปง. ตรวจบัญชี, ศาลคาเฟ่ฟ้องร้อง
  if (/🕵️|⚖️|📜|ปปง\.|ฟ้องร้อง|ศาลคาเฟ่/.test(s)) return 'indigo-blue';
  // 10 Bluebell Magic: แมวส้มแฮ็กตู้เซฟ, โจรย่องเบา, ปล้นสุลต่าน
  if (/🐈‍⬛|🥷|🏦|ตู้เซฟ|โจรย่องเบา|ปล้นสุลต่าน/.test(s)) return 'navy-crimson';
  // 12 Violet Dream: กับดักความโลภ, สลับอันดับย้อนศร, ล้มยักษ์
  if (/😈|⚡|🚩|ความโลภ|ย้อนศร|ล้มยักษ์|ปฏิวัติ/.test(s)) return 'purple-gold';
  // 06 Forget-me-Not: ปลดหนี้, ประกันภัย, ฝนเหรียญ, ปิดผ้าม่าน, โซดา
  if (/👼|🛡️|🌧️|🪟|🕊️|🧊|🫧|ปลดหนี้|ประกันภัย|มหาทาน|ผ้าม่าน|เมตตา|บลู|โซดา/.test(s)) {
    return 'sky-cyan';
  }
  // 11 Wildflower Meadow: ตรรกะวิบัติ, พลิกขั้ว, เฉลี่ยสุข, กระจกเงา
  if (/☯️|🌀|🃏|🪞|🌈|🦄|ชะตาเล่นตลก|เฉลี่ยสุข|กระจกเงา|ตรรกะวิบัติ|กาแล็กซี/.test(s)) {
    return 'prism-chaos';
  }
  // 05 Sunflower Glow: แจ็กพอต 777, ขอทานเศรษฐี, เต๋าทองคำ, น้ำผึ้ง
  if (/7️⃣|👑|🚀|💎|🎲|🏆|🥇|💰|🍯|🍮|777|แจ็กพอต|ขอทานเศรษฐี|เต๋าทองคำ|น้ำผึ้ง|พุดดิ้ง/.test(s)) {
    return 'gold-yellow';
  }
  // 09 Tulip Whisper: กระป๋องคุกกี้, กระปุกหมูแตก, รีวิวไวรัล, ครัวซองต์-พีช
  if (/🍪|🐷|📸|🔥|🥐|🍊|🍑|🧇|คุกกี้|กระปุกหมู|ไวรัล|คาราเมล|ครัวซองต์|พีช|ส้ม/.test(s)) {
    return 'orange-peach';
  }
  // 07 Peony Blush: เพื่อนยืมเงิน, แก๊งเพื่อน, บิลเหมา, ชานม-กาแฟ
  if (/👯|📣|🧾|🦈|💣|💬|🧋|☕|🍫|เพื่อนยืม|แก๊งเพื่อน|เหมาเลี้ยง|ปลาดุก|ระเบิด|ชานม|มอคค่า|เอสเปรสโซ/.test(s)) {
    return 'tangerine-coral';
  }
  // 03 Rose Garden: ค้ำประกัน, สตรอว์เบอร์รี่-เชอร์รี-คัพเค้ก
  if (/📝|💢|🍓|🍒|🧁|ค้ำประกัน|หมั่นไส้|สตรอว์|เบอร์รี่|เชอร์รี/.test(s)) {
    return 'rose-berry';
  }
  // 02 Lavender Field: โซ่ล่ามชะตา, สลับกระเป๋า, แม่เหล็ก, ลาเวนเดอร์-เผือก
  if (/🧶|⛓️|💞|🧲|🎭|🔄|🍇|โซ่ล่าม|สลับกระเป๋า|แม่เหล็ก|อยากรวย|อยากจน|ลาเวนเดอร์|เผือก|อัญชัน/.test(s)) {
    return 'violet-pink';
  }
  // 04 Daisy Daydream: ยืมเพื่อนสำเร็จ, ลาภลอย, เลมอน-ยูซุ
  if (/🤝|🍋|🍍|ยืมเงินเพื่อน|ลาภลอย|เลมอน|ยูซุ|มะนาว/.test(s)) return 'lime-yellow';
  // เขียวใบไม้พาสเทล: โรบินฮู้ด, เก็บกระเป๋า, มัทฉะ
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

// 2️⃣ สีพื้นหลังด้านหน้าช่องสล็อต (การ์ดเมนูคาเฟ่ 3 ช่อง: เครื่องดื่ม • ท็อปปิ้ง • ขนม)
// จัดชุดพาเลตต์ Cute Flowers แยกตามตำแหน่งช่องเพื่อให้ 3 ช่องหน้าการ์ดดูสดใสเข้าชุดกันเสมอ
const MENU_REEL_SETS = [
  ['tulip-whisper', 'sunflower-glow', 'cherry-blossom', 'peony-blush'],     // ช่อง 1: เครื่องดื่ม
  ['forget-me-not', 'daisy-daydream', 'hydrangea-dreams', 'bluebell-magic'], // ช่อง 2: ท็อปปิ้ง
  ['lavender-field', 'rose-garden', 'wildflower-meadow', 'violet-dream']     // ช่อง 3: ขนม
];

export function resolveMenuCardTone(menuItem, idx = 0) {
  const reelPool = MENU_REEL_SETS[idx % MENU_REEL_SETS.length];
  if (!menuItem) return reelPool[0];

  const hit = matchToneFromKeywords(`${menuItem.label || ''} ${menuItem.sub || ''}`, menuItem.icon || '');
  if (hit) return hit;

  const mt = String(menuItem.menuTone || '');
  if (mt.includes('matcha') || mt.includes('green')) return 'green-mint';
  if (mt.includes('rose') || mt.includes('berry')) return 'rose-garden';
  if (mt.includes('sakura')) return 'cherry-blossom';
  if (mt.includes('lavender') || mt.includes('purple')) return 'lavender-field';
  if (mt.includes('sky') || mt.includes('blue') || mt.includes('ocean')) return 'forget-me-not';
  if (mt.includes('honey') || mt.includes('gold')) return 'sunflower-glow';
  if (mt.includes('coral') || mt.includes('spice')) return 'peony-blush';

  return reelPool[hashIndex(`${menuItem.icon}${menuItem.label}${idx}`, reelPool.length)];
}

// 3️⃣ สีพื้นหลังด้านหลังช่องสล็อตทั้ง 3 ช่องของแต่ละชุด (จับคู่ชุดสีเดียวกับอีเวนท์หลักแล้วไล่ 3 เฉดด้วย data-slot-step)
const SLOT_FALLBACK_POS = ['daisy-daydream', 'sunflower-glow', 'forget-me-not', 'green-mint', 'lavender-field', 'tulip-whisper'];
const SLOT_FALLBACK_NEG = ['rose-garden', 'peony-blush', 'crimson-red', 'hydrangea-dreams', 'bluebell-magic', 'violet-dream'];

export function resolveSlotCardTone(slotItem, idx = 0, outcome = null) {
  const eventTone = outcome ? resolveEventTone(outcome) : 'zero';

  // เมื่ออีเวนท์หลักมีชุดสีชัดเจน ให้สล็อตทั้ง 3 ช่องใช้ชุดสีดอกไม้เดียวกัน
  // แล้ว CSS [data-slot-step="0|1|2"] จะไล่เฉด 3 ระดับในพาเลตต์เดียวกันอัตโนมัติ (ช่อง 1 อ่อน -> ช่อง 2 กลาง -> ช่อง 3 เด่น+ใบเขียว)
  if (eventTone && eventTone !== 'zero') {
    const raw = slotItem?.tone || 'zero';
    // ยกเว้นกรณีช่องกลางหรือช่องแรกเป็นตัวคูณพิเศษหรือขวานผ่าที่เด่นชัด ให้คงความโดดเด่นในธีมดอกไม้
    if (idx === 1 && raw === 'mult' && eventTone !== 'gold-yellow') return 'sunflower-glow';
    return eventTone;
  }

  if (!slotItem) return 'zero';

  const kwTone = matchToneFromKeywords(`${slotItem.label || ''} ${slotItem.sub || ''}`, slotItem.icon || '');
  if (kwTone) return kwTone;

  const raw = slotItem.tone || 'zero';
  if (raw === 'mult') return 'sunflower-glow';
  if (raw === 'miracle') return idx === 0 ? 'forget-me-not' : 'lavender-field';
  if (raw === 'win') return SLOT_FALLBACK_POS[hashIndex(`${slotItem.label}${idx}`, SLOT_FALLBACK_POS.length)];
  if (raw === 'divide') return 'crimson-red';
  if (raw === 'tax') return SLOT_FALLBACK_NEG[hashIndex(`${slotItem.label}${idx}`, SLOT_FALLBACK_NEG.length)];

  return 'zero';
}

// 4️⃣ สีพื้นหลังของสมุดสะสมแสตมป์ 158 ดวง (กระจายครบทั้ง 12 พาเลตต์ Cute Flowers ตามหมวด)
const STAMP_PALETTES = {
  EXPENSE: ['rose-garden', 'peony-blush', 'tulip-whisper', 'hydrangea-dreams', 'bluebell-magic', 'crimson-red'],
  BOON: ['daisy-daydream', 'sunflower-glow', 'cherry-blossom', 'forget-me-not', 'green-mint', 'tulip-whisper'],
  ABSURD: ['wildflower-meadow', 'lavender-field', 'violet-dream', 'hydrangea-dreams', 'daisy-daydream', 'peony-blush'],
  MIRACLE: ['lavender-field', 'sunflower-glow', 'forget-me-not', 'violet-dream', 'cherry-blossom', 'bluebell-magic'],
  LANDMARK: ['lm-garden', 'lm-sakura', 'lm-meadow', 'lm-beach', 'lm-river', 'teal-emerald']
};

export function resolveStampTone(stamp) {
  if (!stamp) return 'lavender-field';
  const id = String(stamp.id || '');
  const cat = String(stamp.category || '');

  // แสตมป์แลนด์มาร์ก 5 โซน ใช้สีประจำโซนโดยตรง
  if (id.includes('GARDEN')) return 'lm-garden';
  if (id.includes('SAKURA')) return 'lm-sakura';
  if (id.includes('MEADOW')) return 'lm-meadow';
  if (id.includes('BEACH')) return 'lm-beach';
  if (id.includes('RIVER')) return 'lm-river';

  // แสตมป์ที่มีคีย์เวิร์ดเฉพาะ
  const kwTone = matchToneFromKeywords(`${stamp.title || ''} ${stamp.desc || ''}`, stamp.icon || '');
  if (kwTone) return kwTone;

  // กระจายพาเลตต์ Cute Flowers ประจำหมวดอย่างคงที่ (ดวงเดิมได้ดอกไม้เดิมเสมอ)
  const pool = STAMP_PALETTES[cat] || STAMP_PALETTES.MIRACLE;
  return pool[hashIndex(`${id}:${stamp.title}`, pool.length)];
}