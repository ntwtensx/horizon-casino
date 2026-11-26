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
          <div className="event-idle-title" style={{ color: 'var(--rose)' }}>
            {errorMsg}
          </div>
          <div className="event-idle-desc">ลองดึงคันโยกใหม่อีกครั้งในอีกสักครู่นะคะ</div>
        </div>
      </section>
    );
  }

  // เฟส 1: กำลังปั่นสล็อตสุ่มเมนูพร้อมโปรเกรสบาร์
  if (spinPhase === 'SPINNING') {
    const suspenseText =
      menuRevealedCount === 0
        ? 'กำลังชงเครื่องดื่มสุดแฟนซี...'
        : menuRevealedCount === 1
          ? 'ได้เครื่องดื่มแล้ว! กำลังสุ่มท็อปปิ้ง...'
          : 'กำลังจัดจานขนมทานเล่นชิ้นสุดท้าย...';

    return (
      <section className="event-panel">
        <motion.div
          key={`spin-menu-${menuRevealedCount}`}
          className="event-idle"
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div className="event-idle-emoji">☕</div>
          <div className="event-idle-title">{suspenseText}</div>
          <div className="event-idle-desc">ความคืบหน้าการชงออเดอร์ {spinProgress}% • รอลุ้นเปิดบิลชะตา!</div>
        </motion.div>
      </section>
    );
  }

  // เฟส 2: หยุดครบ 3 ช่องแล้ว — รอผู้เล่นแตะพลิกการ์ดทีละใบ
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
            👆 แตะการ์ดด้านบนทีละใบเพื่อพลิกเปิดชะตา ({flippedCount}/3)
          </div>

          {menuItems.length === 3 && (
            <div className="menu-preview-chips">
              {menuItems.map((m, idx) => (
                <span
                  key={idx}
                  className={`menu-preview-chip ${flippedSlots[idx] ? 'is-flipped' : ''}`}
                >
                  {flippedSlots[idx] ? '✓ ' : ''}
                  {m.icon} {m.label}
                </span>
              ))}
            </div>
          )}

          <div className="event-idle-desc">
            {flippedCount === 0
              ? 'เสิร์ฟครบทั้งเครื่องดื่ม ท็อปปิ้ง และขนมแล้ว! แตะช่องไหนก่อนก็ได้ค่ะ'
              : flippedCount < 3
                ? `เหลืออีก ${3 - flippedCount} ช่อง! แตะพลิกให้ครบเพื่อสรุปผลอีเวนท์`
                : 'กำลังเปิดบิลสรุปผลชะตา...'}
          </div>
        </motion.div>
      </section>
    );
  }

  // เฟสเริ่มต้น
  if (spinPhase !== 'REVEALED' || !spinResult || !spinResult.outcome) {
    return (
      <section className="event-panel">
        <div className="event-idle">
          <div className="event-idle-emoji">🧁</div>
          <div className="event-idle-title">พร้อมวัดดวงกับ Horizon Casino แล้วหรือยังคะ?</div>
          <div className="event-idle-desc">
            ลากหรือแตะคันโยกด้านข้างเพื่อสุ่มเมนูคาเฟ่ทั้ง 3 ช่อง จากนั้นแตะพลิกการ์ดทีละใบเพื่อเฉลยอีเวนท์สุดป่วนกว่า 158 แบบ!
          </div>
        </div>
      </section>
    );
  }

  // เฟส 3: พลิกครบทั้ง 3 ใบแล้ว แสดงรายละเอียดเต็มพอดีหน้าจอ
  const { outcome, previousBalance, newBalance } = spinResult;
  const delta = Number(outcome.delta || 0);
  const diffClass = delta > 0 ? 'diff-pos' : delta < 0 ? 'diff-neg' : 'diff-zero';

  return (
    <section className="event-panel">
      <AnimatePresence mode="wait">
        <motion.div
          key={`${spinResult.scratchCount}-${outcome.headline}`}
          className={`event-card outcome-${outcome.outcomeType || 'ZERO'}`}
          initial={{ opacity: 0, y: 10, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ type: 'spring', stiffness: 330, damping: 25 }}
        >
          {menuItems.length === 3 && (
            <div className="event-order-receipt">
              <span>🧾</span>
              <span>
                {menuItems[0].icon} {menuItems[0].label} + {menuItems[1].icon} {menuItems[1].label} +{' '}
                {menuItems[2].icon} {menuItems[2].label}
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

          <div className={`event-balance-diff ${diffClass}`}>
            {Number(previousBalance || 0).toLocaleString()} ➔ {Number(newBalance || 0).toLocaleString()} เหรียญ (
            {delta > 0 ? `+${delta.toLocaleString()}` : delta.toLocaleString()})
          </div>

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