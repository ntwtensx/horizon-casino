// server/eventEngine.js
// 🎰 เครื่องยนต์สล็อตสายโหดระดับตึง (เสีย ~58%, โซเชียลพบปะเพื่อนหนักขึ้น, ธนาคารได้อย่างเสียอย่าง, บทลงโทษความโลภ)

const {
  BASE_ECONOMIC_UNIT,
  SPKRAN_EMOJI,
  LANDMARK_TIER_RATES,
  DEFAULT_LANDMARKS_META,
  FLAVOR_MESSAGES,
  ABSURD_DUAL_TUPLE,
  STAMP_CATEGORIES,
  LANDMARK_ACTION_STAMPS,
  MIRACLE_STAMPS
} = require('./events/absurdAndMeta');
const { DAILY_EXPENSE_TUPLE, DAILY_BOON_TUPLE } = require('./events/dailyEvents');
const { generateCafeMenuForOutcome } = require('./events/cafeMenuCatalog');
const { applyTipJarSink } = require('./utils/economy');

const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// 🏷️ จัดรูปแบบชื่อเพื่อน ("คุณ...")
const formatFriendTitle = (p) => {
  if (!p) return 'เพื่อนปริศนา';
  if (p.nickname && p.nickname.trim() !== '') return `คุณ${p.nickname.trim().replace(/^คุณ\s*/, '')}`;
  return `คุณ${p.displayName || p.username || 'สมาชิกคาเฟ่'}`;
};

// 📡 สรุปสถานะแลนด์มาร์ก 5 โซนสำหรับหน้าเว็บ
const getWindowLandmarksStatus = (landmarks = [], roster = []) => {
  const source = Array.isArray(landmarks) && landmarks.length > 0
    ? landmarks
    : DEFAULT_LANDMARKS_META.map((m) => ({ ...m, ownerId: null, ownerName: '', tier: 0, curtainClosed: false }));

  return source.map((lm) => {
    let resolvedOwnerName = lm.ownerName || '';
    if (lm.ownerId && Array.isArray(roster) && roster.length > 0) {
      const ownerObj = roster.find((p) => p.userId === lm.ownerId);
      if (ownerObj) {
        resolvedOwnerName = formatFriendTitle(ownerObj);
        lm.ownerName = resolvedOwnerName;
      }
    }
    const isOwned = Boolean(lm.ownerId && lm.tier > 0);
    return {
      id: lm.id,
      icon: lm.icon,
      name: lm.name,
      owned: isOwned,
      ownerId: lm.ownerId || null,
      ownerName: isOwned ? (resolvedOwnerName || 'ผู้ถือหุ้นลึกลับ') : '',
      tier: isOwned ? lm.tier : 0,
      pct: isOwned ? (LANDMARK_TIER_RATES[lm.tier] || 17) : 0,
      curtainClosed: Boolean(lm.curtainClosed)
    };
  });
};

// 🧮 ค่าเฉลี่ยทรัพย์สินคนทั้งคาเฟ่ (คิดรวมกระเป๋า + ธนาคาร)
const calculateCafeAverageWealth = (roster = []) => {
  if (!Array.isArray(roster) || roster.length === 0) return BASE_ECONOMIC_UNIT;
  const pos = roster
    .map((p) => Number(p.walletBalance || 0) + Math.max(0, Number(p.bankBalance || 0)))
    .filter((b) => b > 0);
  if (pos.length === 0) return BASE_ECONOMIC_UNIT;
  return Math.min(8500, Math.max(BASE_ECONOMIC_UNIT, Math.round(pos.reduce((a, v) => a + v, 0) / pos.length)));
};

// ⚖️ ฐานคำนวณความเสี่ยง: นับรวมเงินฝากธนาคาร 60% เพื่อป้องกันคนแอบซ่อนเงินในธนาคารแล้วจ่ายค่าปรับถูก
const computeRiskRefBase = (walletBal = 0, bankBal = 0) => {
  const w = Number(walletBal || 0);
  const b = Math.max(0, Number(bankBal || 0));
  const effective = (w > 0 ? w : 0) + Math.round(b * 0.60);
  if (effective > 0) return Math.max(BASE_ECONOMIC_UNIT, effective);
  return Math.max(BASE_ECONOMIC_UNIT, Math.min(1400, Math.round(Math.abs(w) * 0.5)));
};

// ✨ จัดรูปแบบข้อความอธิบายให้ขึ้นต้นด้วยอีโมจิและปิดท้ายด้วย ✦~
const formatDesc = (rawText) => {
  if (!rawText) return `${SPKRAN_EMOJI} ลุ้นระทึกไปกับวงล้อโชคชะตาประจำคาเฟ่ค่ะ ✦~`;
  const clean = String(rawText)
    .trim()
    .replace(/^"+|"+$/g, '')
    .replace(/^(?:<a:spkran:1513650594546712706>\s*)+/, '')
    .replace(/(?:~✦|✦~|~|!)+$/g, '')
    .trim();
  return `${SPKRAN_EMOJI} ${clean} ✦~`;
};

const stampLookupMap = new Map();
const slot = (icon, label, sub, tone) => ({ icon, label, sub, tone });

// 💸 ตัวช่วยสร้างคำสั่งแก้ไขยอดเพื่อน
const mutDelta = (p, delta, reason, walletOnly = false, txType = '') => ({
  userId: p.userId,
  fallbackName: p.displayName,
  mode: 'DELTA',
  delta: Math.round(Number(delta || 0)),
  walletOnly: Boolean(walletOnly),
  txType: txType || (delta >= 0 ? 'FRIEND_IN' : 'FRIEND_OUT'),
  reason: reason || 'รายการจากอีเวนท์คาเฟ่'
});

const mutSetWallet = (p, newWalletBalance, reason, txType = 'FRIEND_SWAP') => ({
  userId: p.userId,
  fallbackName: p.displayName,
  mode: 'SET',
  newBalance: Math.round(Number(newWalletBalance || 0)),
  walletOnly: true,
  txType,
  reason: reason || 'สลับยอดกระเป๋าตังค์'
});

// 🧩 ประกอบซองผลลัพธ์ 3 ช่อง + แสตมป์
const pack = (outcomeType, categoryHeader, headline, message, delta, equationText, slots, friendMutations, extraFlags = {}) => {
  const normalizedSlots = (slots || []).map((s) => (Array.isArray(s) ? slot(s[0], s[1], s[2], s[3]) : s));
  const stampId = extraFlags.stampId || '';
  const stampInfo = stampId && stampLookupMap.has(stampId) ? stampLookupMap.get(stampId) : null;
  return {
    outcomeType,
    categoryHeader,
    headline,
    message: formatDesc(message),
    delta,
    equationText,
    slots: normalizedSlots,
    ...(friendMutations ? { friendMutations } : {}),
    ...extraFlags,
    stampId,
    stampInfo
  };
};

// 👛 บันทึกกระเป๋าตังค์ที่หล่นหายลง worldState (เก็บสูงสุด 30 ใบ)
const recordLostWallet = (worldState, ownerName, amount, lostReason = 'ทำหล่นไว้หน้าร้าน') => {
  if (!worldState || amount <= 0) return;
  if (!Array.isArray(worldState.lostWallets)) worldState.lostWallets = [];
  worldState.lostWallets.push({
    ownerName: ownerName || 'เศรษฐีปริศนา',
    amount: Math.round(amount),
    lostReason,
    lostAt: Date.now()
  });
  if (worldState.lostWallets.length > 30) worldState.lostWallets.shift();
};

// ⚙️ คอมไพเลอร์ตาราง Tuple (คิดฐานรวมธนาคาร 60% เพื่อให้คนรวยมีเดิมพันสูงจริง)
const compileCatalogTuple = (t, startBal, startBank, isBoon, stampId = '') => {
  const [min, max, [i1, l1, s1], [i2, l2, s2], [i3, s3], catHdr, headline, msg, reason, calcMode = 'FLAT'] = t;
  const refBase = computeRiskRefBase(startBal, startBank);

  if (calcMode === 'DIV' && !isBoon) {
    const div = randInt(min, max);
    const cutAmt = Math.max(50, Math.round(refBase * (1 - 1 / div)));
    return pack(
      'DIVIDER', catHdr, headline, msg, -cutAmt,
      `ฐานทรัพย์สินประเมิน ${refBase.toLocaleString()} ➔ ${reason} ถูกผ่าหาร ÷ ${div} หักไป -${cutAmt.toLocaleString()} เหรียญ = ยอดหักสุทธิ -${cutAmt.toLocaleString()} เหรียญทอง`,
      [[i1, l1, s1, 'zero'], [i2, l2, s2, 'tax'], [i3, `÷${div}`, s3, 'divide']],
      undefined, { stampId }
    );
  }
  if (calcMode === 'MULT' && isBoon) {
    const mult = randInt(min, max);
    const gainBase = startBal > 0 ? startBal : BASE_ECONOMIC_UNIT;
    const gainAmt = Math.min(3200, Math.max(220, Math.round(gainBase * (mult - 1))));
    return pack(
      'MIRACLE', catHdr, headline, msg, gainAmt,
      `กระเป๋ามี ${startBal.toLocaleString()} ➔ ${reason} รับตัวคูณ ×${mult} เพิ่มเงิน +${gainAmt.toLocaleString()} เหรียญ = ยอดได้รับสุทธิ +${gainAmt.toLocaleString()} เหรียญทอง`,
      [[i1, l1, s1, 'zero'], [i2, l2, s2, 'miracle'], [i3, `×${mult}`, s3, 'miracle']],
      undefined, { stampId }
    );
  }
  if (calcMode === 'PCT') {
    const pct = Math.round(randInt(min, max) / 5) * 5;
    if (isBoon) {
      const gainBase = startBal > 0 ? startBal : BASE_ECONOMIC_UNIT;
      const amt = Math.min(2600, Math.max(40, Math.round((gainBase * pct) / 100)));
      return pack(
        'MIRACLE', catHdr, headline, msg, amt,
        `กระเป๋ามี ${startBal.toLocaleString()} ➔ ${reason} ได้รับโบนัส +${pct}% เป็นเงิน +${amt.toLocaleString()} เหรียญ = ยอดได้รับสุทธิ +${amt.toLocaleString()} เหรียญทอง`,
        [[i1, l1, s1, 'zero'], [i2, l2, s2, 'miracle'], [i3, `+${pct}%`, s3, 'miracle']],
        undefined, { stampId }
      );
    }
    const amt = Math.max(45, Math.round((refBase * pct) / 100));
    return pack(
      amt >= 250 ? 'DIVIDER' : 'TAX', catHdr, headline, msg, -amt,
      `ฐานทรัพย์สินประเมิน ${refBase.toLocaleString()} ➔ ${reason} ถูกหักไป -${pct}% เป็นเงิน -${amt.toLocaleString()} เหรียญ = ยอดหักสุทธิ -${amt.toLocaleString()} เหรียญทอง`,
      [[i1, l1, s1, 'zero'], [i2, l2, s2, 'tax'], [i3, `-${pct}%`, s3, amt >= 250 ? 'divide' : 'tax']],
      undefined, { stampId }
    );
  }

  let val = randInt(min, max);
  if (val >= 30) val = Math.round(val / 5) * 5;
  if (isBoon) {
    return pack(
      'MIRACLE', catHdr, headline, msg, val,
      `กระเป๋ามี ${startBal.toLocaleString()} ➔ ${reason} ได้รับเงิน +${val.toLocaleString()} เหรียญ = ยอดได้รับสุทธิ +${val.toLocaleString()} เหรียญทอง`,
      [[i1, l1, s1, 'zero'], [i2, l2, s2, 'miracle'], [i3, `+${val.toLocaleString()}`, s3, 'miracle']],
      undefined, { stampId }
    );
  }
  // สายโหด: เพิ่มค่าใช้จ่ายคงที่ขึ้นอีก 20%
  const scaledLoss = Math.round((val * 1.2) / 5) * 5;
  return pack(
    scaledLoss >= 250 ? 'DIVIDER' : 'TAX', catHdr, headline, msg, -scaledLoss,
    `กระเป๋ามี ${startBal.toLocaleString()} ➔ ${reason} ต้องควักจ่าย -${scaledLoss.toLocaleString()} เหรียญ = ยอดหักสุทธิ -${scaledLoss.toLocaleString()} เหรียญทอง`,
    [[i1, l1, s1, 'zero'], [i2, l2, s2, 'tax'], [i3, `-${scaledLoss.toLocaleString()}`, s3, scaledLoss >= 250 ? 'divide' : 'tax']],
    undefined, { stampId }
  );
};

// ==========================================
// 🏰 1. เครื่องยนต์ตลาดหุ้น "แลนด์มาร์กริมหน้าต่างคาเฟ่ 5 โซน" (22% — ปะทะกันดุขึ้น)
// ==========================================
const generateWindowLandmarkEvent = (startBal, startBank, activePlayerId, roster, worldState) => {
  const activePlayerObj = roster.find((p) => p.userId === activePlayerId);
  const myTitle = formatFriendTitle(activePlayerObj);
  const otherPlayers = roster.filter((p) => p.userId !== activePlayerId);
  const cafeAvg = calculateCafeAverageWealth(roster);

  const lm = pickRandom(worldState.landmarks);
  const lmFullTitle = `${lm.icon} ${lm.name}`;
  let currentOwnerObj = lm.ownerId ? roster.find((p) => p.userId === lm.ownerId) : null;
  if (lm.ownerId && !currentOwnerObj && lm.ownerId !== activePlayerId) {
    currentOwnerObj = { userId: lm.ownerId, displayName: lm.ownerName || 'ผู้ถือหุ้น', walletBalance: cafeAvg, bankBalance: 0 };
  }

  // 🟢 กรณีที่ 1: โต๊ะริมหน้าต่างโซนนี้ยังไม่มีผู้ถือครอง
  if (!lm.ownerId || lm.tier <= 0) {
    lm.ownerId = activePlayerId;
    lm.ownerName = myTitle;
    lm.tier = 1;
    lm.curtainClosed = false;
    const rate1 = LANDMARK_TIER_RATES[1];
    return pack(
      'MIRACLE', `🏰 คำเชิญถือหุ้นพิเศษริมหน้าต่าง ${lmFullTitle}`,
      `ได้รับสิทธิ์เป็นผู้ถือครองหุ้น "${lmFullTitle}" ขั้นที่ 1 (${rate1}%) ฟรีทันที!`,
      `ดวงมหาเศรษฐีพุ่งชนเต็มๆ ค่ะ! อเลสเทียมอบซองคำเชิญถือหุ้นพิเศษให้คุณขึ้นเป็นเจ้าของโต๊ะริมหน้าต่างโซน "${lmFullTitle}" ขั้นที่ 1 แบบฟรีๆ ต่อจากนี้ถ้ามีใครแวะมานั่งจิบกาแฟชมวิวโต๊ะนี้ เตรียมรับส่วนแบ่ง ${rate1}% เข้ากระเป๋าได้เลยนะคะ`,
      0,
      `โต๊ะริมหน้าต่างโซน ${lmFullTitle} ยังไม่มีเจ้าของ ➔ ปั่นสล็อตเจอซองคำเชิญถือหุ้นพอดี ได้ขึ้นเป็นผู้ถือครองหุ้นขั้นที่ 1 (${rate1}%) ฟรีเลย! = ยอดได้รับสุทธิ 0 เหรียญทอง`,
      [[lm.icon, lm.name, 'โต๊ะนี้ยังไม่มีเจ้าของ', 'win'], ['📜', 'คำเชิญถือหุ้น!', 'รับสิทธิ์ถือครองฟรี', 'miracle'], ['👑', `ถือหุ้น ${rate1}%`, 'ขั้นที่ 1 • รอรับปันผล!', 'miracle']],
      undefined, { stampId: `LM_OWN_${lm.id}`, txType: 'LANDMARK' }
    );
  }

  // 🟡 กรณีที่ 2: ผู้เล่นที่ปั่นสล็อต คือ "เจ้าของหุ้นโซนนี้เอง" (เพิ่มบิลค่าซ่อมบำรุง/ภาษีที่ดิน 32%)
  if (lm.ownerId === activePlayerId) {
    const currentRate = LANDMARK_TIER_RATES[lm.tier] || 17;
    const ownerRoll = Math.random();

    if (ownerRoll < 0.32) {
      const maintCost = Math.max(90, Math.round((cafeAvg * (currentRate * 0.55)) / 100));
      return pack(
        maintCost >= 280 ? 'DIVIDER' : 'TAX',
        `🧰 บิลค่าบำรุงรักษาแลนด์มาร์ก ${lmFullTitle}`,
        `ถึงรอบจ่ายค่าทำสวนและภาษีที่ดิน "${lmFullTitle}" -${maintCost.toLocaleString()} เหรียญ!`,
        `ถือหุ้นโต๊ะสวยก็มีภาระค่าดูแลนะคะ! อเลสเทียยื่นบิลค่าเช็ดกระจก รดน้ำต้นไม้ และภาษีที่ดินริมหน้าต่างโซน "${lmFullTitle}" ขั้นที่ ${lm.tier} ให้คุณจ่ายทันที ไม่งั้นเดี๋ยววิวจะรกค่ะ`,
        -maintCost,
        `คุณเป็นเจ้าของโต๊ะ ${lmFullTitle} ขั้นที่ ${lm.tier} (${currentRate}%) ➔ จ่ายค่าบำรุงรักษาประจำรอบ -${maintCost.toLocaleString()} เหรียญ = ยอดหักสุทธิ -${maintCost.toLocaleString()} เหรียญทอง`,
        [[lm.icon, `ขั้นที่ ${lm.tier} (${currentRate}%)`, 'เจ้าของต้องดูแลวิว', 'zero'], ['🧰', 'บิลค่าบำรุงรักษา!', 'เช็ดกระจก & ภาษีที่ดิน', 'tax'], ['💸', `-${maintCost.toLocaleString()}`, 'จ่ายค่าดูแลโต๊ะสวย!', 'divide']],
        undefined, { txType: 'LANDMARK' }
      );
    }

    if (ownerRoll < 0.76) {
      if (lm.tier < 3) {
        const oldTier = lm.tier;
        const oldRate = LANDMARK_TIER_RATES[oldTier];
        lm.tier += 1;
        lm.ownerName = myTitle;
        lm.curtainClosed = false;
        const newRate = LANDMARK_TIER_RATES[lm.tier];
        return pack(
          'JACKPOT', `📈 เลื่อนขั้นหุ้นแลนด์มาร์ก ${lmFullTitle}`,
          `อัปเกรดหุ้น "${lmFullTitle}" จากขั้นที่ ${oldTier} (${oldRate}%) ➔ ขั้นที่ ${lm.tier} (${newRate}%) สำเร็จ!`,
          `คุณปั่นสล็อตเจอโฉนดโต๊ะริมหน้าต่างโซน "${lmFullTitle}" ของตัวเองซ้ำอีกครั้ง! อเลสเทียเลยช่วยจัดสวนแต่งวิวใหม่ให้หรูกว่าเดิม เลื่อนขั้นหุ้นของคุณพุ่งขึ้นเป็นขั้นที่ ${lm.tier} รอเก็บค่าริมหน้าต่างได้สูงถึง ${newRate}% เลยค่ะ`,
          0,
          `คุณถือหุ้นโต๊ะ ${lmFullTitle} ขั้นที่ ${oldTier} (${oldRate}%) อยู่แล้ว ➔ ปั่นเจอโต๊ะเดิมของตัวเอง เลยได้เลื่อนขั้นหุ้นขึ้นเป็นขั้นที่ ${lm.tier} (${newRate}%) ทันที! = ยอดได้รับสุทธิ 0 เหรียญทอง`,
          [[lm.icon, `เดิม ${oldRate}%`, `หุ้นขั้นที่ ${oldTier} ของคุณ`, 'win'], ['📈', 'เลื่อนขั้นหุ้น!', `อัปเกรดสู่ขั้นที่ ${lm.tier}`, 'mult'], ['👑', `พุ่งเป็น ${newRate}%!`, `เก็บค่าชมวิว ${newRate}%!`, 'miracle']],
          undefined, { stampId: 'LM_ACT_UPGRADE', txType: 'LANDMARK' }
        );
      }
      const dividend = Math.min(2600, Math.max(180, Math.round((cafeAvg * 50) / 100)));
      return pack(
        'JACKPOT', `🥂 ปันผลผู้ถือหุ้นใหญ่ริมหน้าต่าง ${lmFullTitle}`,
        `หุ้น "${lmFullTitle}" อยู่ขั้นสูงสุด (68%) แล้ว รับเงินปันผลพิเศษ +${dividend.toLocaleString()} เหรียญ!`,
        `โต๊ะริมหน้าต่างโซน "${lmFullTitle}" ของคุณอัปเกรดเต็มขั้น 68% จนสวยที่สุดในคาเฟ่ไปแล้วค่ะ! อเลสเทียเลยจ่ายเช็คเงินปันผลผู้ถือหุ้นใหญ่เข้ากระเป๋าคุณทันทีเลยค่ะ`,
        dividend,
        `โต๊ะ ${lmFullTitle} ของคุณอยู่ขั้นที่ 3 (68%) สูงสุดแล้ว ➔ รับเงินปันผลหุ้นใหญ่ +${dividend.toLocaleString()} เหรียญ = ยอดได้รับสุทธิ +${dividend.toLocaleString()} เหรียญทอง`,
        [[lm.icon, 'ขั้นสูงสุด 68%', lm.name, 'mult'], ['🥂', 'ปันผลหุ้นใหญ่!', `ยอดเฉลี่ยร้าน ${cafeAvg.toLocaleString()}`, 'miracle'], ['💰', `+${dividend.toLocaleString()}`, 'รับปันผลเข้ากระเป๋า!', 'miracle']],
        undefined, { stampId: 'LM_ACT_DIVIDEND', txType: 'LANDMARK' }
      );
    }

    if (ownerRoll < 0.88 && otherPlayers.length > 0) {
      const luckyFriend = pickRandom(otherPlayers);
      const fTitle = formatFriendTitle(luckyFriend);
      const keptTier = lm.tier;
      lm.ownerId = luckyFriend.userId;
      lm.ownerName = fTitle;
      lm.curtainClosed = false;
      return pack(
        'ZERO', `🎁 อีเวนต์อยู่ๆ ก็ไม่อยากได้หุ้น ${lmFullTitle}`,
        `อยู่ๆ ก็ไม่อยากได้หุ้น "${lmFullTitle}" (${currentRate}%) จึงเซ็นมอบให้ "${fTitle}" ฟรีทันที!`,
        `อารมณ์ติสต์เข้าสิงกะทันหันค่ะ! คุณนั่งมองวิว "${lmFullTitle}" แล้วบ่นพึมพำว่า อยู่ๆ ก็ไม่อยากได้หุ้นโต๊ะนี้แล้วอะ เลยเซ็นโอนใบหุ้นขั้นที่ ${keptTier} (${currentRate}%) ยกให้ "${fTitle}" ไปถือครองกินปันผลต่อแบบฟรีๆ เลยค่ะ`,
        0,
        `คุณถือหุ้นโต๊ะ ${lmFullTitle} ขั้นที่ ${keptTier} (${currentRate}%) ➔ เซ็นยกหุ้นให้ ${fTitle} ไปดูแลต่อฟรีๆ! = ยอดได้รับสุทธิ 0 เหรียญทอง`,
        [[lm.icon, `หุ้น ${currentRate}%`, 'ของเดิมของคุณ', 'zero'], ['🤪', 'ไม่อยากได้แล้ว!', 'เซ็นยกให้เพื่อนฟรีๆ', 'tax'], ['🎁', `มอบให้ ${fTitle}`, 'รับส้มหล่นไปเต็มๆ!', 'miracle']],
        undefined, { stampId: 'LM_ACT_GIFT', txType: 'LANDMARK' }
      );
    }

    const payout = Math.min(2200, Math.max(150, Math.round(((cafeAvg * currentRate) / 100) * 1.3)));
    const soldTier = lm.tier;
    lm.ownerId = null;
    lm.ownerName = '';
    lm.tier = 0;
    lm.curtainClosed = false;
    return pack(
      'MIRACLE', `🔨 ขายทอดตลาดหุ้นริมหน้าต่าง ${lmFullTitle}`,
      `ขายทอดตลาดหุ้น "${lmFullTitle}" (${currentRate}%) รับเงินสด +${payout.toLocaleString()} เหรียญ!`,
      `อยู่ๆ คุณก็นึกอยากถือเงินสดมากกว่าถือหุ้น เลยขายทอดตลาดหุ้นโต๊ะริมหน้าต่างโซน "${lmFullTitle}" ขั้นที่ ${soldTier} (${currentRate}%) คืนให้ทางร้าน! ส่วนโต๊ะนี้ก็ว่างลงรอคนดวงดีมาจับจองต่อค่ะ`,
      payout,
      `ขายทอดตลาดหุ้นโต๊ะ ${lmFullTitle} ขั้นที่ ${soldTier} (${currentRate}%) ➔ รับเงินสด +${payout.toLocaleString()} เหรียญ = ยอดได้รับสุทธิ +${payout.toLocaleString()} เหรียญทอง`,
      [[lm.icon, `หุ้นขั้น ${soldTier} (${currentRate}%)`, 'อยู่ๆ ก็ไม่อยากถือไว้', 'win'], ['🔨', 'ขายทอดตลาด!', 'จะมีใครมาจับจองต่อนะ', 'miracle'], ['🤑', `+${payout.toLocaleString()}`, `รับเงินสดตาม ${currentRate}%!`, 'miracle']],
      undefined, { stampId: 'LM_ACT_SELL', txType: 'LANDMARK' }
    );
  }

  // 🔴 กรณีที่ 3: โต๊ะริมหน้าต่างโซนนี้มีเจ้าของอยู่แล้ว และคนอื่นปั่นมาเจอ (เก็บค่าชมวิวโหดขึ้นและบ่อยขึ้น!)
  const ownerTitle = currentOwnerObj ? formatFriendTitle(currentOwnerObj) : (lm.ownerName || 'ผู้ถือหุ้น');
  const baseRate = LANDMARK_TIER_RATES[lm.tier] || 17;
  const ownedCountByHolder = worldState.landmarks.filter((x) => x.ownerId === lm.ownerId && x.tier > 0).length;
  const monopolyBonusPct = ownedCountByHolder >= 3 ? 15 : 0;
  const effectiveTollRate = baseRate + monopolyBonusPct;

  if (lm.curtainClosed) {
    lm.curtainClosed = false;
    return pack(
      'ZERO', `🪟 ผ้าม่านริมหน้าต่างปิดอยู่ ${lmFullTitle}`,
      `แวะนั่งโต๊ะ "${lmFullTitle}" ของ "${ownerTitle}" แต่ผ้าม่านปิดอยู่ เลยไม่ต้องเสียค่านั่งชมวิวค่ะ!`,
      `คุณเดินไปนั่งที่โต๊ะริมหน้าต่างโซน "${lmFullTitle}" ของ "${ownerTitle}" แต่โชคดีมากที่มีคนแอบรูดผ้าม่านทึบแสงปิดไว้ตั้งแต่รอบก่อน คุณเลยรอดค่าริมหน้าต่าง ${effectiveTollRate}% หวุดหวิด แถมช่วยเปิดผ้าม่านรับลมคืนให้เรียบร้อยค่ะ`,
      0,
      `แวะนั่งโต๊ะ ${lmFullTitle} ของ ${ownerTitle} ➔ โชคดีผ้าม่านปิดอยู่เลยรอดค่าชมวิวฟรี! = ยอดได้รับสุทธิ 0 เหรียญทอง`,
      [[lm.icon, lm.name, `โต๊ะของ ${ownerTitle}`, 'zero'], ['🪟', 'ผ้าม่านปิดอยู่!', 'มองไม่เห็นวิวข้างนอก', 'win'], ['✨', 'ฟรี 0 เหรียญ!', 'รอดค่าชมวิวหวุดหวิด!', 'zero']],
      undefined, { stampId: 'LM_ACT_CURTAIN', txType: 'LANDMARK' }
    );
  }

  const actionRoll = Math.random() * 100;

  // 52% จ่ายค่าริมหน้าต่างให้เจ้าของ (หักภาษี 10% เผาทิ้งให้ร้าน เพื่อลดเงินเฟ้อ)
  if (actionRoll < 52) {
    const tollAmt = Math.max(55, Math.round((cafeAvg * effectiveTollRate) / 100));
    const ownerNet = Math.max(10, Math.round(tollAmt * 0.90));
    const burnedTax = tollAmt - ownerNet;
    const mutList = currentOwnerObj
      ? [mutDelta(currentOwnerObj, ownerNet, `😍 รับค่าชมวิว ${lmFullTitle} จาก ${myTitle} (หักภาษีร้าน 10%)`, false, 'LANDMARK')]
      : [];
    const synergyNote = monopolyBonusPct > 0 ? ` (รวมโบนัสเจ้าพ่อถือครอง ${ownedCountByHolder} โต๊ะ +${monopolyBonusPct}%)` : '';
    return pack(
      tollAmt >= 250 ? 'DIVIDER' : 'TAX', `😍 โต๊ะวิวนี้สวยจังอยากนั่งจังเลย ${lmFullTitle}`,
      `แวะนั่งชมวิว "${lmFullTitle}" จ่ายค่าริมหน้าต่าง ${effectiveTollRate}% ให้ "${ownerTitle}"!`,
      `โต๊ะริมหน้าต่างโซน "${lmFullTitle}" (${lm.viewDesc}) สวยสะกดใจจนคุณอดใจไม่ไหว! เลยต้องควักจ่ายค่าริมหน้าต่างขั้นที่ ${lm.tier} คิดเป็น ${effectiveTollRate}% จากยอดเฉลี่ยของคนในร้าน โอนให้ "${ownerTitle}" ทันทีเลยค่ะ`,
      -tollAmt,
      `แวะนั่งชมวิวโต๊ะ ${lmFullTitle} ของ ${ownerTitle} (ขั้นที่ ${lm.tier}) ➔ จ่ายค่าริมหน้าต่าง -${effectiveTollRate}%${synergyNote} เป็นเงิน -${tollAmt.toLocaleString()} เหรียญ (โอนให้ ${ownerTitle} +${ownerNet.toLocaleString()} • ภาษีร้านเผาทิ้ง ${burnedTax.toLocaleString()}) = ยอดหักสุทธิ -${tollAmt.toLocaleString()} เหรียญทอง`,
      [[lm.icon, 'วิวสวยจังเลย~', `โต๊ะของ ${ownerTitle}`, 'zero'], ['🪑', `ขั้นที่ ${lm.tier} (${effectiveTollRate}%)`, `เฉลี่ยร้าน ${cafeAvg.toLocaleString()}`, 'tax'], ['💸', `-${tollAmt.toLocaleString()}`, `จ่ายให้ ${ownerTitle}!`, 'divide']],
      mutList, { stampId: 'LM_ACT_TOLL', txType: 'LANDMARK', burnedExtra: burnedTax }
    );
  }

  if (actionRoll < 62) {
    const seizedTier = lm.tier;
    lm.ownerId = activePlayerId;
    lm.ownerName = myTitle;
    return pack(
      'MIRACLE', `⚖️ ฟ้องร้องขอเป็นผู้ถือครอง ${lmFullTitle}`,
      `ชนะคดีฟ้องร้อง! ยึดหุ้น "${lmFullTitle}" ขั้นที่ ${seizedTier} (${baseRate}%) มาจาก "${ownerTitle}" สำเร็จ!`,
      `คุณยื่นคำร้องต่อศาลปกครองคาเฟ่ว่า "${ownerTitle}" นั่งจิบกาแฟบังวิวริมหน้าต่างโซน "${lmFullTitle}" นานเกินไป! อเลสเทียพิจารณาแล้วสั่งโอนย้ายหุ้นขั้นที่ ${seizedTier} (${baseRate}%) ทั้งก้อนมาให้คุณทันทีเลยค่ะ`,
      0,
      `ยื่นฟ้องร้องขอเป็นผู้ถือครองโต๊ะ ${lmFullTitle} จาก ${ownerTitle} ➔ ชนะคดี! ได้รับโอนหุ้นขั้นที่ ${seizedTier} (${baseRate}%) ทันที! = ยอดได้รับสุทธิ 0 เหรียญทอง`,
      [['⚖️', 'ยื่นฟ้องศาลคาเฟ่!', `ฟ้อง ${ownerTitle}`, 'win'], ['🔨', 'ชนะคดีเฉยเลย!', 'โอนย้ายหุ้นทั้งก้อน', 'miracle'], [lm.icon, `ยึดหุ้น ${baseRate}%!`, `คุณเป็นเจ้าของขั้นที่ ${seizedTier}!`, 'miracle']],
      undefined, { stampId: 'LM_ACT_SUE_TAKE', txType: 'LANDMARK' }
    );
  }

  if (actionRoll < 72) {
    const halfRate = baseRate / 2;
    const fineAmt = Math.max(40, Math.round((cafeAvg * halfRate) / 100));
    const oldTier = lm.tier;
    const mutList = currentOwnerObj
      ? [mutDelta(currentOwnerObj, -fineAmt, `💢 โดน ${myTitle} ฟ้องปลดแลนด์มาร์ก ${lmFullTitle}`, false, 'LANDMARK')]
      : [];
    lm.ownerId = null;
    lm.ownerName = '';
    lm.tier = 0;
    lm.curtainClosed = false;
    return pack(
      'MIRACLE', `💢 ฟ้องร้องไม่ชอบขี้หน้าผู้ถือครอง ${lmFullTitle}`,
      `ฟ้องปลด "${ownerTitle}" พ้นสภาพผู้ถือหุ้น "${lmFullTitle}" แถมริบค่าปรับมา +${fineAmt.toLocaleString()} เหรียญ!`,
      `คุณเห็น "${ownerTitle}" นั่งเก๊กจิบกาแฟอยู่ริมหน้าต่างแล้วหมั่นไส้ เลยยื่นฟ้องอเลสเทีย! อเลสเทียสั่งปลด "${ownerTitle}" พ้นสภาพเจ้าของโต๊ะทันที แถมปรับเงินครึ่งขั้น (${halfRate}%) มาจ่ายเป็นค่าทำขวัญให้คุณด้วยค่ะ`,
      fineAmt,
      `ยื่นฟ้องปลด ${ownerTitle} เจ้าของโต๊ะ ${lmFullTitle} ขั้นที่ ${oldTier} (${baseRate}%) ➔ ริบค่าปรับครึ่งขั้น (${halfRate}%) มาให้คุณ +${fineAmt.toLocaleString()} เหรียญ = ยอดได้รับสุทธิ +${fineAmt.toLocaleString()} เหรียญทอง`,
      [['💢', `หมั่นไส้ ${ownerTitle}!`, `หุ้นขั้นที่ ${oldTier} (${baseRate}%)`, 'tax'], ['🚫', 'โดนปลดพ้นสภาพ!', 'โต๊ะนี้ว่างแล้วนะ', 'miracle'], ['🤑', `+${fineAmt.toLocaleString()}`, `รับค่าปรับครึ่งขั้น (${halfRate}%)!`, 'miracle']],
      mutList, { stampId: 'LM_ACT_SUE_KICK', txType: 'LANDMARK' }
    );
  }

  if (actionRoll < 83) {
    const halfRate = baseRate * 0.65;
    const buyoutCost = Math.max(50, Math.round((cafeAvg * halfRate) / 100));
    const newTier = Math.min(3, lm.tier + 1);
    const newRate = LANDMARK_TIER_RATES[newTier];
    const mutList = currentOwnerObj
      ? [mutDelta(currentOwnerObj, buyoutCost, `💼 ${myTitle} ทุ่มซื้อทับแลนด์มาร์ก ${lmFullTitle}`, false, 'LANDMARK')]
      : [];
    lm.ownerId = activePlayerId;
    lm.ownerName = myTitle;
    lm.tier = newTier;
    lm.curtainClosed = false;
    return pack(
      'MIRACLE', `💼 ซื้อทับเทคโอเวอร์แลนด์มาร์ก ${lmFullTitle}`,
      `ทุ่มเงินซื้อทับ "${lmFullTitle}" จาก "${ownerTitle}" พร้อมอัปเกรดหุ้นเป็นขั้นที่ ${newTier} (${newRate}%)!`,
      `วิถีนักลงทุนสายเปย์! คุณวางถุงเหรียญทองจำนวน ${buyoutCost.toLocaleString()} เหรียญ ซื้อทับสิทธิ์โซน "${lmFullTitle}" มาจาก "${ownerTitle}" แบบดื้อๆ พร้อมสั่งอัปเกรดหุ้นขึ้นเป็นขั้นที่ ${newTier} (${newRate}%) ทันทีค่ะ`,
      -buyoutCost,
      `ควักเงินซื้อทับสิทธิ์จำนวน -${buyoutCost.toLocaleString()} เหรียญ จ่ายให้ ${ownerTitle} ➔ ยึดครองโต๊ะ ${lmFullTitle} พร้อมอัปเกรดหุ้นเป็น ${newRate}%! = ยอดหักสุทธิ -${buyoutCost.toLocaleString()} เหรียญทอง`,
      [['💼', 'ทุ่มซื้อทับ!', `จ่ายให้ ${ownerTitle}`, 'tax'], ['💸', `-${buyoutCost.toLocaleString()}`, 'ค่าเทคโอเวอร์โต๊ะสวย', 'win'], [lm.icon, `ยึดเป็น ${newRate}%!`, `อัปเกรดสู่ขั้นที่ ${newTier}!`, 'miracle']],
      mutList, { stampId: 'LM_ACT_TAKEOVER', txType: 'LANDMARK' }
    );
  }

  if (actionRoll < 89) {
    const compAmt = Math.max(40, Math.round((cafeAvg * 18) / 100));
    const oldTier = lm.tier;
    if (lm.tier > 1) lm.tier -= 1;
    else { lm.ownerId = null; lm.ownerName = ''; lm.tier = 0; }
    const afterLabel = lm.tier > 0 ? `ลดเหลือขั้น ${lm.tier} (${LANDMARK_TIER_RATES[lm.tier]}%)` : 'หลุดมือไร้เจ้าของเลย!';
    const mutList = currentOwnerObj
      ? [mutDelta(currentOwnerObj, -compAmt, `🌪️ จ่ายค่าปลอบขวัญภัยพิบัติ ${lmFullTitle} ให้ ${myTitle}`, false, 'LANDMARK')]
      : [];
    return pack(
      'MIRACLE', `🌪️ ภัยพิบัติริมหน้าต่าง ${lmFullTitle}`,
      `${lm.disasterTitle} หุ้นของ "${ownerTitle}" ลดขั้น แถมต้องจ่ายค่าทำขวัญให้คุณ!`,
      `เกิดเรื่องวุ่นวายนอกกระจกร้านค่ะ! ${lm.disasterTitle} ผู้ถือหุ้นอย่าง "${ownerTitle}" เลยโดนลดขั้นหุ้นลง แถมต้องควักจ่ายค่าปลอบขวัญ 18% ให้คุณทันทีค่ะ`,
      compAmt,
      `เกิดเรื่องวุ่นวายที่โต๊ะ ${lmFullTitle} ของ ${ownerTitle} (เดิมขั้น ${oldTier}) ➔ หุ้น${afterLabel} และหักเงิน ${ownerTitle} มาจ่ายค่าปลอบขวัญให้คุณ +${compAmt.toLocaleString()} เหรียญ = ยอดได้รับสุทธิ +${compAmt.toLocaleString()} เหรียญทอง`,
      [[lm.disasterIcon, 'วิวพังพินาศ!', lm.name, 'tax'], ['📉', afterLabel, `หุ้นของ ${ownerTitle} ร่วง`, 'divide'], ['🩹', `+${compAmt.toLocaleString()}`, 'รับค่าปลอบขวัญ 18%!', 'miracle']],
      mutList, { stampId: `LM_DIS_${lm.id}`, txType: 'LANDMARK' }
    );
  }

  if (actionRoll < 93) {
    const sponsorBonus = Math.min(1800, Math.max(50, Math.round((cafeAvg * baseRate) / 100)));
    const mutList = currentOwnerObj
      ? [mutDelta(currentOwnerObj, sponsorBonus, `📸 รับค่าสปอนเซอร์รีวิว ${lmFullTitle} ร่วมกับ ${myTitle}`, false, 'LANDMARK')]
      : [];
    return pack(
      'MIRACLE', `📸 รีวิวริมหน้าต่างไวรัลทะลุล้านวิว ${lmFullTitle}`,
      `ถ่ายรูปเช็กอินที่ "${lmFullTitle}" จนไวรัล! รับเงินสปอนเซอร์ +${sponsorBonus.toLocaleString()} เหรียญ ทั้งคุณและ "${ownerTitle}"!`,
      `คุณหยิบมือถือขึ้นมาถ่ายรูปแก้วกาแฟคู่กับวิว "${lmFullTitle}" ของ "${ownerTitle}" ลงโซเชียลจนยอดวิวทะลุล้าน! แบรนด์ขนมเลยจ่ายค่าสปอนเซอร์ให้ทั้งคู่รับทรัพย์แบบแฮปปี้สุดๆ เลยค่ะ`,
      sponsorBonus,
      `ถ่ายรูปเช็กอินที่โต๊ะ ${lmFullTitle} จนไวรัล ➔ ทั้งคุณและเจ้าของโต๊ะ ${ownerTitle} ได้รับสปอนเซอร์คนละ +${sponsorBonus.toLocaleString()} เหรียญ! = ยอดได้รับสุทธิ +${sponsorBonus.toLocaleString()} เหรียญทอง`,
      [['📸', 'ถ่ายรูปเช็กอิน!', lmFullTitle, 'win'], ['🔥', 'ไวรัลล้านวิว!', `${ownerTitle} ได้ด้วย`, 'miracle'], ['🥂', `+${sponsorBonus.toLocaleString()}`, `รับโบนัส ${baseRate}% ทั้งคู่!`, 'miracle']],
      mutList, { stampId: 'LM_ACT_VIRAL', txType: 'LANDMARK' }
    );
  }

  if (actionRoll < 97) {
    const halfRate = baseRate / 2;
    const sneakyLoot = Math.max(30, Math.round((cafeAvg * halfRate) / 100));
    const mutList = currentOwnerObj
      ? [mutDelta(currentOwnerObj, -sneakyLoot, `🕵️ โดน ${myTitle} แอบฉกเหรียญที่โต๊ะ ${lmFullTitle}`, false, 'LANDMARK')]
      : [];
    return pack(
      'WIN', `🕵️ แอบชะโงกหน้าดูวิวฟรี ${lmFullTitle}`,
      `ไม่ยอมจ่ายค่านั่งโต๊ะ "${lmFullTitle}" แถมแอบจิ๊กเงินจากโต๊ะของ "${ownerTitle}" มา +${sneakyLoot.toLocaleString()} เหรียญ!`,
      `คุณทำเนียนยืนพิงเสาแอบชะโงกหน้าดูวิว "${lmFullTitle}" ฟรีๆ พอ "${ownerTitle}" เผลอหันไปคุยกับบาริสต้า คุณก็แอบฉกเหรียญทอนบนโต๊ะของเขามาครึ่งขั้นหุ้น (${halfRate}%) วิ่งหนีกลับโต๊ะตัวเองแบบเนียนกริบค่ะ`,
      sneakyLoot,
      `แอบยืนดูวิว ${lmFullTitle} ฟรี ➔ แอบจิ๊กเงินครึ่งขั้นหุ้น (${halfRate}%) จาก ${ownerTitle} มา +${sneakyLoot.toLocaleString()} เหรียญ! = ยอดได้รับสุทธิ +${sneakyLoot.toLocaleString()} เหรียญทอง`,
      [['🕵️', 'ยืนชะโงกดูฟรี!', 'ไม่ยอมนั่งเก้าอี้', 'win'], [lm.icon, `ของ ${ownerTitle}`, 'เจ้าของเผลอพอดี!', 'miracle'], ['🥷', `+${sneakyLoot.toLocaleString()}`, `ฉกมาฟรีๆ ${halfRate}%!`, 'win']],
      mutList, { stampId: 'LM_ACT_PEEK', txType: 'LANDMARK' }
    );
  }

  const cleanReward = Math.max(35, Math.round((cafeAvg * 17) / 100));
  lm.curtainClosed = true;
  const mutList = currentOwnerObj
    ? [mutDelta(currentOwnerObj, -cleanReward, `🕊️ จ่ายค่าเช็ดกระจก ${lmFullTitle} ให้ ${myTitle}`, false, 'LANDMARK')]
    : [];
  return pack(
    'WIN', `🕊️ นกพิราบปล่อยระเบิดใส่กระจก ${lmFullTitle}`,
    `นกพิราบขี้ใส่กระจก "${lmFullTitle}"! คุณช่วยเช็ดและรูดม่านปิด รับค่าจ้างจาก "${ownerTitle}" +${cleanReward.toLocaleString()} เหรียญ!`,
    `เจ้านกพิราบตัวอ้วนบินมาปล่อยระเบิดใส่กระจกโซน "${lmFullTitle}" ของ "${ownerTitle}" เต็มรัก! อเลสเทียเลยหักเงินผู้ถือหุ้น 17% มาจ่ายเป็นค่าแรงให้คุณช่วยเช็ดกระจก พร้อมรูดผ้าม่านปิดพักวิวไว้ 1 รอบค่ะ`,
    cleanReward,
    `นกพิราบขี้ใส่กระจกโต๊ะ ${lmFullTitle} ➔ หักค่าจ้างเช็ดกระจก 17% จาก ${ownerTitle} มาให้คุณ +${cleanReward.toLocaleString()} เหรียญ! = ยอดได้รับสุทธิ +${cleanReward.toLocaleString()} เหรียญทอง`,
    [['🕊️', 'นกปล่อยระเบิด!', `กระจก ${lm.name} เลอะ`, 'tax'], ['🪟', 'รูดผ้าม่านปิดไว้!', 'พักชมวิวชั่วคราว', 'win'], ['🧽', `+${cleanReward.toLocaleString()}`, `รับค่าเช็ดกระจกจาก ${ownerTitle}!`, 'miracle']],
    mutList, { stampId: 'LM_ACT_PIGEON', txType: 'LANDMARK' }
  );
};

// ==========================================
// 🤝 2. เครื่องยนต์พบปะเพื่อน & ยืมเงินฉบับสายโหด (18% ของเกม • 32% ได้ / 68% เสียหนัก)
// ==========================================
const generateBrutalSocialLoanEvent = (startBal, startBank, activePlayerId, roster, worldState) => {
  const otherPlayers = roster.filter((p) => p.userId !== activePlayerId);
  if (otherPlayers.length === 0) return generateMiracleChaosEvent(startBal, startBank, activePlayerId, roster, worldState);

  const activePlayerObj = roster.find((p) => p.userId === activePlayerId);
  const myTitle = formatFriendTitle(activePlayerObj);
  const myRefBase = computeRiskRefBase(startBal, startBank);
  const socialRoll = Math.random() * 100;

  // 🟢 1. ยืมเงินเพื่อนโหด (32%): ดึง 25%–50% ของฐานทรัพย์สินเพื่อน แต่หักค่าธรรมเนียมนายหน้า 15% เผาทิ้ง!
  if (socialRoll < 32) {
    const richFriends = otherPlayers.filter((p) => Number(p.walletBalance || 0) + Math.max(0, Number(p.bankBalance || 0)) > 150);
    const friend = pickRandom(richFriends.length > 0 ? richFriends : otherPlayers);
    const fTitle = formatFriendTitle(friend);
    const fRefBase = computeRiskRefBase(friend.walletBalance, friend.bankBalance);
    const pct = pickRandom([25, 35, 45, 50]);
    const rawPull = Math.random() < 0.65
      ? Math.min(2600, Math.max(120, Math.round((fRefBase * pct) / 100)))
      : randInt(15, 60) * 10;
    const brokerBurn = Math.max(15, Math.round(rawPull * 0.15));
    const netReceived = Math.max(20, rawPull - brokerBurn);

    const borrowGags = [
      `ทำตาปริบๆ กอดขา "${fTitle}" กลางร้านจนเขายอมโอนให้ยืมถึง ${rawPull.toLocaleString()} เหรียญ! (โดนหักค่านายหน้าอเลสเทีย 15% เหลือเข้ากระเป๋า ${netReceived.toLocaleString()} เหรียญ)`,
      `คุณหลอก "${fTitle}" ว่าขอยืมเงินลงทุนเมล็ดกาแฟเกรดพรีเมียม ดึงมาจากบัญชีเพื่อนเต็มๆ ${rawPull.toLocaleString()} เหรียญ! (หักค่าธรรมเนียมโอนด่วน 15% เผาทิ้ง เหลือรับจริง ${netReceived.toLocaleString()} เหรียญ)`,
      `แอบสะกดจิต "${fTitle}" ตอนกำลังง่วง ให้กดโอนเงินมาให้ยืมหมุน ${rawPull.toLocaleString()} เหรียญ! (อเลสเทียหักค่าดำเนินการ 15% เหลือถึงมือคุณ ${netReceived.toLocaleString()} เหรียญ)`
    ];
    return pack(
      'WIN', '🤝 อีเวนต์ยืมเงินเพื่อนฉบับสายโหด', `ดึงเงินยืมจาก "${fTitle}" สำเร็จ +${netReceived.toLocaleString()} เหรียญ!`,
      pickRandom(borrowGags), netReceived,
      `ดึงเงินจาก ${fTitle} จำนวน -${rawPull.toLocaleString()} เหรียญ (หักข้ามธนาคารได้) ➔ หักค่านายหน้าเผาทิ้ง 15% (-${brokerBurn.toLocaleString()}) ➔ คุณได้รับสุทธิ +${netReceived.toLocaleString()} เหรียญทอง`,
      [['📱', 'ทักยืมสายโหด!', `เป้าหมายคือ ${fTitle}`, 'win'], ['🔥', `หักนายหน้า -${brokerBurn}`, 'เผาลดเงินเฟ้อ 15%', 'tax'], ['🤝', `+${netReceived.toLocaleString()}`, `ดึงจาก ${fTitle}!`, 'win']],
      [mutDelta(friend, -rawPull, `🤝 โดน ${myTitle} ทักมายืมเงินก้อนโต (${pct}%)`, false, 'FRIEND_OUT')],
      { txType: 'FRIEND_IN', burnedExtra: brokerBurn }
    );
  }

  // 🔴 2. เพื่อนมายืมเงินโหด (26%): ดึง 25%–55% จากฐานทรัพย์สินรวมของคุณ (ทะลุถึงธนาคาร!)
  if (socialRoll < 58) {
    const friend = pickRandom(otherPlayers);
    const fTitle = formatFriendTitle(friend);
    const pct = pickRandom([25, 35, 45, 55]);
    const lendAmt = Math.random() < 0.65
      ? Math.max(120, Math.round((myRefBase * pct) / 100))
      : randInt(16, 65) * 10;
    const brokerBurn = Math.max(15, Math.round(lendAmt * 0.12));
    const friendGets = Math.max(20, lendAmt - brokerBurn);

    const lendGags = [
      `"${fTitle}" ทักแชทมาตีหน้าเศร้าขอยืมเงินฉุกเฉิน คุณใจอ่อนโอนไปให้ถึง ${lendAmt.toLocaleString()} เหรียญ... พอโอนปุ๊บเพื่อนบล็อกหนีขึ้นออฟไลน์ทันทีเลยค่ะ`,
      `"${fTitle}" เดินมาตบไหล่กลางร้านแล้วลากคุณไปหน้าเคาน์เตอร์ ขอเงินไปหมุนด่วน -${lendAmt.toLocaleString()} เหรียญ (ถ้ากระเป๋าไม่พอดึงทะลุธนาคารทันที!) สัญญาว่าชาติหน้าคืนนะคะ`,
      `"${fTitle}" ส่งรูปแมวร้องไห้รัวๆ จนคุณมือลั่นโอนเงินให้ยืมไปถึง ${lendAmt.toLocaleString()} เหรียญ ตอนทวงน่าจะต้องจุดธูปเชิญแล้วค่ะ`
    ];
    return pack(
      lendAmt >= 350 ? 'DIVIDER' : 'THEFT', '💸 อีเวนต์เพื่อนยืมเงินฉบับสายโหด',
      `"${fTitle}" ขุดเงินยืมจากคุณไปถึง -${lendAmt.toLocaleString()} เหรียญ!`,
      pickRandom(lendGags), -lendAmt,
      `ฐานทรัพย์สินประเมิน ${myRefBase.toLocaleString()} ➔ โดน ${fTitle} ยืมเงินโหด -${lendAmt.toLocaleString()} เหรียญ (เพื่อนได้รับ +${friendGets.toLocaleString()} • ค่าธรรมเนียมเผาทิ้ง ${brokerBurn.toLocaleString()}) = ยอดหักสุทธิ -${lendAmt.toLocaleString()} เหรียญทอง`,
      [['💬', fTitle, 'ทักแชทขอยืมด่วน!', 'tax'], ['🙏', `ขูดไป ${pct}%!`, 'ชาติหน้าตอนบ่ายคืนนะ!', 'tax'], ['💸', `-${lendAmt.toLocaleString()}`, `โอนให้ ${fTitle}!`, 'divide']],
      [mutDelta(friend, friendGets, `💸 ยืมเงินก้อนโตจาก ${myTitle} สำเร็จ`, false, 'FRIEND_IN')],
      { txType: 'FRIEND_OUT', burnedExtra: brokerBurn }
    );
  }

  // 🔴 3. โดนจับเซ็นค้ำประกันเพื่อนหนีหนี้ (16%): หาคนที่ติดหนี้หนักที่สุดในร้าน แล้วบังคับคุณจ่ายหนี้แทน!
  if (socialRoll < 74) {
    const debtors = [...otherPlayers].filter((p) => Number(p.walletBalance || 0) < 0).sort((a, b) => a.walletBalance - b.walletBalance);
    const target = debtors.length > 0 ? debtors[0] : pickRandom(otherPlayers);
    const tTitle = formatFriendTitle(target);
    const targetDebt = target.walletBalance < 0 ? Math.abs(target.walletBalance) : randInt(500, 1400);
    const bailPct = pickRandom([30, 40, 50]);
    const bailAmt = Math.min(2800, Math.max(250, Math.round((targetDebt * bailPct) / 100)));

    return pack(
      'DIVIDER', '📝 วิกฤตเซ็นค้ำประกันเพื่อนหนีหนี้',
      `โดนเจ้าหนี้ตามทวงแทน "${tTitle}"! ต้องควักจ่ายหนี้แทน -${bailAmt.toLocaleString()} เหรียญ!`,
      `ความซวยมาเยือนถึงโต๊ะ! คุณเคยเผลอเซ็นค้ำประกันให้ "${tTitle}" ไว้ตอนจิบกาแฟ วันนี้เจ้าหนี้บุกมาทวงถึงที่เพราะเจ้าตัวหนีหายไปแล้ว คุณเลยต้องควักจ่ายโปะหนี้ให้เขาแทน ${bailPct}% (ดึงทะลุธนาคารได้ถ้ากระเป๋าไม่พอ) ค่ะ`,
      -bailAmt,
      `โดนบังคับจ่ายหนี้ค้ำประกันแทน ${tTitle} จำนวน -${bailAmt.toLocaleString()} เหรียญ (${bailPct}% ของหนี้) โปะเข้าบัญชีของ ${tTitle} ทันที! = ยอดหักสุทธิ -${bailAmt.toLocaleString()} เหรียญทอง`,
      [['📝', 'ลายเซ็นค้ำประกัน!', `ลูกหนี้คือ ${tTitle}`, 'tax'], ['🏃', 'เพื่อนหนีไปแล้ว!', 'เจ้าหนี้มาทวงที่คุณแทน', 'divide'], ['💸', `-${bailAmt.toLocaleString()}`, `จ่ายโปะหนี้ให้ ${tTitle}!`, 'divide']],
      [mutDelta(target, bailAmt, `📝 ${myTitle} โดนบังคับจ่ายหนี้ค้ำประกันโปะให้คุณ!`, false, 'FRIEND_IN')],
      { txType: 'FRIEND_OUT' }
    );
  }

  // 🔴 4. แก๊งเพื่อน 2–3 คนรุมไถค่ากาแฟ (14%): แท็กทีมกันมารุมขอเงินพร้อมกัน!
  if (socialRoll < 88 && otherPlayers.length >= 2) {
    const gangSize = Math.min(3, otherPlayers.length);
    const gang = [...otherPlayers].sort(() => Math.random() - 0.5).slice(0, gangSize);
    const perFriend = Math.max(120, Math.min(550, Math.round((myRefBase * 0.14) / 10) * 10));
    const totalDrain = perFriend * gang.length;
    const gangNames = gang.map((g) => formatFriendTitle(g)).join(', ');

    return pack(
      'DIVIDER', '👯 อีเวนต์แก๊งเพื่อนรุมไถค่ากาแฟ',
      `โดนแก๊ง ${gang.length} คน (${gangNames}) รุมล้อมขอค่าขนมรวม -${totalDrain.toLocaleString()} เหรียญ!`,
      `เดินเข้าคาเฟ่ผิดจังหวะสุดๆ ค่ะ! เจอแก๊งเพื่อน ${gangNames} นั่งรวมตัวกันอยู่แล้วตะโกนพร้อมกันว่า "เฮ้ย! วันนี้รวยแล้วเลี้ยงกาแฟหน่อย!" คุณปฏิเสธไม่ทันเลยโดนไถไปคนละ ${perFriend.toLocaleString()} เหรียญรวดเดียวเลยค่ะ`,
      -totalDrain,
      `โดนแก๊งเพื่อน ${gang.length} คน (${gangNames}) รุมไถคนละ -${perFriend.toLocaleString()} เหรียญ รวมทั้งหมด -${totalDrain.toLocaleString()} เหรียญ โอนเข้ากระเป๋าเพื่อนทุกคนจริง! = ยอดหักสุทธิ -${totalDrain.toLocaleString()} เหรียญทอง`,
      [['👯', `แก๊ง ${gang.length} คนรุม!`, 'ล้อมโต๊ะไว้ทุกทาง', 'tax'], ['🧋', `คนละ -${perFriend}`, 'สั่งเมนูแพงสุดทุกคน', 'tax'], ['💸', `-${totalDrain.toLocaleString()}`, 'จ่ายเรียบทั้งแก๊ง!', 'divide']],
      gang.map((g) => mutDelta(g, perFriend, `👯 แท็กทีมรุมไถค่ากาแฟจาก ${myTitle} สำเร็จ!`, false, 'FRIEND_IN')),
      { txType: 'FRIEND_OUT' }
    );
  }

  // 🔴 5. บิลเหมาเลี้ยงทั้งร้าน (12%): เผลอปากไวบอก "มื้อนี้ผมเลี้ยงเอง!"
  const headCount = Math.max(3, roster.length);
  const perHead = randInt(40, 70);
  const totalBill = Math.min(2200, Math.max(300, headCount * perHead));
  const luckyCount = Math.min(3, otherPlayers.length);
  const luckyFriends = [...otherPlayers].sort(() => Math.random() - 0.5).slice(0, luckyCount);
  const tipPerLucky = Math.round((totalBill * 0.35) / Math.max(1, luckyCount));
  const totalToFriends = tipPerLucky * luckyFriends.length;
  const burnedCafeBill = Math.max(0, totalBill - totalToFriends);
  const luckyNames = luckyFriends.map((f) => formatFriendTitle(f)).join(', ');

  return pack(
    'DIVIDER', '🧾 วิกฤตบิลเหมาเลี้ยงทั้งร้าน',
    `เผลอตะโกน "มื้อนี้ผมเลี้ยงเอง!" โดนเช็กบิลทั้งร้าน -${totalBill.toLocaleString()} เหรียญ!`,
    `ความใจป้ำพาจนค่ะ! คุณเผลอพูดเล่นเสียงดังว่า "เดี๋ยววันนี้เหมาเลี้ยงกาแฟทั้งร้านเอง!" ปรากฏว่าลูกค้าทั้ง ${headCount} คนเฮลั่นแล้วสั่งเค้กเบิ้ลกันหมด อเลสเทียเลยยื่นบิลยาวเป็นหางว่าวให้คุณจ่ายทันที (เพื่อน ${luckyNames} ได้ขนมติดมือกลับบ้านด้วย)!`,
    -totalBill,
    `เหมาเลี้ยงทั้งร้าน ${headCount} คน × ${perHead} เหรียญ = จ่ายรวม -${totalBill.toLocaleString()} เหรียญ (แบ่งให้ ${luckyNames} คนละ +${tipPerLucky.toLocaleString()} • เผาเข้าคลังร้าน ${burnedCafeBill.toLocaleString()}) = ยอดหักสุทธิ -${totalBill.toLocaleString()} เหรียญทอง`,
    [['📣', 'มื้อนี้เลี้ยงเอง!', `ทั้งร้าน ${headCount} ชีวิต`, 'tax'], ['🧾', 'บิลยาวเป็นหางว่าว', 'สั่งเบิ้ลกันทุกคน!', 'divide'], ['💸', `-${totalBill.toLocaleString()}`, 'จ่ายหน้าซีดทั้งน้ำตา!', 'divide']],
    luckyFriends.map((f) => mutDelta(f, tipPerLucky, `🍰 กินฟรีจากบิลเหมาทั้งร้านของ ${myTitle}`, false, 'FRIEND_IN')),
    { txType: 'FRIEND_OUT', burnedExtra: burnedCafeBill }
  );
};

// ==========================================
// 🏦 3. เครื่องยนต์เจาะตู้เซฟธนาคาร & ขวานผ่า & โจรย่องเบา (10% — โซนเสียหนัก)
// ==========================================
const generateBankRaidAndHeistEvent = (startBal, startBank, activePlayerId, roster) => {
  const otherPlayers = roster.filter((p) => p.userId !== activePlayerId);
  const activePlayerObj = roster.find((p) => p.userId === activePlayerId);
  const myTitle = formatFriendTitle(activePlayerObj);
  const refBase = computeRiskRefBase(startBal, startBank);
  const r = Math.random() * 100;

  // 1. 🕵️ ปปง. คาเฟ่ตรวจสอบบัญชีธนาคาร (35%) — ธนาคารได้อย่างเสียอย่าง!
  if (r < 35) {
    if (startBank >= 200) {
      const taxPct = pickRandom([22, 28, 34, 38]);
      const taxAmt = Math.max(80, Math.round((startBank * taxPct) / 100));
      return pack(
        'DIVIDER', '🕵️ ปปง. คาเฟ่ตรวจสอบบัญชีธนาคาร',
        `พบเงินฝากผิดปกติ! อายัดภาษีตรวจสอบบัญชีธนาคาร -${taxPct}% (-${taxAmt.toLocaleString()} เหรียญ)!`,
        `เก็บเงินไว้ในธนาคารเยอะเกินไปจนไฟแดงขึ้นหน้าจอค่ะ! เจ้าหน้าที่ ปปง. คาเฟ่บุกตรวจเส้นทางการเงินในตู้เซฟของคุณ แล้วสั่งหักภาษีตรวจสอบเงินฝาก ${taxPct}% ออกจากบัญชีธนาคารโดยตรงทันทีเลยค่ะ`,
        -taxAmt,
        `เงินในธนาคารมี ${startBank.toLocaleString()} เหรียญ ➔ โดน ปปง. คาเฟ่ตรวจบัญชีหักภาษี -${taxPct}% ออกจากธนาคารโดยตรง -${taxAmt.toLocaleString()} เหรียญ = ยอดหักสุทธิ -${taxAmt.toLocaleString()} เหรียญทอง`,
        [['🕵️', 'ปปง. บุกตรวจ!', 'สงสัยเงินฝากในธนาคาร', 'tax'], ['🏦', `หักตู้เซฟ -${taxPct}%`, `จากยอดฝาก ${startBank.toLocaleString()}`, 'divide'], ['💸', `-${taxAmt.toLocaleString()}`, 'ตัดจากธนาคารโดยตรง!', 'divide']],
        undefined, { bankDirect: true, txType: 'SPIN_LOSS' }
      );
    }
    const fineAmt = Math.max(70, Math.round((refBase * 22) / 100));
    return pack(
      'TAX', '🕵️ ปปง. คาเฟ่ตรวจพกเงินสดนอกระบบ',
      `ไม่ยอมฝากธนาคาร! โดนค่าปรับตรวจสอบเงินสด -${fineAmt.toLocaleString()} เหรียญ!`,
      `เจ้าหน้าที่ ปปง. คาเฟ่เดินมาตรวจบัญชีแล้วพบว่าคุณแทบไม่ฝากเงินในธนาคารเลย เลยโดนข้อหาถือเงินสดนอกระบบ ปรับเงินเข้าคลังไปตามระเบียบค่ะ`,
      -fineAmt,
      `ฐานทรัพย์สินประเมิน ${refBase.toLocaleString()} ➔ โดนปรับข้อหาถือเงินสดนอกระบบ -22% = ยอดหักสุทธิ -${fineAmt.toLocaleString()} เหรียญทอง`,
      [['🕵️', 'ปปง. คาเฟ่ตรวจ!', 'บัญชีธนาคารว่างเปล่า', 'tax'], ['📋', 'ข้อหาเงินนอกระบบ', 'ไม่ยอมเปิดบัญชีฝาก', 'tax'], ['💸', `-${fineAmt.toLocaleString()}`, 'จ่ายค่าปรับทันที!', 'divide']],
      undefined, { txType: 'SPIN_LOSS' }
    );
  }

  // 2. 🐈‍⬛ แฮ็กเกอร์แมวส้มเจาะตู้เซฟธนาคาร (25%) — หักจากธนาคารตรงๆ + แอบแบ่งให้เพื่อนดวงดี 1 คน!
  if (r < 60) {
    const stealPct = pickRandom([18, 24, 30, 35]);
    const targetPool = startBank >= 150 ? startBank : refBase;
    const stolenAmt = Math.max(75, Math.round((targetPool * stealPct) / 100));
    const luckyFriend = otherPlayers.length > 0 ? pickRandom(otherPlayers) : null;
    const friendCut = luckyFriend ? Math.round(stolenAmt * 0.25) : 0;
    const burnedAmt = stolenAmt - friendCut;
    const fTitle = luckyFriend ? formatFriendTitle(luckyFriend) : '';

    return pack(
      'DIVIDER', '🐈‍⬛ แฮ็กเกอร์แมวส้มเจาะตู้เซฟธนาคาร',
      startBank >= 150
        ? `แมวส้มแฮ็กตู้เซฟธนาคารของคุณ! กวาดไป -${stealPct}% (-${stolenAmt.toLocaleString()} เหรียญ)!`
        : `แมวส้มแฮ็กกระเป๋าตังค์ของคุณ! กวาดไป -${stealPct}% (-${stolenAmt.toLocaleString()} เหรียญ)!`,
      `เจ้าแมวส้มประจำร้านแอบเหยียบคีย์บอร์ดเคาน์เตอร์จนเจาะรหัสตู้เซฟได้เฉย! เหรียญทองของคุณปลิวหายไป ${stolenAmt.toLocaleString()} เหรียญ${
        luckyFriend ? ` แถมเจ้าแมวยังคาบเหรียญบางส่วน (+${friendCut.toLocaleString()}) ไปวางบนตัก "${fTitle}" อีกด้วยค่ะ` : ''
      }`,
      -stolenAmt,
      `เจ้าแมวส้มแฮ็กตู้เซฟกวาดไป -${stealPct}% เป็นเงิน -${stolenAmt.toLocaleString()} เหรียญ${
        luckyFriend ? ` (คาบไปให้ ${fTitle} +${friendCut.toLocaleString()} • เผาหายไป ${burnedAmt.toLocaleString()})` : ''
      } = ยอดหักสุทธิ -${stolenAmt.toLocaleString()} เหรียญทอง`,
      [['🐈‍⬛', 'แฮ็กเกอร์แมวส้ม!', 'เหยียบคีย์บอร์ดเจาะรหัส', 'tax'], ['🏦', `เจาะตู้เซฟ -${stealPct}%`, luckyFriend ? `แบ่งให้ ${fTitle} ด้วย` : 'เงินปลิวว่อน!', 'divide'], ['💥', `-${stolenAmt.toLocaleString()}`, 'ตู้เซฟแตกยับ!', 'divide']],
      luckyFriend ? [mutDelta(luckyFriend, friendCut, `🐈‍⬛ แมวส้มแฮ็กตู้เซฟ ${myTitle} แล้วคาบเงินมาฝากคุณ!`, false, 'FRIEND_IN')] : undefined,
      { bankDirect: startBank >= 150, txType: 'SPIN_LOSS', burnedExtra: burnedAmt, skipTipJarSink: Boolean(luckyFriend) }
    );
  }

  // 3. 🪓 ขวานผ่าทรัพย์สิน (20%) — คิดฐานรวมธนาคาร 60%
  if (r < 80) {
    const div = pickRandom([2, 3, 4]);
    const s1 = -randInt(3, 6) * 10;
    const cutAmt = Math.round(refBase * (1 - 1 / div));
    const netDelta = -(cutAmt + Math.abs(s1));
    return pack(
      'DIVIDER', '🪓 วิกฤตขวานผ่ากระเป๋า', `ทรัพย์สินถูกขวานผ่าหารออก 1 ใน ${div}!`, pickRandom(FLAVOR_MESSAGES.DIVIDER), netDelta,
      `ฐานทรัพย์สินประเมิน ${refBase.toLocaleString()} ➔ โดนขวานผ่าหาร ÷ ${div} หักไป -${cutAmt.toLocaleString()} เหรียญ ➔ หักค่าตกใจอีก ${s1} = ยอดหักสุทธิ ${netDelta.toLocaleString()} เหรียญทอง`,
      [['⚠️', `${s1}`, 'ค่าตกใจ', 'tax'], ['🌪️', 'วิกฤต!', 'ฟองสบู่คาเฟ่แตก', 'tax'], ['🪓', `÷${div}`, `ผ่าหาร ÷${div}!`, 'divide']]
    );
  }

  // 4. 🥷 โจรย่องเบา (20%) — คิดฐานรวมธนาคาร 60%
  const stealPct = pickRandom([25, 35, 45, 55]);
  const s1 = randInt(1, 3) * 10;
  const flatTheft = randInt(3, 7) * 10;
  const pctStolen = Math.max(45, Math.round((refBase * stealPct) / 100));
  const netDelta = -Math.max(45, pctStolen + flatTheft - s1);
  return pack(
    'THEFT', '🥷 อีเวนต์โจรย่องเบา', `โดนโจรล้วงกระเป๋าฉกเงินไป -${stealPct}%!`, pickRandom(FLAVOR_MESSAGES.THEFT), netDelta,
    `ฐานทรัพย์สินประเมิน ${refBase.toLocaleString()} ➔ โดนโจรฉกไป -${stealPct}% เป็นเงิน -${pctStolen.toLocaleString()} เหรียญ ➔ โดนแมวคาบไปอีก -${flatTheft} กู้คืนมาได้ +${s1} = ยอดหักสุทธิ ${netDelta.toLocaleString()} เหรียญทอง`,
    [['🪙', `+${s1}`, 'เหรียญล่อโจร', 'zero'], ['🐈‍⬛', `-${flatTheft}`, 'แมวส้มคาบไป', 'tax'], ['🥷', `-${stealPct}%`, `โจรฉกทรัพย์ -${stealPct}%!`, 'divide']]
  );
};

// ==========================================
// 🌟 4. เครื่องยนต์ปาฏิหาริย์, กับดักความโลภ, กระเป๋าหล่น & มัลติเพลเยอร์ (17%)
// ==========================================
const generateMiracleChaosEvent = (startBal, startBank, activePlayerId, roster, worldState) => {
  const otherPlayers = roster.filter((p) => p.userId !== activePlayerId);
  const activePlayerObj = roster.find((p) => p.userId === activePlayerId);
  const myTitle = formatFriendTitle(activePlayerObj);
  const refBase = computeRiskRefBase(startBal, startBank);
  const totalNetWorth = startBal + startBank;

  // สาย 1A: สุ่มเข้า 34 อีเวนต์ตรรกะวิบัติ (ปรับน้ำหนักเป็น ลบ 65% / บวก 35%)
  if (Math.random() < 0.32) {
    const wantNegative = Math.random() < 0.65;
    const indexed = ABSURD_DUAL_TUPLE.map((item, idx) => ({ item, idx }));
    const filtered = indexed.filter((x) => (wantNegative ? !x.item[0] : Boolean(x.item[0])));
    const picked = pickRandom(filtered.length > 0 ? filtered : indexed);
    const tupleIdx = picked.idx;
    const [isPos, rangeOrPct, calcMode, [i1, l1, s1], [i2, l2, s2], [i3, s3], catHdr, headline, msg, eqFn] = picked.item;
    const stampId = 'AB_' + String(tupleIdx + 1).padStart(2, '0');
    let amt = 0;
    let pctOrDiv = 0;

    if (calcMode === 'DIV') {
      pctOrDiv = pickRandom(rangeOrPct);
      amt = Math.max(50, Math.round(refBase * (1 - 1 / pctOrDiv)));
    } else if (calcMode === 'MULT') {
      pctOrDiv = pickRandom(rangeOrPct);
      const gainBase = startBal > 0 ? startBal : BASE_ECONOMIC_UNIT;
      amt = Math.min(3200, Math.max(220, Math.round(gainBase * (pctOrDiv - 1))));
    } else if (calcMode === true) {
      pctOrDiv = pickRandom(rangeOrPct);
      if (isPos) {
        const gainBase = startBal > 0 ? startBal : BASE_ECONOMIC_UNIT;
        amt = Math.min(2600, Math.max(40, Math.round((gainBase * pctOrDiv) / 100)));
      } else {
        amt = Math.max(50, Math.round((refBase * pctOrDiv) / 100));
      }
    } else {
      amt = randInt(rangeOrPct[0], rangeOrPct[1]);
      if (amt >= 30) amt = Math.round(amt / 5) * 5;
      if (!isPos) amt = Math.round((amt * 1.2) / 5) * 5;
    }

    const netDelta = isPos ? amt : -amt;
    const label3 =
      calcMode === 'DIV' ? `÷${pctOrDiv}` :
      calcMode === 'MULT' ? `×${pctOrDiv}` :
      calcMode === true ? `${isPos ? '+' : '-'}${pctOrDiv}%` :
      `${isPos ? '+' : '-'}${amt.toLocaleString()}`;

    return pack(
      isPos ? 'MIRACLE' : (amt >= 300 ? 'DIVIDER' : 'THEFT'),
      catHdr, headline, msg, netDelta,
      `ฐานประเมิน ${refBase.toLocaleString()} ➔ ${eqFn(amt, pctOrDiv)} = ${netDelta >= 0 ? 'ยอดได้รับสุทธิ +' + netDelta.toLocaleString() : 'ยอดหักสุทธิ ' + netDelta.toLocaleString()} เหรียญทอง`,
      [[i1, l1, s1, 'zero'], [i2, l2, s2, isPos ? 'miracle' : 'tax'], [i3, label3, s3, isPos ? 'miracle' : 'divide']],
      undefined, { stampId }
    );
  }

  // พูลปาฏิหาริย์ & มัลติเพลเยอร์ (เพิ่มน้ำหนักอีเวนท์เจอเพื่อน, ยึดทรัพย์, กระเป๋าหล่น และกับดักความโลภ)
  const eventPool = [
    'GREED_TRAP', 'GREED_TRAP',
    'ALESTIA_SEIZURE', 'ALESTIA_SEIZURE',
    'LOST_AND_FOUND_WALLET', 'LOST_AND_FOUND_WALLET', 'LOST_AND_FOUND_WALLET',
    'RANDOM_WALLET_SWAP', 'RANDOM_WALLET_SWAP',
    'STEAL_SULTAN', 'STEAL_SULTAN',
    'COMMUNITY_TAX_MAGNET', 'COMMUNITY_TAX_MAGNET',
    'DAVID_VS_GOLIATH', 'DAVID_VS_GOLIATH',
    'RUSSIAN_ROULETTE', 'RUSSIAN_ROULETTE',
    'DEBT_TIME_BOMB', 'SOUL_BOND_TWINS', 'REVERSE_RANK_SWAP',
    'SPREAD_THE_LOVE_DEBT', 'COMMUNISM_EQUALIZER', 'MIRROR_COPY_CAT', 'WANT_RICH_POOR',
    'TIME_CAPSULE_VAULT', 'QUANTUM_MULTIPLIER_DICE', 'TIP_JAR_SMASH',
    'BEGGAR_BILLIONAIRE', 'POLARITY_FLIP', 'ALESTIA_DEBT_CLEAR',
    'CAFE_LOTTO_777', 'ROBIN_HOOD', 'DEBT_INSURANCE', 'ALESTIA_RAIN_MAKER'
  ];
  const chosen = pickRandom(eventPool);

  // 🔥 กับดักความโลภ (โลภมากลาภหาย: ยิ่งถือทรัพย์สินรวมสูง ยิ่งโดนหักหนักและโหดมาก!)
  if (chosen === 'GREED_TRAP') {
    if (totalNetWorth >= 1200) {
      const greedPct = totalNetWorth >= 6000 ? pickRandom([45, 50, 60]) : pickRandom([30, 38, 45]);
      const penalty = Math.max(250, Math.round((totalNetWorth * greedPct) / 100));
      const poorFriend = [...otherPlayers].sort((a, b) => (a.walletBalance + (a.bankBalance || 0)) - (b.walletBalance + (b.bankBalance || 0)))[0];
      const donateAmt = poorFriend ? Math.min(800, Math.round(penalty * 0.25)) : 0;
      const burnedAmt = penalty - donateAmt;
      const pTitle = poorFriend ? formatFriendTitle(poorFriend) : '';

      return pack(
        'DIVIDER', '😈 บทลงโทษแห่งความโลภ',
        `โลภมากลาภหาย! ถือทรัพย์สินรวม ${totalNetWorth.toLocaleString()} โดนฟ้าผ่าหัก -${greedPct}% (-${penalty.toLocaleString()} เหรียญ)!`,
        `เทพธิดาคาเฟ่จับได้ว่าคุณกำลังหน้ามืดตามัวปั่นกอบโกยไม่หยุด! เลยปล่อยสายฟ้าแห่งความโลภผ่ากลางโต๊ะ หักทรัพย์สินรวมของคุณไป ${greedPct}% ทันที (ทะลุถึงธนาคาร!)${
          poorFriend ? ` แถมแบ่งเงินสงเคราะห์ให้ "${pTitle}" ไป +${donateAmt.toLocaleString()} เหรียญด้วยค่ะ` : ''
        }`,
        -penalty,
        `ทรัพย์สินรวม ${totalNetWorth.toLocaleString()} ➔ ติดกับดักความโลภโดนหัก -${greedPct}% เป็นเงิน -${penalty.toLocaleString()} เหรียญ${
          poorFriend ? ` (สงเคราะห์ ${pTitle} +${donateAmt.toLocaleString()} • เผาทิ้ง ${burnedAmt.toLocaleString()})` : ''
        } = ยอดหักสุทธิ -${penalty.toLocaleString()} เหรียญทอง`,
        [['😈', 'โลภมากลาภหาย!', `มีรวม ${totalNetWorth.toLocaleString()}`, 'tax'], ['⚡', `ฟ้าผ่า -${greedPct}%!`, 'ทะลุทั้งกระเป๋า & ธนาคาร', 'divide'], ['💸', `-${penalty.toLocaleString()}`, 'บทเรียนคนรวย!', 'divide']],
        poorFriend ? [mutDelta(poorFriend, donateAmt, `⚡ รับเงินสงเคราะห์จากสายฟ้าลงโทษความโลภของ ${myTitle}`, false, 'FRIEND_IN')] : undefined,
        { burnedExtra: burnedAmt, skipTipJarSink: Boolean(poorFriend) }
      );
    }
    const mercyGift = randInt(25, 55) * 10;
    return pack(
      'MIRACLE', '🕊️ เมตตาผู้ไร้ความโลภ',
      `ตรวจสอบแล้วคุณยังจนอยู่! รับเงินปลอบขวัญ +${mercyGift.toLocaleString()} เหรียญ!`,
      `สายฟ้าแห่งความโลภสแกนดูบัญชีคุณแล้วพบว่าทรัพย์สินรวมยังไม่ถึงเกณฑ์คนรวย เทพธิดาเลยสงสารโปรยเหรียญปลอบขวัญมาให้ตั้งตัว +${mercyGift.toLocaleString()} เหรียญค่ะ`,
      mercyGift,
      `ทรัพย์สินรวม ${totalNetWorth.toLocaleString()} (ไม่เข้าข่ายคนโลภ) ➔ รับเงินปลอบขวัญ +${mercyGift.toLocaleString()} เหรียญ = ยอดได้รับสุทธิ +${mercyGift.toLocaleString()} เหรียญทอง`,
      [['🕊️', 'สแกนความโลภ', 'ผ่านฉลุยเพราะยังจน!', 'win'], ['✨', 'เทพธิดาเมตตา', 'มอบทุนตั้งตัวให้', 'miracle'], ['🪙', `+${mercyGift.toLocaleString()}`, 'รับไปสู้ชีวิตต่อ!', 'miracle']]
    );
  }

  // 👛 กระเป๋าตังค์หล่นหาย & เก็บกระเป๋าตังค์ได้ (เฉพาะเงินในกระเป๋า — ธนาคารยังรอด!)
  if (chosen === 'LOST_AND_FOUND_WALLET') {
    const lostWallets = worldState.lostWallets || [];
    if (startBal > 0 && (lostWallets.length === 0 || Math.random() < 0.80)) {
      const lostAmount = startBal;
      const recoverableAmt = Math.max(1, Math.round(lostAmount * 0.70)); // 30% เผาทิ้งลดเงินเฟ้อ
      const bankSafeNote = startBank > 0 ? ` (โชคดีที่เงินในธนาคาร ${startBank.toLocaleString()} เหรียญยังรอด!)` : '';
      const loseScenarios = [
        ['MC_LOST_DANCE', '👛 วิกฤตกระเป๋าตังค์หล่นหายกลางทาง', 'มัวแต่เดินเต้นดุ๊กดิ๊ก ทำกระเป๋าตังค์หล่นหาย เงินในกระเป๋ากลายเป็น 0 ทันที!', `คุณเดินเต้นดุ๊กดิ๊กฮัมเพลงออกจากคาเฟ่จนกระเป๋าตังค์ที่มีเงินอยู่ ${lostAmount.toLocaleString()} เหรียญทองกระเด็นหลุดหายไปทั้งใบ เงินติดตัวกลายเป็น 0 ทันทีค่ะ${bankSafeNote}`, 'ทำตกไว้ตอนเดินเต้นดุ๊กดิ๊กหน้าร้าน', ['🕺', 'เดินเต้นดุ๊กดิ๊ก', `มี ${lostAmount.toLocaleString()} เหรียญ`]],
        ['MC_LOST_TAXI', '🚕 วิกฤตลืมกระเป๋าตังค์ไว้บนหลังคาแท็กซี่', 'วางกระเป๋าตังค์ไว้บนหลังคารถแท็กซี่แล้วรถออกตัว เงินในกระเป๋ากลายเป็น 0 ทันที!', `คุณเผลอวางกระเป๋าตังค์ที่มีเงิน ${lostAmount.toLocaleString()} เหรียญพักไว้บนหลังคารถแท็กซี่แล้วรถซิ่งออกไปเลยค่ะ เหลือเงินติดตัว 0 เหรียญถ้วน${bankSafeNote}`, 'วางลืมไว้บนหลังคารถแท็กซี่จนปลิวตกถนน', ['🚕', 'วางบนหลังคาแท็กซี่', `มี ${lostAmount.toLocaleString()} เหรียญ`]],
        ['MC_LOST_TRASH', '🗑️ วิกฤตเบลอจัดทิ้งกระเป๋าตังค์ลงถังขยะ', 'ถือกระเป๋าตังค์คู่กับซองขนม เผลอโยนกระเป๋าตังค์ทิ้งถังขยะเหลือ 0 เหรียญ!', `ความเบลอเป็นเหตุ! คุณดันโยนกระเป๋าตังค์ที่มีเงิน ${lostAmount.toLocaleString()} เหรียญทิ้งลงถังขยะแทนซองลูกอม เงินในกระเป๋ากลายเป็น 0 ทันที${bankSafeNote}`, 'เผลอโยนทิ้งสลับกับซองขนมหน้าคาเฟ่', ['🗑️', 'โยนผิดมือ!', `มี ${lostAmount.toLocaleString()} เหรียญ`]],
        ['MC_LOST_WIND', '🌪️ วิกฤตลมสลาตันพัดกระเป๋าตังค์ปลิวหาย', 'ลมพายุหมุนพัดกระเป๋าตังค์หลุดมือลอยหายขึ้นฟ้า เงินในกระเป๋ากลายเป็น 0 ทันที!', `ลมพายุหมุนลูกจิ๋วพัดโฉบมาหอบกระเป๋าตังค์ที่มีเงิน ${lostAmount.toLocaleString()} เหรียญของคุณลอยหายวับไปต่อหน้าต่อตา เหลือ 0 เหรียญในกระเป๋าทันที${bankSafeNote}`, 'โดนลมพายุหมุนพัดปลิวไปตกพุ่มไม้หน้าร้าน', ['🌪️', 'พายุหมุนโฉบ!', `มี ${lostAmount.toLocaleString()} เหรียญ`]]
      ];
      const [stampId, hdr, head, msg, reason, s1] = pickRandom(loseScenarios);
      recordLostWallet(worldState, myTitle, recoverableAmt, reason);
      return pack(
        'DIVIDER', hdr, head, msg, -lostAmount,
        `กระเป๋ามี ${lostAmount.toLocaleString()} ➔ ทำกระเป๋าตังค์หล่นหาย -100% เป็นเงิน -${lostAmount.toLocaleString()} เหรียญ (เงินฝากธนาคารปลอดภัย 100%) = ยอดหักสุทธิ -${lostAmount.toLocaleString()} เหรียญทอง`,
        [[s1[0], s1[1], s1[2], 'win'], ['👛', 'กระเป๋าหล่นหาย!', 'เงินในธนาคารยังรอด!', 'tax'], ['🕳️', 'กระเป๋าเหลือ 0!', 'จะมีใครเดินมาเก็บไหมเนี่ย', 'divide']],
        undefined, { stampId, walletOnly: true, skipTipJarSink: true, burnedExtra: lostAmount - recoverableAmt }
      );
    }
    if (lostWallets.length > 0) {
      const fw = lostWallets.pop();
      const foundAmt = fw.amount;
      const prevOwner = fw.ownerName;
      const lostWhy = fw.lostReason || 'ทำตกไว้หน้าร้าน';
      return pack(
        'MIRACLE', '👛 ปาฏิหาริย์เก็บกระเป๋าตังค์ได้',
        `เปิดเจอกระเป๋าตังค์ของ "${prevOwner}" ที่เพิ่งทำหาย รับเงินสด +${foundAmt.toLocaleString()} เหรียญ!`,
        `สวรรค์เข้าข้างคนสู้ชีวิต! คุณเดินไปเตะเจอกระเป๋าตังค์ตุงๆ ของ "${prevOwner}" ที่เจ้าตัวเพิ่ง${lostWhy} ข้างในมีเงินอยู่ถึง ${foundAmt.toLocaleString()} เหรียญทอง เลยเก็บเข้ากระเป๋าตัวเองทันทีเลยค่ะ`,
        foundAmt,
        `กระเป๋ามี ${startBal.toLocaleString()} ➔ เก็บกระเป๋าตังค์ที่ ${prevOwner} ทำตกไว้ได้ รับเงิน +${foundAmt.toLocaleString()} เหรียญ = ยอดได้รับสุทธิ +${foundAmt.toLocaleString()} เหรียญทอง`,
        [['👀', 'ก้มมองพื้นร้าน', 'เจอกระเป๋าตังค์ตกอยู่!', 'zero'], ['👛', `ของ ${prevOwner}`, lostWhy, 'miracle'], ['🤑', `+${foundAmt.toLocaleString()}`, 'หวานเจี๊ยบรับยกซอง!', 'miracle']],
        undefined, { stampId: 'MC_FOUND_FRIEND' }
      );
    }
    const mysteryAmt = randInt(35, 95) * 10;
    return pack(
      'MIRACLE', '👛 ปาฏิหาริย์พบกระเป๋าตังค์ปริศนา',
      `เปิดพรมเช็ดเท้าเจอกระเป๋าตังค์ปริศนาซ่อนอยู่ รับทรัพย์ +${mysteryAmt.toLocaleString()} เหรียญ!`,
      `คุณเดินสะดุดพรมเช็ดเท้าหน้าประตูคาเฟ่ พอเลิกพรมดูดันเจอกระเป๋าตังค์ปริศนาที่วางลืมไว้ ข้างในมีเหรียญทอง +${mysteryAmt.toLocaleString()} เหรียญให้เอาไปตั้งตัวค่ะ`,
      mysteryAmt,
      `กระเป๋ามี ${startBal.toLocaleString()} ➔ พบกระเป๋าตังค์ปริศนาใต้พรมเช็ดเท้ารับเงิน +${mysteryAmt.toLocaleString()} เหรียญ = ยอดได้รับสุทธิ +${mysteryAmt.toLocaleString()} เหรียญทอง`,
      [['🧶', 'สะดุดพรมเช็ดเท้า', 'เลิกพรมขึ้นมาดู', 'zero'], ['👛', 'พบกระเป๋าปริศนา!', 'ซ่อนอยู่ใต้พรม', 'miracle'], ['💰', `+${mysteryAmt.toLocaleString()}`, 'รับทรัพย์เข้ากระเป๋า!', 'miracle']],
      undefined, { stampId: 'MC_FOUND_MAT' }
    );
  }

  // 🍪 กระป๋องคุกกี้แดงฝังดิน
  if (chosen === 'TIME_CAPSULE_VAULT') {
    if (!worldState.timeCapsule && startBal > 100) {
      const buriedAmt = Math.max(60, Math.round(startBal * 0.45));
      worldState.timeCapsule = { ownerName: myTitle, amount: buriedAmt };
      return pack(
        'DIVIDER', '🍪 อีเวนต์ซ่อนตังค์ในกระป๋องคุกกี้แดง',
        'แอบแบ่งเงินในกระเป๋า -45% ใส่กระป๋องคุกกี้สีแดงไปฝังดินไว้ใต้ต้นไม้ แต่ดันลืมพิกัด!',
        `คุณแบ่งเหรียญทองในกระเป๋า 45% จำนวน ${buriedAmt.toLocaleString()} เหรียญ ใส่กระป๋องคุกกี้สีแดงไปขุดหลุมฝังไว้ใต้ต้นไม้หน้าคาเฟ่ แต่พอเดินกลับมาดันลืมว่าฝังไว้ต้นไหน จะมีใครไปขุดเจอไหมคะเนี่ย`,
        -buriedAmt,
        `กระเป๋ามี ${startBal.toLocaleString()} ➔ ฝังกระป๋องคุกกี้ไว้ -45% เป็นเงิน -${buriedAmt.toLocaleString()} เหรียญ = ยอดหักสุทธิ -${buriedAmt.toLocaleString()} เหรียญทอง`,
        [['🍪', 'กระป๋องคุกกี้แดง', 'ไม่ใช่คุกกี้แต่เป็นตังค์!', 'zero'], ['🌳', 'เอาไปฝังไว้ -45%!', 'ดันลืมว่าฝังไว้ต้นไหน', 'tax'], ['🕳️', `-${buriedAmt.toLocaleString()}`, 'จะมีใครมาขุดเจอไหมเนี่ย!', 'divide']],
        undefined, { stampId: 'MC_COOKIE_BURY', walletOnly: true, skipTipJarSink: true }
      );
    } else if (worldState.timeCapsule) {
      const cap = worldState.timeCapsule;
      const maturedAmt = Math.round(cap.amount * 1.25);
      worldState.timeCapsule = null;
      return pack(
        'MIRACLE', '🍪 ปาฏิหาริย์ขุดเจอกระป๋องคุกกี้แดง',
        `ขุดเจอกระป๋องคุกกี้แดงของ "${cap.ownerName}" ที่ฝังลืมไว้ รับเงินคูณ ×1.25 เท่า!`,
        `คุณเดินไปสะดุดดินนูนๆ ใต้ต้นไม้หน้าคาเฟ่ ดันเจอกระป๋องคุกกี้สีแดงที่ "${cap.ownerName}" เอาเงินไปฝังซ่อนไว้ ${cap.amount.toLocaleString()} เหรียญ แถมงอกเงยเป็น ×1.25 เท่า รับไปเต็มๆ ${maturedAmt.toLocaleString()} เหรียญเลยค่ะ`,
        maturedAmt,
        `ขุดเจอกระป๋องคุกกี้ของ ${cap.ownerName} ยอดเดิม ${cap.amount.toLocaleString()} × 1.25 = ยอดได้รับสุทธิ +${maturedAmt.toLocaleString()} เหรียญทอง`,
        [['⛏️', 'สะดุดโคนต้นไม้', `กระป๋องของ ${cap.ownerName}`, 'zero'], ['🍪', 'เปิดมาเจอตังค์ ×1.25!', `จากเดิม ${cap.amount.toLocaleString()}`, 'miracle'], ['💎', `+${maturedAmt.toLocaleString()}`, 'หวานเจี๊ยบรับยกกระป๋อง!', 'miracle']],
        undefined, { stampId: 'MC_COOKIE_DIG' }
      );
    }
  }

  // 🎲 ลูกเต๋าทองคำวัดใจบาริสต้า (สายโหด: 40% ได้ / 60% โดนผ่า)
  if (chosen === 'QUANTUM_MULTIPLIER_DICE') {
    const factor = pickRandom([2, 3]);
    if (Math.random() < 0.40) {
      const gainBase = startBal > 0 ? startBal : BASE_ECONOMIC_UNIT;
      const gain = Math.min(3000, Math.max(220, Math.round(gainBase * (factor - 0.5))));
      return pack(
        'JACKPOT', '🎲 ปาฏิหาริย์ลูกเต๋าทองคำทวีคูณ',
        `ทอยลูกเต๋าทองคำออกแต้มคูณ ×${factor} รับทรัพย์พุ่ง +${gain.toLocaleString()} เหรียญ!`,
        `อเลสเทียชวนคุณทอยลูกเต๋าทองคำเสี่ยงทายบนเคาน์เตอร์บาริสต้า ลูกเต๋าหมุนติ้วแล้วหยุดที่หน้าตัวคูณ ×${factor} พอดีเป๊ะ รับรางวัลเข้ากระเป๋าทันทีค่ะ`,
        gain,
        `ทอยลูกเต๋าทองคำออกหน้า ×${factor} รับเงินรางวัลเพิ่ม +${gain.toLocaleString()} เหรียญ = ยอดได้รับสุทธิ +${gain.toLocaleString()} เหรียญทอง`,
        [['🎲', 'ทอยเต๋าทองคำ', 'ลุ้นแต้มหน้าเคาน์เตอร์', 'win'], ['⚡', 'ออกแต้มมงคล!', 'อเลสเทียปรบมือรัวๆ', 'miracle'], ['🚀', `×${factor}`, `รับทรัพย์ +${gain.toLocaleString()}!`, 'miracle']],
        undefined, { stampId: 'MC_DICE_MULT' }
      );
    }
    const cut = Math.max(70, Math.round(refBase * (1 - 1 / factor)));
    return pack(
      'DIVIDER', '🎲 วิกฤตลูกเต๋าอาถรรพ์ผ่ากระเป๋า',
      `ทอยลูกเต๋าวัดดวงพลาดท่า ออกหน้าหาร ÷${factor} โดนหักเงินทันที!`,
      `ลูกเต๋าไม้โบราณกลิ้งไปหยุดที่หน้าหาร ÷${factor} พอดีเป๊ะ เลยต้องควักเหรียญทองจ่ายค่าต๋งตามฐานทรัพย์สินเลยค่ะ`,
      -cut,
      `ฐานทรัพย์สินประเมิน ${refBase.toLocaleString()} ➔ ทอยลูกเต๋าออกหน้า ÷${factor} หักไป -${cut.toLocaleString()} เหรียญ = ยอดหักสุทธิ -${cut.toLocaleString()} เหรียญทอง`,
      [['🎲', 'ทอยเต๋าวัดดวง', 'ลูกเต๋ากลิ้งตกขอบโต๊ะ', 'tax'], ['😱', 'ออกหน้าหารเฉยเลย!', 'เสียค่าต๋งตามกติกา', 'divide'], ['🪓', `÷${factor}`, `หักไป -${cut.toLocaleString()}!`, 'divide']],
      undefined, { stampId: 'MC_DICE_DIV' }
    );
  }

  // 🐷 ทุบกระปุกหมูหน้าเคาน์เตอร์
  if (chosen === 'TIP_JAR_SMASH') {
    const jarLoot = Math.max(300, Number(worldState.cursedTipJar || 400));
    worldState.cursedTipJar = 250;
    return pack(
      'MIRACLE', '🐷 ปาฏิหาริย์กระปุกหมูหน้าเคาน์เตอร์แตก',
      `เผลอปัดกระปุกออมสินหมูของร้านแตก กวาดเหรียญสะสมมา +${jarLoot.toLocaleString()} เหรียญ!`,
      `ข้อศอกคุณเผลอไปชนกระปุกออมสินหมูทองคำที่เพื่อนๆ โดนหักเงินหยอดสะสมไว้จนแตกกระจาย เหรียญทองไหลทะลักเข้ากระเป๋าคุณทั้งหมด ${jarLoot.toLocaleString()} เหรียญเลยค่ะ`,
      jarLoot,
      `เผลอปัดกระปุกหมูสะสมของคาเฟ่แตก กวาดเงินสะสมทั้งหมด +${jarLoot.toLocaleString()} เหรียญ = ยอดได้รับสุทธิ +${jarLoot.toLocaleString()} เหรียญทอง`,
      [['🐷', 'กระปุกหมูคาเฟ่', 'สะสมเงินคนโดนปรับ', 'win'], ['🔨', 'เผลอปัดแตกโพละ!', 'เหรียญทะลักเต็มพื้นร้าน', 'miracle'], ['🤑', `+${jarLoot.toLocaleString()}`, 'กวาดเรียบเข้ากระเป๋า!', 'miracle']],
      undefined, { stampId: 'MC_TIP_JAR' }
    );
  }

  // 1. 🧲 แม่เหล็กดึงดูดทรัพย์ (ดูด 8%–15% จากเพื่อนทั้งร้าน!)
  if (chosen === 'COMMUNITY_TAX_MAGNET' && otherPlayers.length > 0) {
    const pct = randInt(8, 15);
    const mutations = [];
    let totalSucked = 0;
    otherPlayers.forEach((p) => {
      if (p.walletBalance > 20) {
        const drain = Math.max(10, Math.round((p.walletBalance * pct) / 100));
        totalSucked += drain;
        mutations.push(mutDelta(p, -drain, `🧲 โดนแม่เหล็กของ ${myTitle} ดูดเงิน ${pct}%`, true));
      }
    });
    if (totalSucked === 0) totalSucked = randInt(25, 55) * 10;
    return pack(
      'MIRACLE', '🧲 ปาฏิหาริย์แม่เหล็กดึงดูดทรัพย์',
      `ดูดเงินจากกระเป๋าเพื่อนทั้งเซิร์ฟเวอร์คนละ ${pct}% เข้ากระเป๋าคุณสำเร็จ!`,
      'ปั่นเจอแม่เหล็กนีโอไดเมียมทรงพลัง! ดูดเหรียญทองจากกระเป๋าเพื่อนๆ ทั้งเซิร์ฟเวอร์ปลิววืดมาเข้ากระเป๋าคุณคนเดียวเลยค่ะ เตรียมตัวโดนรุมทวงในแชทได้เลยนะคะ',
      totalSucked,
      `เปิดเครื่องแม่เหล็กดูดเงินในกระเป๋าเพื่อนทั้งร้านคนละ ${pct}% จำนวน ${mutations.length} คน รวมได้เงิน +${totalSucked.toLocaleString()} = ยอดได้รับสุทธิ +${totalSucked.toLocaleString()} เหรียญทอง`,
      [['🧲', `ดูด ${pct}%!`, 'แม่เหล็กนีโอไดเมียม', 'miracle'], ['🌪️', `${mutations.length} กระเป๋า`, 'เหรียญปลิวว่อนทั้งร้าน', 'miracle'], ['💰', `+${totalSucked.toLocaleString()}`, 'เข้ากระเป๋าคุณคนเดียว!', 'miracle']],
      mutations, { stampId: 'MC_MAGNET' }
    );
  }

  // 2. 🪓 ลูกกระจ๊อกล้มยักษ์ (ยึด 35% จากสุลต่าน 3 อันดับแรก — ทะลุถึงธนาคารได้!)
  if (chosen === 'DAVID_VS_GOLIATH' && otherPlayers.length > 0) {
    const top3 = [...otherPlayers]
      .filter((p) => (Number(p.walletBalance || 0) + Math.max(0, Number(p.bankBalance || 0))) > 150)
      .sort((a, b) => (b.walletBalance + (b.bankBalance || 0)) - (a.walletBalance + (a.bankBalance || 0)))
      .slice(0, 3);
    if (top3.length > 0) {
      let totalSeized = 0;
      const mutations = [];
      const names = [];
      top3.forEach((s) => {
        const sRef = computeRiskRefBase(s.walletBalance, s.bankBalance);
        const cut = Math.min(1800, Math.max(40, Math.round(sRef * 0.35)));
        totalSeized += cut;
        names.push(formatFriendTitle(s));
        mutations.push(mutDelta(s, -cut, `🪓 โดน ${myTitle} ปฏิวัติยึดทรัพย์สุลต่าน 35%`, false));
      });
      const myShare = Math.round(totalSeized * 0.85);
      const burnedRevolution = totalSeized - myShare;
      return pack(
        'MIRACLE', '🪓 ปาฏิหาริย์ลูกกระจ๊อกล้มยักษ์',
        `ยึดทรัพย์ 35% จากสุลต่าน 3 อันดับแรกมาเข้ากระเป๋าคุณ +${myShare.toLocaleString()} เหรียญ!`,
        'ประกายไฟแห่งการปฏิวัติจุดติดแล้ว! ปั่นเจอตรากองกำลังโค่นล้มมหาเศรษฐี ยึดทรัพย์สุลต่านอันดับต้นๆ ในร้าน (ทะลุถึงธนาคาร!) มาแบ่งให้คุณเน้นๆ เลยค่ะ',
        myShare,
        `ยึดทรัพย์ 35% จากสุลต่าน ${names.join(' และ ')} รวม ${totalSeized.toLocaleString()} เหรียญ (ค่าปฏิวัติเผาทิ้ง ${burnedRevolution.toLocaleString()}) ➔ คุณได้รับสุทธิ +${myShare.toLocaleString()} เหรียญทอง`,
        [['🚩', 'ปฏิวัติ!', 'ลูกกระจ๊อกล้มยักษ์', 'miracle'], ['👑', 'ยึดสุลต่าน 35%', 'โค่นบัลลังก์มหาเศรษฐี', 'miracle'], ['💎', `+${myShare.toLocaleString()}`, 'รับส่วนแบ่งเต็มๆ!', 'miracle']],
        mutations, { stampId: 'MC_GOLIATH', burnedExtra: burnedRevolution }
      );
    }
  }

  // 3. 💣 ระเบิดเวลาสลับหนี้
  if (chosen === 'DEBT_TIME_BOMB' && otherPlayers.length > 0) {
    const v = pickRandom(otherPlayers);
    const vTitle = formatFriendTitle(v);
    if (startBal < 0) {
      const debtAmt = Math.abs(startBal);
      return pack(
        'MIRACLE', '💣 ปาฏิหาริย์ระเบิดเวลาสลับหนี้',
        `โยนหนี้ทั้งหมดไปให้ "${vTitle}" รับจบแทนสำเร็จ!`,
        `วิชามารสะท้อนกลับ! อเลสเทียเสกระเบิดเวลาหนี้สินผูกติดเอว "${vTitle}" แล้วปลดหนี้ให้คุณเป็น 0 ป่านนี้เพื่อนคงนั่งร้องไห้โฮแล้วค่ะ`,
        debtAmt,
        `โยนหนี้ทั้งหมด -${debtAmt.toLocaleString()} ไปใส่บัญชีของ ${vTitle} ส่วนกระเป๋าคุณล้างหนี้เป็น 0 = ยอดได้รับสุทธิ +${debtAmt.toLocaleString()} เหรียญทอง`,
        [['💸', `${startBal.toLocaleString()}`, 'หนี้สินเดิมของคุณ', 'tax'], ['💣', 'โยนระเบิดหนี้!', `เป้าหมายคือ ${vTitle}`, 'miracle'], ['✨', 'เหลือ 0!', `${vTitle} รับหนี้แทน!`, 'miracle']],
        [mutDelta(v, -debtAmt, `💣 โดน ${myTitle} โยนระเบิดหนี้ใส่`, false)],
        { stampId: 'MC_BOMB_DEBT' }
      );
    }
    return pack(
      'MIRACLE', '💣 ปาฏิหาริย์ระเบิดเวลาดูดทรัพย์',
      `ปาระเบิดใส่บัญชี "${vTitle}" กวาดเหรียญมา +450 เหรียญสำเร็จ!`,
      `เพราะคุณไม่มีหนี้ให้โยน อเลสเทียเลยดัดแปลงระเบิดเวลาไปผูกติดบัญชีของ "${vTitle}" แทน พอระเบิดทำงาน เหรียญทองของเขาก็กระเด็นเข้ากระเป๋าคุณ 450 เหรียญทันทีค่ะ`,
      450,
      `ปาระเบิดเวลาใส่บัญชีของ ${vTitle} ดูดเงินมา +450 เหรียญ หักจากเพื่อนจริง! = ยอดได้รับสุทธิ +450 เหรียญทอง`,
      [['💣', 'ตั้งเวลา!', 'ระเบิดดูดทรัพย์สิน', 'miracle'], ['💥', vTitle, 'กระเป๋าฉีกกระจาย', 'miracle'], ['🪙', '+450', 'เหรียญกระเด็นเข้ามือคุณ!', 'miracle']],
      [mutDelta(v, -450, `💣 โดน ${myTitle} ปาระเบิดดูดทรัพย์`, false)],
      { stampId: 'MC_BOMB_LOOT' }
    );
  }

  // 4. 🪞 กระจกเงาสะท้อนดวง (เฉพาะกระเป๋า — ธนาคารปลอดภัย)
  if (chosen === 'MIRROR_COPY_CAT' && otherPlayers.length > 0) {
    const t = pickRandom(otherPlayers);
    const tTitle = formatFriendTitle(t);
    const copiedBal = Number(t.walletBalance || 0);
    const netDelta = copiedBal - startBal;
    return pack(
      netDelta >= 0 ? 'MIRACLE' : 'DIVIDER', '🪞 ปาฏิหาริย์กระจกเงาสะท้อนดวง',
      `ก็อปปี้ยอดกระเป๋าตังค์ของ "${tTitle}" มาเป็นของคุณสำเร็จ!`,
      `คุณใช้กระจกเวทมนตร์ส่องกระเป๋าตังค์ของ "${tTitle}" แล้วก็อปปี้ตัวเลขเงินสดของเขามาเป็นของคุณเป๊ะๆ โดยที่เงินเพื่อนและเงินธนาคารไม่กระทบเลยค่ะ`,
      netDelta,
      `กระเป๋ามี ${startBal.toLocaleString()} ➔ ก็อปปี้ยอดกระเป๋าของ ${tTitle} (${copiedBal.toLocaleString()}) = ${netDelta >= 0 ? 'ยอดได้รับสุทธิ +' + netDelta.toLocaleString() : 'ยอดหักสุทธิ ' + netDelta.toLocaleString()} เหรียญทอง`,
      [['🪞', 'กระจกเวทมนตร์', `ส่องกระเป๋า ${tTitle}`, 'miracle'], ['📋', 'คัดลอกตัวเลข!', 'เงินเพื่อนไม่ลดลงเลย!', 'miracle'], ['✨', `= ${copiedBal.toLocaleString()}`, 'ก็อปปี้ยอดกระเป๋าสำเร็จ!', 'miracle']],
      undefined, { stampId: 'MC_MIRROR', walletOnly: true, skipTipJarSink: true }
    );
  }

  // 5. 🦈 ปลาดุกยิงหนี้กระจาย
  if (chosen === 'SPREAD_THE_LOVE_DEBT' && otherPlayers.length > 0) {
    const totalDebt = startBal < 0 ? Math.abs(startBal) : randInt(25, 50) * 10;
    const share = Math.max(15, Math.round(totalDebt / otherPlayers.length));
    return pack(
      'MIRACLE', '🦈 ปาฏิหาริย์ปลาดุกยิงหนี้กระจาย',
      `หั่นบิลค่าใช้จ่ายแจกเพื่อนทั้งร้านช่วยกันจ่ายคนละ ${share.toLocaleString()} เหรียญ!`,
      'ปลาดุกเวทมนตร์ช่วยหั่นบิลหนี้สินเป็นชิ้นเล็กชิ้นน้อยแล้วโปรยแจกเพื่อนๆ ทุกคนในร้านช่วยกันจ่ายคนละนิดคนละหน่อย น้ำใจคนไทยน่ารักจังเลยนะคะ',
      totalDebt,
      `กระจายภาระให้เพื่อน ${otherPlayers.length} คน ช่วยกันรับไปคนละ -${share.toLocaleString()} เหรียญ = ยอดได้รับสุทธิ +${totalDebt.toLocaleString()} เหรียญทอง`,
      [['🦈', 'ปลาดุกยิงหนี้!', `ยอดรวม ${totalDebt.toLocaleString()}`, 'miracle'], ['🍕', `หาร ${otherPlayers.length} คน`, `คนละ -${share.toLocaleString()} เหรียญ`, 'miracle'], ['🕊️', `+${totalDebt.toLocaleString()}`, 'เพื่อนรับจบให้ทั้งร้าน!', 'miracle']],
      otherPlayers.map((p) => mutDelta(p, -share, `🦈 โดนปลาดุกของ ${myTitle} แบ่งบิลมาให้ช่วยจ่าย`, false)),
      { stampId: 'MC_CATFISH' }
    );
  }

  // 6. ⚖️ สรรพากรเฉลี่ยสุข (เฉพาะเงินในกระเป๋า — ธนาคารปลอดภัย)
  if (chosen === 'COMMUNISM_EQUALIZER' && otherPlayers.length > 0) {
    const allSum = roster.reduce((acc, p) => acc + Number(p.walletBalance || 0), 0);
    const eqShare = Math.round(allSum / roster.length);
    const netDelta = eqShare - startBal;
    return pack(
      netDelta >= 0 ? 'MIRACLE' : 'DIVIDER', '⚖️ ปาฏิหาริย์สรรพากรเฉลี่ยสุข',
      `จับเงินในกระเป๋าทุกคนมารวมกันแล้วหารเฉลี่ยคนละ ${eqShare.toLocaleString()} เหรียญเท่ากันทั้งร้าน!`,
      'อเลสเทียสวมหมวกสรรพากร กวาดเหรียญทองในกระเป๋าของทุกคนมากองรวมกันแล้วเทหารเท่ากันเป๊ะ! (ส่วนใครฝากธนาคารไว้ยังรอดปลอดภัยค่ะ)',
      netDelta,
      `รวมเงินในกระเป๋าทั้งร้านได้ ${allSum.toLocaleString()} เหรียญ ➔ หารเฉลี่ย ${roster.length} คน ได้คนละ ${eqShare.toLocaleString()} เหรียญ! = ${netDelta >= 0 ? 'ยอดได้รับสุทธิ +' + netDelta.toLocaleString() : 'ยอดหักสุทธิ ' + netDelta.toLocaleString()} เหรียญทอง`,
      [['⚖️', 'รวมกองกลาง!', `${allSum.toLocaleString()} เหรียญ`, 'miracle'], ['🤝', `หาร ${roster.length} ชีวิต`, 'เฉพาะเงินในกระเป๋า', 'miracle'], ['🌟', `= ${eqShare.toLocaleString()}`, 'เท่ากันทุกคนทั้งร้าน!', 'miracle']],
      otherPlayers.map((p) => mutSetWallet(p, eqShare, `⚖️ สรรพากรเฉลี่ยสุขโดย ${myTitle}`)),
      { stampId: 'MC_COMMUNISM', walletOnly: true, skipTipJarSink: true }
    );
  }

  // 7. 🎰 รัสเซียนรูเล็ตต์กระเป๋าตังค์ (สายโหด: โอกาสโดนตัวเอง 40%!)
  if (chosen === 'RUSSIAN_ROULETTE' && otherPlayers.length >= 3) {
    const threeFriends = [...otherPlayers].sort(() => Math.random() - 0.5).slice(0, 3);
    const selfObj = activePlayerObj || { userId: activePlayerId, displayName: 'คุณ', walletBalance: startBal, bankBalance: startBank };
    const loser = Math.random() < 0.40 ? selfObj : pickRandom(threeFriends);
    const loserRef = computeRiskRefBase(loser.walletBalance, loser.bankBalance);
    const pot = Math.max(350, Math.round(loserRef * 0.75));
    const share = Math.round(pot / 3);
    if (loser.userId === activePlayerId) {
      return pack(
        'DIVIDER', '🎰 วิกฤตรัสเซียนรูเล็ตต์กระเป๋าตังค์',
        `กระสุนตกที่คุณพอดี! โดนริบทรัพย์ -${pot.toLocaleString()} ไปแบ่งให้เพื่อน 3 คน!`,
        'หมุนวงล้อรัสเซียนรูเล็ตต์คาเฟ่! น่าเสียดายที่กระสุนสุ่มมาตกที่คุณพอดี โดนริบทรัพย์นำไปแบ่งเค้กแจกจ่ายให้ผู้รอดชีวิตอีก 3 คนทันทีค่ะ',
        -pot,
        `เข้าวงล้อรัสเซียนรูเล็ตต์ 4 คน ➔ คุณเป็นผู้โชคร้ายโดนริบ -${pot.toLocaleString()} แบ่งให้เพื่อน 3 คน คนละ +${share.toLocaleString()} เหรียญ = ยอดหักสุทธิ -${pot.toLocaleString()} เหรียญทอง`,
        [['🔫', 'ผู้ท้าชิง 4 คน', 'หมุนลูกโม่วัดดวง', 'tax'], ['💥', 'ปัง! โดนคุณเต็มๆ', 'ริบทรัพย์เข้ากองกลาง', 'divide'], ['💸', `-${pot.toLocaleString()}`, 'แบ่งให้เพื่อน 3 คนรอดชีวิต!', 'divide']],
        threeFriends.map((f) => mutDelta(f, share, `🎰 ชนะรัสเซียนรูเล็ตต์รับส่วนแบ่งจาก ${myTitle}`, false)),
        { stampId: 'MC_ROULETTE_LOSE' }
      );
    }
    const loserTitle = formatFriendTitle(loser);
    return pack(
      'MIRACLE', '🎰 ปาฏิหาริย์รัสเซียนรูเล็ตต์กระเป๋าตังค์',
      `"${loserTitle}" โดนริบทรัพย์มาแบ่งให้คุณและเพื่อน +${share.toLocaleString()} เหรียญ!`,
      'หมุนวงล้อรัสเซียนรูเล็ตต์คาเฟ่! กระสุนสุ่มไปตกที่เป้าหมายดวงซวย โดนริบทรัพย์มาแบ่งเค้กให้คุณและผู้รอดชีวิตที่เหลือทันทีค่ะ',
      share,
      `กระสุนตกที่ ${loserTitle} ถูกริบ ${pot.toLocaleString()} เหรียญ แบ่งผู้รอดชีวิต 3 คน = ยอดได้รับสุทธิ +${share.toLocaleString()} เหรียญทอง`,
      [['🔫', 'ผู้ท้าชิง 4 คน', 'หมุนลูกโม่วัดดวง', 'miracle'], ['🎯', `โดน ${loserTitle}!`, 'ถูกริบทรัพย์เข้ากองกลาง', 'miracle'], ['🍰', `+${share.toLocaleString()}`, 'ส่วนแบ่งผู้รอดชีวิต!', 'miracle']],
      threeFriends.map((f) =>
        f.userId === loser.userId
          ? mutDelta(f, -pot, `🎰 แพ้รัสเซียนรูเล็ตต์ (วงของ ${myTitle})`, false)
          : mutDelta(f, share, `🎰 รอดชีวิตรัสเซียนรูเล็ตต์รับส่วนแบ่งจาก ${loserTitle}`, false)
      ),
      { stampId: 'MC_ROULETTE_WIN' }
    );
  }

  // 8. 💸 มหาทานบาริสต้า
  if (chosen === 'ALESTIA_RAIN_MAKER') {
    const rainGift = randInt(2, 6) * 100;
    return pack(
      'MIRACLE', '💸 ปาฏิหาริย์มหาทานบาริสต้า',
      `อเลสเทียโปรยเงินแจกทุกคนในเซิร์ฟเวอร์คนละ +${rainGift.toLocaleString()} เหรียญ!`,
      'อเลสเทียอารมณ์ดีขนถุงทองคำขึ้นชั้นลอยแล้วโปรยเหรียญลงมารดหัวทุกคนในคาเฟ่ ได้รับเงินขวัญถุงกันถ้วนหน้าเลยค่ะ',
      rainGift,
      `อเลสเทียโปรยทานแจกผู้เล่นทั้งร้าน ${roster.length} คน คนละ +${rainGift.toLocaleString()} เหรียญ = ยอดได้รับสุทธิ +${rainGift.toLocaleString()} เหรียญทอง`,
      [['☕', 'ยอดขายทะลุเป้า!', 'อเลสเทียอารมณ์ดีจัด', 'miracle'], ['🌧️', 'ฝนเหรียญทองคำ!', `โปรยแจกทั้งร้าน ${roster.length} คน`, 'miracle'], ['💸', `+${rainGift.toLocaleString()}`, 'รวยถ้วนหน้าทั้งเซิร์ฟเวอร์!', 'miracle']],
      otherPlayers.map((p) => mutDelta(p, rainGift, `🌧️ รับฝนเหรียญมหาทานบาริสต้า (จากรอบของ ${myTitle})`, false)),
      { stampId: 'MC_RAIN_MAKER' }
    );
  }

  // 9. ⛓️ สัญญาผูกมิตรโซ่ล่ามชะตา
  if (chosen === 'SOUL_BOND_TWINS' && otherPlayers.length > 0) {
    const partner = pickRandom(otherPlayers);
    const partnerTitle = formatFriendTitle(partner);
    const bondBonus = randInt(20, 45) * 10;
    if (!worldState.soulBonds || typeof worldState.soulBonds !== 'object') worldState.soulBonds = {};
    worldState.soulBonds[activePlayerId] = partner.userId;
    worldState.soulBonds[partner.userId] = activePlayerId;
    return pack(
      'MIRACLE', '⛓️ สัญญาผูกมิตรโซ่ล่ามชะตา',
      `ร้อยด้ายแดงผูกดวงร่วมกับ "${partnerTitle}" สำเร็จ!`,
      `รอบสล็อตนี้ผูกดวงของคุณเข้ากับ "${partnerTitle}" ในการปั่นรอบถัดไป 1 ครั้ง ไม่ว่าใครจะได้หรือเสียหนักแค่ไหน อีกฝ่ายจะรับผล 50% ตามไปด้วยทันทีค่ะ`,
      bondBonus,
      `ผูกโซ่ล่ามชะตากับ ${partnerTitle} แชร์ผลบวกและลบ 50% ในรอบถัดไป ➔ รับโบนัสคนละ +${bondBonus.toLocaleString()} เหรียญ = ยอดได้รับสุทธิ +${bondBonus.toLocaleString()} เหรียญทอง`,
      [['🧶', 'ด้ายแดงทำงาน!', 'มีผล 1 ครั้งในรอบถัดไป', 'miracle'], ['⛓️', partnerTitle, 'แชร์ผลบวกและลบ 50%!', 'miracle'], ['💞', `+${bondBonus.toLocaleString()}`, 'รับโบนัสคู่หูชะตาแฝด!', 'miracle']],
      [mutDelta(partner, bondBonus, `⛓️ รับโบนัสผูกโซ่ล่ามชะตากับ ${myTitle}`, false)],
      { isNewSoulBond: true, stampId: 'MC_SOUL_BOND' }
    );
  }

  // 10. 🔄 ยืนสลับตำแหน่งย้อนศร (สลับเฉพาะกระเป๋าตังค์ — ธนาคารปลอดภัย)
  if (chosen === 'REVERSE_RANK_SWAP' && roster.length >= 2) {
    const sortedAll = [...roster].sort((a, b) => b.walletBalance - a.walletBalance);
    const top1 = sortedAll[0];
    const botLast = sortedAll[sortedAll.length - 1];
    if (top1 && botLast && top1.userId !== botLast.userId && top1.walletBalance !== botLast.walletBalance) {
      const topTitle = formatFriendTitle(top1);
      const botTitle = formatFriendTitle(botLast);
      const topOld = top1.walletBalance;
      const botOld = botLast.walletBalance;
      let myNetDelta = 300;
      let mutations = [
        mutSetWallet(top1, botOld, `🔄 สลับกระเป๋าอันดับ 1 กับ ${botTitle}`),
        mutSetWallet(botLast, topOld, `🔄 สลับกระเป๋าอันดับบ๊วยกับ ${topTitle}`)
      ];
      if (activePlayerId === top1.userId) {
        myNetDelta = botOld - startBal;
        mutations = [mutSetWallet(botLast, topOld, `🔄 สลับกระเป๋าอันดับบ๊วยกับ ${topTitle}`)];
      } else if (activePlayerId === botLast.userId) {
        myNetDelta = topOld - startBal;
        mutations = [mutSetWallet(top1, botOld, `🔄 สลับกระเป๋าอันดับ 1 กับ ${botTitle}`)];
      }
      return pack(
        myNetDelta >= 0 ? 'MIRACLE' : 'DIVIDER', '🔄 ปาฏิหาริย์ยืนสลับตำแหน่งย้อนศร',
        `สลับกระเป๋าอันดับ 1 "${topTitle}" กับอันดับสุดท้าย "${botTitle}" ทันที!`,
        'เทพธิดาจับกระเป๋าตังค์อันดับ 1 คว่ำลง แล้วยกอันดับบ๊วยสุดขึ้นมานั่งแทนที่ สลับยอดกระเป๋ากันแบบสายฟ้าแลบ (ส่วนเงินในธนาคารยังปลอดภัยค่ะ)',
        myNetDelta,
        `สลับยอดกระเป๋าของ ${topTitle} (${topOld.toLocaleString()}) กับ ${botTitle} (${botOld.toLocaleString()}) = ${myNetDelta >= 0 ? 'ยอดได้รับสุทธิ +' + myNetDelta.toLocaleString() : 'ยอดหักสุทธิ ' + myNetDelta.toLocaleString()} เหรียญทอง`,
        [['👑', topTitle, `เดิมมี ${topOld.toLocaleString()}`, 'miracle'], ['🔄', 'สลับขั้วกระเป๋า!', 'เงินธนาคารยังปลอดภัย', 'miracle'], ['🚀', botTitle, 'สลับยอดสำเร็จทันที!', 'miracle']],
        mutations, { stampId: 'MC_RANK_SWAP', walletOnly: true, skipTipJarSink: true }
      );
    }
  }

  // 11. 🔄 สลับกระเป๋าตังค์แบบสุ่ม (เฉพาะกระเป๋า — ธนาคารปลอดภัย)
  if (chosen === 'RANDOM_WALLET_SWAP' && otherPlayers.length > 0) {
    const diffCandidates = otherPlayers.filter((p) => p.walletBalance !== startBal);
    const f = pickRandom(diffCandidates.length > 0 ? diffCandidates : otherPlayers);
    const fTitle = formatFriendTitle(f);
    const fOld = Number(f.walletBalance || 0);
    const netDelta = fOld - startBal;
    return pack(
      'MIRACLE', '🔄 ปาฏิหาริย์สลับกระเป๋าตังค์',
      `สลับกระเป๋าตังค์กับ "${fTitle}" แบบสดๆ สำเร็จ!`,
      `อเลสเทียแอบหยิบกระเป๋าตังค์ของคุณไปสลับกับของ "${fTitle}" ที่วางอยู่บนโต๊ะข้างๆ (ส่วนเงินที่ฝากไว้ในธนาคารจะไม่ถูกสลับไปด้วยค่ะ)`,
      netDelta,
      `สลับกระเป๋าตังค์กับ ${fTitle} ที่มี ${fOld.toLocaleString()} เหรียญ (เงินธนาคารปลอดภัย) = ${netDelta >= 0 ? 'ยอดได้รับสุทธิ +' + netDelta.toLocaleString() : 'ยอดหักสุทธิ ' + netDelta.toLocaleString()} เหรียญทอง`,
      [['👛', `${startBal.toLocaleString()}`, 'กระเป๋าเดิมของคุณ', 'zero'], ['🔄', 'สลับกระเป๋า!', `คู่กรณีคือ ${fTitle}`, 'miracle'], ['🎭', `${fOld.toLocaleString()}`, `ได้กระเป๋า ${fTitle}!`, 'miracle']],
      [mutSetWallet(f, startBal, `🎭 โดน ${myTitle} สลับกระเป๋าตังค์`)],
      { stampId: 'MC_WALLET_SWAP', walletOnly: true, skipTipJarSink: true }
    );
  }

  // 12. 🥷 ปฏิบัติการปล้นสุลต่านอันดับ 1 (ฉก 30%–55% จากกระเป๋าสุลต่าน!)
  if (chosen === 'STEAL_SULTAN' && otherPlayers.length > 0) {
    const topSultan = [...otherPlayers].sort((a, b) => b.walletBalance - a.walletBalance)[0];
    if (topSultan && topSultan.walletBalance > 50) {
      const sTitle = formatFriendTitle(topSultan);
      const stealPct = pickRandom([30, 40, 50, 55]);
      const stolenAmt = Math.max(40, Math.round((topSultan.walletBalance * stealPct) / 100));
      return pack(
        'MIRACLE', '🥷 ปฏิบัติการปล้นสุลต่านอันดับ 1',
        `บุกขโมยเงินจากกระเป๋าของ "${sTitle}" สำเร็จ +${stolenAmt.toLocaleString()} เหรียญ!`,
        `คุณสวมหน้ากากจอมโจรย่องเข้าห้อง VIP ของสุลต่าน "${sTitle}" แล้วกวาดเหรียญทองในกระเป๋าของเขามาถึง ${stealPct}% โอนเข้ากระเป๋าคุณแบบเนียนกริบเลยค่ะ`,
        stolenAmt,
        `สุลต่าน ${sTitle} มีในกระเป๋า ${topSultan.walletBalance.toLocaleString()} ➔ ฉกมา ${stealPct}% ได้เงิน +${stolenAmt.toLocaleString()} เหรียญ! = ยอดได้รับสุทธิ +${stolenAmt.toLocaleString()} เหรียญทอง`,
        [['👑', sTitle, `มี ${topSultan.walletBalance.toLocaleString()} เหรียญ`, 'win'], ['🥷', `ฉกมา ${stealPct}%!`, 'ปฏิบัติการปล้นสุลต่าน', 'miracle'], ['💰', `+${stolenAmt.toLocaleString()}`, 'โอนเข้ากระเป๋าคุณ!', 'miracle']],
        [mutDelta(topSultan, -stolenAmt, `🥷 โดน ${myTitle} ย่องปล้นกระเป๋าสุลต่าน ${stealPct}%`, true)],
        { stampId: 'MC_STEAL_SULTAN' }
      );
    }
  }

  // 13. 🤪/🤩 รู้สึกว่าอยากจน / อยากรวย (เฉพาะกระเป๋า — โอกาสอยากจน 60% / อยากรวย 40%)
  if (chosen === 'WANT_RICH_POOR' && otherPlayers.length > 0) {
    const sorted = [...otherPlayers].sort((a, b) => b.walletBalance - a.walletBalance);
    const richest = sorted[0];
    const poorest = sorted[sorted.length - 1];
    if (Math.random() < 0.60 && poorest && startBal !== poorest.walletBalance) {
      const pTitle = formatFriendTitle(poorest);
      const pOld = Number(poorest.walletBalance || 0);
      const netDelta = pOld - startBal;
      return pack(
        'DIVIDER', '🤪 อีเวนต์ปาฏิหาริย์กลับตาลปัตร',
        `อยู่ดีๆ ก็รู้สึกว่าอยากจน เลยสลับกระเป๋ากับ "${pTitle}" ทันที!`,
        `คุณบ่นพึมพำว่าอยากลองใช้ชีวิตแบบคนจนดูบ้าง เทพธิดาเลยสลับกระเป๋าตังค์ของคุณกับ "${pTitle}" ทันทีเลยค่ะ (เงินในธนาคารไม่ถูกสลับ)`,
        netDelta,
        `สลับกระเป๋ากับ ${pTitle} ที่มี ${pOld.toLocaleString()} เหรียญ = ${netDelta >= 0 ? 'ยอดได้รับสุทธิ +' + netDelta.toLocaleString() : 'ยอดหักสุทธิ ' + netDelta.toLocaleString()} เหรียญทอง`,
        [['🥂', `${startBal.toLocaleString()}`, 'กระเป๋าเดิมของคุณ', 'win'], ['🤪', 'อยากจน!', `สลับกับ ${pTitle}`, 'divide'], ['🥣', `${pOld.toLocaleString()}`, 'สลับกระเป๋าสำเร็จ!', 'divide']],
        [mutSetWallet(poorest, startBal, `🤪 โดน ${myTitle} (ติสต์อยากจน) สลับกระเป๋าตังค์`)],
        { stampId: 'MC_WANT_POOR', walletOnly: true, skipTipJarSink: true }
      );
    } else if (richest && startBal !== richest.walletBalance) {
      const rTitle = formatFriendTitle(richest);
      const rOld = Number(richest.walletBalance || 0);
      const netDelta = rOld - startBal;
      return pack(
        'MIRACLE', '🤩 ปาฏิหาริย์ฟ้าประทานสลับบัลลังก์',
        `ตะโกนว่าอยากรวย เลยได้สลับกระเป๋ากับสุลต่าน "${rTitle}" ทันที!`,
        `คุณตะโกนลั่นร้านว่าอยากรวย! สวรรค์เลยสั่งสลับกระเป๋าตังค์ของคุณกับคนที่พกเงินสดเยอะที่สุดอย่าง "${rTitle}" ทันทีค่ะ (เงินในธนาคารไม่ถูกสลับ)`,
        netDelta,
        `สลับกระเป๋ากับสุลต่าน ${rTitle} ที่มี ${rOld.toLocaleString()} เหรียญ = ${netDelta >= 0 ? 'ยอดได้รับสุทธิ +' + netDelta.toLocaleString() : 'ยอดหักสุทธิ ' + netDelta.toLocaleString()} เหรียญทอง`,
        [['🙏', `${startBal.toLocaleString()}`, 'ตะโกนว่าอยากรวย!', 'zero'], ['🤩', 'สลับสุลต่าน!', `ยึดกระเป๋า ${rTitle}`, 'miracle'], ['👑', `${rOld.toLocaleString()}`, 'กลายเป็นเศรษฐีทันที!', 'miracle']],
        [mutSetWallet(richest, startBal, `🤩 โดน ${myTitle} (ตะโกนอยากรวย) สลับกระเป๋าตังค์`)],
        { stampId: 'MC_WANT_RICH', walletOnly: true, skipTipJarSink: true }
      );
    }
  }

  // 14. 👑 ขอทานเศรษฐี
  if (chosen === 'BEGGAR_BILLIONAIRE') {
    const megaGrant = randInt(9, 22) * 100;
    const debtForgiven = startBal < 0 ? Math.abs(startBal) : 0;
    const netDelta = debtForgiven + megaGrant;
    return pack(
      'MIRACLE', '👑 ปาฏิหาริย์ขอทานเศรษฐี',
      'มหาเศรษฐีลึกลับโยนหีบทองคำแท้ใส่ตัก รับทรัพย์ล้นกระเป๋า!',
      'มหาเศรษฐีลึกลับเดินผ่านโต๊ะของคุณแล้วโยนหีบทองคำแท้ใส่ตักให้ไปตั้งตัวเลยค่ะ',
      netDelta,
      debtForgiven > 0
        ? `ล้างหนี้ +${debtForgiven.toLocaleString()} จนเป็น 0 ➔ แถมขุมทรัพย์ +${megaGrant.toLocaleString()} = ยอดได้รับสุทธิ +${netDelta.toLocaleString()} เหรียญทอง`
        : `ได้รับหีบทองคำขอทานเศรษฐี +${megaGrant.toLocaleString()} = ยอดได้รับสุทธิ +${megaGrant.toLocaleString()} เหรียญทอง`,
      [['🥣', 'โชคชะตา...', 'จุดเปลี่ยนแห่งชีวิต', 'zero'], ['⚡', 'ปาฏิหาริย์!', 'ฟ้าผ่ากลางคาเฟ่', 'miracle'], ['👑', `+${megaGrant.toLocaleString()}`, 'ขอทานเศรษฐี!', 'miracle']],
      undefined, { stampId: 'MC_BEGGAR_KING' }
    );
  }

  // 15. ☯️ ชะตาเล่นตลก (พลิกขั้วเฉพาะเงินในกระเป๋า — ธนาคารปลอดภัย)
  if (chosen === 'POLARITY_FLIP') {
    if (startBal === 0) {
      const chaosVal = Math.random() < 0.4 ? 555 : -555;
      return pack(
        chaosVal > 0 ? 'MIRACLE' : 'DIVIDER', '☯️ ปาฏิหาริย์ชะตาเล่นตลก',
        `เสกเลขตองเสียงหัวเราะ ${chaosVal > 0 ? '+555' : '-555'} ใส่กระเป๋าตังค์!`,
        'เปิดมาเจอกระเป๋าว่างเปล่า 0 เหรียญ ชะตาเลยหัวเราะ 555 แล้วเสกเหรียญเลขตองใส่กระเป๋าแทนค่ะ',
        chaosVal,
        `กระเป๋ามี 0 เหรียญ ➔ ชะตาเสกเลขตอง ${chaosVal > 0 ? '+555' : '-555'} = ${chaosVal > 0 ? 'ยอดได้รับสุทธิ +555' : 'ยอดหักสุทธิ -555'} เหรียญทอง`,
        [['🎭', '0', 'กระเป๋าว่างเปล่า', 'zero'], ['🌀', 'พลิกขั้ว!', 'ชะตาเล่นตลก', 'miracle'], ['🃏', `${chaosVal > 0 ? '+555' : '-555'}`, 'เสียงหัวเราะแห่งโชค!', 'miracle']],
        undefined, { stampId: 'MC_POLARITY_ZERO', walletOnly: true }
      );
    }
    const flippedBal = -startBal;
    const netDelta = flippedBal - startBal;
    return pack(
      startBal < 0 ? 'MIRACLE' : 'DIVIDER', '☯️ ปาฏิหาริย์ชะตาเล่นตลก',
      startBal < 0 ? 'พลิกขั้วหนี้สินติดลบทั้งหมดให้กลายเป็นเงินสดเต็มจำนวน!' : 'เงินบวกในกระเป๋าถูกกระจกมนตราพลิกกลับด้านกลายเป็นหนี้!',
      startBal < 0
        ? 'กระจกเวทมนตร์สะท้อนยอดหนี้ติดลบของคุณให้พลิกกลับขั้วกลายเป็นเงินบวกเต็มจำนวน ยิ่งเคยเป็นหนี้เยอะยิ่งรวยเละค่ะ'
        : 'โชคชะตาเล่นตลกร้าย เสกให้เงินบวกในกระเป๋าของคุณพลิกกลับด้านกลายเป็นหนี้ในพริบตา (ส่วนเงินในธนาคารยังปลอดภัยดีค่ะ)',
      netDelta,
      startBal < 0
        ? `พลิกหนี้ ${startBal.toLocaleString()} กลายเป็นเงินสด +${flippedBal.toLocaleString()} = ยอดได้รับสุทธิ +${netDelta.toLocaleString()} เหรียญทอง`
        : `พลิกเงินในกระเป๋า +${startBal.toLocaleString()} กลับด้านเป็น ${flippedBal.toLocaleString()} (เงินธนาคารปลอดภัย) = ยอดหักสุทธิ ${netDelta.toLocaleString()} เหรียญทอง`,
      [['🪞', `${startBal.toLocaleString()}`, 'ขั้วการเงินเดิม', startBal < 0 ? 'tax' : 'win'], ['☯️', 'สลับขั้ว!', 'เฉพาะเงินในกระเป๋า', 'miracle'], ['⚡', `${flippedBal > 0 ? '+' : ''}${flippedBal.toLocaleString()}`, 'ชะตาเล่นตลก!', 'miracle']],
      undefined, { stampId: startBal < 0 ? 'MC_POLARITY_PLUS' : 'MC_POLARITY_MINUS', walletOnly: true, skipTipJarSink: true }
    );
  }

  // 16. 👼 อเลสเทียปลดหนี้
  if (chosen === 'ALESTIA_DEBT_CLEAR') {
    if (startBal < 0) {
      const debtCleared = Math.abs(startBal);
      return pack(
        'MIRACLE', '👼 ปาฏิหาริย์อเลสเทียปลดหนี้',
        'อเลสเทียเผาสมุดบัญชีหนี้ทิ้ง ล้างหนี้เป็น 0 ทันที!',
        'อเลสเทียทนเห็นคุณแบกหนี้ไม่ไหว เลยแอบเอาสมุดบัญชีหนี้ของคุณไปเผาไฟทิ้งให้ทั้งหมดแล้วค่ะ เริ่มต้นชีวิตใหม่แบบไร้หนี้กันนะคะ',
        debtCleared,
        `อเลสเทียล้างหนี้ทั้งหมด +${debtCleared.toLocaleString()} เหรียญ เหลือ 0 ทันที! = ยอดได้รับสุทธิ +${debtCleared.toLocaleString()} เหรียญทอง`,
        [['💸', `${startBal.toLocaleString()}`, 'หนี้สินคงค้าง', 'tax'], ['🔥', 'เผาสัญญา!', 'อเลสเทียเมตตา', 'miracle'], ['👼', 'ปลดหนี้ 100%', 'ล้างหนี้เป็น 0 ทันที!', 'miracle']],
        undefined, { stampId: 'MC_DEBT_CLEAR' }
      );
    }
    return pack(
      'ZERO', '👼 อีเวนต์อเลสเทียปลดหนี้',
      'สิทธิ์ปลดหนี้ไร้ผลเนื่องจากคุณไม่ได้เป็นหนี้ค่ะ!',
      'เปิดดูสมุดบัญชีแล้วคุณไม่ได้ติดหนี้คาเฟ่เลยแม้แต่เหรียญเดียว สล็อตรอบนี้จึงไร้ผลค่ะ',
      0,
      `ไม่ได้ติดหนี้คาเฟ่เลยสักเหรียญ ➔ อเลสเทียเก็บยางลบตามเดิม = ยอดได้รับสุทธิ 0 เหรียญทอง`,
      [['✨', `${startBal.toLocaleString()}`, 'ไร้หนี้สิน', 'win'], ['👼', 'ปลดหนี้', 'ตรวจสอบบัญชี...', 'miracle'], ['🫧', 'ไร้ผล 0', 'คุณไม่ได้เป็นหนี้ค่ะ!', 'zero']],
      undefined, { stampId: 'MC_DEBT_NOOP' }
    );
  }

  // 17. 🔨 อเลสเทียยึดทรัพย์สิน (อายัดทั้งกระเป๋าและธนาคาร + เผา 70% ทิ้งถาวร!)
  if (chosen === 'ALESTIA_SEIZURE') {
    const walletDelta = 1 - startBal;
    const seizedWallet = startBal > 1 ? startBal - 1 : 0;
    const totalSeized = seizedWallet + startBank;
    const netCombinedDelta = walletDelta - startBank;

    let droppedAmt = 0;
    let burnedAmt = 0;
    if (totalSeized > 100) {
      droppedAmt = Math.round(totalSeized * 0.30);
      burnedAmt = totalSeized - droppedAmt;
      recordLostWallet(worldState, myTitle, droppedAmt, 'โดนอเลสเทียอายัดทรัพย์แล้วทำหล่นไว้หน้าเคาน์เตอร์');
    } else if (totalSeized > 0) {
      burnedAmt = totalSeized;
    }

    const hadAssets = totalSeized > 0;
    const bankPartText = startBank > 0 ? ` พร้อมอายัดบัญชีธนาคาร -${startBank.toLocaleString()} เหรียญจนเกลี้ยง` : '';

    return pack(
      hadAssets ? 'DIVIDER' : 'MIRACLE',
      '🔨 คำสั่งเด็ดขาดอเลสเทียยึดทรัพย์สิน',
      startBank > 0
        ? 'อายัดทั้งกระเป๋าและบัญชีธนาคารเข้าคลังคาเฟ่ เหลือติดตัว 1 เหรียญทันที!'
        : 'ยึดทรัพย์เข้าคลังคาเฟ่ เหลือเงินติดกระเป๋าไว้ให้ 1 เหรียญทองทันที!',
      hadAssets
        ? `ประกาศกฎอัยการศึกประจำคาเฟ่ค่ะ! อเลสเทียสั่งยึดทรัพย์สินในกระเป๋า${bankPartText}เข้าคลังหลวงทั้งหมด (เผาลดเงินเฟ้อ 70%) แล้วเหลือเหรียญทองติดก้นถุงไว้ให้ดูต่างหน้า 1 เหรียญถ้วนนะคะ อิอิ`
        : 'อเลสเทียบุกมายึดทรัพย์สิน แต่เปิดดูทั้งกระเป๋าและธนาคารมีแต่หนี้กับความว่างเปล่า เลยยึดหนี้ไปแทนแล้ววางเหรียญทอง 1 เหรียญไว้ให้ตั้งตัวค่ะ',
      netCombinedDelta,
      `กระเป๋า ${startBal.toLocaleString()} + ธนาคาร ${startBank.toLocaleString()} ➔ ยึดทรัพย์ทั้งสองบัญชีเหลือติดกระเป๋า 1 เหรียญ และธนาคาร 0 เหรียญ! = ${netCombinedDelta >= 0 ? 'ยอดสุทธิ +' + netCombinedDelta.toLocaleString() : 'ยอดหักสุทธิ ' + netCombinedDelta.toLocaleString()} เหรียญทอง`,
      [
        ['🚨', 'กฎอัยการศึก!', 'อายัดทั้งกระเป๋า & ธนาคาร', 'tax'],
        ['🏦', startBank > 0 ? `ริบ -${startBank.toLocaleString()}` : 'กวาดเรียบ!', 'หนีไม่พ้นคำสั่งยึดทรัพย์', 'divide'],
        ['🔨', 'เหลือ 1 เหรียญ', 'ไว้ดูต่างหน้าค่ะ!', 'miracle']
      ],
      undefined,
      { stampId: 'MC_SEIZURE', seizeBank: true, txType: 'SEIZURE', skipTipJarSink: true, burnedExtra: burnedAmt }
    );
  }

  // 18. 🎰 สล็อตเรียงตอง 777
  if (chosen === 'CAFE_LOTTO_777') {
    const prize = Math.random() < 0.25 ? 4777 : 2222;
    return pack(
      'JACKPOT', '🎰 ปาฏิหาริย์สล็อตเรียงตอง 777',
      `ปั่นเจอเลขตองมงคล 777 รับทรัพย์ก้อนใหญ่ +${prize.toLocaleString()} เหรียญทอง!`,
      'เสียงระฆังทองคำดังลั่นร้าน! คุณปั่นสล็อตเจอเลขตองมงคลประจำคาเฟ่ Horizon รับเงินรางวัลแจ็กพอตใหญ่ไปนอนกอดได้เลยค่ะ',
      prize,
      `ปั่นเจอเลขตองมงคลครบ 3 ช่อง ➔ รับรางวัลแจ็กพอต +${prize.toLocaleString()} เหรียญ = ยอดได้รับสุทธิ +${prize.toLocaleString()} เหรียญทอง`,
      [['7️⃣', 'LUCKY', 'เรียงตองช่องที่ 1', 'mult'], ['7️⃣', 'TRIPLE', 'เรียงตองช่องที่ 2', 'mult'], ['7️⃣', `+${prize.toLocaleString()}`, 'แจ็กพอตตองแตก!', 'miracle']],
      undefined, { stampId: 'MC_LOTTO_777' }
    );
  }

  // 19. 🛡️ เคลมประกันภัยคาเฟ่
  if (chosen === 'DEBT_INSURANCE') {
    const clearAmt = startBal < 0 ? Math.abs(startBal) : 0;
    const netDelta = clearAmt + 777;
    return pack(
      'MIRACLE', '🛡️ ปาฏิหาริย์เคลมประกันภัยคาเฟ่',
      clearAmt > 0 ? 'อนุมัติสินไหมล้างหนี้หมดจด แถมเงินขวัญถุง +777 เหรียญทอง!' : 'รับเงินปันผลกรมธรรม์เลขมงคล +777 เหรียญทอง!',
      'บริษัทประกันภัย Horizon อนุมัติสินไหมทดแทนพิเศษให้คุณแล้วค่ะ! มอบเงินขวัญถุง 777 เหรียญทองเข้ากระเป๋าทันทีค่ะ',
      netDelta,
      clearAmt > 0
        ? `ประกันเคลมหนี้ +${clearAmt.toLocaleString()} จนเป็น 0 ➔ แถมขวัญถุง +777 = ยอดได้รับสุทธิ +${netDelta.toLocaleString()} เหรียญทอง`
        : `ได้รับเงินปันผลกรมธรรม์ +777 เหรียญ = ยอดได้รับสุทธิ +777 เหรียญทอง`,
      [['🏥', 'เคลมประกัน!', clearAmt > 0 ? `ล้างหนี้ +${clearAmt.toLocaleString()}` : 'โบนัสกรมธรรม์', 'miracle'], ['🛡️', 'อนุมัติ 100%', 'กองทุนช่วยเหลือ', 'miracle'], ['🧧', '+777', 'รับเงินขวัญถุง!', 'miracle']],
      undefined, { stampId: 'MC_INSURANCE' }
    );
  }

  // 20. 🏹 กองทุนโรบินฮู้ด
  const aidAmt = randInt(5, 11) * 100;
  return pack(
    'MIRACLE', '🏹 ปาฏิหาริย์กองทุนโรบินฮู้ด',
    `รับถุงเงินกระจายความมั่งคั่ง +${aidAmt.toLocaleString()} เหรียญทอง!`,
    'จอมโจรโรบินฮู้ดแห่งคาเฟ่แอบโปรยถุงเหรียญทองลงมาจากชั้นลอย โชคดีที่หล่นใส่ตักคุณพอดิบพอดีเลยค่ะ',
    aidAmt,
    `ถุงเงินของโรบินฮู้ดหล่นใส่ตักพอดี รับไป +${aidAmt.toLocaleString()} เหรียญ = ยอดได้รับสุทธิ +${aidAmt.toLocaleString()} เหรียญทอง`,
    [['🏹', 'โรบินฮู้ด', 'โปรยทานกลางคาเฟ่', 'miracle'], ['✨', 'รับเต็มๆ!', 'หล่นใส่ตักพอดี', 'miracle'], ['🎁', `+${aidAmt.toLocaleString()}`, 'รับทรัพย์ก้อนโต!', 'miracle']],
    undefined, { stampId: 'MC_ROBIN_HOOD' }
  );
};

// ==========================================
// 🏥 5. เครื่องยนต์ค่าใช้จ่ายชีวิตประจำวัน & พลิกวิกฤต (20% • เสีย 80% / ได้ 20%)
// ==========================================
const generateDailyExpenseEvent = (startBal, startBank) => {
  const isBoon = Math.random() < 0.20;
  const list = isBoon ? DAILY_BOON_TUPLE : DAILY_EXPENSE_TUPLE;
  const idx = Math.floor(Math.random() * list.length);
  return compileCatalogTuple(list[idx], startBal, startBank, isBoon, (isBoon ? 'BN_' : 'EX_') + String(idx + 1).padStart(2, '0'));
};

// ==========================================
// 🎰 6. เครื่องยนต์หลัก: สุ่มผลสล็อต 3 ช่อง (เรทสายโหดระดับตึง ~58% เสีย)
// ==========================================
const calculateSlotOutcome = (currentBalance = 0, activePlayerId = '', roster = [], worldState = null) => {
  const state = worldState || {
    landmarks: DEFAULT_LANDMARKS_META.map((m) => ({ ...m, ownerId: null, ownerName: '', tier: 0, curtainClosed: false })),
    lostWallets: [],
    timeCapsule: null,
    cursedTipJar: 400,
    soulBonds: {}
  };

  const activePlayerObj = roster.find((p) => p.userId === activePlayerId);
  const startBal = Number(currentBalance || 0);
  const startBank = Math.max(0, Number(activePlayerObj?.bankBalance || 0));
  const roll = Math.random() * 100;
  let result = null;

  // สัดส่วนสายโหดระดับตึง:
  // 0–22  (22%) : 🏰 แลนด์มาร์กริมหน้าต่าง 5 โซน
  // 22–40 (18%) : 🤝 พบปะเพื่อน & ยืมเงินฉบับสายโหด (32% ได้ / 68% เสียหนัก)
  // 40–57 (17%) : 🌟 ปาฏิหาริย์ มัลติเพลเยอร์ กับดักความโลภ & ตรรกะวิบัติ
  // 57–77 (20%) : 🏥 ค่าใช้จ่ายประจำวัน (80% เสีย / 20% พลิกวิกฤต)
  // 77–87 (10%) : 🏦 เจาะตู้เซฟธนาคาร / 🪓 ขวานผ่า / 🥷 โจรย่องเบา
  // 87–91 ( 4%) : 🤑 แจ็กพอตมาตรฐาน
  // 91–96 ( 5%) : 🎉 ดวงดีมาตรฐาน
  // 96–100( 4%) : 💨 ดวงเกลือ / คูณศูนย์
  if (roll < 22) result = generateWindowLandmarkEvent(startBal, startBank, activePlayerId, roster, state);
  else if (roll < 40) result = generateBrutalSocialLoanEvent(startBal, startBank, activePlayerId, roster, state);
  else if (roll < 57) result = generateMiracleChaosEvent(startBal, startBank, activePlayerId, roster, state);
  else if (roll < 77) result = generateDailyExpenseEvent(startBal, startBank);
  else if (roll < 87) result = generateBankRaidAndHeistEvent(startBal, startBank, activePlayerId, roster);
  else {
    const gainBase = startBal > 0 ? startBal : BASE_ECONOMIC_UNIT;

    // หมวด JACKPOT (4%)
    if (roll < 91) {
      if (Math.random() < 0.6) {
        const s1 = randInt(6, 13) * 10;
        const s2 = randInt(6, 14) * 10;
        const mult = pickRandom([2, 2, 3, 4]);
        const rawSum = s1 + s2;
        const multVal = rawSum * mult;
        const boost = Math.min(1800, Math.round(gainBase * (mult >= 3 ? 0.30 : 0.18)));
        const netDelta = Math.round(multVal + boost);
        result = pack(
          'JACKPOT', '🤑 แจ็กพอตแตกประจำคาเฟ่', `รวยฟ้าผ่า รับรางวัลทวีคูณ ${mult} เท่าตัว!`, pickRandom(FLAVOR_MESSAGES.JACKPOT), netDelta,
          `ช่องแรกได้ +${s1} รวมกับช่องสอง +${s2} ได้ ${rawSum} เหรียญ ➔ นำไป × ${mult} ได้ ${multVal.toLocaleString()} เหรียญ ➔ แถมเงินขวัญถุง +${boost.toLocaleString()} = ยอดได้รับสุทธิ +${netDelta.toLocaleString()} เหรียญทอง`,
          [['🪙', `+${s1}`, 'เหรียญตั้งต้น', 'win'], ['💎', `+${s2}`, 'โบนัสเสริมดวง', 'win'], ['🚀', `×${mult}`, `ทวีคูณ ${mult} เท่าตัว!`, 'mult']]
        );
      } else {
        const s1 = randInt(5, 10) * 10;
        const s2 = randInt(5, 10) * 10;
        const pct = pickRandom([40, 60, 80, 100]);
        const pctGain = Math.min(2400, Math.max(120, Math.round((gainBase * pct) / 100)));
        const netDelta = s1 + s2 + pctGain;
        result = pack(
          'JACKPOT', '🤑 แจ็กพอตแตกประจำคาเฟ่', `รวยฟ้าผ่า รับปันผลกระเป๋าตังค์พุ่ง +${pct}%!`, pickRandom(FLAVOR_MESSAGES.JACKPOT), netDelta,
          `กระเป๋ามี ${startBal.toLocaleString()} เหรียญ ➔ ได้ปันผล +${pct}% เป็นเงิน +${pctGain.toLocaleString()} เหรียญ ➔ รวมกับ +${s1} และ +${s2} = ยอดได้รับสุทธิ +${netDelta.toLocaleString()} เหรียญทอง`,
          [['🪙', `+${s1}`, 'เหรียญนำโชค', 'win'], ['👑', `+${s2}`, 'ถุงทองบาริสต้า', 'win'], ['📈', `+${pct}%`, `ปันผลกระเป๋า +${pct}%`, 'mult']]
        );
      }
    }
    // หมวด WIN (5%)
    else if (roll < 96) {
      const s1 = randInt(4, 11) * 10;
      const s2 = randInt(4, 10) * 10;
      if (Math.random() < 0.55) {
        const pct = pickRandom([15, 20, 25, 35]);
        const pctBonus = Math.min(750, Math.max(40, Math.round((gainBase * pct) / 100)));
        const subTotal = s1 + s2;
        const netDelta = subTotal + pctBonus;
        result = pack(
          'WIN', '🎉 ดวงดีมีกำไร', `รับทรัพย์เข้ากระเป๋าพร้อมโบนัสพิเศษ +${pct}%!`, pickRandom(FLAVOR_MESSAGES.WIN), netDelta,
          `ช่องแรกได้ +${s1} รวมกับช่องสอง +${s2} ได้ ${subTotal} เหรียญ ➔ บวกโบนัส +${pct}% (+${pctBonus.toLocaleString()}) = ยอดได้รับสุทธิ +${netDelta.toLocaleString()} เหรียญทอง`,
          [['🪙', `+${s1}`, 'เหรียญทอง', 'win'], ['🍀', `+${s2}`, 'โชคช่วยสองชั้น', 'win'], ['✨', `+${pct}%`, `โบนัส +${pct}%`, 'win']]
        );
      } else {
        const s3 = randInt(4, 11) * 10;
        const netDelta = s1 + s2 + s3;
        result = pack(
          'WIN', '🎉 ดวงดีมีกำไร', 'ปั่นเจอเหรียญทองคำครบทั้ง 3 ช่องรวด!', pickRandom(FLAVOR_MESSAGES.WIN), netDelta,
          `ช่องแรก +${s1} ➔ บวกช่องสอง +${s2} ➔ บวกทิป +${s3} = ยอดได้รับสุทธิ +${netDelta.toLocaleString()} เหรียญทอง`,
          [['🪙', `+${s1}`, 'เหรียญทอง', 'win'], ['🪙', `+${s2}`, 'เหรียญทอง', 'win'], ['🍰', `+${s3}`, 'ทิปจากอเลสเทีย', 'win']]
        );
      }
    }
    // หมวด ZERO (4%)
    else {
      if (Math.random() < 0.50) {
        const f1 = randInt(8, 20) * 10;
        const f2 = randInt(5, 15) * 10;
        result = pack(
          'ZERO', '💨 ดวงเกลือเรียกพี่', 'เกือบจะรวยแล้วแต่ดันหยุดเจอหลุมดำคูณศูนย์!', pickRandom(FLAVOR_MESSAGES.ZERO), 0,
          `ช่องแรกได้ +${f1} รวมกับช่องสอง +${f2} ได้ ${f1 + f2} เหรียญ ➔ นำไป × 0 ได้ 0 เหรียญ = ยอดได้รับสุทธิ 0 เหรียญทอง`,
          [['🪙', `+${f1}`, 'ทำท่าจะรวย...', 'win'], ['💎', `+${f2}`, 'เกือบได้จับเงินก้อน...', 'win'], ['🕳️', '×0', 'คูณศูนย์ โมฆะทันที!', 'zero']]
        );
      } else {
        const emptyIcons = ['🍂', '💨', '🫧', '🧻', '🦴'];
        result = pack(
          'ZERO', '💨 ดวงเกลือเรียกพี่', 'แย่จังไม่มีอะไรซ่อนอยู่ในรอบนี้เลยค่ะ!', pickRandom(FLAVOR_MESSAGES.ZERO), 0,
          'ออก 0 ทั้ง 3 ช่อง ไม่ได้รับเหรียญเพิ่มและไม่ถูกหักเงิน = ยอดได้รับสุทธิ 0 เหรียญทอง',
          [0, 1, 2].map(() => [pickRandom(emptyIcons), '0', 'ว่างเปล่า~', 'zero'])
        );
      }
    }
  }

  // 🔥 กลไกลดเงินเฟ้อ: สุ่มเข้ากระปุกหมูแค่ 10%–35% และเผาส่วนต่าง 65%–90% ออกจากระบบถาวร
  if (
    result &&
    result.delta < 0 &&
    !result.skipTipJarSink &&
    (!result.friendMutations || result.friendMutations.length === 0)
  ) {
    result.sinkInfo = applyTipJarSink(Math.abs(result.delta), state);
  } else if (result && result.burnedExtra > 0) {
    result.sinkInfo = { tipPct: 0, toTipJar: 0, burned: result.burnedExtra };
  }

  // ☕ แนบเซ็ตเมนูคาเฟ่ 3 ช่อง (เครื่องดื่ม / ท็อปปิ้ง / ขนมทานเล่น)
  if (result) {
    result.cafeMenu = generateCafeMenuForOutcome(result);
  }

  return result;
};

// ==========================================
// 📖 7. สารบัญสมุดสะสมแสตมป์อัตโนมัติ (158 ดวง • 5 หมวด)
// ==========================================
const parseHeaderIconAndTitle = (rawHeader, fallbackIcon = '🌟', fallbackSub = '') => {
  const str = String(rawHeader || '').trim();
  const idx = str.indexOf(' ');
  if (idx === -1) return { icon: fallbackIcon, title: str || fallbackSub };
  const icon = str.slice(0, idx).trim() || fallbackIcon;
  let title = str.slice(idx + 1).trim().replace(/^(?:ปาฏิหาริย์|อีเวนต์|วิกฤต|คำสาป|ปฏิบัติการ|คำสั่งเด็ดขาด)/, '').trim();
  if (!title || title.length < 3) title = fallbackSub || str.slice(idx + 1).trim();
  return { icon, title };
};

const buildMasterStampCatalog = () => {
  const catalog = [];
  const reg = (id, category, icon, title, desc, tone = 'miracle') => {
    const entry = { id, category, icon, title, desc, tone };
    catalog.push(entry);
    stampLookupMap.set(id, entry);
  };

  DEFAULT_LANDMARKS_META.forEach((lm) => reg(`LM_OWN_${lm.id}`, 'LANDMARK', lm.icon, `ผู้ถือหุ้น${lm.name}`, `ปั่นเจอซองคำเชิญพิเศษ ได้ขึ้นเป็นเจ้าของโต๊ะริมหน้าต่างโซน${lm.name}ฟรี!`, 'miracle'));
  DEFAULT_LANDMARKS_META.forEach((lm) => reg(`LM_DIS_${lm.id}`, 'LANDMARK', lm.disasterIcon, `วิวพังที่${lm.name}`, lm.disasterTitle, 'divide'));
  LANDMARK_ACTION_STAMPS.forEach(([id, ic, ti, de, to]) => reg(id, 'LANDMARK', ic, ti, de, to));
  MIRACLE_STAMPS.forEach(([id, ic, ti, de, to]) => reg(id, 'MIRACLE', ic, ti, de, to));

  ABSURD_DUAL_TUPLE.forEach((t, idx) => {
    const isPos = Boolean(t[0]);
    const s1 = t[3] || ['🌟', ''];
    const s3 = t[5] || ['✨', ''];
    const parsed = parseHeaderIconAndTitle(t[6], s1[0], s1[1]);
    reg('AB_' + String(idx + 1).padStart(2, '0'), 'ABSURD', isPos ? (s3[0] || parsed.icon) : (s1[0] || parsed.icon), parsed.title, t[7] || '', isPos ? 'miracle' : 'divide');
  });

  DAILY_EXPENSE_TUPLE.forEach((t, idx) => {
    const s1 = t[2] || ['💸', ''];
    const s2 = t[3] || ['⚠️', ''];
    const parsed = parseHeaderIconAndTitle(t[5], s1[0], s2[1]);
    const cleanTitle = (parsed.title.includes('ค่าใช้จ่าย') || parsed.title.includes('อิหยังวะ'))
      ? String(s2[1] || parsed.title).replace(/!+$/, '')
      : parsed.title;
    reg('EX_' + String(idx + 1).padStart(2, '0'), 'EXPENSE', parsed.icon, cleanTitle, t[6] || '', 'tax');
  });

  DAILY_BOON_TUPLE.forEach((t, idx) => {
    const s1 = t[2] || ['🌈', ''];
    const parsed = parseHeaderIconAndTitle(t[5], s1[0], s1[1]);
    reg('BN_' + String(idx + 1).padStart(2, '0'), 'BOON', parsed.icon, parsed.title, t[6] || '', 'miracle');
  });

  return catalog;
};

const MASTER_STAMP_CATALOG = buildMasterStampCatalog();
const getMasterStampCatalog = () => ({
  totalStamps: MASTER_STAMP_CATALOG.length,
  categories: STAMP_CATEGORIES,
  stamps: MASTER_STAMP_CATALOG
});

module.exports = {
  BASE_ECONOMIC_UNIT,
  SPKRAN_EMOJI,
  DEFAULT_LANDMARKS_META,
  MASTER_STAMP_CATALOG,
  STAMP_CATEGORIES,
  getMasterStampCatalog,
  getWindowLandmarksStatus,
  formatFriendTitle,
  calculateSlotOutcome
};