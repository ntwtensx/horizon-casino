import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

function renderDiscordText(rawText) {
  if (!rawText) return null;
  const regex = /<(a?):([a-zA-Z0-9_]+):(\d+)>/g;
  const parts = [];
  let lastIdx = 0;
  let match;

  while ((match = regex.exec(rawText)) !== null) {
    if (match.index > lastIdx) {
      parts.push(rawText.slice(lastIdx, match.index));
    }
    const [, isAnim, name, id] = match;
    const ext = isAnim === 'a' ? 'gif' : 'png';
    parts.push(
      <img
        key={`${id}-${match.index}`}
        className="discord-emoji-inline"
        src={`https://cdn.discordapp.com/emojis/${id}.${ext}?size=48&quality=lossless`}
        alt={name}
        onError={(e) => {
          e.currentTarget.style.display = 'none';
        }}
      />
    );
    lastIdx = regex.lastIndex;
  }

  if (lastIdx < rawText.length) {
    parts.push(rawText.slice(lastIdx));
  }
  return parts;
}

export default function EventDisplay({
  isSpinning,
  revealedCount,
  spinResult,
  isBrandNewStamp,
  matchedStamp,
  errorMsg,
  onOpenStampBook
}) {
  if (errorMsg) {
    return (
      <section className="event-panel">
        <div className="event-idle">
          <div style={{ fontSize: '1.8rem' }}>☕</div>
          <div className="event-idle-title" style={{ color: 'var(--rose)' }}>
            {errorMsg}
          </div>
          <div style={{ fontSize: '0.82rem' }}>ลองดึงคันโยกใหม่อีกครั้งในอีกสักครู่นะคะ</div>
        </div>
      </section>
    );
  }

  if (isSpinning) {
    const suspenseText =
      revealedCount === 0
        ? 'อเลสเทียกำลังหมุนวงล้อชะตาทั้ง 3 ช่อง...'
        : revealedCount === 1
          ? 'ช่องที่ 1 หยุดแล้ว! มาลุ้นจุดพลิกผันในช่องที่ 2 กันค่ะ...'
          : 'ช่องสุดท้ายกำลังชะลอตัว... เตรียมรับชะตาปาฏิหาริย์!';

    return (
      <section className="event-panel">
        <motion.div
          key={`suspense-${revealedCount}`}
          className="event-idle"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
        >
          <div style={{ fontSize: '1.9rem' }}>✨</div>
          <div className="event-idle-title">{suspenseText}</div>
          <div style={{ fontSize: '0.8rem' }}>ทุกการโยกมีความป่วนสูง โปรดจับแก้วกาแฟไว้ให้แน่นค่ะ</div>
        </motion.div>
      </section>
    );
  }

  if (!spinResult || !spinResult.outcome || revealedCount < 3) {
    return (
      <section className="event-panel">
        <div className="event-idle">
          <div style={{ fontSize: '2rem' }}>🧁</div>
          <div className="event-idle-title">พร้อมวัดดวงกับ Horizon Casino แล้วหรือยังคะ?</div>
          <div style={{ fontSize: '0.84rem', maxWidth: 520, lineHeight: 1.5 }}>
            จับคันโยกด้านขวาของตู้สล็อตลากลงมา (หรือคลิก) เพื่อสุ่ม 3 ช่อง — ลุ้นได้ทั้งแจ็กพอต,
            หุ้นแลนด์มาร์กริมหน้าต่าง 5 โซน, อีเวนท์ยืมเงินเพื่อน ไปจนถึงตรรกะวิบัติสุดปั่นกว่า 158 แบบ!
          </div>
        </div>
      </section>
    );
  }

  const { outcome, previousBalance, newBalance } = spinResult;
  const delta = Number(outcome.delta || 0);
  const diffClass = delta > 0 ? 'diff-pos' : delta < 0 ? 'diff-neg' : 'diff-zero';

  return (
    <section className="event-panel">
      <AnimatePresence mode="wait">
        <motion.div
          key={`${spinResult.scratchCount}-${outcome.headline}`}
          className={`event-card outcome-${outcome.outcomeType || 'ZERO'}`}
          initial={{ opacity: 0, y: 14, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ type: 'spring', stiffness: 320, damping: 24 }}
        >
          <div className="event-category-pill">{outcome.categoryHeader || '🌟 ผลการลุ้นดวง'}</div>

          <h2 className="event-headline">{outcome.headline}</h2>

          <p className="event-message">{renderDiscordText(outcome.message)}</p>

          {outcome.equationText && (
            <div className="event-equation">
              <strong>🧮 สมการคำนวณดวง</strong>
              <span>{outcome.equationText}</span>
            </div>
          )}

          <div className={`event-balance-diff ${diffClass}`}>
            สรุปกระเป๋าตังค์: {Number(previousBalance || 0).toLocaleString()} ➔{' '}
            {Number(newBalance || 0).toLocaleString()} เหรียญทอง (
            {delta > 0 ? `+${delta.toLocaleString()}` : delta.toLocaleString()})
          </div>

          {isBrandNewStamp && matchedStamp && (
            <motion.button
              type="button"
              className="stamp-unlock-banner"
              onClick={() => onOpenStampBook(matchedStamp.category)}
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              whileHover={{ scale: 1.04 }}
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