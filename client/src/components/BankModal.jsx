import React, { useCallback, useEffect, useState } from 'react';
import NumberFlow from '@number-flow/react';
import { casinoApi } from '../api';

function formatTxTime(rawDate) {
  if (!rawDate) return '';
  const d = new Date(rawDate);
  if (Number.isNaN(d.getTime())) return '';
  const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diffSec < 45) return 'เมื่อสักครู่';
  if (diffSec < 3600) return `${Math.max(1, Math.floor(diffSec / 60))} นาทีที่แล้ว`;
  return d.toLocaleString('th-TH', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getTxCategoryBadge(type) {
  switch (type) {
    case 'DEPOSIT':
      return { text: 'ฝากธนาคาร', cls: 'tx-deposit' };
    case 'WITHDRAW':
      return { text: 'ถอนเงิน', cls: 'tx-withdraw' };
    case 'SEIZURE':
      return { text: 'ยึดทรัพย์', cls: 'tx-bad' };
    case 'LANDMARK':
      return { text: 'แลนด์มาร์ก', cls: 'tx-landmark' };
    case 'FRIEND_IN':
      return { text: 'จากเพื่อน', cls: 'tx-good' };
    case 'FRIEND_OUT':
      return { text: 'โอน/โดนดึง', cls: 'tx-bad' };
    case 'FRIEND_SWAP':
      return { text: 'สลับกระเป๋า', cls: 'tx-landmark' };
    case 'SPIN_WIN':
      return { text: 'รางวัลสล็อต', cls: 'tx-good' };
    case 'SPIN_LOSS':
      return { text: 'หักจากสล็อต', cls: 'tx-bad' };
    default:
      return { text: 'รายการทั่วไป', cls: 'tx-neutral' };
  }
}

export default function BankModal({
  isOpen,
  initialTab = 'BANK',
  depositFeePct = 3,
  activePlayer,
  verifiedPin,
  onClose,
  onBalancesUpdated
}) {
  const [tab, setTab] = useState('BANK'); // BANK | STATEMENT
  const [actionMode, setActionMode] = useState('DEPOSIT'); // DEPOSIT | WITHDRAW
  const [amountText, setAmountText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  const [transactions, setTransactions] = useState([]);
  const [loadingTx, setLoadingTx] = useState(false);

  const walletBalance = Number(activePlayer?.walletBalance || 0);
  const bankBalance = Math.max(0, Number(activePlayer?.bankBalance || 0));
  const totalNetWorth = walletBalance + bankBalance;

  const fetchStatement = useCallback(async () => {
    if (!activePlayer?.userId) return;
    setLoadingTx(true);
    const res = await casinoApi.getTransactions(activePlayer.userId);
    setLoadingTx(false);
    if (res.ok) {
      setTransactions(Array.isArray(res.transactions) ? res.transactions : []);
      if (typeof onBalancesUpdated === 'function') {
        onBalancesUpdated(activePlayer.userId, res.walletBalance, res.bankBalance);
      }
    }
  }, [activePlayer?.userId, onBalancesUpdated]);

  useEffect(() => {
    if (!isOpen) return;
    setTab(initialTab || 'BANK');
    setAmountText('');
    setFeedback({ type: '', text: '' });
    fetchStatement();
  }, [isOpen, initialTab, fetchStatement]);

  if (!isOpen || !activePlayer) return null;

  const maxAvailable = actionMode === 'DEPOSIT' ? Math.max(0, walletBalance) : bankBalance;
  const parsedAmount = Math.floor(Number(amountText || 0));
  const isValidAmount = Number.isFinite(parsedAmount) && parsedAmount > 0 && parsedAmount <= maxAvailable;

  // คำนวณตัวอย่างค่าธรรมเนียมฝาก 3% ให้ผู้เล่นเห็นชัดก่อนกดยืนยัน
  const previewFee =
    actionMode === 'DEPOSIT' && isValidAmount && parsedAmount >= 20
      ? Math.max(1, Math.round((parsedAmount * depositFeePct) / 100))
      : 0;
  const previewCredited = actionMode === 'DEPOSIT' && isValidAmount ? parsedAmount - previewFee : 0;

  const setQuickPercent = (ratio) => {
    if (maxAvailable <= 0) {
      setAmountText('');
      return;
    }
    const val = ratio >= 1 ? maxAvailable : Math.max(1, Math.floor(maxAvailable * ratio));
    setAmountText(String(val));
    setFeedback({ type: '', text: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isValidAmount || submitting) return;

    setSubmitting(true);
    setFeedback({ type: 'wait', text: '⏳ กำลังทำรายการกับธนาคารคาเฟ่...' });

    const res =
      actionMode === 'DEPOSIT'
        ? await casinoApi.deposit(activePlayer.userId, verifiedPin, parsedAmount)
        : await casinoApi.withdraw(activePlayer.userId, verifiedPin, parsedAmount);

    setSubmitting(false);

    if (!res.ok) {
      setFeedback({ type: 'err', text: `⚠️ ${res.error || 'ทำรายการไม่สำเร็จค่ะ'}` });
      return;
    }

    setAmountText('');
    if (Array.isArray(res.transactions)) {
      setTransactions(res.transactions);
    }
    if (typeof onBalancesUpdated === 'function') {
      onBalancesUpdated(activePlayer.userId, res.walletBalance, res.bankBalance);
    }

    if (actionMode === 'DEPOSIT') {
      setFeedback({
        type: 'ok',
        text:
          res.fee > 0
            ? `✅ ฝากเข้าธนาคารสำเร็จ +${res.credited.toLocaleString()} เหรียญ (หักค่าธรรมเนียมลดเงินเฟ้อ ${res.fee.toLocaleString()} เหรียญ)`
            : `✅ ฝากเข้าธนาคารสำเร็จ +${res.credited.toLocaleString()} เหรียญ`
      });
    } else {
      setFeedback({
        type: 'ok',
        text: `✅ ถอนเงินเข้ากระเป๋าตังค์สำเร็จ +${res.withdrawn.toLocaleString()} เหรียญ`
      });
    }
  };

  const ownerName = activePlayer.nickname ? `คุณ${activePlayer.nickname}` : activePlayer.displayName;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card bank-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">🏦 ธนาคาร & การเดินบัญชี • {ownerName}</div>
            <div className="modal-sub">
              ทรัพย์สินสุทธิรวม: <strong>{totalNetWorth.toLocaleString()} เหรียญ</strong> (กระเป๋า + ธนาคาร)
            </div>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="ปิด">
            ✕
          </button>
        </div>

        {/* แท็บสลับ ฝาก-ถอน / เดินบัญชี 10 รายการ */}
        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab-btn ${tab === 'BANK' ? 'active' : ''}`}
            onClick={() => setTab('BANK')}
          >
            🏦 ฝาก / ถอนเงิน
          </button>
          <button
            type="button"
            className={`auth-tab-btn ${tab === 'STATEMENT' ? 'active' : ''}`}
            onClick={() => {
              setTab('STATEMENT');
              fetchStatement();
            }}
          >
            📜 เดินบัญชีล่าสุด ({transactions.length}/10)
          </button>
        </div>

        <div className="modal-body">
          {/* การ์ดยอดเงิน 2 บัญชี */}
          <div className="bank-summary-grid">
            <div className="bank-balance-card wallet">
              <span className="bank-card-label">👛 เงินในกระเป๋าตังค์</span>
              <strong className={`bank-card-amount ${walletBalance < 0 ? 'negative' : ''}`}>
                <NumberFlow value={walletBalance} /> 🪙
              </strong>
              <span className="bank-card-hint">
                {walletBalance < 0 ? 'ติดหนี้อยู่ (ถอนธนาคารมาโปะได้)' : 'พร้อมใช้และพร้อมฝาก'}
              </span>
            </div>

            <div className="bank-balance-card vault">
              <span className="bank-card-label">🏦 เงินฝากธนาคาร</span>
              <strong className="bank-card-amount vault-num">
                <NumberFlow value={bankBalance} /> 🪙
              </strong>
              <span className="bank-card-hint">กันทำหล่น & สลับกระเป๋า</span>
            </div>
          </div>

          {tab === 'BANK' ? (
            <>
              <form className="bank-action-panel" onSubmit={handleSubmit}>
                <div className="bank-mode-switch">
                  <button
                    type="button"
                    className={`bank-mode-btn ${actionMode === 'DEPOSIT' ? 'active-deposit' : ''}`}
                    onClick={() => {
                      setActionMode('DEPOSIT');
                      setAmountText('');
                      setFeedback({ type: '', text: '' });
                    }}
                  >
                    📥 ฝากเข้าธนาคาร
                  </button>
                  <button
                    type="button"
                    className={`bank-mode-btn ${actionMode === 'WITHDRAW' ? 'active-withdraw' : ''}`}
                    onClick={() => {
                      setActionMode('WITHDRAW');
                      setAmountText('');
                      setFeedback({ type: '', text: '' });
                    }}
                  >
                    📤 ถอนเข้ากระเป๋า
                  </button>
                </div>

                <div className="bank-input-row">
                  <input
                    type="number"
                    min="1"
                    max={maxAvailable > 0 ? maxAvailable : undefined}
                    step="1"
                    inputMode="numeric"
                    className="auth-input-text"
                    placeholder={
                      actionMode === 'DEPOSIT'
                        ? `กรอกยอดฝาก (สูงสุด ${maxAvailable.toLocaleString()} เหรียญ)`
                        : `กรอกยอดถอน (สูงสุด ${maxAvailable.toLocaleString()} เหรียญ)`
                    }
                    value={amountText}
                    disabled={submitting || maxAvailable <= 0}
                    onChange={(e) => {
                      setAmountText(e.target.value.replace(/[^\d]/g, ''));
                      if (feedback.type) setFeedback({ type: '', text: '' });
                    }}
                  />
                </div>

                <div className="bank-quick-row">
                  <button
                    type="button"
                    className="btn-pill"
                    disabled={maxAvailable <= 0 || submitting}
                    onClick={() => setQuickPercent(0.25)}
                  >
                    25%
                  </button>
                  <button
                    type="button"
                    className="btn-pill"
                    disabled={maxAvailable <= 0 || submitting}
                    onClick={() => setQuickPercent(0.5)}
                  >
                    50%
                  </button>
                  <button
                    type="button"
                    className="btn-pill"
                    disabled={maxAvailable <= 0 || submitting}
                    onClick={() => setQuickPercent(1)}
                  >
                    ทั้งหมด ({maxAvailable.toLocaleString()})
                  </button>
                </div>

                {/* แสดงสรุปก่อนกดยืนยัน */}
                {isValidAmount && (
                  <div className="bank-preview-note">
                    {actionMode === 'DEPOSIT' ? (
                      <>
                        ฝาก <strong>{parsedAmount.toLocaleString()}</strong> ➔ เงินเข้าธนาคาร{' '}
                        <strong className="diff-pos">+{previewCredited.toLocaleString()}</strong> เหรียญ
                        {previewFee > 0 && (
                          <span>
                            {' '}
                            (ค่าธรรมเนียม {depositFeePct}% = -{previewFee.toLocaleString()} เผาลดเงินเฟ้อ)
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        ถอน <strong>{parsedAmount.toLocaleString()}</strong> ➔ เข้ากระเป๋าตังค์{' '}
                        <strong className="diff-pos">+{parsedAmount.toLocaleString()}</strong> เหรียญ (ฟรีค่าธรรมเนียม 0%)
                      </>
                    )}
                  </div>
                )}

                {feedback.text && (
                  <div className={`pin-feedback ${feedback.type}`}>{feedback.text}</div>
                )}

                <button
                  type="submit"
                  className="btn-primary"
                  style={{ width: '100%' }}
                  disabled={!isValidAmount || submitting}
                >
                  {submitting
                    ? '⏳ กำลังดำเนินการ...'
                    : actionMode === 'DEPOSIT'
                      ? '📥 ยืนยันฝากเงินเข้าธนาคาร'
                      : '📤 ยืนยันถอนเงินเข้ากระเป๋า'}
                </button>
              </form>

              <div className="bank-rules-box">
                <strong>📌 กติกาธนาคาร Horizon Cafe</strong>
                <ul>
                  <li>
                    <strong>ปลอดภัยจากการพกพา:</strong> เงินในธนาคารจะไม่ถูกทำหล่นหาย ไม่โดนสลับกระเป๋า และไม่โดนพลิกขั้ว
                  </li>
                  <li>
                    <strong>หักเงินข้ามบัญชีอัตโนมัติ:</strong> หากโดนบิลค่าใช้จ่ายหรือค่าชมวิวแลนด์มาร์กแล้วเงินในกระเป๋าไม่พอ ระบบจะดึงจากธนาคารมาจ่ายส่วนต่างแทน
                  </li>
                  <li>
                    <strong>คำสั่งยึดทรัพย์:</strong> หากเจออีเวนท์ <em>อเลสเทียยึดทรัพย์</em> จะถูกอายัดทั้งกระเป๋าและธนาคาร
                  </li>
                  <li>
                    <strong>คุมเงินเฟ้อ:</strong> ค่าธรรมเนียมฝาก {depositFeePct}% จะถูกลบออกจากระบบถาวร (ถอนฟรี 0%)
                  </li>
                </ul>
              </div>
            </>
          ) : (
            /* แท็บประวัติการเดินบัญชี 10 รายการล่าสุด */
            <div className="statement-section">
              <div className="drawer-row-between">
                <span className="drawer-label">แสดงรายการเคลื่อนไหวล่าสุดสูงสุด 10 รายการ</span>
                <button
                  type="button"
                  className="btn-pill"
                  onClick={fetchStatement}
                  disabled={loadingTx}
                >
                  {loadingTx ? '⏳ โหลดอยู่...' : '🔄 รีเฟรช'}
                </button>
              </div>

              {loadingTx && transactions.length === 0 ? (
                <div className="statement-empty">⏳ กำลังดึงรายการเดินบัญชีล่าสุด...</div>
              ) : transactions.length === 0 ? (
                <div className="statement-empty">
                  ยังไม่มีประวัติการเดินบัญชีค่ะ ลองปั่นสล็อตหรือฝากเงินเข้าธนาคารดูนะคะ ☕
                </div>
              ) : (
                <div className="statement-list">
                  {transactions.map((tx, idx) => {
                    const badge = getTxCategoryBadge(tx.type);
                    const wDelta = Number(tx.walletDelta || 0);
                    const bDelta = Number(tx.bankDelta || 0);
                    return (
                      <div key={`${tx.at || idx}-${idx}`} className="statement-row">
                        <div className="statement-row-top">
                          <span className={`tx-cat-pill ${badge.cls}`}>{badge.text}</span>
                          <span className="statement-time">{formatTxTime(tx.at)}</span>
                        </div>

                        <div className="statement-title">{tx.title}</div>

                        <div className="statement-deltas">
                          {wDelta !== 0 && (
                            <span className={`delta-chip ${wDelta > 0 ? 'pos' : 'neg'}`}>
                              👛 กระเป๋า {wDelta > 0 ? `+${wDelta.toLocaleString()}` : wDelta.toLocaleString()}
                            </span>
                          )}
                          {bDelta !== 0 && (
                            <span className={`delta-chip ${bDelta > 0 ? 'bank-pos' : 'bank-neg'}`}>
                              🏦 ธนาคาร {bDelta > 0 ? `+${bDelta.toLocaleString()}` : bDelta.toLocaleString()}
                            </span>
                          )}
                          {wDelta === 0 && bDelta === 0 && (
                            <span className="delta-chip neutral">ไม่เปลี่ยนแปลงยอดเงิน</span>
                          )}
                        </div>

                        <div className="statement-after">
                          คงเหลือหลังรายการ: 👛 {Number(tx.walletAfter || 0).toLocaleString()} • 🏦{' '}
                          {Number(tx.bankAfter || 0).toLocaleString()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}