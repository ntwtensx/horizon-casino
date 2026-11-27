// client/src/utils/cafeAudio.js
// 🔊 ตัวสังเคราะห์เสียงคาเฟ่ฉบับกะทัดรัด (Web Audio API • ไม่ต้องโหลดไฟล์เสียง)

export function createCafeAudio() {
  let ctx = null;

  const getCtx = () => {
    if (typeof window === 'undefined') return null;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) ctx = new AC();
    }
    if (ctx?.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  };

  // เล่นโน้ตเดี่ยวหรือสวีปความถี่ (f1 -> f2)
  const note = (f1, dur = 0.09, type = 'sine', vol = 0.08, delay = 0, f2 = null) => {
    const c = getCtx();
    if (!c) return;
    const t = c.currentTime + delay;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f1, t);
    if (f2) osc.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.014);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    g.connect(c.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  };

  const seq = (list) => list.forEach((args) => note(...args));

  return {
    lever: () => seq([
      [240, 0.07, 'triangle', 0.09, 0],
      [155, 0.11, 'triangle', 0.08, 0.05]
    ]),
    tick: () => note(520 + Math.random() * 140, 0.028, 'sine', 0.022),

    // เสียงหยุดเมนู + เสียงป๊อปใสๆ รับจังหวะปาติเคิลอิโมจิระเบิด
    stop: (idx = 0) => seq([
      [440 + idx * 110, 0.11, 'triangle', 0.085, 0],
      [880 + idx * 140, 0.08, 'sine', 0.042, 0.025]
    ]),

    // เสียงพลิกการ์ด 3 ชั้น: ฟึ่บ + กระแทกตุบ + ประกายแสงวาบตามสีการ์ด
    flipImpact: (idx = 0, cardTone = 'zero') => {
      const isDark = ['tax', 'divide', 'seizure', 'expense', 'bank-raid'].includes(cardTone);
      const isGrand = ['miracle', 'mult', 'win', 'jackpot', 'landmark'].includes(cardTone);
      const chime = isDark ? 390 + idx * 40 : isGrand ? 880 + idx * 140 : 660 + idx * 90;
      seq([
        [280 + idx * 55, 0.075, 'triangle', 0.065, 0, 560 + idx * 80],
        [175, 0.12, 'sine', 0.17, 0.085, 48],
        [chime, 0.16, isDark ? 'sawtooth' : 'sine', isDark ? 0.045 : 0.075, 0.095],
        ...(isGrand ? [[chime * 1.25, 0.2, 'triangle', 0.06, 0.13]] : [])
      ]);
    },

    win: () => seq([
      [523.25, 0.14, 'triangle', 0.09, 0],
      [659.25, 0.14, 'triangle', 0.09, 0.1],
      [783.99, 0.22, 'triangle', 0.1, 0.2],
      [1046.5, 0.32, 'sine', 0.09, 0.3]
    ]),
    bad: () => seq([
      [340, 0.14, 'sawtooth', 0.05, 0],
      [260, 0.24, 'sawtooth', 0.05, 0.13]
    ]),
    zero: () => seq([
      [392, 0.1, 'sine', 0.06, 0],
      [350, 0.16, 'sine', 0.05, 0.11]
    ])
  };
}