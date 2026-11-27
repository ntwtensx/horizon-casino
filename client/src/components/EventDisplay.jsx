import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle,
  Sparkles,
  Hand,
  Check,
  Coffee,
  Receipt,
  Calculator,
  Wallet,
  Landmark,
  PiggyBank,
  Flame,
  ArrowRight,
  Award
} from 'lucide-react';
import { FOIL_TONES, resolveEventTone, resolveStampTone } from '../utils/eventTones';
import { AnimatedText, ICON_BASE } from './MotionPrimitives.jsx';

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
          <div className="event-idle-emoji" style={{ display: 'inline-flex', color: 'var(--rose)' }}>
            <AlertCircle {...ICON_BASE} size={30} />
          </div>
          <div className="event-idle-title" style={{ color: 'var(--rose)' }}>
            <AnimatedText text={errorMsg} variant="blur" by="word" />
          </div>
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
          <motion.div
            className="event-idle-emoji"
            animate={{ rotate: [0, 14, -14, 0], scale: [1, 1.12, 1] }}
            transition={{ repeat: Infinity, duration: 1.4, ease: 'easeInOut' }}
            style={{ display: 'inline-flex', color: 'var(--cinnamon)' }}
          >
            <Sparkles {...ICON_BASE} size={30} />
          </motion.div>
          <div className="event-idle-title">
            <AnimatedText key={suspense} text={suspense} variant="blur" by="word" />
          </div>
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
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 360, damping: 26 }}
        >
          <div
            className="menu-preview-title"
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            <Hand {...ICON_BASE} size={16} />
            <span>แตะหรือลากกวาดผ่านการ์ดด้านบนเพื่อพลิก ({flippedCount}/3)</span>
          </div>

          {menuItems.length === 3 && (
            <div className="menu-preview-chips">
              {menuItems.map((m, idx) => (
                <motion.span
                  key={idx}
                  className={`menu-preview-chip ${flippedSlots[idx] ? 'is-flipped' : ''}`}
                  initial={{ opacity: 0, scale: 0.82 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 22, delay: idx * 0.05 }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  {flippedSlots[idx] && <Check {...ICON_BASE} size={12} />}
                  <span>
                    {m.icon} {m.label}
                  </span>
                </motion.span>
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
          <div className="event-idle-emoji" style={{ display: 'inline-flex', color: 'var(--cinnamon)' }}>
            <Coffee {...ICON_BASE} size={30} />
          </div>
          <div className="event-idle-title">
            <AnimatedText
              text="พร้อมวัดดวงกับ Horizon Casino แล้วหรือยังคะ?"
              variant="pop"
              by="word"
              stagger={0.038}
              delay={0.08}
            />
          </div>
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
  const stampTone = matchedStamp ? resolveStampTone(matchedStamp) : tone;
  const wDelta = typeof walletDelta === 'number' ? walletDelta : Number(outcome.delta || 0);
  const bDelta = typeof bankDelta === 'number' ? bankDelta : 0;
  const walletDiffClass = wDelta > 0 ? 'diff-pos' : wDelta < 0 ? 'diff-neg' : 'diff-zero';
  const sink = outcome.sinkInfo;
  const cardKey = `${spinResult.scratchCount}-${outcome.headline}`;

  return (
    <section className="event-panel">
      <AnimatePresence mode="wait">
        <motion.div
          key={cardKey}
          className={`event-card outcome-${outcome.outcomeType || 'ZERO'} ${FOIL_TONES.has(tone) ? 'foil-sheen' : ''}`}
          data-tone={tone}
          initial={{ opacity: 0, y: 14, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ type: 'spring', stiffness: 340, damping: 24 }}
        >
          {menuItems.length === 3 && (
            <div className="event-order-receipt" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <Receipt {...ICON_BASE} size={13} />
              <span>{menuItems.map((m) => `${m.icon} ${m.label}`).join(' + ')}</span>
            </div>
          )}

          <div className="event-category-pill">{outcome.categoryHeader || 'ผลการลุ้นดวง'}</div>

          <h2 className="event-headline">
            <AnimatedText
              key={`hl-${cardKey}`}
              text={outcome.headline || ''}
              variant="assemble"
              by="word"
              stagger={0.04}
            />
          </h2>

          <p className="event-message">{renderDiscordText(outcome.message)}</p>

          {outcome.equationText && (
            <div className="event-equation">
              <strong style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Calculator {...ICON_BASE} size={13} /> สมการคำนวณดวง
              </strong>
              <span>{outcome.equationText}</span>
            </div>
          )}

          <div
            className={`event-balance-diff ${walletDiffClass}`}
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 4 }}
          >
            <Wallet {...ICON_BASE} size={14} />
            <span>กระเป๋า: {Number(previousBalance || 0).toLocaleString()}</span>
            <ArrowRight {...ICON_BASE} size={13} />
            <span>
              {Number(newBalance || 0).toLocaleString()} เหรียญ ({wDelta > 0 ? `+${wDelta.toLocaleString()}` : wDelta.toLocaleString()})
            </span>
          </div>

          {bDelta !== 0 && (
            <div
              className="event-bank-diff"
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 4 }}
            >
              <Landmark {...ICON_BASE} size={14} />
              <span>ธนาคาร: {Number(previousBankBalance || 0).toLocaleString()}</span>
              <ArrowRight {...ICON_BASE} size={13} />
              <span>
                {Number(newBankBalance || 0).toLocaleString()} เหรียญ ({bDelta > 0 ? `+${bDelta.toLocaleString()}` : bDelta.toLocaleString()})
                {outcome.bankDirect
                  ? ' • เจาะหักจากธนาคารโดยตรง'
                  : usedBank > 0 && !outcome.seizeBank
                    ? ' • ดึงมาช่วยจ่ายส่วนต่าง'
                    : ''}
              </span>
            </div>
          )}

          {sink && (sink.burned > 0 || sink.toTipJar > 0) && (
            <div
              className="event-sink-note"
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 6 }}
            >
              {sink.toTipJar > 0 && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                  <PiggyBank {...ICON_BASE} size={13} />
                  เข้ากระปุกหมู +{sink.toTipJar.toLocaleString()} ({sink.tipPct}%)
                </span>
              )}
              {sink.burned > 0 && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                  <Flame {...ICON_BASE} size={13} />
                  เผาลดเงินเฟ้อ {Number(sink.burned || 0).toLocaleString()} เหรียญ
                </span>
              )}
            </div>
          )}

          {isBrandNewStamp && matchedStamp && (
            <motion.button
              type="button"
              className="stamp-unlock-banner foil-sheen"
              data-tone={stampTone}
              onClick={() => onOpenStampBook(matchedStamp.category)}
              initial={{ scale: 0.82, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 420, damping: 20, delay: 0.14 }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.96 }}
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              <Award {...ICON_BASE} size={15} />
              <span>
                ปลดล็อกแสตมป์ใหม่: {matchedStamp.icon} {matchedStamp.title}
              </span>
            </motion.button>
          )}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}