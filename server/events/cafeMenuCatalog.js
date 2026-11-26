// server/events/cafeMenuCatalog.js
// ☕ คลังเมนูเครื่องดื่มแฟนซี + ท็อปปิ้ง + ขนมทานเล่น (ระบบใบ้แบบแอบๆ และหักมุมได้ทุกรอบ)

const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

// 🍰 คลังเมนูแยกตามกลุ่มอารมณ์ (โทนสีหน้าการ์ดคุมพาสเทลคาเฟ่ทั้งหมด ไม่สปอยล์โจ่งแจ้ง)
const MOOD_MENUS = {
  LUXURY: {
    menuTone: 'cafe-honey',
    drinks: [
      { icon: '☕', label: 'ปานามาเกอิชาทองคำ', sub: 'ดริปเมล็ดคั่วอ่อน 24K' },
      { icon: '🍵', label: 'มัทฉะเกรดจักรพรรดิ', sub: 'ตีโฟมเนียนละมุนลิ้น' },
      { icon: '🥂', label: 'สปาร์กลิงพีชรอยัล', sub: 'ซ่าละมุนกลิ่นน้ำผึ้งป่า' },
      { icon: '🧋', label: 'ชานมอัสสัมคาราเมล', sub: 'สูตรลับบาริสต้า VIP' },
      { icon: '🍷', label: 'เบลนด์เบอร์รี่มูนไลท์', sub: 'สกัดเย็น 18 ชั่วโมง' }
    ],
    toppings: [
      { icon: '✨', label: 'แผ่นทองคำเปลวแท้', sub: 'ประกายวิบวับระดับสุลต่าน' },
      { icon: '🍯', label: 'ไข่มุกน้ำผึ้งเดือนห้า', sub: 'เคี้ยวหนึบหวานกำลังดี' },
      { icon: '☁️', label: 'วิปครีมฮอกไกโด', sub: 'นุ่มฟูละลายในปาก' },
      { icon: '🧈', label: 'ซอสคาราเมลเกลือทะเล', sub: 'หอมเนยฝรั่งเศสแท้' },
      { icon: '🌸', label: 'เจลลี่น้ำกุหลาบ', sub: 'กลิ่นหอมละมุนสุดหรู' }
    ],
    snacks: [
      { icon: '🥐', label: 'ครัวซองต์เนยฝรั่งเศส', sub: 'อบร้อนกรอบนอกนุ่มใน' },
      { icon: '🍈', label: 'ทาร์ตเมลอนญี่ปุ่น', sub: 'หวานฉ่ำตัดครีมสด' },
      { icon: '🍰', label: 'เครปเค้กวานิลลาทอง', sub: 'ซ้อน 20 ชั้นสุดละมุน' },
      { icon: '🥧', label: 'คานาเล่บอร์โดซ์', sub: 'เปลือกกรอบคาราเมล' },
      { icon: '🍓', label: 'สตรอว์เบอร์รีชอร์ตเค้ก', sub: 'ครีมสดคัดพิเศษ' }
    ]
  },

  COZY: {
    menuTone: 'cafe-matcha',
    drinks: [
      { icon: '🧋', label: 'โอ๊ตมิลค์ลาเต้น้ำผึ้ง', sub: 'ละมุนอุ่นใจบ่ายวันหยุด' },
      { icon: '🍓', label: 'มัทฉะสตรอว์เบอร์รี', sub: 'เลเยอร์สีชมพูเขียวสุดคิวท์' },
      { icon: '☕', label: 'เดอร์ตี้คอฟฟี่เย็นจัด', sub: 'ช็อตเข้มตัดนมเย็นครีมมี่' },
      { icon: '🍫', label: 'โกโก้ดัตช์มาร์ชเมลโลว์', sub: 'เข้มข้นหวานกำลังดี' },
      { icon: '🍊', label: 'ยูซุเอสเพรสโซ่โซดา', sub: 'สดชื่นตื่นเต็มตา' }
    ],
    toppings: [
      { icon: '🤎', label: 'บุกบราวน์ชูการ์', sub: 'หนุบหนับเคี้ยวเพลิน' },
      { icon: '🍦', label: 'ไอศกรีมวานิลลาบีน', sub: 'ท็อปปิ้งสุดคลาสสิก' },
      { icon: '🍪', label: 'ครัมเบิลบิสกิตเนย', sub: 'กรุบกรอบหอมกรุ่น' },
      { icon: '🥛', label: 'โฟมนมชีสละมุน', sub: 'เค็มมันตัดหวานพอดี' },
      { icon: '🍒', label: 'เชอร์รีเชื่อมมาราสชิโน', sub: 'สีสดใสประดับยอด' }
    ],
    snacks: [
      { icon: '🧁', label: 'ชิฟฟ่อนวานิลลาเมฆ', sub: 'เนื้อนุ่มเด้งดึ๋ง' },
      { icon: '🍫', label: 'บราวนี่ฟัดจ์อบอุ่น', sub: 'ช็อกโกแลตเยิ้มตรงกลาง' },
      { icon: '🧇', label: 'วาฟเฟิลเบลเยียม', sub: 'ราดเมเปิลไซรัปหอมๆ' },
      { icon: '🍪', label: 'ซอฟต์คุกกี้ดาร์กช็อก', sub: 'เพิ่งออกจากเตาใหม่ๆ' },
      { icon: '🍩', label: 'โดนัทเคลือบน้ำตาล', sub: 'นุ่มฟูกินคู่กาแฟฟินมาก' }
    ]
  },

  MYSTIC: {
    menuTone: 'cafe-lavender',
    drinks: [
      { icon: '🌌', label: 'กาแล็กซี่ลาเวนเดอร์', sub: 'อัญชันโซดาเปลี่ยนสีได้' },
      { icon: '🔮', label: 'ชาเอิร์ลเกรย์แสงจันทร์', sub: 'หอมกลิ่นมะกรูดต้องมนตร์' },
      { icon: '🪷', label: 'มิลค์ทีกลีบดอกวิสทีเรีย', sub: 'สีม่วงพาสเทลชวนฝัน' },
      { icon: '🌠', label: 'สตาร์ไลท์บูลเบอร์รีฟิซ', sub: 'ซ่าเบาๆ พร้อมประกายดาว' },
      { icon: '🫖', label: 'ชากุหลาบขาวปาฏิหาริย์', sub: 'ชงด้วยน้ำค้างยามเช้า' }
    ],
    toppings: [
      { icon: '🌈', label: 'กลิตเตอร์ดาวกินได้', sub: 'หมุนวนเหมือนทางช้างเผือก' },
      { icon: '🫧', label: 'ไข่มุกป๊อปยูซุระเบิด', sub: 'แตกเป๊าะในปากทันที' },
      { icon: '🍬', label: 'สายไหมก้อนเมฆ', sub: 'ลอยฟูเหนือปากแก้ว' },
      { icon: '🪻', label: 'ไซรัปลาเวนเดอร์ป่า', sub: 'กลิ่นหอมชวนเคลิ้ม' },
      { icon: '🌙', label: 'เยลลี่พระจันทร์เสี้ยว', sub: 'ใสวิ้งเหมือนคริสตัล' }
    ],
    snacks: [
      { icon: '🥞', label: 'ซูเฟล่แพนเค้กลอยได้', sub: 'นุ่มเด้งเหมือนปุยเมฆ' },
      { icon: '🍮', label: 'พุดดิ้งแสงจันทร์', sub: 'เด้งดึ๋งราดซอสคาราเมล' },
      { icon: '🍡', label: 'โมจิหยดน้ำคริสตัล', sub: 'ใสกิ๊งราดซอสคุโรมิตสึ' },
      { icon: '🧁', label: 'มาการองสีรุ้งพาสเทล', sub: 'ไส้กานาชลาเวนเดอร์' },
      { icon: '🍰', label: 'มูสเค้กบลูเบอร์รี', sub: 'เย็นละมุนเหมือนต้องมนตร์' }
    ]
  },

  MINIMAL: {
    menuTone: 'cafe-cream',
    drinks: [
      { icon: '🧊', label: 'น้ำเปล่าไม่ใส่น้ำแข็ง', sub: 'บริสุทธิ์ระดับเซน' },
      { icon: '💧', label: 'อเมริกาโน่น้ำแข็งละลาย', sub: 'จางนิดหน่อยแต่ใจสู้' },
      { icon: '🍵', label: 'ชาร้อนจืดสไตล์มินิมอล', sub: 'ไร้ความหวาน ไร้อารมณ์' },
      { icon: '🥛', label: 'นมจืดอุณหภูมิห้อง', sub: 'เรียบง่ายสบายท้อง' },
      { icon: '🫧', label: 'โซดาเปล่าซ่าเงียบๆ', sub: 'ฟองกำลังค่อยๆ หายไป' }
    ],
    toppings: [
      { icon: '💨', label: 'โฟมฟองอากาศล้วน', sub: 'เบาหวิว 0 แคลอรี่' },
      { icon: '🧂', label: 'เกลือหิมาลายัน 1 เม็ด', sub: 'เค็มนิดๆ พอเป็นพิธี' },
      { icon: '🧊', label: 'น้ำแข็งก้อนกลม 1 ก้อน', sub: 'ละลายช้าเหมือนเวลา' },
      { icon: '🍃', label: 'ใบสะระแหน่ 1 ใบถ้วน', sub: 'วางแปะให้ดูมีอะไร' },
      { icon: '🥢', label: 'หลอดกระดาษเปื่อยๆ', sub: 'รีบดูดก่อนจะยุ่ยนะ' }
    ],
    snacks: [
      { icon: '🍘', label: 'แครกเกอร์จืดแผ่นเดียว', sub: 'กรอบแห้งไร้รสชาติ' },
      { icon: '🍞', label: 'ขอบขนมปังเปล่า', sub: 'ไม่ได้ทาเนย ไม่ได้ปิ้ง' },
      { icon: '🥠', label: 'คุกกี้เสี่ยงทายใบเปล่า', sub: 'ข้างในเขียนว่าสู้ๆ นะ' },
      { icon: '🍽️', label: 'จานเปล่าเช็ดสะอาด', sub: 'พร้อมกลิ่นขนมจากโต๊ะข้างๆ' },
      { icon: '🥨', label: 'เพรทเซลแท่งจิ๋ว', sub: 'เคี้ยวแก้เหงาเบาๆ' }
    ]
  },

  BITTER: {
    menuTone: 'cafe-berry',
    drinks: [
      { icon: '🖤', label: 'เอสเพรสโซ่คั่วไหม้ 4 ช็อต', sub: 'ขมตาสว่างถึงชาติหน้า' },
      { icon: '🍋', label: 'เลมอนโซดาเปรี้ยวปรี๊ด', sub: 'คั้นสดไม่ใส่น้ำเชื่อม' },
      { icon: '☕', label: 'กาแฟดำลืมใส่น้ำตาล', sub: 'รสชาติของชีวิตจริง' },
      { icon: '🍵', label: 'มัทฉะเพียวไม่ผสมนม', sub: 'เข้มขมปาดคอสุดๆ' },
      { icon: '🌶️', label: 'โกโก้พริกปาปริก้า', sub: 'เผ็ดร้อนแปลกใหม่' }
    ],
    toppings: [
      { icon: '🌶️', label: 'เกลือพริกชี้ฟ้า', sub: 'ซี้ดซ้าดสะเทือนลิ้น' },
      { icon: '🍋', label: 'เปลือกมะนาวขูดเข้ม', sub: 'ขมติดปลายลิ้นเบาๆ' },
      { icon: '🧊', label: 'น้ำแข็งพูนล้นแก้ว', sub: 'ดูดสองทีหมดแก้วแล้ว' },
      { icon: '☕', label: 'ผงกาแฟบดหยาบ', sub: 'เคี้ยวกร้วมๆ แก้ง่วง' },
      { icon: '🍋‍🟩', label: 'ช็อตมะนาวเพียวเพิ่ม', sub: 'เปรี้ยวจนหลับตาปี๋' }
    ],
    snacks: [
      { icon: '🍞', label: 'ปังปิ้งขอบไหม้เกรียม', sub: 'กรุบกรอบกลิ่นถ่านอ่อนๆ' },
      { icon: '🥧', label: 'ทาร์ตมะนาวสุดจี๊ด', sub: 'เปรี้ยวเข็ดฟันตาสว่าง' },
      { icon: '🍫', label: 'ดาร์กช็อกโกแลต 99%', sub: 'ขมเข้มข้นระดับผู้ใหญ่' },
      { icon: '🥐', label: 'ครัวซองต์แบนแต๊ดแต๋', sub: 'โดนกระเป๋าตังค์ทับมา' },
      { icon: '🍪', label: 'คุกกี้ลูกเกดหลอกตา', sub: 'นึกว่าช็อกโกแลตชิปอะดิ' }
    ]
  },

  CHAOS: {
    menuTone: 'cafe-latte',
    drinks: [
      { icon: '🍲', label: 'ชาเขียวปั่นซุปเห็ด', sub: 'เมนูทดลองสุดวิบัติ' },
      { icon: '🔥', label: 'ลาเต้หม้อทอด 200°C', sub: 'เดือดปุดๆ ร้อนทะลุแก้ว' },
      { icon: '🧃', label: 'อเมริกาโน่น้ำปลาหวาน', sub: 'สูตรลับที่ไม่มีใครขอ' },
      { icon: '🫧', label: 'ชานมไข่มุกใส่โซดา', sub: 'ซ่าจนไข่มุกลอยชนเพดาน' },
      { icon: '🌪️', label: 'สมูทตี้รวมมิตรทั้งร้าน', sub: 'ปั่นทุกอย่างที่ขวางหน้า' }
    ],
    toppings: [
      { icon: '🐜', label: 'มดงานจิ๋วแอบชิม', sub: 'การันตีความหวานเจี๊ยบ' },
      { icon: '🥫', label: 'ซอสพริกศรีราชาบีบวน', sub: 'ลวดลายลาเต้อาร์ตสุดโหด' },
      { icon: '🧅', label: 'หอมเจียวกรอบโรยหน้า', sub: 'หอมฟุ้งไปสามโต๊ะ' },
      { icon: '🧄', label: 'วิปครีมรสกระเทียม', sub: 'กันแวมไพร์ได้ 100%' },
      { icon: '💥', label: 'เป๊าะแป๊ะปะทุในแก้ว', sub: 'เสียงดังเหมือนประทัด' }
    ],
    snacks: [
      { icon: '🍜', label: 'มาม่าดิบโรยผงโกโก้', sub: 'กรอบเค็มหวานในคำเดียว' },
      { icon: '🍮', label: 'พุดดิ้งซอสน้ำปลา', sub: 'เด้งดึ๋งกลิ่นชวนฉงน' },
      { icon: '🍞', label: 'โทสต์ชุบน้ำจิ้มสุกี้', sub: 'นวัตกรรมเชฟสติหลุด' },
      { icon: '🧁', label: 'คัพเค้กหน้าปลากรอบ', sub: 'แคลเซียมสูงเกินพิกัด' },
      { icon: '🌮', label: 'เครปเย็นไส้หมูหยองพริกเผา', sub: 'เมนูฟิวชันหลุดโลก' }
    ]
  }
};

// 🏰 เซ็ตเมนูซิกเนเจอร์ประจำแลนด์มาร์กริมหน้าต่าง 5 โซน
const LANDMARK_MENUS = {
  GARDEN: {
    menuTone: 'cafe-matcha',
    drink: { icon: '🪴', label: 'มอนสเตอร่ามัทฉะลาเต้', sub: 'หอมใบชาเขียวกลางสวน' },
    topping: { icon: '🍃', label: 'เจลลี่มิ้นต์ยอดอ่อน', sub: 'เย็นสดชื่นกลิ่นพฤกษา' },
    snack: { icon: '🧁', label: 'ทีรามิสุกระถางต้นไม้', sub: 'โรยครัมเบิลโกโก้น่ารัก' }
  },
  SAKURA: {
    menuTone: 'cafe-berry',
    drink: { icon: '🌸', label: 'ซากุระบลอสซั่มลาเต้', sub: 'นมชมพูหอมกลีบซากุระ' },
    topping: { icon: '🎀', label: 'กลีบซากุระเชื่อมน้ำผึ้ง', sub: 'ลอยพลิ้วบนฟองนมละมุน' },
    snack: { icon: '🍡', label: 'ดังโงะสามสีชมพู', sub: 'นุ่มหนึบสไตล์เกียวโต' }
  },
  MEADOW: {
    menuTone: 'cafe-lavender',
    drink: { icon: '🪻', label: 'ลาเวนเดอร์ฮันนี่มิลค์', sub: 'หอมทุ่งดอกไม้ยามบ่าย' },
    topping: { icon: '🍯', label: 'รวงผึ้งแท้หยดทอง', sub: 'หวานหอมจากดอกไม้ป่า' },
    snack: { icon: '🍰', label: 'ชีสเค้กเลมอนดอกไม้', sub: 'แต่งกลีบดอกไม้กินได้' }
  },
  BEACH: {
    menuTone: 'cafe-cream',
    drink: { icon: '🏖️', label: 'บลูฮาวายเกลียวคลื่น', sub: 'โซดาสีครามสดชื่นริมทะเล' },
    topping: { icon: '🥥', label: 'เกล็ดมะพร้าวคั่วกรอบ', sub: 'หอมมันรับลมชายหาด' },
    snack: { icon: '🍧', label: 'บิงซูเกล็ดหิมะทะเล', sub: 'เย็นฉ่ำหวานละมุน' }
  },
  RIVER: {
    menuTone: 'cafe-matcha',
    drink: { icon: '🏞️', label: 'โคลด์บริวสายหมอกเขา', sub: 'กาแฟดริปเย็นละมุนกลิ่นไม้' },
    topping: { icon: '☁️', label: 'โฟมนมสายหมอกเช้า', sub: 'นุ่มฟูเหมือนเมฆบนยอดดอย' },
    snack: { icon: '🧇', label: 'ครอฟเฟิลน้ำผึ้งป่า', sub: 'กรอบหอมกลิ่นเมเปิล' }
  }
};

const ALL_MOOD_KEYS = Object.keys(MOOD_MENUS);

function detectLandmarkId(outcome) {
  const stamp = String(outcome?.stampId || '');
  for (const id of Object.keys(LANDMARK_MENUS)) {
    if (stamp.includes(id)) return id;
  }
  const hdr = String(outcome?.categoryHeader || '');
  if (hdr.includes('🪴')) return 'GARDEN';
  if (hdr.includes('🌸')) return 'SAKURA';
  if (hdr.includes('🪻')) return 'MEADOW';
  if (hdr.includes('🏖️')) return 'BEACH';
  if (hdr.includes('🏞️')) return 'RIVER';
  return null;
}

function getNativeMood(outcome) {
  const t = outcome?.outcomeType || 'ZERO';
  if (t === 'JACKPOT') return 'LUXURY';
  if (t === 'WIN') return 'COZY';
  if (t === 'MIRACLE') return 'MYSTIC';
  if (t === 'TAX' || t === 'THEFT') return 'BITTER';
  if (t === 'DIVIDER') return 'CHAOS';
  return 'MINIMAL';
}

function pickFromMood(moodKey, slotType) {
  const pool = MOOD_MENUS[moodKey] || MOOD_MENUS.COZY;
  const item = pickRandom(pool[slotType]);
  return { ...item, menuTone: pool.menuTone };
}

/**
 * สร้างเซ็ตเมนูคาเฟ่ 3 ช่อง (เครื่องดื่ม / ท็อปปิ้ง / ขนมทานเล่น)
 * ระดับการใบ้แบบแอบๆ (Unpredictable Subtle Hint):
 * - 35%: ตรงกับโซนแลนด์มาร์ก หรือแอบอิงอารมณ์ผลลัพธ์ทั้ง 3 ช่อง
 * - 35%: ผสมใบ้แค่ 1-2 ช่อง ที่เหลือสุ่มคาเฟ่ทั่วไป (ชวนเอ๊ะเบาๆ)
 * - 30%: สุ่มขั้วอิสระ/หักมุมเต็มรูปแบบ (ไม่ว่าเป็นอะไรก็เกิดขึ้นได้)
 */
function generateCafeMenuForOutcome(outcome) {
  const nativeMood = getNativeMood(outcome);
  const landmarkId = detectLandmarkId(outcome);
  const roll = Math.random();

  let drink;
  let topping;
  let snack;

  if (landmarkId && roll < 0.55) {
    // แลนด์มาร์กริมหน้าต่าง: มีโอกาสเสิร์ฟเมนูซิกเนเจอร์ประจำโซนวิว (แต่ยังไม่ 100% เพื่อคงความลุ้น)
    const lm = LANDMARK_MENUS[landmarkId];
    drink = { ...lm.drink, menuTone: lm.menuTone };
    topping = Math.random() < 0.7 ? { ...lm.topping, menuTone: lm.menuTone } : pickFromMood(pickRandom(ALL_MOOD_KEYS), 'toppings');
    snack = { ...lm.snack, menuTone: lm.menuTone };
  } else if (roll < 0.35) {
    // โหมดแอบใบ้เนียนๆ ทั้ง 3 ช่องตามอารมณ์ผลลัพธ์
    drink = pickFromMood(nativeMood, 'drinks');
    topping = pickFromMood(nativeMood, 'toppings');
    snack = pickFromMood(nativeMood, 'snacks');
  } else if (roll < 0.70) {
    // โหมดใบ้แอบๆ แค่ 1-2 ช่อง ที่เหลือเป็นเมนูคาเฟ่ชิลๆ ปนกัน
    const neutralMoods = ['COZY', 'LUXURY', 'MYSTIC'];
    const hintIdx = Math.floor(Math.random() * 3);
    drink = pickFromMood(hintIdx === 0 ? nativeMood : pickRandom(neutralMoods), 'drinks');
    topping = pickFromMood(hintIdx === 1 ? nativeMood : pickRandom(neutralMoods), 'toppings');
    snack = pickFromMood(hintIdx === 2 ? nativeMood : pickRandom(neutralMoods), 'snacks');
  } else {
    // โหมดอิสระ / หักมุมสุดขั้ว (เช่น เสิร์ฟหรูแต่โดนปล้น หรือเสิร์ฟแปลกแต่แจ็กพอตแตก)
    const surpriseMoods = ALL_MOOD_KEYS.filter((k) => k !== nativeMood);
    const chosenSurprise = pickRandom(surpriseMoods);
    drink = pickFromMood(chosenSurprise, 'drinks');
    topping = pickFromMood(Math.random() < 0.65 ? chosenSurprise : pickRandom(ALL_MOOD_KEYS), 'toppings');
    snack = pickFromMood(chosenSurprise, 'snacks');
  }

  return {
    items: [
      { category: '☕ เครื่องดื่ม', ...drink },
      { category: '✨ ท็อปปิ้ง', ...topping },
      { category: '🍰 ขนมทานเล่น', ...snack }
    ]
  };
}

module.exports = {
  MOOD_MENUS,
  LANDMARK_MENUS,
  generateCafeMenuForOutcome
};