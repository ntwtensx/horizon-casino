// server/utils/economy.js
// 🏦 ศูนย์รวมสูตรสมดุลเศรษฐกิจ: กระเป๋าตังค์ + ธนาคาร + หักเงินข้ามบัญชี + ลดเงินเฟ้อ (Money Sink)

const MAX_WALLET_CAP = 9999999;
const MIN_WALLET_CAP = -9999999;
const TIP_JAR_CAP = 18000; // เพดานกระปุกหมู (ลดจาก 60,000 เพื่อคุมเงินเฟ้อ)
const DEPOSIT_FEE_RATE = 0.03; // ค่าธรรมเนียมฝากธนาคาร 3% (เผาทิ้งออกจากระบบจริง)
const MAX_STATEMENT_ITEMS = 10;

const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const clampCoins = (val) =>
  Math.max(MIN_WALLET_CAP, Math.min(MAX_WALLET_CAP, Math.round(Number(val || 0))));

const clampBank = (val) =>
  Math.max(0, Math.min(MAX_WALLET_CAP, Math.round(Number(val || 0))));

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

// 🔥 กลไกคุมเงินเฟ้อ: สุ่มอัตราเข้ากระปุกหมู 10%–50% (ถ่วงน้ำหนักให้อยู่ช่วง 10%–25% บ่อยกว่า) ส่วนที่เหลือเผาทิ้งถาวร
function applyTipJarSink(rawLossAmount, worldState) {
  const loss = Math.abs(Math.round(Number(rawLossAmount || 0)));
  if (loss <= 0 || !worldState) {
    return { tipPct: 0, toTipJar: 0, burned: 0 };
  }

  const r = Math.random();
  let tipPct;
  if (r < 0.50) tipPct = randInt(10, 22);
  else if (r < 0.85) tipPct = randInt(23, 36);
  else tipPct = randInt(37, 50);

  const toTipJar = Math.max(5, Math.round((loss * tipPct) / 100));
  const currentJar = Number(worldState.cursedTipJar || 500);
  const nextJar = Math.min(TIP_JAR_CAP, currentJar + toTipJar);
  const actualAdded = Math.max(0, nextJar - currentJar);
  const burned = Math.max(0, loss - actualAdded);

  worldState.cursedTipJar = nextJar;
  return { tipPct, toTipJar: actualAdded, burned };
}

/**
 * 💸 คำนวณการเปลี่ยนแปลงยอดเงิน 2 บัญชี (Wallet + Bank)
 * - seizeBank = true : ยึดทรัพย์ทั้งกระเป๋า (เหลือ 1) และอายัดธนาคาร (เหลือ 0)
 * - walletOnly = true: กระทบเฉพาะกระเป๋าตังค์เท่านั้น (ธนาคารปลอดภัย 100%)
 * - delta < 0 (ปกติ) : หักกระเป๋าตังค์ก่อน ➔ ไม่พอให้ดึงจากธนาคาร ➔ หมดแล้วยังไม่พอจึงติดหนี้ในกระเป๋า
 */
function applyBalanceDelta({
  walletBalance = 0,
  bankBalance = 0,
  delta = 0,
  walletOnly = false,
  seizeBank = false
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

  // กรณีโดนหักเงินแบบข้ามบัญชี (Waterfall Deduction: Wallet -> Bank -> Debt)
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

// 🏦 คำนวณการฝากเงิน (Wallet ➔ Bank) พร้อมค่าธรรมเนียม 3% เผาออกจากระบบ
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
  buildTransaction,
  applyTipJarSink,
  applyBalanceDelta,
  calculateDeposit,
  calculateWithdraw
};