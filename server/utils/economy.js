// server/utils/economy.js
// 🏦 ศูนย์รวมสูตรสมดุลเศรษฐกิจสายโหด: กระเป๋า + ธนาคาร + เจาะตู้เซฟ + ค่าตั๋วขั้นบันได + เผาลดเงินเฟ้อ

const MAX_WALLET_CAP = 9999999;
const MIN_WALLET_CAP = -9999999;
const TIP_JAR_CAP = 10000; // เพดานกระปุกหมู (คุมไม่ให้แตกจนเงินเฟ้อ)
const DEPOSIT_FEE_RATE = 0.05; // ค่าธรรมเนียมฝากธนาคาร 5% (เผาทิ้งออกจากระบบถาวร • ถอนฟรี 0%)
const MAX_STATEMENT_ITEMS = 10;

const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const clampCoins = (val) =>
  Math.max(MIN_WALLET_CAP, Math.min(MAX_WALLET_CAP, Math.round(Number(val || 0))));

const clampBank = (val) =>
  Math.max(0, Math.min(MAX_WALLET_CAP, Math.round(Number(val || 0))));

// 🎟️ ค่าตั๋วโยกสล็อตแบบขั้นบันไดตามความรวย (ติดหนี้หรือหมดตัวปั่นฟรี 0 เหรียญ • คนรวยจ่ายหนักและเผาทิ้ง 100%)
function calculateSpinFee(walletBalance = 0, bankBalance = 0) {
  const netWorth = Number(walletBalance || 0) + clampBank(bankBalance);
  if (netWorth <= 0) return 0;
  if (netWorth <= 2000) return 15;
  if (netWorth <= 8000) return 40;
  return Math.min(250, Math.max(40, Math.round(netWorth * 0.01)));
}

// 📜 สร้างอ็อบเจกต์รายการเดินบัญชี 1 รายการ
function buildTransaction({
  type = 'SPIN',
  title = '',
  walletDelta = 0,
  bankDelta = 0,
  walletAfter = 0,
  bankAfter = 0,
  burned = 0
}) {
  return {
    at: new Date(),
    type,
    title: String(title || 'รายการทางการเงิน').slice(0, 120),
    walletDelta: Math.round(Number(walletDelta || 0)),
    bankDelta: Math.round(Number(bankDelta || 0)),
    walletAfter: clampCoins(walletAfter),
    bankAfter: clampBank(bankAfter),
    burned: Math.max(0, Math.round(Number(burned || 0)))
  };
}

// 🔥 กลไกคุมเงินเฟ้อสายตึง: สุ่มเข้ากระปุกหมูแค่ 10%–35% (ถ่วงน้ำหนักต่ำ) ส่วนที่เหลือ 65%–90% เผาหายถาวร
function applyTipJarSink(rawLossAmount, worldState) {
  const loss = Math.abs(Math.round(Number(rawLossAmount || 0)));
  if (loss <= 0 || !worldState) {
    return { tipPct: 0, toTipJar: 0, burned: 0 };
  }

  const r = Math.random();
  let tipPct;
  if (r < 0.60) tipPct = randInt(10, 18);
  else if (r < 0.90) tipPct = randInt(19, 27);
  else tipPct = randInt(28, 35);

  const toTipJar = Math.max(5, Math.round((loss * tipPct) / 100));
  const currentJar = Number(worldState.cursedTipJar || 400);
  const nextJar = Math.min(TIP_JAR_CAP, currentJar + toTipJar);
  const actualAdded = Math.max(0, nextJar - currentJar);
  const burned = Math.max(0, loss - actualAdded);

  worldState.cursedTipJar = nextJar;
  return { tipPct, toTipJar: actualAdded, burned };
}

/**
 * 💸 คำนวณการเปลี่ยนแปลงยอดเงิน 2 บัญชี (Wallet + Bank)
 * - seizeBank = true  : ยึดทรัพย์ทั้งกระเป๋า (เหลือ 1) และอายัดธนาคาร (เหลือ 0)
 * - bankDirect = true : เจาะหักจากธนาคารก่อน ➔ ถ้าธนาคารไม่พอค่อยดึงจากกระเป๋า
 * - walletOnly = true : กระทบเฉพาะกระเป๋าตังค์เท่านั้น (ธนาคารปลอดภัย 100%)
 * - delta < 0 (ปกติ)  : หักกระเป๋าตังค์ก่อน ➔ ไม่พอให้ดึงจากธนาคาร ➔ หมดแล้วยังไม่พอจึงติดหนี้ในกระเป๋า
 */
function applyBalanceDelta({
  walletBalance = 0,
  bankBalance = 0,
  delta = 0,
  walletOnly = false,
  seizeBank = false,
  bankDirect = false
}) {
  const wallet = clampCoins(walletBalance);
  const bank = clampBank(bankBalance);
  const change = Math.round(Number(delta || 0));

  if (seizeBank) {
    const newWallet = 1;
    const newBank = 0;
    return {
      newWallet,
      newBank,
      walletDelta: newWallet - wallet,
      bankDelta: newBank - bank,
      usedBank: bank
    };
  }

  if (bankDirect && change < 0) {
    const need = Math.abs(change);
    const fromBank = Math.min(bank, need);
    const remAfterBank = need - fromBank;
    const newBank = clampBank(bank - fromBank);
    const newWallet = clampCoins(wallet - remAfterBank);
    return {
      newWallet,
      newBank,
      walletDelta: newWallet - wallet,
      bankDelta: newBank - bank,
      usedBank: fromBank
    };
  }

  if (walletOnly || change >= 0) {
    const newWallet = clampCoins(wallet + change);
    return {
      newWallet,
      newBank: bank,
      walletDelta: newWallet - wallet,
      bankDelta: 0,
      usedBank: 0
    };
  }

  // หักเงินข้ามบัญชีแบบปกติ (Waterfall: Wallet -> Bank -> Debt)
  const need = Math.abs(change);
  const fromWalletPositive = wallet > 0 ? Math.min(wallet, need) : 0;
  const remAfterWallet = need - fromWalletPositive;
  const fromBank = remAfterWallet > 0 && bank > 0 ? Math.min(bank, remAfterWallet) : 0;
  const remDebt = remAfterWallet - fromBank;

  const newWallet = clampCoins(wallet - fromWalletPositive - remDebt);
  const newBank = clampBank(bank - fromBank);

  return {
    newWallet,
    newBank,
    walletDelta: newWallet - wallet,
    bankDelta: newBank - bank,
    usedBank: fromBank
  };
}

// 🏦 คำนวณการฝากเงิน (Wallet ➔ Bank) พร้อมค่าธรรมเนียม 5% เผาออกจากระบบ
function calculateDeposit(walletBalance, bankBalance, rawAmount) {
  const wallet = clampCoins(walletBalance);
  const bank = clampBank(bankBalance);
  const amount = Math.floor(Number(rawAmount || 0));

  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: 'กรุณาระบุจำนวนเงินฝากมากกว่า 0 เหรียญค่ะ' };
  }
  if (wallet <= 0) {
    return { ok: false, error: 'ไม่มีเงินคงเหลือในกระเป๋าตังค์สำหรับฝากค่ะ' };
  }
  if (amount > wallet) {
    return { ok: false, error: `เงินในกระเป๋าไม่พอฝาก (มีอยู่ ${wallet.toLocaleString()} เหรียญ)` };
  }

  const fee = amount >= 20 ? Math.max(1, Math.round(amount * DEPOSIT_FEE_RATE)) : 0;
  const credited = amount - fee;
  if (credited <= 0) {
    return { ok: false, error: 'ยอดฝากน้อยเกินไปหลังหักค่าธรรมเนียมค่ะ' };
  }

  const newWallet = clampCoins(wallet - amount);
  const newBank = clampBank(bank + credited);

  const tx = buildTransaction({
    type: 'DEPOSIT',
    title: fee > 0 ? `🏦 ฝากเงินเข้าธนาคาร (ค่าธรรมเนียม ${fee.toLocaleString()} เหรียญ)` : '🏦 ฝากเงินเข้าธนาคาร',
    walletDelta: -amount,
    bankDelta: credited,
    walletAfter: newWallet,
    bankAfter: newBank,
    burned: fee
  });

  return { ok: true, amount, fee, credited, newWallet, newBank, tx };
}

// 🏧 คำนวณการถอนเงิน (Bank ➔ Wallet) ฟรีค่าธรรมเนียม 0%
function calculateWithdraw(walletBalance, bankBalance, rawAmount) {
  const wallet = clampCoins(walletBalance);
  const bank = clampBank(bankBalance);
  const amount = Math.floor(Number(rawAmount || 0));

  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: 'กรุณาระบุจำนวนเงินถอนมากกว่า 0 เหรียญค่ะ' };
  }
  if (bank <= 0) {
    return { ok: false, error: 'ไม่มีเงินฝากในธนาคารให้ถอนค่ะ' };
  }
  if (amount > bank) {
    return { ok: false, error: `ยอดเงินในธนาคารไม่พอถอน (มีอยู่ ${bank.toLocaleString()} เหรียญ)` };
  }

  const newWallet = clampCoins(wallet + amount);
  const newBank = clampBank(bank - amount);

  const tx = buildTransaction({
    type: 'WITHDRAW',
    title: wallet < 0 ? '🏧 ถอนเงินจากธนาคาร (ช่วยโปะหนี้ในกระเป๋า)' : '🏧 ถอนเงินจากธนาคารเข้ากระเป๋า',
    walletDelta: amount,
    bankDelta: -amount,
    walletAfter: newWallet,
    bankAfter: newBank,
    burned: 0
  });

  return { ok: true, amount, newWallet, newBank, tx };
}

module.exports = {
  MAX_WALLET_CAP,
  MIN_WALLET_CAP,
  TIP_JAR_CAP,
  DEPOSIT_FEE_RATE,
  MAX_STATEMENT_ITEMS,
  clampCoins,
  clampBank,
  calculateSpinFee,
  buildTransaction,
  applyTipJarSink,
  applyBalanceDelta,
  calculateDeposit,
  calculateWithdraw
};