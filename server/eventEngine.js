// server/eventEngine.js
// 🎰 เครื่องยนต์สุ่มสล็อต 3 ช่อง + เมนูคาเฟ่ + ธนาคาร/ยึดทรัพย์ + ลดเงินเฟ้อ + สมุดแสตมป์ 158 ดวง

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

// 🧮 ค่าเฉลี่ยทรัพย์สินคนทั้งคาเฟ่ (คิดจากกระเป๋า + ธนาคาร เพื่อกันคนซ่อนเงินหลบค่าเฉลี่ย)
const calculateCafeAverageWealth = (roster = []) => {
  if (!Array.isArray(roster) || roster.length === 0) return BASE_ECONOMIC_UNIT;
  const pos = roster
    .map((p) => Number(p.walletBalance || 0) + Number(p.bankBalance || 0))
    .filter((b) => b > 0);
  if (pos.length === 0) return BASE_ECONOMIC_UNIT;
  return Math.min(8000, Math.max(BASE_ECONOMIC_UNIT, Math.round(pos.reduce((a, v) => a + v, 0) / pos.length)));
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

// 💸 ตัวช่วยสร้างคำสั่งแก้ไขยอดเพื่อน (รองรับทั้งโหมด DELTA หักข้ามบัญชี และ SET เฉพาะกระเป๋า)
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

// ⚙️ คอมไพเลอร์ตาราง Tuple (รองรับ FLAT, PCT, DIV, MULT)
const compileCatalogTuple = (t, startBal, isBoon, stampId = '') => {
  const [min, max, [i1, l1, s1], [i2, l2, s2], [i3, s3], catHdr, headline, msg, reason, calcMode = 'FLAT'] = t;
  const refBase = startBal > 0 ? startBal : Math.max(BASE_ECONOMIC_UNIT, Math.abs(startBal));

  if (calcMode === 'DIV' && !isBoon) {
    const div = randInt(min, max);
    const cutAmt = Math.max(40, Math.round(refBase * (1 - 1 / div)));
    return pack(
      'DIVIDER', catHdr, headline, msg, -cutAmt,
      `กระเป๋ามี ${startBal.toLocaleString()} ➔ ${reason} ถูกผ่าหาร ÷ ${div} หักไป -${cutAmt.toLocaleString()} เหรียญ = ยอดหักสุทธิ -${cutAmt.toLocaleString()} เหรียญทอง`,
      [[i1, l1, s1, 'zero'], [i2, l2, s2, 'tax'], [i3, `÷${div}`, s3, 'divide']],
      undefined, { stampId }
    );
  }
  if (calcMode === 'MULT' && isBoon) {
    const mult = randInt(min, max);
    const gainAmt = Math.min(4000, Math.max(250, Math.round(refBase * (mult - 1))));
    return pack(
      'MIRACLE', catHdr, headline, msg, gainAmt,
      `กระเป๋ามี ${startBal.toLocaleString()} ➔ ${reason} รับตัวคูณ ×${mult} เพิ่มเงิน +${gainAmt.toLocaleString()} เหรียญ = ยอดได้รับสุทธิ +${gainAmt.toLocaleString()} เหรียญทอง`,
      [[i1, l1, s1, 'zero'], [i2, l2, s2, 'miracle'], [i3, `×${mult}`, s3, 'miracle']],
      undefined, { stampId }
    );
  }
  if (calcMode === 'PCT') {
    const pct = Math.round(randInt(min, max) / 5) * 5;
    const amt = Math.min(3200, Math.max(35, Math.round((refBase * pct) / 100)));
    if (isBoon) {
      return pack(
        'MIRACLE', catHdr, headline, msg, amt,
        `กระเป๋ามี ${startBal.toLocaleString()} ➔ ${reason} ได้รับโบนัส +${pct}% เป็นเงิน +${amt.toLocaleString()} เหรียญ = ยอดได้รับสุทธิ +${amt.toLocaleString()} เหรียญทอง`,
        [[i1, l1, s1, 'zero'], [i2, l2, s2, 'miracle'], [i3, `+${pct}%`, s3, 'miracle']],
        undefined, { stampId }
      );
    }
    return pack(
      amt >= 250 ? 'DIVIDER' : 'TAX', catHdr, headline, msg, -amt,
      `กระเป๋ามี ${startBal.toLocaleString()} ➔ ${reason} ถูกหักไป -${pct}% เป็นเงิน -${amt.toLocaleString()} เหรียญ = ยอดหักสุทธิ -${amt.toLocaleString()} เหรียญทอง`,
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
  return pack(
    val >= 250 ? 'DIVIDER' : 'TAX', catHdr, headline, msg, -val,
    `กระเป๋ามี ${startBal.toLocaleString()} ➔ ${reason} ต้องควักจ่าย -${val.toLocaleString()} เหรียญ = ยอดหักสุทธิ -${val.toLocaleString()} เหรียญทอง`,
    [[i1, l1, s1, 'zero'], [i2, l2, s2, 'tax'], [i3, `-${val.toLocaleString()}`, s3, val >= 250 ? 'divide' : 'tax']],
    undefined, { stampId }
  );
};

// ==========================================
// 🏰 1. เครื่องยนต์ตลาดหุ้น "แลนด์มาร์กริมหน้าต่างคาเฟ่ 5 โซน"
// ==========================================
const generateWindowLandmarkEvent = (startBal, activePlayerId, roster, worldState) => {
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

  // 🟡 กรณีที่ 2: ผู้เล่นที่ปั่นสล็อต คือ "เจ้าของหุ้นโซนนี้เอง"
  if (lm.ownerId === activePlayerId) {
    const currentRate = LANDMARK_TIER_RATES[lm.tier] || 17;
    const ownerRoll = Math.random();
    if (ownerRoll < 0.68) {
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
      const dividend = Math.max(200, Math.round((cafeAvg * 68) / 100));
      return pack(
        'JACKPOT', `🥂 ปันผลผู้ถือหุ้นใหญ่ริมหน้าต่าง ${lmFullTitle}`,
        `หุ้น "${lmFullTitle}" อยู่ขั้นสูงสุด (68%) แล้ว รับเงินปันผลพิเศษ +${dividend.toLocaleString()} เหรียญ!`,
        `โต๊ะริมหน้าต่างโซน "${lmFullTitle}" ของคุณอัปเกรดเต็มขั้น 68% จนสวยที่สุดในคาเฟ่ไปแล้วค่ะ! อเลสเทียเลยจ่ายเช็คเงินปันผลผู้ถือหุ้นใหญ่คิดเป็น 68% จากยอดเฉลี่ยของคนในร้าน เข้ากระเป๋าคุณทันทีเลยค่ะ`,
        dividend,
        `โต๊ะ ${lmFullTitle} ของคุณอยู่ขั้นที่ 3 (68%) สูงสุดแล้ว ➔ อเลสเทียจ่ายเงินปันผลหุ้นใหญ่ +68% จากยอดเฉลี่ยคนในร้าน (${cafeAvg.toLocaleString()} เหรียญ) = ยอดได้รับสุทธิ +${dividend.toLocaleString()} เหรียญทอง`,
        [[lm.icon, 'ขั้นสูงสุด 68%', lm.name, 'mult'], ['🥂', 'ปันผลหุ้นใหญ่!', `ยอดเฉลี่ยร้าน ${cafeAvg.toLocaleString()}`, 'miracle'], ['💰', `+${dividend.toLocaleString()}`, 'รับปันผลเข้ากระเป๋า!', 'miracle']],
        undefined, { stampId: 'LM_ACT_DIVIDEND', txType: 'LANDMARK' }
      );
    }
    if (ownerRoll < 0.84 && otherPlayers.length > 0) {
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
        `คุณถือหุ้นโต๊ะ ${lmFullTitle} ขั้นที่ ${keptTier} (${currentRate}%) ➔ อยู่ๆ ก็ไม่อยากได้ขึ้นมาซะงั้น เลยเซ็นยกหุ้นให้ ${fTitle} ไปดูแลต่อฟรีๆ! = ยอดได้รับสุทธิ 0 เหรียญทอง`,
        [[lm.icon, `หุ้น ${currentRate}%`, 'ของเดิมของคุณ', 'zero'], ['🤪', 'ไม่อยากได้แล้ว!', 'เซ็นยกให้เพื่อนฟรีๆ', 'tax'], ['🎁', `มอบให้ ${fTitle}`, 'รับส้มหล่นไปเต็มๆ!', 'miracle']],
        undefined, { stampId: 'LM_ACT_GIFT', txType: 'LANDMARK' }
      );
    }
    const payout = Math.max(150, Math.round(((cafeAvg * currentRate) / 100) * 1.6));
    const soldTier = lm.tier;
    lm.ownerId = null;
    lm.ownerName = '';
    lm.tier = 0;
    lm.curtainClosed = false;
    return pack(
      'MIRACLE', `🔨 ขายทอดตลาดหุ้นริมหน้าต่าง ${lmFullTitle}`,
      `อยู่ๆ ก็ไม่อยากได้ จึงขายทอดตลาดหุ้น "${lmFullTitle}" (${currentRate}%) รับเงินสด +${payout.toLocaleString()} เหรียญ!`,
      `อยู่ๆ คุณก็นึกอยากถือเงินสดมากกว่าถือหุ้น เลยตัดสินใจขายทอดตลาดหุ้นโต๊ะริมหน้าต่างโซน "${lmFullTitle}" ขั้นที่ ${soldTier} (${currentRate}%) คืนให้ทางร้าน! รับเงินก้อนโตเข้ากระเป๋าทันที ส่วนโต๊ะริมหน้าต่างบานนี้ก็ว่างลง จะมีใครดวงดีมาจับจองต่อไหมคะเนี่ย`,
      payout,
      `ขายทอดตลาดหุ้นโต๊ะ ${lmFullTitle} ขั้นที่ ${soldTier} (${currentRate}%) คืนให้ร้าน ➔ รับเงินสดเข้ากระเป๋าทันที +${payout.toLocaleString()} เหรียญ แล้วปล่อยโต๊ะว่างรอเจ้าของคนใหม่ = ยอดได้รับสุทธิ +${payout.toLocaleString()} เหรียญทอง`,
      [[lm.icon, `หุ้นขั้น ${soldTier} (${currentRate}%)`, 'อยู่ๆ ก็ไม่อยากถือไว้', 'win'], ['🔨', 'ขายทอดตลาด!', 'จะมีใครมาจับจองต่อนะ', 'miracle'], ['🤑', `+${payout.toLocaleString()}`, `รับเงินสดตาม ${currentRate}%!`, 'miracle']],
      undefined, { stampId: 'LM_ACT_SELL', txType: 'LANDMARK' }
    );
  }

  // 🔴 กรณีที่ 3: โต๊ะริมหน้าต่างโซนนี้มีเจ้าของอยู่แล้ว และสมาชิกคนอื่นปั่นมาเจอ
  const ownerTitle = currentOwnerObj ? formatFriendTitle(currentOwnerObj) : (lm.ownerName || 'ผู้ถือหุ้น');
  const baseRate = LANDMARK_TIER_RATES[lm.tier] || 17;
  const ownedCountByHolder = worldState.landmarks.filter((x) => x.ownerId === lm.ownerId && x.tier > 0).length;
  const monopolyBonusPct = ownedCountByHolder >= 3 ? 10 : 0;
  const effectiveTollRate = baseRate + monopolyBonusPct;

  if (lm.curtainClosed) {
    lm.curtainClosed = false;
    return pack(
      'ZERO', `🪟 ผ้าม่านริมหน้าต่างปิดอยู่ ${lmFullTitle}`,
      `แวะนั่งโต๊ะ "${lmFullTitle}" ของ "${ownerTitle}" แต่ผ้าม่านปิดอยู่ เลยไม่ต้องเสียค่านั่งชมวิวค่ะ!`,
      `คุณเดินไปนั่งที่โต๊ะริมหน้าต่างโซน "${lmFullTitle}" ของ "${ownerTitle}" แต่โชคดีมากที่มีคนแอบรูดผ้าม่านทึบแสงปิดไว้ตั้งแต่รอบก่อน คุณเลยมองไม่เห็นวิวและไม่ต้องจ่ายค่าริมหน้าต่าง ${effectiveTollRate}% เลยแม้แต่เหรียญเดียว แถมช่วยเปิดผ้าม่านรับลมคืนให้เรียบร้อยค่ะ`,
      0,
      `แวะนั่งโต๊ะ ${lmFullTitle} ของ ${ownerTitle} ➔ โชคดีที่มีคนรูดผ้าม่านปิดไว้พอดี เลยไม่ต้องเสียค่านั่งชมวิวสักเหรียญ แถมเปิดม่านรับลมต่อให้แล้ว = ยอดได้รับสุทธิ 0 เหรียญทอง`,
      [[lm.icon, lm.name, `โต๊ะของ ${ownerTitle}`, 'zero'], ['🪟', 'ผ้าม่านปิดอยู่!', 'มองไม่เห็นวิวข้างนอก', 'win'], ['✨', 'ฟรี 0 เหรียญ!', 'รอดค่าชมวิวหวุดหวิด!', 'zero']],
      undefined, { stampId: 'LM_ACT_CURTAIN', txType: 'LANDMARK' }
    );
  }

  const actionRoll = Math.random() * 100;

  if (actionRoll < 44) {
    const tollAmt = Math.max(35, Math.round((cafeAvg * effectiveTollRate) / 100));
    const mutList = currentOwnerObj
      ? [mutDelta(currentOwnerObj, tollAmt, `😍 รับค่าชมวิว ${lmFullTitle} จาก ${myTitle}`, false, 'LANDMARK')]
      : [];
    const synergyNote = monopolyBonusPct > 0 ? ` (รวมโบนัสเจ้าพ่อถือครอง ${ownedCountByHolder} โต๊ะ +${monopolyBonusPct}%)` : '';
    return pack(
      tollAmt >= 250 ? 'DIVIDER' : 'TAX', `😍 โต๊ะวิวนี้สวยจังอยากนั่งจังเลย ${lmFullTitle}`,
      `แวะนั่งชมวิว "${lmFullTitle}" จ่ายค่าริมหน้าต่าง ${effectiveTollRate}% ให้ "${ownerTitle}"!`,
      `โต๊ะริมหน้าต่างโซน "${lmFullTitle}" (${lm.viewDesc}) มันช่างสวยสะกดใจจนคุณอดใจไม่ไหว ขอเข้าไปนั่งจิบกาแฟชมวิวสักหน่อย! เลยต้องควักจ่ายค่าริมหน้าต่างขั้นที่ ${lm.tier} คิดเป็น ${effectiveTollRate}% จากยอดเฉลี่ยของคนในร้าน โอนเข้ากระเป๋าผู้ถือหุ้น "${ownerTitle}" ทันทีเลยค่ะ`,
      -tollAmt,
      `แวะนั่งชมวิวโต๊ะ ${lmFullTitle} ของ ${ownerTitle} (ขั้นที่ ${lm.tier}) ➔ จ่ายค่าริมหน้าต่าง -${effectiveTollRate}%${synergyNote} จากยอดเฉลี่ยคนในร้าน (${cafeAvg.toLocaleString()} เหรียญ) เป็นเงิน -${tollAmt.toLocaleString()} เหรียญ โอนให้ ${ownerTitle} ทันที! = ยอดหักสุทธิ -${tollAmt.toLocaleString()} เหรียญทอง`,
      [[lm.icon, 'วิวสวยจังเลย~', `โต๊ะของ ${ownerTitle}`, 'zero'], ['🪑', `ขั้นที่ ${lm.tier} (${effectiveTollRate}%)`, `เฉลี่ยร้าน ${cafeAvg.toLocaleString()}`, 'tax'], ['💸', `-${tollAmt.toLocaleString()}`, `จ่ายให้ ${ownerTitle}!`, 'divide']],
      mutList, { stampId: 'LM_ACT_TOLL', txType: 'LANDMARK' }
    );
  }

  if (actionRoll < 56) {
    const seizedTier = lm.tier;
    lm.ownerId = activePlayerId;
    lm.ownerName = myTitle;
    return pack(
      'MIRACLE', `⚖️ ฟ้องร้องขอเป็นผู้ถือครอง ${lmFullTitle}`,
      `ชนะคดีฟ้องร้อง! ยึดหุ้น "${lmFullTitle}" ขั้นที่ ${seizedTier} (${baseRate}%) มาจาก "${ownerTitle}" สำเร็จ!`,
      `คุณยื่นคำร้องต่อศาลปกครองคาเฟ่ว่า "${ownerTitle}" นั่งจิบกาแฟบังวิวริมหน้าต่างโซน "${lmFullTitle}" นานเกินไป! อเลสเทียพิจารณาแล้วเห็นด้วย เลยสั่งโอนย้ายหุ้นขั้นที่ ${seizedTier} (${baseRate}%) ทั้งก้อนมาให้คุณเป็นผู้ถือครองแทนทันทีแบบไม่ต้องเสียตังค์สักบาทเลยค่ะ`,
      0,
      `ยื่นฟ้องร้องขอเป็นผู้ถือครองโต๊ะ ${lmFullTitle} จาก ${ownerTitle} ➔ ชนะคดี! ได้รับโอนหุ้นขั้นที่ ${seizedTier} (${baseRate}%) มาเป็นของคุณทันที! = ยอดได้รับสุทธิ 0 เหรียญทอง`,
      [['⚖️', 'ยื่นฟ้องศาลคาเฟ่!', `ฟ้อง ${ownerTitle}`, 'win'], ['🔨', 'ชนะคดีเฉยเลย!', 'โอนย้ายหุ้นทั้งก้อน', 'miracle'], [lm.icon, `ยึดหุ้น ${baseRate}%!`, `คุณเป็นเจ้าของขั้นที่ ${seizedTier}!`, 'miracle']],
      undefined, { stampId: 'LM_ACT_SUE_TAKE', txType: 'LANDMARK' }
    );
  }

  if (actionRoll < 68) {
    const halfRate = baseRate / 2;
    const fineAmt = Math.max(30, Math.round((cafeAvg * halfRate) / 100));
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
      `คุณเดินผ่านโต๊ะริมหน้าต่างโซน "${lmFullTitle}" แล้วเห็น "${ownerTitle}" นั่งเก๊กจิบกาแฟอยู่ เลยยื่นฟ้องอเลสเทียด้วยข้อหาไม่ชอบขี้หน้าผู้ถือครอง! อเลสเทียสั่งปลด "${ownerTitle}" พ้นสภาพเจ้าของโต๊ะทันที แถมปรับเงินครึ่งหนึ่งของขั้นหุ้น (${halfRate}%) มาจ่ายเป็นค่าทำขวัญให้คุณด้วยค่ะ`,
      fineAmt,
      `ยื่นฟ้องข้อหาหมั่นไส้ ${ownerTitle} เจ้าของโต๊ะ ${lmFullTitle} ขั้นที่ ${oldTier} (${baseRate}%) ➔ อเลสเทียยึดหุ้นคืนเข้ากองกลาง โต๊ะนี้เลยว่างไม่มีเจ้าของ แถมปรับเงินครึ่งหนึ่ง (${halfRate}%) จาก ${ownerTitle} มาจ่ายให้คุณ +${fineAmt.toLocaleString()} เหรียญ = ยอดได้รับสุทธิ +${fineAmt.toLocaleString()} เหรียญทอง`,
      [['💢', `หมั่นไส้ ${ownerTitle}!`, `หุ้นขั้นที่ ${oldTier} (${baseRate}%)`, 'tax'], ['🚫', 'โดนปลดพ้นสภาพ!', 'โต๊ะนี้ไม่มีเจ้าของแล้วนะ', 'miracle'], ['🤑', `+${fineAmt.toLocaleString()}`, `รับค่าปรับครึ่งขั้น (${halfRate}%)!`, 'miracle']],
      mutList, { stampId: 'LM_ACT_SUE_KICK', txType: 'LANDMARK' }
    );
  }

  if (actionRoll < 78) {
    const halfRate = baseRate / 2;
    const buyoutCost = Math.max(30, Math.round((cafeAvg * halfRate) / 100));
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
      `วิถีนักลงทุนสายเปย์! คุณวางถุงเหรียญทองจำนวน ${buyoutCost.toLocaleString()} เหรียญ กระแทกโต๊ะเพื่อซื้อทับสิทธิ์โซน "${lmFullTitle}" มาจาก "${ownerTitle}" แบบดื้อๆ พร้อมสั่งอัปเกรดหุ้นขึ้นเป็นขั้นที่ ${newTier} (${newRate}%) รอเก็บเงินคนถัดไปทันทีค่ะ`,
      -buyoutCost,
      `ควักเงินซื้อทับสิทธิ์ (${halfRate}% ของยอดเฉลี่ยร้าน) จำนวน -${buyoutCost.toLocaleString()} เหรียญ จ่ายให้ ${ownerTitle} ➔ ยึดครองโต๊ะ ${lmFullTitle} พร้อมอัปเกรดหุ้นเป็น ${newRate}% ทันที! = ยอดหักสุทธิ -${buyoutCost.toLocaleString()} เหรียญทอง`,
      [['💼', 'ทุ่มซื้อทับ!', `จ่ายให้ ${ownerTitle}`, 'tax'], ['💸', `-${buyoutCost.toLocaleString()}`, 'ค่าเทคโอเวอร์โต๊ะสวย', 'win'], [lm.icon, `ยึดเป็น ${newRate}%!`, `อัปเกรดสู่ขั้นที่ ${newTier}!`, 'miracle']],
      mutList, { stampId: 'LM_ACT_TAKEOVER', txType: 'LANDMARK' }
    );
  }

  if (actionRoll < 84) {
    const compAmt = Math.max(30, Math.round((cafeAvg * 15) / 100));
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
      `เกิดเรื่องวุ่นวายนอกกระจกร้านค่ะ! ${lm.disasterTitle} ทำเอาคุณที่กำลังนั่งจิบกาแฟตกใจจนสำลัก ผู้ถือหุ้นอย่าง "${ownerTitle}" เลยโดนลดขั้นหุ้นลง แถมต้องควักจ่ายค่าปลอบขวัญ 15% ให้คุณทันทีค่ะ`,
      compAmt,
      `เกิดเรื่องวุ่นวายที่โต๊ะ ${lmFullTitle} ของ ${ownerTitle} (เดิมขั้น ${oldTier}) ➔ หุ้น${afterLabel} และหักเงิน ${ownerTitle} มาจ่ายค่าปลอบขวัญให้คุณ +${compAmt.toLocaleString()} เหรียญ = ยอดได้รับสุทธิ +${compAmt.toLocaleString()} เหรียญทอง`,
      [[lm.disasterIcon, 'วิวพังพินาศ!', lm.name, 'tax'], ['📉', afterLabel, `หุ้นของ ${ownerTitle} ร่วง`, 'divide'], ['🩹', `+${compAmt.toLocaleString()}`, 'รับค่าปลอบขวัญ 15%!', 'miracle']],
      mutList, { stampId: `LM_DIS_${lm.id}`, txType: 'LANDMARK' }
    );
  }

  if (actionRoll < 90) {
    const sponsorBonus = Math.max(50, Math.round((cafeAvg * baseRate) / 100));
    const mutList = currentOwnerObj
      ? [mutDelta(currentOwnerObj, sponsorBonus, `📸 รับค่าสปอนเซอร์รีวิว ${lmFullTitle} ร่วมกับ ${myTitle}`, false, 'LANDMARK')]
      : [];
    return pack(
      'MIRACLE', `📸 รีวิวริมหน้าต่างไวรัลทะลุล้านวิว ${lmFullTitle}`,
      `ถ่ายรูปเช็กอินที่ "${lmFullTitle}" จนไวรัล! รับเงินสปอนเซอร์ +${sponsorBonus.toLocaleString()} เหรียญ ทั้งคุณและ "${ownerTitle}"!`,
      `คุณหยิบมือถือขึ้นมาถ่ายรูปแก้วกาแฟคู่กับวิว "${lmFullTitle}" ของ "${ownerTitle}" ลงโซเชียล ปรากฏว่าคนแชร์สนั่นจนยอดวิวทะลุล้าน! แบรนด์ขนมเลยจ่ายค่าสปอนเซอร์คิดเป็น ${baseRate}% ให้ทั้งคุณและเจ้าของโต๊ะรับทรัพย์คู่กันแบบแฮปปี้สุดๆ เลยค่ะ`,
      sponsorBonus,
      `ถ่ายรูปเช็กอินที่โต๊ะ ${lmFullTitle} ขั้นที่ ${lm.tier} (${baseRate}%) จนดังระเบิด ➔ ทั้งคุณและเจ้าของโต๊ะ ${ownerTitle} ได้รับเงินสปอนเซอร์คนละ +${sponsorBonus.toLocaleString()} เหรียญ! = ยอดได้รับสุทธิ +${sponsorBonus.toLocaleString()} เหรียญทอง`,
      [['📸', 'ถ่ายรูปเช็กอิน!', lmFullTitle, 'win'], ['🔥', 'ไวรัลล้านวิว!', `${ownerTitle} ได้ด้วย`, 'miracle'], ['🥂', `+${sponsorBonus.toLocaleString()}`, `รับโบนัส ${baseRate}% ทั้งคู่!`, 'miracle']],
      mutList, { stampId: 'LM_ACT_VIRAL', txType: 'LANDMARK' }
    );
  }

  if (actionRoll < 95) {
    const halfRate = baseRate / 2;
    const sneakyLoot = Math.max(25, Math.round((cafeAvg * halfRate) / 100));
    const mutList = currentOwnerObj
      ? [mutDelta(currentOwnerObj, -sneakyLoot, `🕵️ โดน ${myTitle} แอบฉกเหรียญที่โต๊ะ ${lmFullTitle}`, false, 'LANDMARK')]
      : [];
    return pack(
      'WIN', `🕵️ แอบชะโงกหน้าดูวิวฟรี ${lmFullTitle}`,
      `ไม่ยอมจ่ายค่านั่งโต๊ะ "${lmFullTitle}" แถมแอบจิ๊กเงินจากโต๊ะของ "${ownerTitle}" มา +${sneakyLoot.toLocaleString()} เหรียญ!`,
      `เรื่องอะไรจะยอมเสียค่านั่งริมหน้าต่างแพงๆ ล่ะคะ! คุณทำเนียนเดินไปยืนพิงเสาแอบชะโงกหน้าดูวิว "${lmFullTitle}" ฟรีๆ พอ "${ownerTitle}" เผลอหันไปคุยกับบาริสต้า คุณก็แอบฉกเหรียญทอนบนโต๊ะของเขามาครึ่งหนึ่งของขั้นหุ้น (${halfRate}%) วิ่งหนีกลับโต๊ะตัวเองแบบเนียนกริบค่ะ`,
      sneakyLoot,
      `แอบยืนดูวิว ${lmFullTitle} ฟรีโดยไม่ยอมนั่งเก้าอี้ ➔ แอบจิ๊กเงินครึ่งขั้นหุ้น (${halfRate}%) จากโต๊ะของ ${ownerTitle} มา +${sneakyLoot.toLocaleString()} เหรียญ! = ยอดได้รับสุทธิ +${sneakyLoot.toLocaleString()} เหรียญทอง`,
      [['🕵️', 'ยืนชะโงกดูฟรี!', 'ไม่ยอมนั่งเก้าอี้', 'win'], [lm.icon, `ของ ${ownerTitle}`, 'เจ้าของเผลอพอดี!', 'miracle'], ['🥷', `+${sneakyLoot.toLocaleString()}`, `ฉกมาฟรีๆ ${halfRate}%!`, 'win']],
      mutList, { stampId: 'LM_ACT_PEEK', txType: 'LANDMARK' }
    );
  }

  const cleanReward = Math.max(30, Math.round((cafeAvg * 17) / 100));
  lm.curtainClosed = true;
  const mutList = currentOwnerObj
    ? [mutDelta(currentOwnerObj, -cleanReward, `🕊️ จ่ายค่าเช็ดกระจก ${lmFullTitle} ให้ ${myTitle}`, false, 'LANDMARK')]
    : [];
  return pack(
    'WIN', `🕊️ นกพิราบปล่อยระเบิดใส่กระจก ${lmFullTitle}`,
    `นกพิราบขี้ใส่กระจก "${lmFullTitle}"! คุณช่วยเช็ดและรูดม่านปิด รับค่าจ้างจาก "${ownerTitle}" +${cleanReward.toLocaleString()} เหรียญ!`,
    `เจ้านกพิราบตัวอ้วนบินมาปล่อยระเบิดใส่กระจกโซน "${lmFullTitle}" ของ "${ownerTitle}" เต็มรักจนมองไม่เห็นวิว! อเลสเทียเลยหักเงินผู้ถือหุ้น 17% มาจ่ายเป็นค่าแรงให้คุณช่วยเช็ดกระจก พร้อมรูดผ้าม่านปิดพักวิวไว้ก่อน 1 รอบค่ะ`,
    cleanReward,
    `นกพิราบขี้ใส่กระจกโต๊ะ ${lmFullTitle} ➔ หักค่าจ้างเช็ดกระจก 17% จาก ${ownerTitle} มาให้คุณ +${cleanReward.toLocaleString()} เหรียญ พร้อมรูดผ้าม่านปิดพักวิวไว้ชั่วคราว! = ยอดได้รับสุทธิ +${cleanReward.toLocaleString()} เหรียญทอง`,
    [['🕊️', 'นกปล่อยระเบิด!', `กระจก ${lm.name} เลอะ`, 'tax'], ['🪟', 'รูดผ้าม่านปิดไว้!', 'พักชมวิวชั่วคราว', 'win'], ['🧽', `+${cleanReward.toLocaleString()}`, `รับค่าเช็ดกระจกจาก ${ownerTitle}!`, 'miracle']],
    mutList, { stampId: 'LM_ACT_PIGEON', txType: 'LANDMARK' }
  );
};

// ==========================================
// 🌟 2. เครื่องยนต์ปาฏิหาริย์, กระเป๋าหล่น, กระป๋องคุกกี้ & มัลติเพลเยอร์
// ==========================================
const generateMiracleChaosEvent = (startBal, activePlayerId, roster, worldState) => {
  const otherPlayers = roster.filter((p) => p.userId !== activePlayerId);
  const activePlayerObj = roster.find((p) => p.userId === activePlayerId);
  const myTitle = formatFriendTitle(activePlayerObj);
  const startBank = Math.max(0, Number(activePlayerObj?.bankBalance || 0));
  const refBase = startBal > 0 ? startBal : Math.max(BASE_ECONOMIC_UNIT, Math.abs(startBal));

  // สาย 1A: สุ่มเข้า 34 อีเวนต์ตรรกะวิบัติและขั้วตรงข้าม (32% ของหมวด)
  if (Math.random() < 0.32) {
    const tupleIdx = Math.floor(Math.random() * ABSURD_DUAL_TUPLE.length);
    const [isPos, rangeOrPct, calcMode, [i1, l1, s1], [i2, l2, s2], [i3, s3], catHdr, headline, msg, eqFn] = ABSURD_DUAL_TUPLE[tupleIdx];
    const stampId = 'AB_' + String(tupleIdx + 1).padStart(2, '0');
    let amt = 0;
    let pctOrDiv = 0;

    if (calcMode === 'DIV') {
      pctOrDiv = pickRandom(rangeOrPct);
      amt = Math.max(40, Math.round(refBase * (1 - 1 / pctOrDiv)));
    } else if (calcMode === 'MULT') {
      pctOrDiv = pickRandom(rangeOrPct);
      amt = Math.min(4000, Math.max(250, Math.round(refBase * (pctOrDiv - 1))));
    } else if (calcMode === true) {
      pctOrDiv = pickRandom(rangeOrPct);
      amt = Math.min(3200, Math.max(40, Math.round((refBase * pctOrDiv) / 100)));
    } else {
      amt = randInt(rangeOrPct[0], rangeOrPct[1]);
      if (amt >= 30) amt = Math.round(amt / 5) * 5;
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
      `กระเป๋ามี ${startBal.toLocaleString()} ➔ ${eqFn(amt, pctOrDiv)} = ${netDelta >= 0 ? 'ยอดได้รับสุทธิ +' + netDelta.toLocaleString() : 'ยอดหักสุทธิ ' + netDelta.toLocaleString()} เหรียญทอง`,
      [[i1, l1, s1, 'zero'], [i2, l2, s2, isPos ? 'miracle' : 'tax'], [i3, label3, s3, isPos ? 'miracle' : 'divide']],
      undefined, { stampId }
    );
  }

  const eventPool = [
    'LOST_AND_FOUND_WALLET', 'LOST_AND_FOUND_WALLET', 'LOST_AND_FOUND_WALLET', 'TIME_CAPSULE_VAULT', 'QUANTUM_MULTIPLIER_DICE', 'TIP_JAR_SMASH',
    'RANDOM_WALLET_SWAP', 'STEAL_SULTAN', 'WANT_RICH_POOR', 'BEGGAR_BILLIONAIRE', 'POLARITY_FLIP', 'ALESTIA_DEBT_CLEAR', 'ALESTIA_SEIZURE',
    'CAFE_LOTTO_777', 'ROBIN_HOOD', 'DEBT_INSURANCE', 'COMMUNITY_TAX_MAGNET', 'DAVID_VS_GOLIATH', 'DEBT_TIME_BOMB', 'MIRROR_COPY_CAT',
    'SPREAD_THE_LOVE_DEBT', 'COMMUNISM_EQUALIZER', 'RUSSIAN_ROULETTE', 'ALESTIA_RAIN_MAKER', 'SOUL_BOND_TWINS', 'REVERSE_RANK_SWAP'
  ];
  const chosen = pickRandom(eventPool);

  // 👛 กระเป๋าตังค์หล่นหาย & เก็บกระเป๋าตังค์ได้ (เฉพาะเงินในกระเป๋า — ธนาคารปลอดภัย 100%!)
  if (chosen === 'LOST_AND_FOUND_WALLET') {
    const lostWallets = worldState.lostWallets || [];
    if (startBal > 0 && (lostWallets.length === 0 || Math.random() < 0.78)) {
      const lostAmount = startBal;
      const recoverableAmt = Math.max(1, Math.round(lostAmount * 0.80)); // 80% รอคนเก็บ, 20% ปลิวลงท่อเผาทิ้งลดเงินเฟ้อ
      const bankSafeNote = startBank > 0 ? ` (โชคดีที่เงินในธนาคาร ${startBank.toLocaleString()} เหรียญปลอดภัย!)` : '';
      const loseScenarios = [
        ['MC_LOST_DANCE', '👛 วิกฤตกระเป๋าตังค์หล่นหายกลางทาง', 'มัวแต่เดินเต้นดุ๊กดิ๊ก ทำกระเป๋าตังค์หล่นหาย เงินในกระเป๋ากลายเป็น 0 ทันที!', `คุณเดินเต้นดุ๊กดิ๊กฮัมเพลงออกจากคาเฟ่ด้วยความอารมณ์ดี จนกระเป๋าตังค์ที่มีเงินอยู่ ${lostAmount.toLocaleString()} เหรียญทองกระเด็นหลุดจากกระเป๋ากางเกงตกพื้นหายไปทั้งใบ เงินติดตัวกลายเป็น 0 ทันทีค่ะ${bankSafeNote} ตกอยู่แถวหน้าร้านนั่นแหละค่ะ จะมีใครตาดีเดินมาเก็บไปรึเปล่าคะเนี่ย`, 'ทำตกไว้ตอนเดินเต้นดุ๊กดิ๊กหน้าร้าน', ['🕺', 'เดินเต้นดุ๊กดิ๊ก', `มี ${lostAmount.toLocaleString()} เหรียญ`]],
        ['MC_LOST_TAXI', '🚕 วิกฤตลืมกระเป๋าตังค์ไว้บนหลังคาแท็กซี่', 'วางกระเป๋าตังค์ไว้บนหลังคารถแท็กซี่แล้วรถออกตัว เงินในกระเป๋ากลายเป็น 0 ทันที!', `จังหวะกำลังผูกเชือกรองเท้าหน้าคาเฟ่ คุณเผลอวางกระเป๋าตังค์ที่มีเงิน ${lostAmount.toLocaleString()} เหรียญทองพักไว้บนหลังคารถแท็กซี่ พอผูกเสร็จรถแท็กซี่ก็ซิ่งออกไปพร้อมกระเป๋าคุณเลยค่ะ เหลือเงินติดตัว 0 เหรียญถ้วน${bankSafeNote}`, 'วางลืมไว้บนหลังคารถแท็กซี่จนปลิวตกถนน', ['🚕', 'วางบนหลังคาแท็กซี่', `มี ${lostAmount.toLocaleString()} เหรียญ`]],
        ['MC_LOST_TRASH', '🗑️ วิกฤตเบลอจัดทิ้งกระเป๋าตังค์ลงถังขยะ', 'ถือกระเป๋าตังค์คู่กับซองขนม เผลอโยนกระเป๋าตังค์ทิ้งถังขยะเหลือ 0 เหรียญ!', `ความเบลอเป็นเหตุสังเกตได้! มือซ้ายถือซองลูกอมเปล่า มือขวาถือกระเป๋าตังค์ที่มีเงิน ${lostAmount.toLocaleString()} เหรียญทอง พอเดินผ่านถังขยะคุณดันโยนกระเป๋าตังค์ทิ้งลงไปแทนซองลูกอม เงินในกระเป๋ากลายเป็น 0 ทันที${bankSafeNote}`, 'เผลอโยนทิ้งสลับกับซองขนมหน้าคาเฟ่', ['🗑️', 'โยนผิดมือ!', `มี ${lostAmount.toLocaleString()} เหรียญ`]],
        ['MC_LOST_WIND', '🌪️ วิกฤตลมสลาตันพัดกระเป๋าตังค์ปลิวหาย', 'ลมพายุหมุนพัดกระเป๋าตังค์หลุดมือลอยหายขึ้นฟ้า เงินในกระเป๋ากลายเป็น 0 ทันที!', `คุณหยิบกระเป๋าตังค์ที่มีเงิน ${lostAmount.toLocaleString()} เหรียญทองขึ้นมาเตรียมจะนับโชว์ จู่ๆ ลมพายุหมุนลูกจิ๋วก็พัดโฉบมาหอบกระเป๋าตังค์ของคุณลอยเคว้งข้ามหลังคาหายวับไปต่อหน้าต่อตา กลายเป็นคนหมดตัว 0 เหรียญในกระเป๋าทันที${bankSafeNote}`, 'โดนลมพายุหมุนพัดปลิวไปตกพุ่มไม้หน้าร้าน', ['🌪️', 'พายุหมุนโฉบ!', `มี ${lostAmount.toLocaleString()} เหรียญ`]]
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
        `สวรรค์เข้าข้างคนสู้ชีวิต! คุณเดินก้มหน้าอยู่ดีๆ ก็ไปเตะเจอกระเป๋าตังค์ตุงๆ ของ "${prevOwner}" ที่เจ้าตัวเพิ่ง${lostWhy}ตกอยู่หมาดๆ พอเปิดซิปดูข้างในมีเงินอยู่ถึง ${foundAmt.toLocaleString()} เหรียญทอง เลยเก็บเข้ากระเป๋าตัวเองมาปลดหนี้ตั้งตัวแบบหวานเจี๊ยบเลยค่ะ`,
        foundAmt,
        `กระเป๋ามี ${startBal.toLocaleString()} ➔ เดินไปเจอกระเป๋าตังค์ที่ ${prevOwner} ทำตกไว้พอดี รับเงินทั้งหมด +${foundAmt.toLocaleString()} เหรียญ = ยอดได้รับสุทธิ +${foundAmt.toLocaleString()} เหรียญทอง`,
        [['👀', 'ก้มมองพื้นร้าน', 'เจอกระเป๋าตังค์ตกอยู่!', 'zero'], ['👛', `ของ ${prevOwner}`, lostWhy, 'miracle'], ['🤑', `+${foundAmt.toLocaleString()}`, 'หวานเจี๊ยบรับยกซอง!', 'miracle']],
        undefined, { stampId: 'MC_FOUND_FRIEND' }
      );
    }
    const mysteryPct = pickRandom([60, 80, 100, 120]);
    const mysteryAmt = Math.min(2800, Math.max(400, Math.round((refBase * mysteryPct) / 100)));
    return pack(
      'MIRACLE', '👛 ปาฏิหาริย์พบกระเป๋าตังค์ปริศนา',
      `เปิดพรมเช็ดเท้าเจอกระเป๋าตังค์ปริศนาซ่อนอยู่ รับทรัพย์ +${mysteryAmt.toLocaleString()} เหรียญ!`,
      `คุณเดินสะดุดพรมเช็ดเท้าหน้าประตูคาเฟ่ พอเลิกพรมดูดันเจอกระเป๋าตังค์หนังจระเข้ปริศนาที่เศรษฐีนิรนามวางลืมไว้ ข้างในมีเหรียญทองอัดแน่นคิดเป็นโบนัส +${mysteryPct}% เข้ากระเป๋าคุณเอาไปปลดหนี้ตั้งตัวทันทีเลยค่ะ`,
      mysteryAmt,
      `กระเป๋ามี ${startBal.toLocaleString()} ➔ พบกระเป๋าตังค์ปริศนาใต้พรมเช็ดเท้าได้โบนัส +${mysteryPct}% เป็นเงิน +${mysteryAmt.toLocaleString()} เหรียญ = ยอดได้รับสุทธิ +${mysteryAmt.toLocaleString()} เหรียญทอง`,
      [['🧶', 'สะดุดพรมเช็ดเท้า', 'เลิกพรมขึ้นมาดู', 'zero'], ['👛', 'พบกระเป๋าปริศนา!', `โบนัสพุ่ง +${mysteryPct}%`, 'miracle'], ['💰', `+${mysteryAmt.toLocaleString()}`, 'รับทรัพย์เข้ากระเป๋า!', 'miracle']],
      undefined, { stampId: 'MC_FOUND_MAT' }
    );
  }

  // 🍪 กระป๋องคุกกี้แดงฝังดิน (เฉพาะเงินในกระเป๋า)
  if (chosen === 'TIME_CAPSULE_VAULT') {
    if (!worldState.timeCapsule && startBal > 100) {
      const buriedAmt = Math.max(60, Math.round(startBal * 0.40));
      worldState.timeCapsule = { ownerName: myTitle, amount: buriedAmt };
      return pack(
        'DIVIDER', '🍪 อีเวนต์ซ่อนตังค์ในกระป๋องคุกกี้แดง',
        'แอบแบ่งเงินในกระเป๋า -40% ใส่กระป๋องคุกกี้สีแดงไปฝังดินไว้ใต้ต้นไม้หน้าร้าน แต่ดันลืมพิกัด!',
        `คุณกลัวตัวเองใช้เงินมือเติบ เลยแบ่งเหรียญทองในกระเป๋า 40% จำนวน ${buriedAmt.toLocaleString()} เหรียญ ใส่กระป๋องคุกกี้สีแดงในตำนานไปขุดหลุมฝังไว้ใต้ต้นไม้หน้าคาเฟ่ แต่พอเดินกลับมาที่โต๊ะดันลืมไปแล้วว่าฝังไว้ต้นไหน จะมีใครแอบไปขุดเจอไหมคะเนี่ย`,
        -buriedAmt,
        `กระเป๋ามี ${startBal.toLocaleString()} ➔ แบ่งเงิน -40% ใส่กระป๋องคุกกี้ไปฝังดินแล้วลืมพิกัด -${buriedAmt.toLocaleString()} เหรียญ จะมีใครมาขุดเจอไหมเนี่ย! = ยอดหักสุทธิ -${buriedAmt.toLocaleString()} เหรียญทอง`,
        [['🍪', 'กระป๋องคุกกี้แดง', 'ไม่ใช่คุกกี้แต่เป็นตังค์!', 'zero'], ['🌳', 'เอาไปฝังไว้ -40%!', 'ดันลืมว่าฝังไว้ต้นไหน', 'tax'], ['🕳️', `-${buriedAmt.toLocaleString()}`, 'จะมีใครมาขุดเจอไหมเนี่ย!', 'divide']],
        undefined, { stampId: 'MC_COOKIE_BURY', walletOnly: true, skipTipJarSink: true }
      );
    } else if (worldState.timeCapsule) {
      const cap = worldState.timeCapsule;
      const maturedAmt = Math.round(cap.amount * 1.35);
      worldState.timeCapsule = null;
      return pack(
        'MIRACLE', '🍪 ปาฏิหาริย์ขุดเจอกระป๋องคุกกี้แดง',
        `ขุดเจอกระป๋องคุกกี้แดงของ "${cap.ownerName}" ที่ฝังลืมไว้ รับเงินคูณ ×1.35 เท่า!`,
        `คุณเดินไปสะดุดดินนูนๆ ใต้ต้นไม้หน้าคาเฟ่ พอลองเขี่ยดูดันเจอกระป๋องคุกกี้สีแดงที่ "${cap.ownerName}" เอาเงินไปฝังซ่อนไว้ ${cap.amount.toLocaleString()} เหรียญ แถมมีเหรียญมงคลงอกเพิ่มขึ้นมาเป็น ×1.35 เท่า รับไปเต็มๆ ${maturedAmt.toLocaleString()} เหรียญทองเลยค่ะ`,
        maturedAmt,
        `กระเป๋ามี ${startBal.toLocaleString()} ➔ ขุดเจอกระป๋องคุกกี้ของ ${cap.ownerName} ยอดเดิม ${cap.amount.toLocaleString()} เหรียญ งอกเงย × 1.35 เท่า = ยอดได้รับสุทธิ +${maturedAmt.toLocaleString()} เหรียญทอง`,
        [['⛏️', 'สะดุดโคนต้นไม้', `กระป๋องของ ${cap.ownerName}`, 'zero'], ['🍪', 'เปิดมาเจอตังค์ ×1.35!', `จากเดิม ${cap.amount.toLocaleString()}`, 'miracle'], ['💎', `+${maturedAmt.toLocaleString()}`, 'หวานเจี๊ยบรับยกกระป๋อง!', 'miracle']],
        undefined, { stampId: 'MC_COOKIE_DIG' }
      );
    }
  }

  // 🎲 ลูกเต๋าทองคำวัดใจบาริสต้า
  if (chosen === 'QUANTUM_MULTIPLIER_DICE') {
    const factor = pickRandom([2, 3]);
    if (Math.random() < 0.52) {
      const gain = Math.min(3800, Math.max(250, Math.round(refBase * (factor - 0.5))));
      return pack(
        'JACKPOT', '🎲 ปาฏิหาริย์ลูกเต๋าทองคำทวีคูณ',
        `ทอยลูกเต๋าทองคำหน้าเคาน์เตอร์ออกแต้มคูณ ×${factor} รับทรัพย์พุ่ง +${gain.toLocaleString()} เหรียญ!`,
        `อเลสเทียชวนคุณทอยลูกเต๋าทองคำเสี่ยงทายบนเคาน์เตอร์บาริสต้า ลูกเต๋าหมุนติ้วแล้วหยุดที่หน้าตัวคูณ ×${factor} พอดีเป๊ะ อเลสเทียเลยควักถุงทองคำแถมเงินรางวัลทวีคูณเข้ากระเป๋าคุณทันทีเลยค่ะ`,
        gain,
        `กระเป๋ามี ${startBal.toLocaleString()} ➔ ทอยลูกเต๋าทองคำออกหน้า ×${factor} รับเงินรางวัลเพิ่ม +${gain.toLocaleString()} เหรียญ = ยอดได้รับสุทธิ +${gain.toLocaleString()} เหรียญทอง`,
        [['🎲', 'ทอยเต๋าทองคำ', 'ลุ้นแต้มหน้าเคาน์เตอร์', 'win'], ['⚡', 'ออกแต้มมงคล!', 'อเลสเทียปรบมือรัวๆ', 'miracle'], ['🚀', `×${factor}`, `รับทรัพย์ +${gain.toLocaleString()}!`, 'miracle']],
        undefined, { stampId: 'MC_DICE_MULT' }
      );
    }
    const cut = Math.max(50, Math.round(refBase * (1 - 1 / factor)));
    return pack(
      'DIVIDER', '🎲 วิกฤตลูกเต๋าอาถรรพ์ผ่ากระเป๋า',
      `ทอยลูกเต๋าวัดดวงพลาดท่า ออกหน้าหาร ÷${factor} โดนหักเงินทันที!`,
      `คุณลองหยิบลูกเต๋าไม้โบราณบนเคาน์เตอร์มาโยนเล่น แต่ลูกเต๋าดันกลิ้งไปหยุดที่หน้าหาร ÷${factor} เลยต้องควักเหรียญทองจ่ายค่าต๋งตามกติกาเลยค่ะ`,
      -cut,
      `กระเป๋ามี ${startBal.toLocaleString()} ➔ ทอยลูกเต๋าออกหน้า ÷${factor} ต้องแบ่งเงินจ่ายไป -${cut.toLocaleString()} เหรียญ = ยอดหักสุทธิ -${cut.toLocaleString()} เหรียญทอง`,
      [['🎲', 'ทอยเต๋าวัดดวง', 'ลูกเต๋ากลิ้งตกขอบโต๊ะ', 'tax'], ['😱', 'ออกหน้าหารเฉยเลย!', 'เสียค่าต๋งตามกติกา', 'divide'], ['🪓', `÷${factor}`, `หักไป -${cut.toLocaleString()}!`, 'divide']],
      undefined, { stampId: 'MC_DICE_DIV' }
    );
  }

  // 🐷 ทุบกระปุกหมูหน้าเคาน์เตอร์
  if (chosen === 'TIP_JAR_SMASH') {
    const jarLoot = Math.max(350, Number(worldState.cursedTipJar || 500));
    worldState.cursedTipJar = 300;
    return pack(
      'MIRACLE', '🐷 ปาฏิหาริย์กระปุกหมูหน้าเคาน์เตอร์แตก',
      `เผลอปัดกระปุกออมสินหมูของร้านแตก กวาดเหรียญสะสมมา +${jarLoot.toLocaleString()} เหรียญ!`,
      `คุณเดินไปสั่งน้ำที่เคาน์เตอร์แล้วข้อศอกเผลอไปชนกระปุกออมสินหมูทองคำที่เพื่อนๆ คนก่อนหน้าโดนหักเงินหยอดสะสมไว้จนแตกกระจาย เหรียญทองไหลทะลักเข้ากระเป๋าคุณทั้งหมด ${jarLoot.toLocaleString()} เหรียญทองเลยค่ะ`,
      jarLoot,
      `กระเป๋ามี ${startBal.toLocaleString()} ➔ เผลอปัดกระปุกหมูสะสมของคาเฟ่แตก กวาดเงินสะสมทั้งหมด +${jarLoot.toLocaleString()} เหรียญ = ยอดได้รับสุทธิ +${jarLoot.toLocaleString()} เหรียญทอง`,
      [['🐷', 'กระปุกหมูคาเฟ่', 'สะสมเงินคนโดนปรับ', 'win'], ['🔨', 'เผลอปัดแตกโพละ!', 'เหรียญทะลักเต็มพื้นร้าน', 'miracle'], ['🤑', `+${jarLoot.toLocaleString()}`, 'กวาดเรียบเข้ากระเป๋า!', 'miracle']],
      undefined, { stampId: 'MC_TIP_JAR' }
    );
  }

  // 1. 🧲 แม่เหล็กดึงดูดทรัพย์ (ดูดเฉพาะเงินในกระเป๋าเพื่อน)
  if (chosen === 'COMMUNITY_TAX_MAGNET' && otherPlayers.length > 0) {
    const pct = randInt(5, 10);
    const mutations = [];
    let totalSucked = 0;
    otherPlayers.forEach((p) => {
      if (p.walletBalance > 20) {
        const drain = Math.max(5, Math.round((p.walletBalance * pct) / 100));
        totalSucked += drain;
        mutations.push(mutDelta(p, -drain, `🧲 โดนแม่เหล็กของ ${myTitle} ดูดเงิน ${pct}%`, true));
      }
    });
    if (totalSucked === 0) totalSucked = randInt(30, 65) * 10;
    return pack(
      'MIRACLE', '🧲 ปาฏิหาริย์แม่เหล็กดึงดูดทรัพย์',
      `ดูดเงินจากกระเป๋าเพื่อนทั้งเซิร์ฟเวอร์คนละ ${pct}% เข้ากระเป๋าคุณสำเร็จ!`,
      'ปั่นเจอแม่เหล็กนีโอไดเมียมทรงพลัง! เครื่องทำงานปุ๊บ ดูดเหรียญทองจากกระเป๋าเพื่อนๆ ทั้งเซิร์ฟเวอร์ปลิววืดมาเข้ากระเป๋าคุณคนเดียวเลยค่ะ เตรียมตัวโดนรุมทวงในแชทได้เลยนะคะ',
      totalSucked,
      `กระเป๋ามี ${startBal.toLocaleString()} ➔ เปิดเครื่องแม่เหล็กดูดเงินในกระเป๋าเพื่อนทั้งเซิร์ฟเวอร์คนละ ${pct}% จำนวน ${mutations.length} คน รวมได้เงิน +${totalSucked.toLocaleString()} = ยอดได้รับสุทธิ +${totalSucked.toLocaleString()} เหรียญทอง`,
      [['🧲', `ดูด ${pct}%!`, 'แม่เหล็กนีโอไดเมียม', 'miracle'], ['🌪️', `${mutations.length} กระเป๋า`, 'เหรียญปลิวว่อนทั้งร้าน', 'miracle'], ['💰', `+${totalSucked.toLocaleString()}`, 'เข้ากระเป๋าคุณคนเดียว!', 'miracle']],
      mutations, { stampId: 'MC_MAGNET' }
    );
  }

  // 2. 🪓 ลูกกระจ๊อกล้มยักษ์ (ยึด 30% จากกระเป๋าตังค์สุลต่าน 3 อันดับแรก)
  if (chosen === 'DAVID_VS_GOLIATH' && otherPlayers.length > 0) {
    const top3 = [...otherPlayers].filter((p) => p.walletBalance > 100).sort((a, b) => b.walletBalance - a.walletBalance).slice(0, 3);
    if (top3.length > 0) {
      let totalSeized = 0;
      const mutations = [];
      const names = [];
      top3.forEach((s) => {
        const cut = Math.max(30, Math.round(s.walletBalance * 0.30));
        totalSeized += cut;
        names.push(formatFriendTitle(s));
        mutations.push(mutDelta(s, -cut, `🪓 โดน ${myTitle} ปฏิวัติยึดทรัพย์สุลต่าน 30%`, true));
      });
      return pack(
        'MIRACLE', '🪓 ปาฏิหาริย์ลูกกระจ๊อกล้มยักษ์',
        'ยึดเงินในกระเป๋า 30% จากสุลต่าน 3 อันดับแรกมาเข้ากระเป๋าคุณสำเร็จ!',
        'ประกายไฟแห่งการปฏิวัติจุดติดแล้ว! ปั่นเจอตรากองกำลังโค่นล้มมหาเศรษฐี ยึดเงินในกระเป๋าสุลต่านอันดับต้นๆ ในร้านมาแบ่งให้คุณคนเดียวเน้นๆ เลยค่ะ',
        totalSeized,
        `กระเป๋ามี ${startBal.toLocaleString()} ➔ ยึดทรัพย์ในกระเป๋า 30% จากสุลต่าน ${names.join(' และ ')} รวมเป็นเงิน +${totalSeized.toLocaleString()} หักจากกระเป๋าสุลต่านจริง! = ยอดได้รับสุทธิ +${totalSeized.toLocaleString()} เหรียญทอง`,
        [['🚩', 'ปฏิวัติ!', 'ลูกกระจ๊อกล้มยักษ์', 'miracle'], ['👑', 'ยึดสุลต่าน 30%', 'โค่นบัลลังก์มหาเศรษฐี', 'miracle'], ['💎', `+${totalSeized.toLocaleString()}`, 'รับส่วนแบ่งเต็มๆ!', 'miracle']],
        mutations, { stampId: 'MC_GOLIATH' }
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
        `วิชามารสะท้อนกลับ! อเลสเทียเสกระเบิดเวลาหนี้สินผูกติดเอว "${vTitle}" แล้วปลดหนี้ให้คุณเป็น 0 ป่านนี้เพื่อนคนที่โดนแจ็กพอตหนี้ไปคงนั่งร้องไห้โฮแล้วค่ะ`,
        debtAmt,
        `กระเป๋ามี ${startBal.toLocaleString()} ➔ โยนหนี้ทั้งหมด -${debtAmt.toLocaleString()} ไปใส่บัญชีของ ${vTitle} ส่วนกระเป๋าคุณล้างหนี้เป็น 0 = ยอดได้รับสุทธิ +${debtAmt.toLocaleString()} เหรียญทอง`,
        [['💸', `${startBal.toLocaleString()}`, 'หนี้สินเดิมของคุณ', 'tax'], ['💣', 'โยนระเบิดหนี้!', `เป้าหมายคือ ${vTitle}`, 'miracle'], ['✨', 'เหลือ 0!', `${vTitle} รับหนี้แทน!`, 'miracle']],
        [mutDelta(v, -debtAmt, `💣 โดน ${myTitle} โยนระเบิดหนี้ใส่`, false)],
        { stampId: 'MC_BOMB_DEBT' }
      );
    }
    return pack(
      'MIRACLE', '💣 ปาฏิหาริย์ระเบิดเวลาดูดทรัพย์',
      `ปาระเบิดใส่กระเป๋า "${vTitle}" กวาดเหรียญมาสำเร็จ!`,
      `เพราะคุณไม่มีหนี้ให้โยน อเลสเทียเลยดัดแปลงระเบิดเวลาไปผูกติดกระเป๋าตังค์ของ "${vTitle}" แทน พอระเบิดทำงาน เหรียญทองของเขาก็กระเด็นเข้ากระเป๋าคุณ 350 เหรียญทันทีค่ะ`,
      350,
      `กระเป๋ามี ${startBal.toLocaleString()} ➔ ปาระเบิดเวลาใส่บัญชีของ ${vTitle} ดูดเงินมา +350 เหรียญ หักจากเพื่อนจริง! = ยอดได้รับสุทธิ +350 เหรียญทอง`,
      [['💣', 'ตั้งเวลา!', 'ระเบิดดูดทรัพย์สิน', 'miracle'], ['💥', vTitle, 'กระเป๋าฉีกกระจาย', 'miracle'], ['🪙', '+350', 'เหรียญกระเด็นเข้ามือคุณ!', 'miracle']],
      [mutDelta(v, -350, `💣 โดน ${myTitle} ปาระเบิดดูดทรัพย์`, false)],
      { stampId: 'MC_BOMB_LOOT' }
    );
  }

  // 4. 🪞 กระจกเงาสะท้อนดวง (ก็อปปี้เฉพาะกระเป๋าตังค์ — ธนาคารปลอดภัย)
  if (chosen === 'MIRROR_COPY_CAT' && otherPlayers.length > 0) {
    const t = pickRandom(otherPlayers);
    const tTitle = formatFriendTitle(t);
    const copiedBal = Number(t.walletBalance || 0);
    const netDelta = copiedBal - startBal;
    return pack(
      netDelta >= 0 ? 'MIRACLE' : 'DIVIDER', '🪞 ปาฏิหาริย์กระจกเงาสะท้อนดวง',
      `ก็อปปี้ยอดกระเป๋าตังค์ของ "${tTitle}" มาเป็นของคุณสำเร็จ!`,
      `เสกเงาสะท้อนจิตวิญญาณ! คุณแอบใช้กระจกเวทมนตร์ส่องกระเป๋าตังค์ของ "${tTitle}" แล้วก็อปปี้ตัวเลขเงินสดของเขามาเป็นของคุณเป๊ะๆ โดยที่เงินเพื่อนและเงินธนาคารไม่กระทบเลยค่ะ`,
      netDelta,
      `กระเป๋ามี ${startBal.toLocaleString()} ➔ ใช้กระจกเงาส่องก็อปปี้ยอดกระเป๋าของ ${tTitle} ที่มี ${copiedBal.toLocaleString()} เหรียญ มาทับกระเป๋าคุณ = ${netDelta >= 0 ? 'ยอดได้รับสุทธิ +' + netDelta.toLocaleString() : 'ยอดหักสุทธิ ' + netDelta.toLocaleString()} เหรียญทอง`,
      [['🪞', 'กระจกเวทมนตร์', `ส่องกระเป๋า ${tTitle}`, 'miracle'], ['📋', 'คัดลอกตัวเลข!', 'เงินเพื่อนไม่ลดลงเลย!', 'miracle'], ['✨', `= ${copiedBal.toLocaleString()}`, 'ก็อปปี้ยอดกระเป๋าสำเร็จ!', 'miracle']],
      undefined, { stampId: 'MC_MIRROR', walletOnly: true, skipTipJarSink: true }
    );
  }

  // 5. 🦈 ปลาดุกยิงหนี้กระจาย
  if (chosen === 'SPREAD_THE_LOVE_DEBT' && otherPlayers.length > 0) {
    const totalDebt = startBal < 0 ? Math.abs(startBal) : randInt(25, 50) * 10;
    const share = Math.max(10, Math.round(totalDebt / otherPlayers.length));
    return pack(
      'MIRACLE', '🦈 ปาฏิหาริย์ปลาดุกยิงหนี้กระจาย',
      `หั่นบิลค่าใช้จ่ายแจกเพื่อนทั้งร้านช่วยกันจ่ายคนละ ${share.toLocaleString()} เหรียญ!`,
      'มิตรภาพคือการแบ่งปันค่ะ! ปลาดุกเวทมนตร์ช่วยหั่นบิลหนี้สินเป็นชิ้นเล็กชิ้นน้อยแล้วโปรยแจกเพื่อนๆ ทุกคนในร้านช่วยกันผ่อนชำระคนละนิดคนละหน่อย น้ำใจคนไทยน่ารักจังเลยนะคะ',
      totalDebt,
      `กระเป๋ามี ${startBal.toLocaleString()} ➔ กระจายภาระให้เพื่อน ${otherPlayers.length} คน ช่วยกันรับไปคนละ -${share.toLocaleString()} เหรียญ = ยอดได้รับสุทธิ +${totalDebt.toLocaleString()} เหรียญทอง`,
      [['🦈', 'ปลาดุกยิงหนี้!', `ยอดรวม ${totalDebt.toLocaleString()}`, 'miracle'], ['🍕', `หาร ${otherPlayers.length} คน`, `คนละ -${share.toLocaleString()} เหรียญ`, 'miracle'], ['🕊️', `+${totalDebt.toLocaleString()}`, 'เพื่อนรับจบให้ทั้งร้าน!', 'miracle']],
      otherPlayers.map((p) => mutDelta(p, -share, `🦈 โดนปลาดุกของ ${myTitle} แบ่งบิลมาให้ช่วยจ่าย`, false)),
      { stampId: 'MC_CATFISH' }
    );
  }

  // 6. ⚖️ สรรพากรเฉลี่ยสุข (เฉลี่ยเฉพาะเงินในกระเป๋า — ธนาคารปลอดภัย)
  if (chosen === 'COMMUNISM_EQUALIZER' && otherPlayers.length > 0) {
    const allSum = roster.reduce((acc, p) => acc + Number(p.walletBalance || 0), 0);
    const eqShare = Math.round(allSum / roster.length);
    const netDelta = eqShare - startBal;
    return pack(
      netDelta >= 0 ? 'MIRACLE' : 'DIVIDER', '⚖️ ปาฏิหาริย์สรรพากรเฉลี่ยสุข',
      `จับเงินในกระเป๋าทุกคนมารวมกันแล้วหารเฉลี่ยคนละ ${eqShare.toLocaleString()} เหรียญเท่ากันทั้งร้าน!`,
      'ฟองสบู่เศรษฐกิจตื่นรู้! อเลสเทียสวมหมวกสรรพากร กวาดเหรียญทองในกระเป๋าของทุกคนมากองรวมกันแล้วเทหารเท่ากันเป๊ะ! (ส่วนใครฝากธนาคารไว้ยังรอดปลอดภัยค่ะ)',
      netDelta,
      `รวมเงินในกระเป๋าทั้งร้านได้ ${allSum.toLocaleString()} เหรียญ ➔ นำมาหารเฉลี่ย ${roster.length} คน ได้คนละ ${eqShare.toLocaleString()} เหรียญเท่ากันเป๊ะ! = ${netDelta >= 0 ? 'ยอดได้รับสุทธิ +' + netDelta.toLocaleString() : 'ยอดหักสุทธิ ' + netDelta.toLocaleString()} เหรียญทอง`,
      [['⚖️', 'รวมกองกลาง!', `${allSum.toLocaleString()} เหรียญ`, 'miracle'], ['🤝', `หาร ${roster.length} ชีวิต`, 'เฉพาะเงินในกระเป๋า', 'miracle'], ['🌟', `= ${eqShare.toLocaleString()}`, 'เท่ากันทุกคนทั้งร้าน!', 'miracle']],
      otherPlayers.map((p) => mutSetWallet(p, eqShare, `⚖️ สรรพากรเฉลี่ยสุขโดย ${myTitle}`)),
      { stampId: 'MC_COMMUNISM', walletOnly: true, skipTipJarSink: true }
    );
  }

  // 7. 🎰 รัสเซียนรูเล็ตต์กระเป๋าตังค์
  if (chosen === 'RUSSIAN_ROULETTE' && otherPlayers.length >= 3) {
    const threeFriends = [...otherPlayers].sort(() => Math.random() - 0.5).slice(0, 3);
    const selfObj = activePlayerObj || { userId: activePlayerId, displayName: 'คุณ', walletBalance: startBal };
    const loser = [selfObj, ...threeFriends][Math.floor(Math.random() * 4)];
    const pot = Math.max(300, Math.abs(Number(loser.walletBalance || 0)));
    const share = Math.round(pot / 3);
    if (loser.userId === activePlayerId) {
      const netDelta = startBal > 0 ? -startBal : -300;
      return pack(
        'DIVIDER', '🎰 วิกฤตรัสเซียนรูเล็ตต์กระเป๋าตังค์',
        'กระสุนตกที่คุณพอดี โดนริบเงินในกระเป๋าไปแบ่งให้เพื่อน 3 คน!',
        'หมุนวงล้อแห่งชะตากรรม รัสเซียนรูเล็ตต์คาเฟ่! น่าเสียดายที่กระสุนเงินสุ่มมาตกที่คุณพอดี โดนริบเงินในกระเป๋านำไปแบ่งเค้กแจกจ่ายให้ผู้รอดชีวิตอีก 3 คนทันทีค่ะ',
        netDelta,
        `สุ่มผู้เล่น 4 คนเข้าวงล้อรัสเซียนรูเล็ตต์ ➔ คุณเป็นผู้โชคร้ายโดนริบเงินไปแบ่งให้เพื่อน 3 คน คนละ +${share.toLocaleString()} เหรียญ = ยอดหักสุทธิ ${netDelta.toLocaleString()} เหรียญทอง`,
        [['🔫', 'ผู้ท้าชิง 4 คน', 'หมุนลูกโม่วัดดวง', 'tax'], ['💥', 'ปัง! โดนคุณเต็มๆ', 'ริบทรัพย์เข้ากองกลาง', 'divide'], ['💸', `${netDelta.toLocaleString()}`, 'แบ่งให้เพื่อน 3 คนรอดชีวิต!', 'divide']],
        threeFriends.map((f) => mutDelta(f, share, `🎰 ชนะรัสเซียนรูเล็ตต์รับส่วนแบ่งจาก ${myTitle}`, false)),
        { stampId: 'MC_ROULETTE_LOSE', walletOnly: true }
      );
    }
    const loserTitle = formatFriendTitle(loser);
    return pack(
      'MIRACLE', '🎰 ปาฏิหาริย์รัสเซียนรูเล็ตต์กระเป๋าตังค์',
      `"${loserTitle}" โดนริบทรัพย์มาแบ่งให้คุณและเพื่อนสำเร็จ!`,
      'หมุนวงล้อแห่งชะตากรรม รัสเซียนรูเล็ตต์คาเฟ่! กระสุนเงินสุ่มไปตกที่เป้าหมายดวงซวย โดนริบเงินในกระเป๋าหมดตัวนำมาแบ่งเค้กแจกจ่ายให้คุณและผู้รอดชีวิตที่เหลือทันทีค่ะ',
      share,
      `สุ่มผู้เล่น 4 คนเข้าวงล้อ ➔ กระสุนตกที่ ${loserTitle} ถูกริบเงิน ${pot.toLocaleString()} เหรียญ นำมาหารแบ่งผู้รอดชีวิต 3 คน = ยอดได้รับสุทธิ +${share.toLocaleString()} เหรียญทอง`,
      [['🔫', 'ผู้ท้าชิง 4 คน', 'หมุนลูกโม่วัดดวง', 'miracle'], ['🎯', `โดน ${loserTitle}!`, 'ถูกริบเงินเข้ากองกลาง', 'miracle'], ['🍰', `+${share.toLocaleString()}`, 'ส่วนแบ่งผู้รอดชีวิต!', 'miracle']],
      threeFriends.map((f) =>
        f.userId === loser.userId
          ? mutDelta(f, f.walletBalance > 0 ? -f.walletBalance : -300, `🎰 แพ้รัสเซียนรูเล็ตต์ (วงของ ${myTitle})`, true)
          : mutDelta(f, share, `🎰 รอดชีวิตรัสเซียนรูเล็ตต์รับส่วนแบ่งจาก ${loserTitle}`, false)
      ),
      { stampId: 'MC_ROULETTE_WIN' }
    );
  }

  // 8. 💸 มหาทานบาริสต้า (ปรับช่วงรางวัลให้สมดุลขึ้น)
  if (chosen === 'ALESTIA_RAIN_MAKER') {
    const rainGift = randInt(3, 9) * 100;
    return pack(
      'MIRACLE', '💸 ปาฏิหาริย์มหาทานบาริสต้า',
      `อเลสเทียโปรยเงินแจกทุกคนในเซิร์ฟเวอร์คนละ +${rainGift.toLocaleString()} เหรียญ!`,
      'อเลสเทียอารมณ์ดีเพราะวันนี้ขายกาแฟได้ยอดทะลุเป้า! ขนถุงทองคำขึ้นไปบนชั้นลอยแล้วโปรยเหรียญลงมารดหัวทุกคนในคาเฟ่ ได้รับเงินขวัญถุงกันถ้วนหน้าเลยค่ะ',
      rainGift,
      `กระเป๋ามี ${startBal.toLocaleString()} ➔ อเลสเทียโปรยทานแจกผู้เล่นทั้งเซิร์ฟเวอร์ ${roster.length} คน ได้รับคนละ +${rainGift.toLocaleString()} เหรียญ = ยอดได้รับสุทธิ +${rainGift.toLocaleString()} เหรียญทอง`,
      [['☕', 'ยอดขายทะลุเป้า!', 'อเลสเทียอารมณ์ดีจัด', 'miracle'], ['🌧️', 'ฝนเหรียญทองคำ!', `โปรยแจกทั้งร้าน ${roster.length} คน`, 'miracle'], ['💸', `+${rainGift.toLocaleString()}`, 'รวยถ้วนหน้าทั้งเซิร์ฟเวอร์!', 'miracle']],
      otherPlayers.map((p) => mutDelta(p, rainGift, `🌧️ รับฝนเหรียญมหาทานบาริสต้า (จากรอบของ ${myTitle})`, false)),
      { stampId: 'MC_RAIN_MAKER' }
    );
  }

  // 9. ⛓️ สัญญาผูกมิตรโซ่ล่ามชะตา
  if (chosen === 'SOUL_BOND_TWINS' && otherPlayers.length > 0) {
    const partner = pickRandom(otherPlayers);
    const partnerTitle = formatFriendTitle(partner);
    const bondBonus = randInt(25, 60) * 10;
    if (!worldState.soulBonds || typeof worldState.soulBonds !== 'object') worldState.soulBonds = {};
    worldState.soulBonds[activePlayerId] = partner.userId;
    worldState.soulBonds[partner.userId] = activePlayerId;
    return pack(
      'MIRACLE', '⛓️ สัญญาผูกมิตรโซ่ล่ามชะตา',
      `ร้อยด้ายแดงผูกดวงร่วมกับ "${partnerTitle}" สำเร็จ!`,
      `ร้อยด้ายแดงแห่งชะตากรรม! รอบสล็อตนี้ผูกดวงของคุณเข้ากับ "${partnerTitle}" โดยในการปั่นสล็อตรอบถัดไปเพียง 1 ครั้ง ไม่ว่าใครจะได้เงินหรือเสียเงิน อีกฝ่ายจะรับผล 50% ตามไปด้วยทันทีค่ะ`,
      bondBonus,
      `ผูกโซ่ล่ามชะตากับ ${partnerTitle} สำเร็จ แชร์ดวงร่วมกัน 50% ในการปั่นสล็อตครั้งถัดไป ➔ รับโบนัสพันธสัญญาคนละ +${bondBonus.toLocaleString()} เหรียญ = ยอดได้รับสุทธิ +${bondBonus.toLocaleString()} เหรียญทอง`,
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
      let myNetDelta = 400;
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
        'เกิดการปฏิวัติโครงสร้างเศรษฐกิจ! เทพธิดาจับกระเป๋าตังค์อันดับ 1 คว่ำลง แล้วยกอันดับบ๊วยสุดขึ้นมานั่งแทนที่ สลับยอดกระเป๋ากันแบบสายฟ้าแลบ (ส่วนเงินในธนาคารยังปลอดภัยค่ะ)',
        myNetDelta,
        `สลับยอดกระเป๋าของอันดับ 1 ${topTitle} ที่มี ${topOld.toLocaleString()} เหรียญ กับอันดับสุดท้าย ${botTitle} ที่มี ${botOld.toLocaleString()} เหรียญทันที! = ${myNetDelta >= 0 ? 'ยอดได้รับสุทธิ +' + myNetDelta.toLocaleString() : 'ยอดหักสุทธิ ' + myNetDelta.toLocaleString()} เหรียญทอง`,
        [['👑', topTitle, `เดิมมี ${topOld.toLocaleString()}`, 'miracle'], ['🔄', 'สลับขั้วกระเป๋า!', 'เงินธนาคารยังปลอดภัย', 'miracle'], ['🚀', botTitle, 'สลับยอดสำเร็จทันที!', 'miracle']],
        mutations, { stampId: 'MC_RANK_SWAP', walletOnly: true, skipTipJarSink: true }
      );
    }
  }

  // 11. 🔄 สลับกระเป๋าตังค์แบบสุ่ม (เฉพาะกระเป๋าตังค์ — ธนาคารปลอดภัย)
  if (chosen === 'RANDOM_WALLET_SWAP' && otherPlayers.length > 0) {
    const diffCandidates = otherPlayers.filter((p) => p.walletBalance !== startBal);
    const f = pickRandom(diffCandidates.length > 0 ? diffCandidates : otherPlayers);
    const fTitle = formatFriendTitle(f);
    const fOld = Number(f.walletBalance || 0);
    const netDelta = fOld - startBal;
    return pack(
      'MIRACLE', '🔄 ปาฏิหาริย์สลับกระเป๋าตังค์',
      `สลับกระเป๋าตังค์กับ "${fTitle}" แบบสดๆ สำเร็จ!`,
      `เวทมนตร์สลับวิญญาณทำงาน! อเลสเทียแอบหยิบกระเป๋าตังค์ของคุณไปสลับกับของ "${fTitle}" ที่วางอยู่บนโต๊ะข้างๆ (ส่วนเงินที่ฝากไว้ในธนาคารจะไม่ถูกสลับไปด้วยค่ะ)`,
      netDelta,
      `กระเป๋ามี ${startBal.toLocaleString()} ➔ สลับกระเป๋าตังค์กับ ${fTitle} ที่มี ${fOld.toLocaleString()} เหรียญ (เงินธนาคารปลอดภัย) = ${netDelta >= 0 ? 'ยอดได้รับสุทธิ +' + netDelta.toLocaleString() : 'ยอดหักสุทธิ ' + netDelta.toLocaleString()} เหรียญทอง`,
      [['👛', `${startBal.toLocaleString()}`, 'กระเป๋าเดิมของคุณ', 'zero'], ['🔄', 'สลับกระเป๋า!', `คู่กรณีคือ ${fTitle}`, 'miracle'], ['🎭', `${fOld.toLocaleString()}`, `ได้กระเป๋า ${fTitle}!`, 'miracle']],
      [mutSetWallet(f, startBal, `🎭 โดน ${myTitle} สลับกระเป๋าตังค์`)],
      { stampId: 'MC_WALLET_SWAP', walletOnly: true, skipTipJarSink: true }
    );
  }

  // 12. 🥷 ปฏิบัติการปล้นสุลต่านอันดับ 1 (ฉกจากกระเป๋าตังค์สุลต่าน)
  if (chosen === 'STEAL_SULTAN' && otherPlayers.length > 0) {
    const topSultan = [...otherPlayers].sort((a, b) => b.walletBalance - a.walletBalance)[0];
    if (topSultan && topSultan.walletBalance > 50) {
      const sTitle = formatFriendTitle(topSultan);
      const stealPct = pickRandom([25, 35, 45, 50]);
      const stolenAmt = Math.max(30, Math.round((topSultan.walletBalance * stealPct) / 100));
      return pack(
        'MIRACLE', '🥷 ปฏิบัติการปล้นสุลต่านอันดับ 1',
        `บุกขโมยเงินจากกระเป๋าของ "${sTitle}" สำเร็จ!`,
        `คุณสวมหน้ากากจอมโจรย่องเข้าห้อง VIP ของสุลต่านอันดับ 1 "${sTitle}" แล้วกวาดเหรียญทองในกระเป๋าของเขามาถึง ${stealPct}% โอนเข้ากระเป๋าคุณแบบเนียนกริบเลยค่ะ`,
        stolenAmt,
        `สุลต่าน ${sTitle} มีในกระเป๋า ${topSultan.walletBalance.toLocaleString()} ➔ คุณแอบย่องไปฉกมา ${stealPct}% ได้เงิน +${stolenAmt.toLocaleString()} เหรียญ หักจากกระเป๋าสุลต่านสดๆ! = ยอดได้รับสุทธิ +${stolenAmt.toLocaleString()} เหรียญทอง`,
        [['👑', sTitle, `มี ${topSultan.walletBalance.toLocaleString()} เหรียญ`, 'win'], ['🥷', `ฉกมา ${stealPct}%!`, 'ปฏิบัติการปล้นสุลต่าน', 'miracle'], ['💰', `+${stolenAmt.toLocaleString()}`, 'โอนเข้ากระเป๋าคุณ!', 'miracle']],
        [mutDelta(topSultan, -stolenAmt, `🥷 โดน ${myTitle} ย่องปล้นกระเป๋าสุลต่าน ${stealPct}%`, true)],
        { stampId: 'MC_STEAL_SULTAN' }
      );
    }
  }

  // 13. 🤪/🤩 รู้สึกว่าอยากจน / อยากรวย (สลับเฉพาะกระเป๋าตังค์ — ธนาคารปลอดภัย)
  if (chosen === 'WANT_RICH_POOR' && otherPlayers.length > 0) {
    const sorted = [...otherPlayers].sort((a, b) => b.walletBalance - a.walletBalance);
    const richest = sorted[0];
    const poorest = sorted[sorted.length - 1];
    if (Math.random() < 0.5 && poorest && startBal !== poorest.walletBalance) {
      const pTitle = formatFriendTitle(poorest);
      const pOld = Number(poorest.walletBalance || 0);
      const netDelta = pOld - startBal;
      return pack(
        'DIVIDER', '🤪 อีเวนต์ปาฏิหาริย์กลับตาลปัตร',
        `อยู่ดีๆ ก็รู้สึกว่าอยากจน เลยสลับกระเป๋ากับ "${pTitle}" ทันที!`,
        `โชคชะตาพัดพาความติสต์เข้าสิง! คุณบ่นพึมพำว่า รู้สึกว่าอยากลองใช้ชีวิตแบบคนจนดูบ้าง เทพธิดาแห่งโชคชะตาเลยสลับกระเป๋าตังค์ของคุณกับ "${pTitle}" ทันทีเลยค่ะ (เงินในธนาคารไม่ถูกสลับ)`,
        netDelta,
        `กระเป๋ามี ${startBal.toLocaleString()} อยู่ดีๆ ก็อยากลองจนดูบ้าง ➔ เลยสลับกระเป๋ากับ ${pTitle} ที่มี ${pOld.toLocaleString()} เหรียญ = ${netDelta >= 0 ? 'ยอดได้รับสุทธิ +' + netDelta.toLocaleString() : 'ยอดหักสุทธิ ' + netDelta.toLocaleString()} เหรียญทอง`,
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
        `คุณแหงนหน้ามองเพดานคาเฟ่แล้วตะโกนว่า รู้สึกว่าอยากรวยโว้ยยย! สวรรค์เลยสั่งสลับกระเป๋าตังค์ของคุณกับคนที่พกเงินสดเยอะที่สุดอย่าง "${rTitle}" แบบสายฟ้าแลบเลยค่ะ (เงินในธนาคารไม่ถูกสลับ)`,
        netDelta,
        `กระเป๋ามี ${startBal.toLocaleString()} ตะโกนลั่นร้านว่าอยากรวย ➔ เลยได้สลับกระเป๋ากับสุลต่าน ${rTitle} ที่มี ${rOld.toLocaleString()} เหรียญ = ${netDelta >= 0 ? 'ยอดได้รับสุทธิ +' + netDelta.toLocaleString() : 'ยอดหักสุทธิ ' + netDelta.toLocaleString()} เหรียญทอง`,
        [['🙏', `${startBal.toLocaleString()}`, 'ตะโกนว่าอยากรวย!', 'zero'], ['🤩', 'สลับสุลต่าน!', `ยึดกระเป๋า ${rTitle}`, 'miracle'], ['👑', `${rOld.toLocaleString()}`, 'กลายเป็นเศรษฐีทันที!', 'miracle']],
        [mutSetWallet(richest, startBal, `🤩 โดน ${myTitle} (ตะโกนอยากรวย) สลับกระเป๋าตังค์`)],
        { stampId: 'MC_WANT_RICH', walletOnly: true, skipTipJarSink: true }
      );
    }
  }

  // 14. 👑 ขอทานเศรษฐี
  if (chosen === 'BEGGAR_BILLIONAIRE') {
    const megaGrant = randInt(12, 30) * 100;
    const debtForgiven = startBal < 0 ? Math.abs(startBal) : 0;
    const netDelta = debtForgiven + megaGrant;
    return pack(
      'MIRACLE', '👑 ปาฏิหาริย์ขอทานเศรษฐี',
      'มหาเศรษฐีลึกลับโยนหีบทองคำแท้ใส่ตัก รับทรัพย์ล้นกระเป๋า!',
      'ชะตาฟ้าลิขิตให้รวย! มหาเศรษฐีลึกลับเดินผ่านโต๊ะของคุณแล้วโยนหีบทองคำแท้ใส่ตักให้ไปตั้งตัวแบบล้นๆ เลยค่ะ',
      netDelta,
      debtForgiven > 0
        ? `กระเป๋ามี ${startBal.toLocaleString()} ➔ อเลสเทียล้างหนี้ให้ +${debtForgiven.toLocaleString()} จนเป็น 0 ➔ แถมขุมทรัพย์ขอทานเศรษฐีให้อีก +${megaGrant.toLocaleString()} = ยอดได้รับสุทธิ +${netDelta.toLocaleString()} เหรียญทอง`
        : `กระเป๋ามี ${startBal.toLocaleString()} ➔ ได้รับหีบทองคำขอทานเศรษฐี +${megaGrant.toLocaleString()} = ยอดได้รับสุทธิ +${netDelta.toLocaleString()} เหรียญทอง`,
      [['🥣', 'โชคชะตา...', 'จุดเปลี่ยนแห่งชีวิต', 'zero'], ['⚡', 'ปาฏิหาริย์!', 'ฟ้าผ่ากลางคาเฟ่', 'miracle'], ['👑', `+${megaGrant.toLocaleString()}`, 'ขอทานเศรษฐี!', 'miracle']],
      undefined, { stampId: 'MC_BEGGAR_KING' }
    );
  }

  // 15. ☯️ ชะตาเล่นตลก (พลิกขั้วเฉพาะเงินในกระเป๋า — ธนาคารปลอดภัย)
  if (chosen === 'POLARITY_FLIP') {
    if (startBal === 0) {
      const chaosVal = Math.random() < 0.5 ? 555 : -555;
      return pack(
        'MIRACLE', '☯️ ปาฏิหาริย์ชะตาเล่นตลก',
        `เสกเลขตองเสียงหัวเราะ ${chaosVal > 0 ? '+555' : '-555'} ใส่กระเป๋าตังค์!`,
        'โชคชะตาตั้งใจจะพลิกขั้วเงินในกระเป๋าของคุณ แต่เปิดมาเจอกระเป๋าว่างเปล่า 0 เหรียญ ชะตาเลยหัวเราะ 555 แล้วเสกเหรียญเลขตองใส่กระเป๋าแทนค่ะ',
        chaosVal,
        `กระเป๋ามี 0 เหรียญ ไม่มีขั้วให้พลิก ➔ โชคชะตาเลยขำกลิ้งเสกเลขตอง ${chaosVal > 0 ? '+555' : '-555'} ใส่กระเป๋าให้แทน = ${chaosVal > 0 ? 'ยอดได้รับสุทธิ +555' : 'ยอดหักสุทธิ -555'} เหรียญทอง`,
        [['🎭', '0', 'กระเป๋าว่างเปล่า', 'zero'], ['🌀', 'พลิกขั้ว!', 'ชะตาเล่นตลก', 'miracle'], ['🃏', `${chaosVal > 0 ? '+555' : '-555'}`, 'เสียงหัวเราะแห่งโชค!', 'miracle']],
        undefined, { stampId: 'MC_POLARITY_ZERO', walletOnly: true }
      );
    }
    const flippedBal = -startBal;
    const netDelta = flippedBal - startBal;
    return pack(
      'MIRACLE', '☯️ ปาฏิหาริย์ชะตาเล่นตลก',
      startBal < 0 ? 'พลิกขั้วหนี้สินติดลบทั้งหมดให้กลายเป็นเงินสดเต็มจำนวน!' : 'เงินบวกในกระเป๋าถูกกระจกมนตราพลิกกลับด้านกลายเป็นหนี้!',
      startBal < 0
        ? 'สะใจสุดๆ ไปเลยค่ะ! กระจกเวทมนตร์สะท้อนยอดหนี้ติดลบของคุณให้พลิกกลับขั้วกลายเป็นเงินบวกเต็มจำนวน ยิ่งเคยเป็นหนี้เยอะยิ่งรวยเละค่ะ'
        : 'อุ๊ยตายแล้ววว! โชคชะตาเล่นตลกร้าย เสกให้ตัวเลขเงินบวกในกระเป๋าของคุณพลิกกลับด้านกลายเป็นตัวเลขติดลบในพริบตา (ส่วนเงินในธนาคารยังปลอดภัยดีค่ะ)',
      netDelta,
      startBal < 0
        ? `กระเป๋ามี ${startBal.toLocaleString()} ➔ กระจกเวทมนตร์พลิกหนี้ติดลบให้กลายเป็นเงินสด +${flippedBal.toLocaleString()} เหรียญ = ยอดได้รับสุทธิ +${netDelta.toLocaleString()} เหรียญทอง`
        : `กระเป๋ามี +${startBal.toLocaleString()} ➔ กระจกเวทมนตร์พลิกเงินในกระเป๋ากลับด้านกลายเป็น ${flippedBal.toLocaleString()} เหรียญ (เงินธนาคารปลอดภัย) = ยอดหักสุทธิ ${netDelta.toLocaleString()} เหรียญทอง`,
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
        'อเลสเทียทนเห็นคุณแบกหนี้หลังแอ่นไม่ไหว เลยแอบเอาสมุดบัญชีหนี้ของคุณไปเผาไฟทิ้งให้ทั้งหมดแล้วค่ะ เริ่มต้นชีวิตใหม่แบบไร้หนี้กันนะคะ',
        debtCleared,
        `กระเป๋ามี ${startBal.toLocaleString()} ➔ อเลสเทียเผาสมุดจดหนี้ทิ้งทั้งหมด +${debtCleared.toLocaleString()} เหรียญ ล้างหนี้เป็น 0 ทันที! = ยอดได้รับสุทธิ +${debtCleared.toLocaleString()} เหรียญทอง`,
        [['💸', `${startBal.toLocaleString()}`, 'หนี้สินคงค้าง', 'tax'], ['🔥', 'เผาสัญญา!', 'อเลสเทียเมตตา', 'miracle'], ['👼', 'ปลดหนี้ 100%', 'ล้างหนี้เป็น 0 ทันที!', 'miracle']],
        undefined, { stampId: 'MC_DEBT_CLEAR' }
      );
    }
    return pack(
      'ZERO', '👼 อีเวนต์อเลสเทียปลดหนี้',
      'สิทธิ์ปลดหนี้ไร้ผลเนื่องจากคุณไม่ได้เป็นหนี้ค่ะ!',
      'อเลสเทียถือยางลบเตรียมมาลบหนี้ให้เต็มที่เลยค่ะ แต่เปิดดูสมุดบัญชีแล้วคุณไม่ได้ติดหนี้คาเฟ่เลยแม้แต่เหรียญเดียว สล็อตรอบนี้จึงไร้ผลค่ะ',
      0,
      `กระเป๋ามี ${startBal.toLocaleString()} เหรียญ ไม่ได้ติดหนี้คาเฟ่เลยสักเหรียญ ➔ อเลสเทียเลยเก็บยางลบใส่กระเป๋าตามเดิม = ยอดได้รับสุทธิ 0 เหรียญทอง`,
      [['✨', `${startBal.toLocaleString()}`, 'ไร้หนี้สิน', 'win'], ['👼', 'ปลดหนี้', 'ตรวจสอบบัญชี...', 'miracle'], ['🫧', 'ไร้ผล 0', 'คุณไม่ได้เป็นหนี้ค่ะ!', 'zero']],
      undefined, { stampId: 'MC_DEBT_NOOP' }
    );
  }

  // 17. 🔨 อเลสเทียยึดทรัพย์สิน (ไม่รอดแม้ฝากธนาคาร! อายัดทั้งกระเป๋าและธนาคาร + เผา 65% ทิ้งถาวร)
  if (chosen === 'ALESTIA_SEIZURE') {
    const walletDelta = 1 - startBal;
    const seizedWallet = startBal > 1 ? startBal - 1 : 0;
    const totalSeized = seizedWallet + startBank;
    const netCombinedDelta = walletDelta - startBank;

    let droppedAmt = 0;
    let burnedAmt = 0;
    if (totalSeized > 100) {
      droppedAmt = Math.round(totalSeized * 0.35);
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
        ? `ประกาศกฎอัยการศึกประจำคาเฟ่ค่ะ! อเลสเทียสั่งยึดทรัพย์สินในกระเป๋า${bankPartText}เข้าคลังหลวงทั้งหมด (เผาลดเงินเฟ้อ 65%) แล้วเหลือเหรียญทองติดก้นถุงไว้ให้ดูต่างหน้า 1 เหรียญถ้วนนะคะ อิอิ`
        : 'อเลสเทียบุกมายึดทรัพย์สินของคุณค่ะ! แต่เปิดดูทั้งกระเป๋าและธนาคารมีแต่หนี้กับความว่างเปล่า อเลสเทียเลยยึดหนี้ไปแทน แล้ววางเหรียญทอง 1 เหรียญไว้ให้ตั้งตัวค่ะ',
      netCombinedDelta,
      `กระเป๋า ${startBal.toLocaleString()} + ธนาคาร ${startBank.toLocaleString()} ➔ กฎอัยการศึกยึดทรัพย์ทั้งสองบัญชีเหลือติดกระเป๋า 1 เหรียญ และธนาคาร 0 เหรียญ! = ${netCombinedDelta >= 0 ? 'ยอดสุทธิ +' + netCombinedDelta.toLocaleString() : 'ยอดหักสุทธิ ' + netCombinedDelta.toLocaleString()} เหรียญทอง`,
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
    const prize = Math.random() < 0.30 ? 5555 : 2777;
    return pack(
      'JACKPOT', '🎰 ปาฏิหาริย์สล็อตเรียงตอง 777',
      `ปั่นเจอเลขตองมงคล 777 รับทรัพย์ก้อนใหญ่ +${prize.toLocaleString()} เหรียญทอง!`,
      'เสียงระฆังทองคำดังลั่นร้าน! คุณปั่นสล็อตเจอเลขตองมงคลประจำคาเฟ่ Horizon รับเงินรางวัลแจ็กพอตใหญ่ไปนอนกอดได้เลยค่ะ',
      prize,
      `ปั่นเจอเลขตองมงคลเรียงกันครบ 3 ช่อง ➔ รับเงินรางวัลแจ็กพอตพิเศษ +${prize.toLocaleString()} เหรียญ = ยอดได้รับสุทธิ +${prize.toLocaleString()} เหรียญทอง`,
      [['7️⃣', 'LUCKY', 'เรียงตองช่องที่ 1', 'mult'], ['7️⃣', 'TRIPLE', 'เรียงตองช่องที่ 2', 'mult'], ['7️⃣', `+${prize.toLocaleString()}`, 'แจ็กพอตตองแตก!', 'miracle']],
      undefined, { stampId: 'MC_LOTTO_777' }
    );
  }

  // 19. 🛡️ เคลมประกันภัยคาเฟ่
  if (chosen === 'DEBT_INSURANCE') {
    const clearAmt = startBal < 0 ? Math.abs(startBal) : 0;
    const netDelta = clearAmt + 888;
    return pack(
      'MIRACLE', '🛡️ ปาฏิหาริย์เคลมประกันภัยคาเฟ่',
      clearAmt > 0 ? 'อนุมัติสินไหมล้างหนี้หมดจด แถมเงินขวัญถุง +888 เหรียญทอง!' : 'รับเงินปันผลกรมธรรม์เลขมงคล +888 เหรียญทอง!',
      'บริษัทประกันภัย Horizon อนุมัติสินไหมทดแทนพิเศษให้คุณแล้วค่ะ! มอบเงินขวัญถุงเลขมงคล 888 เหรียญทองเข้ากระเป๋าทันทีค่ะ',
      netDelta,
      clearAmt > 0
        ? `กระเป๋ามี ${startBal.toLocaleString()} ➔ ประกันจ่ายเคลมหนี้ให้ +${clearAmt.toLocaleString()} จนเป็น 0 ➔ แถมเงินขวัญถุงให้อีก +888 = ยอดได้รับสุทธิ +${netDelta.toLocaleString()} เหรียญทอง`
        : `กระเป๋ามี ${startBal.toLocaleString()} ➔ ได้รับเงินปันผลกรมธรรม์เลขมงคล +888 เหรียญ = ยอดได้รับสุทธิ +888 เหรียญทอง`,
      [['🏥', 'เคลมประกัน!', clearAmt > 0 ? `ล้างหนี้ +${clearAmt.toLocaleString()}` : 'โบนัสกรมธรรม์', 'miracle'], ['🛡️', 'อนุมัติ 100%', 'กองทุนช่วยเหลือ', 'miracle'], ['🧧', '+888', 'รับเงินขวัญถุง!', 'miracle']],
      undefined, { stampId: 'MC_INSURANCE' }
    );
  }

  // 20. 🏹 กองทุนโรบินฮู้ด
  const aidAmt = randInt(7, 14) * 100;
  return pack(
    'MIRACLE', '🏹 ปาฏิหาริย์กองทุนโรบินฮู้ด',
    `รับถุงเงินกระจายความมั่งคั่ง +${aidAmt.toLocaleString()} เหรียญทอง!`,
    'จอมโจรโรบินฮู้ดแห่งคาเฟ่แอบโปรยถุงเหรียญทองลงมาจากชั้นลอย โชคดีที่หล่นใส่ตักคุณพอดิบพอดีเลยค่ะ',
    aidAmt,
    `กระเป๋ามี ${startBal.toLocaleString()} ➔ ถุงเงินของโรบินฮู้ดหล่นใส่ตักพอดี รับไป +${aidAmt.toLocaleString()} เหรียญ = ยอดได้รับสุทธิ +${aidAmt.toLocaleString()} เหรียญทอง`,
    [['🏹', 'โรบินฮู้ด', 'โปรยทานกลางคาเฟ่', 'miracle'], ['✨', 'รับเต็มๆ!', 'หล่นใส่ตักพอดี', 'miracle'], ['🎁', `+${aidAmt.toLocaleString()}`, 'รับทรัพย์ก้อนโต!', 'miracle']],
    undefined, { stampId: 'MC_ROBIN_HOOD' }
  );
};

// ==========================================
// 🤝 3. เครื่องยนต์ยืมเงินเพื่อน & เพื่อนยืมเงิน (หักข้ามธนาคารได้ถ้ากระเป๋าไม่พอ)
// ==========================================
const generateFriendLoanEvent = (startBal, activePlayerId, roster, worldState) => {
  const otherPlayers = roster.filter((p) => p.userId !== activePlayerId);
  if (otherPlayers.length === 0) return generateMiracleChaosEvent(startBal, activePlayerId, roster, worldState);

  const activePlayerObj = roster.find((p) => p.userId === activePlayerId);
  const myTitle = formatFriendTitle(activePlayerObj);
  const friend = pickRandom(otherPlayers);
  const fTitle = formatFriendTitle(friend);
  const fOld = Number(friend.walletBalance || 0);
  const usePctLoan = Math.random() < 0.50;
  const pct = pickRandom([15, 20, 25, 35]);

  if (Math.random() < 0.50) {
    const loanAmt = usePctLoan && fOld > 100 ? Math.max(60, Math.round((fOld * pct) / 100)) : randInt(8, 42) * 10;
    const borrowGags = [
      `ทำตาปริบๆ นั่งคุกเข่ากอดขา "${fTitle}" กลางร้านคาเฟ่ จนเขายอมควักเงินให้ยืมมา ${loanAmt.toLocaleString()} เหรียญทองเพื่อตัดรำคาญค่ะ อิอิ`,
      `คุณทักแชทไปหา "${fTitle}" บอกว่าขอยืมตังค์ไปซื้อแฟ้บซักผ้าหน่อย แต่พอได้ตังค์ปุ๊บเอามาปั่นสล็อตต่อทันที สัญญาว่าชาติหน้าตอนบ่ายๆ จะคืนนะคะ`,
      `แอบสะกดจิต "${fTitle}" ตอนกำลังง่วงนอนในห้องเสียง ให้โอนเหรียญทองมาให้ยืมหมุนก่อน ${loanAmt.toLocaleString()} เหรียญ แบบที่เจ้าตัวยังงงๆ อยู่เลยค่ะ`,
      `บอก "${fTitle}" ว่าขอยืมตังค์ลงทุนธุรกิจเมล็ดกาแฟพันล้าน พอเขาโอนมาให้ปุ๊บ คุณก็แกล้งทำเป็นเน็ตหลุดหายเข้ากลีบเมฆไปเลยค่ะ`
    ];
    return pack(
      'WIN', '🤝 อีเวนต์ยืมเงินเพื่อน', `ขอยืมตังค์ "${fTitle}" สำเร็จ!`, pickRandom(borrowGags), loanAmt,
      `กระเป๋ามี ${startBal.toLocaleString()} ➔ ขอยืมเงินจาก ${fTitle} มาหมุนก่อน +${loanAmt.toLocaleString()} เหรียญ = ยอดได้รับสุทธิ +${loanAmt.toLocaleString()} เหรียญทอง`,
      [['📱', 'ทักแชทยืมตังค์', `เป้าหมายคือ ${fTitle}`, 'win'], ['🥺', 'ชาติหน้าคืน!', 'สกิลปากหวานขั้นเทพ', 'miracle'], ['🤝', `+${loanAmt.toLocaleString()}`, `ดึงเงิน ${fTitle}!`, 'win']],
      [mutDelta(friend, -loanAmt, `🤝 ${myTitle} ทักมายืมเงินไปหมุน`, false, 'FRIEND_OUT')],
      { txType: 'FRIEND_IN' }
    );
  }

  const lendAmt = usePctLoan && startBal > 100 ? Math.max(50, Math.round((startBal * pct) / 100)) : randInt(6, 36) * 10;
  const lendGags = [
    `"${fTitle}" ทักแชทมาตีหน้าเศร้าขอยืมตังค์ไปซื้อชานมไข่มุก บอกเดี๋ยวพรุ่งนี้คืนแน่นอน... แต่พอโอนเสร็จปุ๊บ ขึ้นสถานะออฟไลน์หนีไปแล้วค่ะ`,
    `"${fTitle}" เดินมาตบไหล่ในคาเฟ่แล้วบอกว่า เพื่อนรัก ขอยืมตังค์จ่ายค่ากาแฟก่อนนะ! แล้วล้วงเหรียญไป ${lendAmt.toLocaleString()} เหรียญหน้าตาเฉยเลยค่ะ`,
    `ใจอ่อนโอนเงินให้ "${fTitle}" ยืมไปเปย์สาว ${lendAmt.toLocaleString()} เหรียญทอง ตอนยืมกราบแทบเท้า ตอนทวงน่าจะต้องจุดธูปเรียกแล้วนะคะเนี่ย`,
    `"${fTitle}" ส่งสติกเกอร์แมวร้องไห้มาขอยืมตังค์หมุนรายวัน คุณเผลอกดตกลง เงินเลยปลิวไปเข้ากระเป๋าเพื่อนทันทีเลยค่ะ`
  ];
  return pack(
    'THEFT', '💸 อีเวนต์เพื่อนยืมเงิน', `"${fTitle}" ทักมายืมตังค์คุณไปดื้อๆ!`, pickRandom(lendGags), -lendAmt,
    `กระเป๋ามี ${startBal.toLocaleString()} ➔ ใจอ่อนให้ ${fTitle} ยืมเงินไป -${lendAmt.toLocaleString()} เหรียญ เข้ากระเป๋าเพื่อนเรียบร้อย! = ยอดหักสุทธิ -${lendAmt.toLocaleString()} เหรียญทอง`,
    [['💬', fTitle, 'ทักแชทมาหาคุณ...', 'tax'], ['🙏', 'ขอยืมตังค์หน่อย', 'เดี๋ยวพรุ่งนี้คืนแน่นะวิ!', 'tax'], ['💸', `-${lendAmt.toLocaleString()}`, `โอนให้ ${fTitle}!`, 'divide']],
    [mutDelta(friend, lendAmt, `💸 ยืมเงินจาก ${myTitle} สำเร็จ`, false, 'FRIEND_IN')],
    { txType: 'FRIEND_OUT' }
  );
};

// ==========================================
// 🏥 4. เครื่องยนต์ค่าใช้จ่ายชีวิตประจำวัน & พลิกวิกฤตเป็นลาภลอย
// ==========================================
const generateDailyExpenseEvent = (startBal) => {
  const isBoon = Math.random() < 0.32;
  const list = isBoon ? DAILY_BOON_TUPLE : DAILY_EXPENSE_TUPLE;
  const idx = Math.floor(Math.random() * list.length);
  return compileCatalogTuple(list[idx], startBal, isBoon, (isBoon ? 'BN_' : 'EX_') + String(idx + 1).padStart(2, '0'));
};

// ==========================================
// 🎰 5. เครื่องยนต์หลัก: สุ่มผลสล็อต 3 ช่อง + เมนูคาเฟ่ + สุ่มเผาเงินลดเฟ้อ
// ==========================================
const calculateSlotOutcome = (currentBalance = 0, activePlayerId = '', roster = [], worldState = null) => {
  const state = worldState || {
    landmarks: DEFAULT_LANDMARKS_META.map((m) => ({ ...m, ownerId: null, ownerName: '', tier: 0, curtainClosed: false })),
    lostWallets: [],
    timeCapsule: null,
    cursedTipJar: 500,
    soulBonds: {}
  };

  const startBal = Number(currentBalance || 0);
  const roll = Math.random() * 100;
  let result = null;

  if (roll < 20) result = generateWindowLandmarkEvent(startBal, activePlayerId, roster, state);
  else if (roll < 42) result = generateMiracleChaosEvent(startBal, activePlayerId, roster, state);
  else if (roll < 52) result = generateFriendLoanEvent(startBal, activePlayerId, roster, state);
  else if (roll < 72) result = generateDailyExpenseEvent(startBal);
  else {
    const refBase = startBal > 0 ? startBal : Math.max(BASE_ECONOMIC_UNIT, Math.abs(startBal));

    // หมวด JACKPOT
    if (roll < 79) {
      if (Math.random() < 0.6) {
        const s1 = randInt(7, 15) * 10;
        const s2 = randInt(7, 16) * 10;
        const mult = pickRandom([2, 2, 3, 4]);
        const rawSum = s1 + s2;
        const multVal = rawSum * mult;
        const boost = Math.min(2200, Math.round(refBase * (mult >= 3 ? 0.35 : 0.20)));
        const netDelta = Math.round(multVal + boost);
        result = pack(
          'JACKPOT', '🤑 แจ็กพอตแตกประจำคาเฟ่', `รวยฟ้าผ่า รับรางวัลทวีคูณ ${mult} เท่าตัว!`, pickRandom(FLAVOR_MESSAGES.JACKPOT), netDelta,
          `ช่องแรกได้ +${s1} รวมกับช่องสอง +${s2} ได้ ${rawSum} เหรียญ ➔ นำไป × ${mult} ได้ ${multVal.toLocaleString()} เหรียญ ➔ แถมเงินขวัญถุงเพิ่มอีก +${boost.toLocaleString()} = ยอดได้รับสุทธิ +${netDelta.toLocaleString()} เหรียญทอง`,
          [['🪙', `+${s1}`, 'เหรียญตั้งต้น', 'win'], ['💎', `+${s2}`, 'โบนัสเสริมดวง', 'win'], ['🚀', `×${mult}`, `ทวีคูณ ${mult} เท่าตัว!`, 'mult']]
        );
      } else {
        const s1 = randInt(5, 11) * 10;
        const s2 = randInt(5, 11) * 10;
        const pct = pickRandom([40, 60, 80, 100, 120]);
        const pctGain = Math.min(3000, Math.max(120, Math.round((refBase * pct) / 100)));
        const netDelta = s1 + s2 + pctGain;
        result = pack(
          'JACKPOT', '🤑 แจ็กพอตแตกประจำคาเฟ่', `รวยฟ้าผ่า รับปันผลกระเป๋าตังค์พุ่ง +${pct}%!`, pickRandom(FLAVOR_MESSAGES.JACKPOT), netDelta,
          `กระเป๋ามี ${startBal.toLocaleString()} เหรียญ ➔ ได้ปันผล +${pct}% เป็นเงิน +${pctGain.toLocaleString()} เหรียญ ➔ นำไปรวมกับช่องแรก +${s1} และช่องสอง +${s2} = ยอดได้รับสุทธิ +${netDelta.toLocaleString()} เหรียญทอง`,
          [['🪙', `+${s1}`, 'เหรียญนำโชค', 'win'], ['👑', `+${s2}`, 'ถุงทองบาริสต้า', 'win'], ['📈', `+${pct}%`, `ปันผลกระเป๋า +${pct}%`, 'mult']]
        );
      }
    }
    // หมวด WIN
    else if (roll < 86) {
      const s1 = randInt(5, 12) * 10;
      const s2 = randInt(4, 11) * 10;
      if (Math.random() < 0.55) {
        const pct = pickRandom([15, 20, 30, 40]);
        const pctBonus = Math.min(900, Math.max(45, Math.round((refBase * pct) / 100)));
        const subTotal = s1 + s2;
        const netDelta = subTotal + pctBonus;
        result = pack(
          'WIN', '🎉 ดวงดีมีกำไร', `รับทรัพย์เข้ากระเป๋าพร้อมโบนัสพิเศษ +${pct}%!`, pickRandom(FLAVOR_MESSAGES.WIN), netDelta,
          `ช่องแรกได้ +${s1} รวมกับช่องสอง +${s2} ได้ ${subTotal} เหรียญ ➔ นำไปบวกโบนัส +${pct}% เป็นเงิน +${pctBonus.toLocaleString()} เหรียญ = ยอดได้รับสุทธิ +${netDelta.toLocaleString()} เหรียญทอง`,
          [['🪙', `+${s1}`, 'เหรียญทอง', 'win'], ['🍀', `+${s2}`, 'โชคช่วยสองชั้น', 'win'], ['✨', `+${pct}%`, `โบนัส +${pct}%`, 'win']]
        );
      } else {
        const s3 = randInt(5, 13) * 10;
        const netDelta = s1 + s2 + s3;
        result = pack(
          'WIN', '🎉 ดวงดีมีกำไร', 'ปั่นเจอเหรียญทองคำครบทั้ง 3 ช่องรวด!', pickRandom(FLAVOR_MESSAGES.WIN), netDelta,
          `ช่องแรกได้ +${s1} ➔ บวกช่องสอง +${s2} ➔ บวกทิปช่องสุดท้าย +${s3} = ยอดได้รับสุทธิ +${netDelta.toLocaleString()} เหรียญทอง`,
          [['🪙', `+${s1}`, 'เหรียญทอง', 'win'], ['🪙', `+${s2}`, 'เหรียญทอง', 'win'], ['🍰', `+${s3}`, 'ทิปจากอเลสเทีย', 'win']]
        );
      }
    }
    // หมวด ZERO
    else if (roll < 92) {
      if (Math.random() < 0.45) {
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
    // หมวด DIVIDER / THEFT
    else if (Math.random() < 0.5) {
      const div = pickRandom([2, 3, 4]);
      const s1 = -randInt(2, 4) * 10;
      const cutAmt = Math.round(refBase * (1 - 1 / div));
      const netDelta = -(cutAmt + Math.abs(s1));
      result = pack(
        'DIVIDER', '🪓 วิกฤตขวานผ่ากระเป๋า', `กระเป๋าตังค์ถูกขวานผ่าหารออก 1 ใน ${div}!`, pickRandom(FLAVOR_MESSAGES.DIVIDER), netDelta,
        `กระเป๋ามี ${startBal.toLocaleString()} ➔ โดนขวานผ่ากระเป๋าหาร ÷ ${div} หักไป -${cutAmt.toLocaleString()} เหรียญ ➔ หักค่าตกใจอีก ${s1} = ยอดหักสุทธิ ${netDelta.toLocaleString()} เหรียญทอง`,
        [['⚠️', `${s1}`, 'ค่าตกใจ', 'tax'], ['🌪️', 'วิกฤต!', 'ฟองสบู่คาเฟ่แตก', 'tax'], ['🪓', `÷${div}`, `หารกระเป๋าตัง ÷${div}!`, 'divide']]
      );
    } else {
      const stealPct = pickRandom([20, 30, 40, 50]);
      const s1 = randInt(1, 3) * 10;
      const flatTheft = randInt(2, 5) * 10;
      const pctStolen = Math.max(30, Math.round((refBase * stealPct) / 100));
      const netDelta = -Math.max(30, pctStolen + flatTheft - s1);
      result = pack(
        'THEFT', '🥷 อีเวนต์โจรย่องเบา', `โดนโจรล้วงกระเป๋าฉกเงินไป -${stealPct}%!`, pickRandom(FLAVOR_MESSAGES.THEFT), netDelta,
        `กระเป๋ามี ${startBal.toLocaleString()} ➔ โดนโจรฉกไป -${stealPct}% เป็นเงิน -${pctStolen.toLocaleString()} เหรียญ ➔ โดนแมวคาบไปอีก -${flatTheft} กู้คืนมาได้ +${s1} = ยอดหักสุทธิ ${netDelta.toLocaleString()} เหรียญทอง`,
        [['🪙', `+${s1}`, 'เหรียญล่อโจร', 'zero'], ['🐈‍⬛', `-${flatTheft}`, 'แมวส้มคาบไป', 'tax'], ['🥷', `-${stealPct}%`, `โจรฉกกระเป๋า -${stealPct}%!`, 'divide']]
      );
    }
  }

  // 🔥 กลไกลดเงินเฟ้อ: สุ่มให้เข้ากระปุกหมูแค่ 10%–50% และเผาส่วนต่างออกจากระบบถาวร
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
// 📖 6. สารบัญสมุดสะสมแสตมป์อัตโนมัติ (158 ดวง • 5 หมวด)
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