import React, { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

// ค่าเริ่มต้นลายเส้นไอคอน lucide-react ให้ความหนามนเท่ากันทั้งแอป
export const ICON_BASE = {
  size: 15,
  strokeWidth: 2.2,
  'aria-hidden': true
};

// ตัดข้อความภาษาไทยด้วย Intl.Segmenter เพื่อไม่ให้สระบน-ล่างและวรรณยุกต์หลุดแยก
function segmentThaiText(rawText, mode = 'word') {
  const str = String(rawText ?? '');
  if (!str) return [];

  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    const granularity = mode === 'grapheme' ? 'grapheme' : 'word';
    const seg = new Intl.Segmenter('th', { granularity });
    return Array.from(seg.segment(str), (s) => s.segment);
  }

  return mode === 'grapheme' ? Array.from(str) : str.split(/(\s+)/);
}

/**
 * ✨ ตัวอักษรมีอนิเมชั่นรองรับภาษาไทยสมบูรณ์
 * - ค่าเริ่มต้นตัดเป็น "คำ" (by="word") เพื่อไม่ให้เบราว์เซอร์ฉีกบรรทัดกลางคำไทย
 * - variant: 'pop' (เด้งขึ้นทีละคำ) | 'assemble' (พุ่งสลับทิศเด้งมารวมกัน) | 'blur' (เฟดจากเบลอเป็นคม)
 */
export function AnimatedText({
  text = '',
  variant = 'pop',
  by = 'word',
  delay = 0,
  stagger,
  className = '',
  as = 'span'
}) {
  const reduceMotion = useReducedMotion();
  const unitMode = by === 'grapheme' ? 'grapheme' : 'word';
  const step = stagger ?? (unitMode === 'word' ? 0.04 : 0.024);
  const tokens = useMemo(() => segmentThaiText(text, unitMode), [text, unitMode]);

  const Tag = as;

  if (reduceMotion || tokens.length === 0) {
    return <Tag className={className}>{text}</Tag>;
  }

  const cappedStep = tokens.length > 22 ? Math.min(step, 0.018) : step;

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

        const itemDelay = delay + Math.min(idx, 28) * cappedStep;

        if (variant === 'assemble') {
          const dirY = idx % 2 === 0 ? -14 : 14;
          const dirX = idx % 3 === 0 ? -8 : idx % 3 === 1 ? 8 : 0;
          const rot = idx % 2 === 0 ? -4 : 4;
          return (
            <motion.span
              key={`as-${idx}-${chunk}`}
              aria-hidden="true"
              style={{ display: 'inline-block', whiteSpace: 'pre' }}
              initial={{ opacity: 0, y: dirY, x: dirX, scale: 0.78, rotate: rot }}
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
              initial={{ opacity: 0, y: 6, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{
                duration: 0.24,
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
            initial={{ opacity: 0, y: 9, scale: 0.76 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{
              type: 'spring',
              stiffness: 440,
              damping: 22,
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
      ? { y: -12, x: 0, scale: 0.99 }
      : from === 'scale'
        ? { y: 8, x: 0, scale: 0.95 }
        : { y: 14, x: 0, scale: 0.99 };

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
 * 🪟 หน้าต่างป๊อบอัพ (เรนเดอร์บน document.body ด้วย Portal + ตัดคลิกทันทีตอนปิด + ขาออกเวลาตายตัว)
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

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="pop-modal-overlay"
          className="modal-overlay"
          initial={{ opacity: 0 }}
          animate={{
            opacity: 1,
            transition: { duration: 0.18, ease: 'easeOut' }
          }}
          exit={{
            opacity: 0,
            pointerEvents: 'none',
            transition: { duration: 0.14, ease: 'easeOut' }
          }}
          onClick={() => {
            if (canClose && onClose) onClose();
          }}
        >
          <motion.div
            key="pop-modal-card"
            className={`modal-card ${cardClassName}`.trim()}
            style={cardStyle}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 22, scale: 0.9 }}
            animate={
              reduceMotion
                ? { opacity: 1, transition: { duration: 0.16 } }
                : {
                    opacity: 1,
                    y: 0,
                    scale: 1,
                    transition: { type: 'spring', stiffness: 380, damping: 26, mass: 0.85 }
                  }
            }
            exit={{
              opacity: 0,
              y: reduceMotion ? 0 : 12,
              scale: reduceMotion ? 1 : 0.95,
              pointerEvents: 'none',
              transition: { duration: 0.13, ease: 'easeOut' }
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

/**
 * 🗂️ ลิ้นชักลอยด้านบน (เรนเดอร์บน document.body ด้วยตัวครอบเดียวมี key • ไร้บัค Fragment ค้าง)
 */
export function FloatingDrawer({ isOpen, onClose, children }) {
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!isOpen || !onClose) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="floating-drawer-portal"
          className="drawer-portal-root"
          initial={{ opacity: 0 }}
          animate={{
            opacity: 1,
            transition: { duration: 0.16, ease: 'easeOut' }
          }}
          exit={{
            opacity: 0,
            pointerEvents: 'none',
            transition: { duration: 0.14, ease: 'easeOut' }
          }}
        >
          <div
            className="drawer-backdrop"
            onClick={() => {
              if (onClose) onClose();
            }}
          />
          <div className="floating-drawer-wrap">
            <motion.aside
              className="floating-top-drawer"
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -14, scale: 0.97 }}
              animate={
                reduceMotion
                  ? { opacity: 1, transition: { duration: 0.16 } }
                  : {
                      opacity: 1,
                      y: 0,
                      scale: 1,
                      transition: { type: 'spring', stiffness: 360, damping: 28 }
                    }
              }
              exit={{
                opacity: 0,
                y: reduceMotion ? 0 : -10,
                scale: reduceMotion ? 1 : 0.97,
                pointerEvents: 'none',
                transition: { duration: 0.13, ease: 'easeOut' }
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {children}
            </motion.aside>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

/**
 * 🫧 รายการเด้งปุ้งๆ ทีละแถว/ใบ (จำกัดเพดาน stagger เพื่อความลื่น)
 */
export function PopItem({
  index = 0,
  step = 0.032,
  maxStagger = 14,
  baseDelay = 0.02,
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
      initial={{ opacity: 0, y: 10, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        type: 'spring',
        stiffness: 420,
        damping: 24,
        delay: cappedDelay
      }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}