import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const FOIL_TONES = new Set([
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

// 🎨 คัดแยกสีสเปกตรัมเต็มรุ้งแบบยิบย่อยตามหมวดและเนื้อหาอีเวนท์ (ดึงเฉดจาก theme-fx.css)
function resolveEventTone(outcome) {
  if (!outcome) return 'zero';
  const hdr = `${outcome.categoryHeader || ''} ${outcome.headline || ''}`;
  const sid = String(outcome.stampId || '');
  const tx = outcome.txType || '';
  const type = outcome.outcomeType || 'ZERO';

  // 1. แดงเพลิงผสมส้มเข้ม: ยึดทรัพย์, ขวานผ่า, รัสเซียนรูเล็ตต์, ทำกระเป๋าหล่น
  if (
    outcome.seizeBank ||
    tx === 'SEIZURE' ||
    sid === 'MC_SEIZURE' ||
    sid.startsWith('MC_LOST_') ||
    sid === 'MC_ROULETTE_LOSE' ||
    hdr.includes('ยึดทรัพย์') ||
    hdr.includes('ขวานผ่า') ||
    hdr.includes('กระเป๋าตังค์หล่น') ||
    hdr.includes('ลืมกระเป๋าตังค์') ||
    hdr.includes('ทิ้งกระเป๋าตังค์') ||
    hdr.includes('พัดกระเป๋าตังค์')
  ) {
    return 'crimson-red';
  }

  // 2. ครามผสมน้ำเงิน: ปปง. ตรวจบัญชี, ศาลคาเฟ่ฟ้องร้อง
  if (
    hdr.includes('ปปง.') ||
    hdr.includes('ฟ้องร้อง') ||
    sid === 'LM_ACT_SUE_TAKE' ||
    sid === 'LM_ACT_SUE_KICK'
  ) {
    return 'indigo-blue';
  }

  // 3. น้ำเงินมิดไนท์ผสมแดงไซเรน: แฮ็กเกอร์แมวส้มเจาะตู้เซฟ, โจรย่องเบา, ปล้นสุลต่าน
  if (
    outcome.bankDirect ||
    hdr.includes('ตู้เซฟ') ||
    hdr.includes('โจรย่องเบา') ||
    hdr.includes('ปล้นสุลต่าน') ||
    sid === 'MC_STEAL_SULTAN'
  ) {
    return 'navy-crimson';
  }

  // 4. ม่วงเข้มผสมเหลืองสายฟ้า: กับดักความโลภ, สลับอันดับย้อนศร, ลูกกระจ๊อกล้มยักษ์
  if (
    hdr.includes('ความโลภ') ||
    hdr.includes('สลับตำแหน่งย้อนศร') ||
    hdr.includes('ลูกกระจ๊อกล้มยักษ์') ||
    sid === 'MC_RANK_SWAP' ||
    sid === 'MC_GOLIATH'
  ) {
    return 'purple-gold';
  }

  // 5. ฟ้าใสผสมครามอ่อน: ปลดหนี้, เคลมประกัน, ฝนเหรียญบาริสต้า, ผ้าม่านปิด, เมตตาผู้ไร้ความโลภ
  if (
    hdr.includes('ปลดหนี้') ||
    hdr.includes('ประกันภัย') ||
    hdr.includes('มหาทาน') ||
    hdr.includes('ผ้าม่าน') ||
    hdr.includes('เมตตาผู้ไร้ความโลภ') ||
    sid === 'MC_DEBT_CLEAR' ||
    sid === 'MC_INSURANCE' ||
    sid === 'MC_RAIN_MAKER' ||
    sid === 'LM_ACT_CURTAIN'
  ) {
    return 'sky-cyan';
  }

  // 6. สีเฉพาะของแลนด์มาร์กริมหน้าต่างทั้ง 5 โซน
  if (tx === 'LANDMARK' || sid.startsWith('LM_') || hdr.includes('ริมหน้าต่าง')) {
    if (hdr.includes('รีวิว') || sid === 'LM_ACT_VIRAL') return 'orange-peach';
    if (hdr.includes('สวนต้นไม้') || sid.includes('GARDEN')) return 'lm-garden';
    if (hdr.includes('ซากุระ') || sid.includes('SAKURA')) return 'lm-sakura';
    if (hdr.includes('ทุ่งดอกไม้') || sid.includes('MEADOW')) return 'lm-meadow';
    if (hdr.includes('ชายหาด') || sid.includes('BEACH')) return 'lm-beach';
    if (hdr.includes('แม่น้ำภูเขา') || sid.includes('RIVER')) return 'lm-river';
    return 'teal-emerald';
  }

  // 7. รุ้งพาสเทลผสมหลายสี: ตรรกะวิบัติ 34 แบบ, พลิกขั้วชะตาเล่นตลก, สรรพากรเฉลี่ยสุข, กระจกเงา
  if (
    sid.startsWith('AB_') ||
    sid.startsWith('MC_POLARITY') ||
    sid === 'MC_COMMUNISM' ||
    sid === 'MC_MIRROR' ||
    hdr.includes('ชะตาเล่นตลก') ||
    hdr.includes('สรรพากรเฉลี่ยสุข') ||
    hdr.includes('กระจกเงา')
  ) {
    return 'prism-chaos';
  }

  // 8. เหลืองทองผสมแชมเปญ: แจ็กพอต, ตอง 777, ขอทานเศรษฐี, ลูกเต๋าทองคำ
  if (
    type === 'JACKPOT' ||
    sid === 'MC_LOTTO_777' ||
    sid === 'MC_BEGGAR_KING' ||
    sid === 'MC_DICE_MULT' ||
    hdr.includes('777') ||
    hdr.includes('ขอทานเศรษฐี')
  ) {
    return 'gold-yellow';
  }

  // 9. ส้มคาราเมลผสมพีช: กระป๋องคุกกี้แดง, กระปุกหมูแตก
  if (
    sid.startsWith('MC_COOKIE_') ||
    sid === 'MC_TIP_JAR' ||
    hdr.includes('กระป๋องคุกกี้') ||
    hdr.includes('กระปุกหมู')
  ) {
    return 'orange-peach';
  }

  // 10. แดงกุหลาบผสมชมพูเบอร์รี่: เซ็นค้ำประกันหนี้, ค่าใช้จ่ายประจำวัน
  if (
    hdr.includes('ค้ำประกัน') ||
    sid.startsWith('EX_')
  ) {
    return 'rose-berry';
  }

  // 11. แสดผสมส้มปะการัง: เพื่อนยืมเงิน, แก๊งเพื่อนรุมไถ, บิลเหมาทั้งร้าน, ปลาดุกยิงหนี้, ระเบิดเวลา
  if (
    tx === 'FRIEND_OUT' ||
    hdr.includes('เพื่อนยืมเงิน') ||
    hdr.includes('แก๊งเพื่อน') ||
    hdr.includes('เหมาเลี้ยง') ||
    sid === 'MC_CATFISH' ||
    sid.startsWith('MC_BOMB_')
  ) {
    return 'tangerine-coral';
  }

  // 12. เขียวมะนาวผสมเหลือง: ยืมเงินเพื่อนสำเร็จ, พลิกวิกฤตเป็นลาภลอย (BN_)
  if (
    tx === 'FRIEND_IN' ||
    hdr.includes('ยืมเงินเพื่อน') ||
    sid.startsWith('BN_')
  ) {
    return 'lime-yellow';
  }

  // 13. เขียวสดผสมมิ้นต์: โรบินฮู้ด, เก็บกระเป๋าตังค์ได้, ดวงดีมีกำไร
  if (
    sid === 'MC_ROBIN_HOOD' ||
    sid.startsWith('MC_FOUND_') ||
    hdr.includes('โรบินฮู้ด') ||
    hdr.includes('เก็บกระเป๋าตังค์') ||
    hdr.includes('พบกระเป๋าตังค์') ||
    type === 'WIN'
  ) {
    return 'green-mint';
  }

  // 14. ม่วงผสมชมพู: โซ่ล่ามชะตา, สลับกระเป๋า, แม่เหล็ก, อยากรวย/อยากจน, ปาฏิหาริย์ทั่วไป
  if (
    sid === 'MC_SOUL_BOND' ||
    sid === 'MC_WALLET_SWAP' ||
    sid === 'MC_MAGNET' ||
    sid.startsWith('MC_WANT_') ||
    type === 'MIRACLE'
  ) {
    return 'violet-pink';
  }

  // 15. ค่ามาตรฐานตามผลลัพธ์
  if (type === 'DIVIDER') return 'crimson-red';
  if (type === 'THEFT') return 'navy-crimson';
  if (type === 'TAX') return 'rose-berry';
  return 'zero';
}

function renderDiscordText(rawText) {
  if (!rawText) return null;
  const regex = /<(a?):([a-zA-Z0-9_]+):(\d+)>/g;
  const parts = [];
  let lastIdx = 0;
  let match;

  while ((match = regex.exec(rawText)) !== null) {
    if (match.index > lastIdx) parts.push(rawText.slice(lastIdx, match.index));
    const [, isAnim, name, id] = match;
    parts.push(
      <img
        key={`${id}-${match.index}`}
        className="discord-emoji-inline"
        src={`https://cdn.discordapp.com/emojis/${id}.${isAnim === 'a' ? 'gif' : 'png'}?size=48&quality=lossless`}
        alt={name}
        onError={(e) => {
          e.currentTarget.style.display = 'none';
        }}
      />
    );
    lastIdx = regex.lastIndex;
  }

  if (lastIdx < rawText.length) parts.push(rawText.slice(lastIdx));
  return parts;
}

export default function EventDisplay({
  spinPhase = 'IDLE',
  spinProgress = 0,
  menuRevealedCount = 0,
  flippedSlots = [false, false, false],
  spinResult,
  isBrandNewStamp,
  matchedStamp,
  errorMsg,
  onOpenStampBook
}) {
  const menuItems = spinResult?.outcome?.cafeMenu?.items || [];
  const flippedCount = flippedSlots.filter(Boolean).length;

  if (errorMsg) {
    return (
      <section className="event-panel">
        <div className="event-idle">
          <div className="event-idle-emoji">☕</div>
          <div className="event-idle-title" style={{ color: 'var(--rose)' }}>{errorMsg}</div>
          <div className="event-idle-desc">ลองดึงคันโยกใหม่อีกครั้งในอีกสักครู่นะคะ</div>
        </div>
      </section>
    );
  }

  if (spinPhase === 'SPINNING') {
    const suspense = [
      'กำลังชงเครื่องดื่มสุดแฟนซี...',
      'ได้เครื่องดื่มแล้ว! กำลังสุ่มท็อปปิ้ง...',
      'กำลังจัดจานขนมทานเล่นชิ้นสุดท้าย...'
    ][Math.min(menuRevealedCount, 2)];

    return (
      <section className="event-panel">
        <motion.div
          key={`spin-${menuRevealedCount}`}
          className="event-idle"
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div className="event-idle-emoji">🌈</div>
          <div className="event-idle-title">{suspense}</div>
          <div className="event-idle-desc">ความคืบหน้าการชงออเดอร์ {spinProgress}% • รอลุ้นเปิดบิลชะตา!</div>
        </motion.div>
      </section>
    );
  }

  if (spinPhase === 'MENU_SHOW') {
    return (
      <section className="event-panel">
        <motion.div
          className="menu-preview-box"
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.22 }}
        >
          <div className="menu-preview-title">
            👆 แตะหรือลากกวาดผ่านการ์ดด้านบนเพื่อพลิก ({flippedCount}/3)
          </div>

          {menuItems.length === 3 && (
            <div className="menu-preview-chips">
              {menuItems.map((m, idx) => (
                <span key={idx} className={`menu-preview-chip ${flippedSlots[idx] ? 'is-flipped' : ''}`}>
                  {flippedSlots[idx] ? '✓ ' : ''}{m.icon} {m.label}
                </span>
              ))}
            </div>
          )}

          <div className="event-idle-desc">
            {flippedCount === 0
              ? 'กดแตะทีละใบ หรือกดค้างแล้วลากนิ้วผ่านทั้ง 3 การ์ดเพื่อเปิดเรียงกันได้เลยค่ะ!'
              : flippedCount < 3
                ? `เหลืออีก ${3 - flippedCount} ช่อง! แตะหรือลากพลิกให้ครบเพื่อเฉลยอีเวนท์`
                : 'กำลังเปิดบิลสรุปผลชะตา...'}
          </div>
        </motion.div>
      </section>
    );
  }

  if (spinPhase !== 'REVEALED' || !spinResult?.outcome) {
    return (
      <section className="event-panel">
        <div className="event-idle">
          <div className="event-idle-emoji">🧁</div>
          <div className="event-idle-title">พร้อมวัดดวงกับ Horizon Casino แล้วหรือยังคะ?</div>
          <div className="event-idle-desc">
            ลากหรือแตะคันโยกด้านข้างเพื่อสุ่มเมนูคาเฟ่ทั้ง 3 ช่อง จากนั้นแตะหรือลากผ่านการ์ดเพื่อพลิกเปิดอีเวนท์สุดป่วนกว่า 158 แบบ!
          </div>
        </div>
      </section>
    );
  }

  const {
    outcome,
    previousBalance,
    newBalance,
    previousBankBalance,
    newBankBalance,
    walletDelta,
    bankDelta,
    usedBank
  } = spinResult;

  const tone = resolveEventTone(outcome);
  const wDelta = typeof walletDelta === 'number' ? walletDelta : Number(outcome.delta || 0);
  const bDelta = typeof bankDelta === 'number' ? bankDelta : 0;
  const walletDiffClass = wDelta > 0 ? 'diff-pos' : wDelta < 0 ? 'diff-neg' : 'diff-zero';
  const sink = outcome.sinkInfo;

  return (
    <section className="event-panel">
      <AnimatePresence mode="wait">
        <motion.div
          key={`${spinResult.scratchCount}-${outcome.headline}`}
          className={`event-card outcome-${outcome.outcomeType || 'ZERO'} ${FOIL_TONES.has(tone) ? 'foil-sheen' : ''}`}
          data-tone={tone}
          initial={{ opacity: 0, y: 10, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ type: 'spring', stiffness: 330, damping: 25 }}
        >
          {menuItems.length === 3 && (
            <div className="event-order-receipt">
              <span>🧾</span>
              <span>{menuItems.map((m) => `${m.icon} ${m.label}`).join(' + ')}</span>
            </div>
          )}

          <div className="event-category-pill">{outcome.categoryHeader || '🌟 ผลการลุ้นดวง'}</div>
          <h2 className="event-headline">{outcome.headline}</h2>
          <p className="event-message">{renderDiscordText(outcome.message)}</p>

          {outcome.equationText && (
            <div className="event-equation">
              <strong>🧮 สมการคำนวณดวง</strong>
              <span>{outcome.equationText}</span>
            </div>
          )}

          <div className={`event-balance-diff ${walletDiffClass}`}>
            👛 กระเป๋า: {Number(previousBalance || 0).toLocaleString()} ➔{' '}
            {Number(newBalance || 0).toLocaleString()} เหรียญ ({wDelta > 0 ? `+${wDelta.toLocaleString()}` : wDelta.toLocaleString()})
          </div>

          {bDelta !== 0 && (
            <div className="event-bank-diff">
              🏦 ธนาคาร: {Number(previousBankBalance || 0).toLocaleString()} ➔{' '}
              {Number(newBankBalance || 0).toLocaleString()} เหรียญ ({bDelta.toLocaleString()})
              {outcome.bankDirect
                ? ' • เจาะหักจากธนาคารโดยตรง'
                : usedBank > 0 && !outcome.seizeBank
                  ? ' • ดึงมาช่วยจ่ายส่วนต่าง'
                  : ''}
            </div>
          )}

          {sink && (sink.burned > 0 || sink.toTipJar > 0) && (
            <div className="event-sink-note">
              {sink.toTipJar > 0 ? `🐷 เข้ากระปุกหมู +${sink.toTipJar.toLocaleString()} (${sink.tipPct}%) • ` : ''}
              🔥 เผาลดเงินเฟ้อ {Number(sink.burned || 0).toLocaleString()} เหรียญ
            </div>
          )}

          {isBrandNewStamp && matchedStamp && (
            <motion.button
              type="button"
              className="stamp-unlock-banner"
              onClick={() => onOpenStampBook(matchedStamp.category)}
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.96 }}
            >
              🆕 ปลดล็อกแสตมป์ใหม่: {matchedStamp.icon} {matchedStamp.title}
            </motion.button>
          )}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}