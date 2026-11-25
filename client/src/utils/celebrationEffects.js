import confetti from 'canvas-confetti';

const CAFE_GOLD = ['#E3A73B', '#FFE08A', '#D8836C', '#FFFDF9'];
const CAFE_MIRACLE = ['#9173B3', '#D4B2F2', '#E3A73B', '#F7C9B6'];
const CAFE_WIN = ['#5EA377', '#A4D9B6', '#E3A73B', '#FFF5DC'];

function makeEmojiShape(text, scalar = 2) {
  if (typeof confetti.shapeFromText === 'function') {
    try {
      return confetti.shapeFromText({ text, scalar });
    } catch {
      return null;
    }
  }
  return null;
}

export function fireOutcomeEffect(outcomeType, isBrandNewStamp = false, customIcon = '') {
  if (typeof window === 'undefined') return;

  // แจ็กพอตแตก: ยิงพลุ 2 ฝั่ง + เหรียญทองพุ่งกลางจอ
  if (outcomeType === 'JACKPOT') {
    const coinShape = makeEmojiShape('🪙', 2.2);
    const sparkleShape = makeEmojiShape('✨', 2);
    confetti({
      particleCount: 55,
      spread: 75,
      origin: { x: 0.2, y: 0.65 },
      colors: CAFE_GOLD
    });
    confetti({
      particleCount: 55,
      spread: 75,
      origin: { x: 0.8, y: 0.65 },
      colors: CAFE_GOLD
    });
    if (coinShape && sparkleShape) {
      setTimeout(() => {
        confetti({
          particleCount: 24,
          spread: 90,
          scalar: 1.4,
          origin: { y: 0.55 },
          shapes: [coinShape, sparkleShape]
        });
      }, 180);
    }
    return;
  }

  // ปาฏิหาริย์ / อีเวนท์พิเศษ: ดาวลาเวนเดอร์ + อิโมจิประจำอีเวนท์
  if (outcomeType === 'MIRACLE') {
    const starShape = makeEmojiShape('✨', 2);
    const iconShape = customIcon ? makeEmojiShape(customIcon, 2.2) : null;
    confetti({
      particleCount: 48,
      spread: 85,
      origin: { y: 0.6 },
      colors: CAFE_MIRACLE
    });
    if (starShape) {
      confetti({
        particleCount: 16,
        spread: 70,
        scalar: 1.35,
        origin: { y: 0.58 },
        shapes: iconShape ? [starShape, iconShape] : [starShape]
      });
    }
    return;
  }

  // ชนะปกติ: พลุเขียวมัทฉะ + ทองละมุน
  if (outcomeType === 'WIN') {
    confetti({
      particleCount: 36,
      spread: 65,
      origin: { y: 0.62 },
      colors: CAFE_WIN
    });
    return;
  }

  // โดนหัก / ขวานผ่า / โดนขโมย: ใบไม้แห้งหรืออีโมจิกวนๆ ร่วงเบาๆ จากด้านบน
  if (['DIVIDER', 'TAX', 'THEFT'].includes(outcomeType)) {
    const leaf = makeEmojiShape(outcomeType === 'DIVIDER' ? '💸' : '🍂', 2);
    if (leaf) {
      confetti({
        particleCount: 14,
        spread: 110,
        startVelocity: 14,
        gravity: 0.65,
        ticks: 160,
        origin: { y: 0.2 },
        shapes: [leaf]
      });
    }
    return;
  }

  // ปลดล็อกแสตมป์ใหม่แม้จะออก ZERO
  if (isBrandNewStamp) {
    confetti({
      particleCount: 28,
      spread: 60,
      origin: { y: 0.7 },
      colors: CAFE_GOLD
    });
  }
}

export function fireStampUnlockBurst() {
  if (typeof window === 'undefined') return;
  const bookShape = makeEmojiShape('⭐', 2);
  confetti({
    particleCount: 24,
    spread: 60,
    origin: { y: 0.72 },
    colors: CAFE_GOLD,
    ...(bookShape ? { shapes: [bookShape, 'circle'] } : {})
  });
}