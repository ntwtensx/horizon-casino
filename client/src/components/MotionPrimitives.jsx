import React, { useEffect, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

// ค่าเริ่มต้นลายเส้นไอคอน lucide-react ให้ความหนามนเท่ากันทั้งแอป
export const ICON_BASE = {
  size: 15,
  strokeWidth: 2.2,
  'aria-hidden': true
};

// ตัดข้อความภาษาไทยด้วย Intl.Segmenter เพื่อไม่ให้สระบน-ล่างและวรรณยุกต์หลุดแยก
function segmentThaiText(rawText, mode = 'grapheme') {
  const str = String(rawText ?? '');
  if (!str) return [];

  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    const granularity = mode === 'word' ? 'word' : 'grapheme';
    const seg = new Intl.Segmenter('th', { granularity });
    return Array.from(seg.segment(str), (s) => s.segment);
  }

  return mode === 'word' ? str.split(/(\s+)/) : Array.from(str);
}

/**
 * ✨ ตัวอักษรมีอนิเมชั่นรองรับภาษาไทยสมบูรณ์
 * - variant: 'pop' (เด้งขึ้นทีละตัว) | 'assemble' (พุ่งสลับทิศเด้งมารวมกัน) | 'blur' (เฟดจากเบลอเป็นคม)
 * - by: 'grapheme' (ทีละตัวอักษรพร้อมสระ) | 'word' (ทีละคำ เหมาะกับพาดหัวยาวๆ)
 */
export function AnimatedText({
  text = '',
  variant = 'pop',
  by,
  delay = 0,
  stagger,
  className = '',
  as = 'span'
}) {
  const reduceMotion = useReducedMotion();
  const unitMode = by || (variant === 'assemble' ? 'word' : 'grapheme');
  const step = stagger ?? (unitMode === 'word' ? 0.045 : 0.026);
  const tokens = useMemo(() => segmentThaiText(text, unitMode), [text, unitMode]);

  const Tag = as;

  if (reduceMotion || tokens.length === 0) {
    return <Tag className={className}>{text}</Tag>;
  }

  const cappedStep = tokens.length > 26 ? Math.min(step, 0.018) : step;

  return (
    <Tag className={className} aria-label={String(text)}>
      {tokens.map((chunk, idx) => {
        if (/^\s+$/.test(chunk)) {
          return (
            <span key={`sp-${idx}`} aria-hidden="true">
              {chunk}
            </span>
          );
        }

        const itemDelay = delay + Math.min(idx, 32) * cappedStep;

        if (variant === 'assemble') {
          const dirY = idx % 2 === 0 ? -16 : 16;
          const dirX = idx % 3 === 0 ? -10 : idx % 3 === 1 ? 10 : 0;
          const rot = idx % 2 === 0 ? -5 : 5;
          return (
            <motion.span
              key={`as-${idx}-${chunk}`}
              aria-hidden="true"
              style={{ display: 'inline-block', whiteSpace: 'pre' }}
              initial={{ opacity: 0, y: dirY, x: dirX, scale: 0.72, rotate: rot }}
              animate={{ opacity: 1, y: 0, x: 0, scale: 1, rotate: 0 }}
              transition={{
                type: 'spring',
                stiffness: 420,
                damping: 22,
                delay: itemDelay
              }}
            >
              {chunk}
            </motion.span>
          );
        }

        if (variant === 'blur') {
          return (
            <motion.span
              key={`bl-${idx}-${chunk}`}
              aria-hidden="true"
              style={{ display: 'inline-block', whiteSpace: 'pre' }}
              initial={{ opacity: 0, y: 7, filter: 'blur(5px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{
                duration: 0.28,
                ease: 'easeOut',
                delay: itemDelay
              }}
            >
              {chunk}
            </motion.span>
          );
        }

        return (
          <motion.span
            key={`pp-${idx}-${chunk}`}
            aria-hidden="true"
            style={{ display: 'inline-block', whiteSpace: 'pre' }}
            initial={{ opacity: 0, y: 11, scale: 0.65 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{
              type: 'spring',
              stiffness: 460,
              damping: 20,
              delay: itemDelay
            }}
          >
            {chunk}
          </motion.span>
        );
      })}
    </Tag>
  );
}

/**
 * 🎬 บล็อกเปิดตัวหน้าเว็บตามลำดับเวลา (Entrance Choreography)
 */
export function EntranceBlock({
  children,
  delay = 0,
  from = 'bottom',
  className = '',
  style
}) {
  const reduceMotion = useReducedMotion();
  const offset =
    from === 'top'
      ? { y: -14, x: 0, scale: 0.98 }
      : from === 'scale'
        ? { y: 10, x: 0, scale: 0.93 }
        : { y: 16, x: 0, scale: 0.98 };

  if (reduceMotion) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      className={className}
      style={style}
      initial={{ opacity: 0, ...offset }}
      animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
      transition={{
        type: 'spring',
        stiffness: 340,
        damping: 26,
        delay
      }}
    >
      {children}
    </motion.div>
  );
}

/**
 * 🪟 หน้าต่างป๊อบอัพเด้งสปริงนุ่มมีน้ำหนัก (ใช้ร่วมกันทุก Modal ในเว็บ)
 */
export function PopModal({
  isOpen,
  onClose,
  canClose = true,
  cardClassName = '',
  cardStyle,
  children
}) {
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!isOpen || !canClose || !onClose) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, canClose, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={() => {
            if (canClose && onClose) onClose();
          }}
        >
          <motion.div
            className={`modal-card ${cardClassName}`.trim()}
            style={cardStyle}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 26, scale: 0.86 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 380, damping: 24, mass: 0.85 }}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * 🫧 รายการเด้งปุ้งๆ ทีละแถว/ใบ (จำกัดเพดาน stagger เพื่อความลื่น)
 */
export function PopItem({
  index = 0,
  step = 0.036,
  maxStagger = 16,
  baseDelay = 0.03,
  className = '',
  style,
  children,
  ...rest
}) {
  const reduceMotion = useReducedMotion();
  const cappedDelay = baseDelay + Math.min(index, maxStagger) * step;

  if (reduceMotion) {
    return (
      <div className={className} style={style} {...rest}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      className={className}
      style={style}
      initial={{ opacity: 0, y: 12, scale: 0.84 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        type: 'spring',
        stiffness: 430,
        damping: 22,
        delay: cappedDelay
      }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}