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
  menuRevealedCount = 0,
  spinResult,
  isBrandNewStamp,
  matchedStamp,
  errorMsg,
  onOpenStampBook,
  onQuickFlip
}) {
  const menuItems = spinResult?.outcome?.cafeMenu?.items || [];

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

  // เฟส 1: กำลังหมุนสุ่มเมนูคาเฟ่ทีละช่อง
  if (spinPhase === 'SPINNING') {
    const suspenseText =
      menuRevealedCount === 0
        ? 'อเลสเทียกำลังชงเครื่องดื่มสุดแฟนซีประจำรอบนี้...'
        : menuRevealedCount === 1
          ? 'ได้เครื่องดื่มแล้ว! กำลังเลือกท็อปปิ้งสุดพิเศษ...'
          : 'กำลังจัดจานขนมทานเล่นชิ้นสุดท้ายมาเสิร์ฟค่ะ...';

    return (
      <section className="event-panel">
        <motion.div
          key={`spin-menu-${menuRevealedCount}`}
          className="event-idle"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
        >
          <div style={{ fontSize: '1.9rem' }}>☕</div>
          <div className="event-idle-title">{suspenseText}</div>
          <div style={{ fontSize: '0.8rem' }}>เมนูนี้อาจแอบบอกใบ้... หรืออาจหักมุมเต็มระบบก็ได้นะคะ!</div>
        </motion.div>
      </section>
    );
  }

  // เฟส 2: แสดงเซ็ตเมนูครบ 3 ช่อง (ค้าง 1.5 วิ ก่อนพลิกการ์ดไล่เวฟ)
  if (spinPhase === 'MENU_SHOW' || spinPhase === 'FLIPPING') {
    return (
      <section className="event-panel">
        <motion.div
          className="menu-preview-box"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.24 }}
        >
          <div className="menu-preview-title">
            {spinPhase === 'FLIPPING'
              ? '🃏 กำลังพลิกการ์ดเปิดบิลชะตา...'
              : '🧁 อเลสเทียเสิร์ฟเซ็ตคาเฟ่ครบ 3 รายการแล้ว!'}
          </div>

          {menuItems.length === 3 && (
            <div className="menu-preview-chips">
              {menuItems.map((m, idx) => (
                <span key={idx} className="menu-preview-chip">
                  {m.icon} {m.label}
                </span>
              ))}
            </div>
          )}

          <div className="menu-wait-track">
            <motion.div
              className="menu-wait-fill"
              initial={{ width: '0%' }}
              animate={{ width: '100%' }}
              transition={{ duration: 1.5, ease: 'linear' }}
            />
          </div>

          {spinPhase === 'MENU_SHOW' && (
            <button type="button" className="btn-pill" onClick={onQuickFlip} style={{ marginTop: 4 }}>
              ⚡ แตะเปิดบิลพลิกการ์ดทันที
            </button>
          )}
        </motion.div>
      </section>
    );
  }

  // เฟสเริ่มต้น
  if (spinPhase !== 'REVEALED' || !spinResult || !spinResult.outcome) {
    return (
      <section className="event-panel">
        <div className="event-idle">
          <div style={{ fontSize: '2rem' }}>🧁</div>
          <div className="event-idle-title">พร้อมสั่งเมนูวัดดวงกับ Horizon Casino แล้วหรือยังคะ?</div>
          <div style={{ fontSize: '0.84rem', maxWidth: 540, lineHeight: 1.5 }}>
            ดึงคันโยกด้านขวาเพื่อสุ่ม <strong>เครื่องดื่ม • ท็อปปิ้ง • ขนมทานเล่น</strong> จากนั้นการ์ดทั้ง 3 ใบจะพลิกกลับด้านเพื่อเผยอีเวนท์สุดป่วนกว่า 158 แบบ!
          </div>
        </div>
      </section>
    );
  }

  // เฟส 3: พลิกการ์ดครบแล้ว เฉลยอีเวนท์เต็มรูปแบบ + ใบเสร็จเมนูจิ๋ว
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
          {menuItems.length === 3 && (
            <div className="event-order-receipt">
              <span>🧾 ออเดอร์รอบนี้:</span>
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