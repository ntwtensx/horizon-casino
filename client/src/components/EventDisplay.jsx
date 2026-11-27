import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const FOIL_TONES = new Set(['jackpot', 'miracle', 'landmark', 'greed']);

// 🎨 คัดแยกสีธีมเฉพาะตัวของแต่ละหมวดอีเวนท์ (ดึงค่าสีจาก theme-fx.css)
function resolveEventTone(outcome) {
  if (!outcome) return 'zero';
  const hdr = `${outcome.categoryHeader || ''} ${outcome.headline || ''}`;
  const tx = outcome.txType || '';
  const type = outcome.outcomeType || 'ZERO';

  if (outcome.seizeBank || tx === 'SEIZURE') return 'seizure';
  if (outcome.bankDirect || hdr.includes('ปปง.') || hdr.includes('ตู้เซฟ')) return 'bank-raid';
  if (hdr.includes('ความโลภ')) return 'greed';
  if (tx === 'LANDMARK' || String(outcome.stampId || '').startsWith('LM_') || hdr.includes('ริมหน้าต่าง')) return 'landmark';
  if (
    tx === 'FRIEND_IN' ||
    tx === 'FRIEND_OUT' ||
    hdr.includes('ยืมเงิน') ||
    hdr.includes('ค้ำประกัน') ||
    hdr.includes('แก๊งเพื่อน') ||
    hdr.includes('เหมาเลี้ยง')
  ) {
    return 'social';
  }

  if (type === 'JACKPOT') return 'jackpot';
  if (type === 'MIRACLE') return 'miracle';
  if (type === 'WIN') return 'win';
  if (type === 'DIVIDER') return 'divide';
  if (type === 'TAX' || type === 'THEFT') return 'expense';
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
              <span>
                {menuItems.map((m) => `${m.icon} ${m.label}`).join(' + ')}
              </span>
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