import React, { useCallback, useEffect, useState } from 'react';
import NumberFlow from '@number-flow/react';
import { motion } from 'framer-motion';
import {
  Landmark,
  ScrollText,
  Wallet,
  Coins,
  ArrowDownToLine,
  ArrowUpFromLine,
  RefreshCw,
  X,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight
} from 'lucide-react';
import { casinoApi } from '../api';
import { AnimatedText, PopModal, PopItem, ICON_BASE } from './MotionPrimitives.jsx';

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
  depositFeePct = 5,
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

  const maxAvailable = actionMode === 'DEPOSIT' ? Math.max(0, walletBalance) : bankBalance;
  const parsedAmount = Math.floor(Number(amountText || 0));
  const isValidAmount = Number.isFinite(parsedAmount) && parsedAmount > 0 && parsedAmount <= maxAvailable;

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
    if (!activePlayer || !isValidAmount || submitting) return;

    setSubmitting(true);
    setFeedback({ type: 'wait', text: 'กำลังทำรายการกับธนาคารคาเฟ่...' });

    const res =
      actionMode === 'DEPOSIT'
        ? await casinoApi.deposit(activePlayer.userId, verifiedPin, parsedAmount)
        : await casinoApi.withdraw(activePlayer.userId, verifiedPin, parsedAmount);

    setSubmitting(false);

    if (!res.ok) {
      setFeedback({ type: 'err', text: res.error || 'ทำรายการไม่สำเร็จค่ะ' });
      return;
    }

    setAmountText('');
    if (Array.isArray(res.transactions)) setTransactions(res.transactions);
    if (typeof onBalancesUpdated === 'function') {
      onBalancesUpdated(activePlayer.userId, res.walletBalance, res.bankBalance);
    }

    if (actionMode === 'DEPOSIT') {
      setFeedback({
        type: 'ok',
        text:
          res.fee > 0
            ? `ฝากเข้าธนาคารสำเร็จ +${res.credited.toLocaleString()} เหรียญ (หักค่าธรรมเนียมลดเงินเฟ้อ ${res.fee.toLocaleString()} เหรียญ)`
            : `ฝากเข้าธนาคารสำเร็จ +${res.credited.toLocaleString()} เหรียญ`
      });
    } else {
      setFeedback({
        type: 'ok',
        text: `ถอนเงินเข้ากระเป๋าตังค์สำเร็จ +${res.withdrawn.toLocaleString()} เหรียญ`
      });
    }
  };

  const ownerName = activePlayer?.nickname ? `คุณ${activePlayer.nickname}` : activePlayer?.displayName || '';

  return (
    <PopModal
      isOpen={Boolean(isOpen && activePlayer)}
      onClose={onClose}
      cardClassName="bank-modal-card"
    >
      <div className="modal-header">
        <div>
          <div className="modal-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            <Landmark {...ICON_BASE} size={18} />
            <AnimatedText text={`ธนาคาร & เดินบัญชี • ${ownerName}`} variant="pop" stagger={0.018} />
          </div>
          <div className="modal-sub">
            ทรัพย์สินสุทธิรวม: <strong>{totalNetWorth.toLocaleString()} เหรียญ</strong> (กระเป๋า + ธนาคาร)
          </div>
        </div>
        <button type="button" className="modal-close" onClick={onClose} aria-label="ปิด">
          <X {...ICON_BASE} size={16} />
        </button>
      </div>

      {/* แท็บสลับ ฝาก-ถอน / เดินบัญชี 10 รายการ พร้อมแถบเลื่อนตามนิ้ว */}
      <div className="lb-filter-tabs" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
        {[
          { id: 'BANK', label: 'ฝาก / ถอนเงิน', Icon: Landmark },
          { id: 'STATEMENT', label: `เดินบัญชีล่าสุด (${transactions.length}/10)`, Icon: ScrollText }
        ].map((item) => {
          const TabIcon = item.Icon;
          const isActive = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`lb-tab-btn ${isActive ? 'active' : ''}`}
              onClick={() => {
                setTab(item.id);
                if (item.id === 'STATEMENT') fetchStatement();
              }}
            >
              {isActive && (
                <motion.span
                  layoutId="bank-tab-pill"
                  className="lb-tab-pill-bg"
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                />
              )}
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                <TabIcon {...ICON_BASE} size={13} />
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      <div className="modal-body">
        <div className="bank-summary-grid">
          <div className="bank-balance-card wallet">
            <span className="bank-card-label" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Wallet {...ICON_BASE} size={13} /> เงินในกระเป๋าตังค์
            </span>
            <strong
              className={`bank-card-amount ${walletBalance < 0 ? 'negative' : ''}`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
            >
              <NumberFlow value={walletBalance} />
              <Coins {...ICON_BASE} size={15} />
            </strong>
            <span className="bank-card-hint">
              {walletBalance < 0 ? 'ติดหนี้อยู่ (ถอนธนาคารมาโปะได้)' : 'พร้อมใช้และพร้อมฝาก'}
            </span>
          </div>

          <div className="bank-balance-card vault">
            <span className="bank-card-label" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Landmark {...ICON_BASE} size={13} /> เงินฝากธนาคาร
            </span>
            <strong
              className="bank-card-amount vault-num"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
            >
              <NumberFlow value={bankBalance} />
              <Coins {...ICON_BASE} size={15} />
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
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
                  onClick={() => {
                    setActionMode('DEPOSIT');
                    setAmountText('');
                    setFeedback({ type: '', text: '' });
                  }}
                >
                  <ArrowDownToLine {...ICON_BASE} size={14} /> ฝากเข้าธนาคาร
                </button>
                <button
                  type="button"
                  className={`bank-mode-btn ${actionMode === 'WITHDRAW' ? 'active-withdraw' : ''}`}
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
                  onClick={() => {
                    setActionMode('WITHDRAW');
                    setAmountText('');
                    setFeedback({ type: '', text: '' });
                  }}
                >
                  <ArrowUpFromLine {...ICON_BASE} size={14} /> ถอนเข้ากระเป๋า
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
                {[
                  { label: '25%', ratio: 0.25 },
                  { label: '50%', ratio: 0.5 },
                  { label: `ทั้งหมด (${maxAvailable.toLocaleString()})`, ratio: 1 }
                ].map((q) => (
                  <button
                    key={q.label}
                    type="button"
                    className="btn-pill"
                    disabled={maxAvailable <= 0 || submitting}
                    onClick={() => setQuickPercent(q.ratio)}
                  >
                    {q.label}
                  </button>
                ))}
              </div>

              {isValidAmount && (
                <div
                  className="bank-preview-note"
                  style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}
                >
                  {actionMode === 'DEPOSIT' ? (
                    <>
                      <span>
                        ฝาก <strong>{parsedAmount.toLocaleString()}</strong>
                      </span>
                      <ArrowRight {...ICON_BASE} size={13} />
                      <span>
                        เงินเข้าธนาคาร <strong className="diff-pos">+{previewCredited.toLocaleString()}</strong> เหรียญ
                      </span>
                      {previewFee > 0 && (
                        <span>
                          (ค่าธรรมเนียม {depositFeePct}% = -{previewFee.toLocaleString()} เผาลดเงินเฟ้อ)
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      <span>
                        ถอน <strong>{parsedAmount.toLocaleString()}</strong>
                      </span>
                      <ArrowRight {...ICON_BASE} size={13} />
                      <span>
                        เข้ากระเป๋าตังค์ <strong className="diff-pos">+{parsedAmount.toLocaleString()}</strong> เหรียญ (ฟรีค่าธรรมเนียม 0%)
                      </span>
                    </>
                  )}
                </div>
              )}

              {feedback.text && (
                <div
                  className={`pin-feedback ${feedback.type}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  {feedback.type === 'ok' && <CheckCircle2 {...ICON_BASE} size={15} style={{ flexShrink: 0 }} />}
                  {feedback.type === 'err' && <AlertTriangle {...ICON_BASE} size={15} style={{ flexShrink: 0 }} />}
                  {feedback.type === 'wait' && <Clock {...ICON_BASE} size={15} style={{ flexShrink: 0 }} />}
                  <span>{feedback.text}</span>
                </div>
              )}

              <button
                type="submit"
                className="btn-primary"
                style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                disabled={!isValidAmount || submitting}
              >
                {actionMode === 'DEPOSIT' ? (
                  <ArrowDownToLine {...ICON_BASE} size={15} />
                ) : (
                  <ArrowUpFromLine {...ICON_BASE} size={15} />
                )}
                <span>
                  {submitting
                    ? 'กำลังดำเนินการ...'
                    : actionMode === 'DEPOSIT'
                      ? 'ยืนยันฝากเงินเข้าธนาคาร'
                      : 'ยืนยันถอนเงินเข้ากระเป๋า'}
                </span>
              </button>
            </form>

            <div className="bank-rules-box">
              <strong style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <ShieldAlert {...ICON_BASE} size={15} /> กติกาธนาคาร Horizon Cafe (ได้อย่างเสียอย่าง)
              </strong>
              <ul>
                <li>
                  <strong>ปลอดภัยจากการพกพา:</strong> เงินในธนาคารจะไม่ถูกทำหล่นหาย ไม่โดนสลับกระเป๋า และไม่โดนกระจกพลิกขั้ว
                </li>
                <li>
                  <strong>หักเงินข้ามบัญชีอัตโนมัติ:</strong> หากโดนบิลค่าใช้จ่าย, ค่านั่งแลนด์มาร์ก หรือเพื่อนมายืมเงินแล้วกระเป๋าไม่พอ ระบบจะดึงจากธนาคารมาจ่ายส่วนต่างแทน
                </li>
                <li>
                  <strong>ความเสี่ยงของตู้เซฟ:</strong> ระวังอีเวนท์ <em>ปปง. คาเฟ่ตรวจบัญชี</em>, <em>แฮ็กเกอร์แมวส้มเจาะตู้เซฟ</em> (ตัดเงินจากธนาคารโดยตรง) และ <em>อเลสเทียยึดทรัพย์</em> (อายัดหมดทั้งสองบัญชี)
                </li>
                <li>
                  <strong>คุมเงินเฟ้อ:</strong> ค่าธรรมเนียมฝาก {depositFeePct}% จะถูกเผาออกจากระบบถาวร (ถอนฟรี 0%)
                </li>
              </ul>
            </div>
          </>
        ) : (
          <div className="statement-section">
            <div className="drawer-row-between">
              <span className="drawer-label">แสดงรายการเคลื่อนไหวล่าสุดสูงสุด 10 รายการ</span>
              <button
                type="button"
                className="btn-pill"
                onClick={fetchStatement}
                disabled={loadingTx}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                <motion.span
                  animate={loadingTx ? { rotate: 360 } : { rotate: 0 }}
                  transition={loadingTx ? { repeat: Infinity, duration: 0.7, ease: 'linear' } : { duration: 0.2 }}
                  style={{ display: 'inline-flex', alignItems: 'center' }}
                >
                  <RefreshCw {...ICON_BASE} size={13} />
                </motion.span>
                <span>{loadingTx ? 'โหลดอยู่...' : 'รีเฟรช'}</span>
              </button>
            </div>

            {loadingTx && transactions.length === 0 ? (
              <div className="statement-empty">กำลังดึงรายการเดินบัญชีล่าสุด...</div>
            ) : transactions.length === 0 ? (
              <div className="statement-empty">
                ยังไม่มีประวัติการเดินบัญชีค่ะ ลองปั่นสล็อตหรือฝากเงินเข้าธนาคารดูนะคะ
              </div>
            ) : (
              <div className="statement-list">
                {transactions.map((tx, idx) => {
                  const badge = getTxCategoryBadge(tx.type);
                  const wDelta = Number(tx.walletDelta || 0);
                  const bDelta = Number(tx.bankDelta || 0);
                  return (
                    <PopItem
                      key={`${tx.at || idx}-${idx}`}
                      index={idx}
                      step={0.032}
                      maxStagger={10}
                      className="statement-row"
                    >
                      <div className="statement-row-top">
                        <span className={`tx-cat-pill ${badge.cls}`}>{badge.text}</span>
                        <span className="statement-time">{formatTxTime(tx.at)}</span>
                      </div>

                      <div className="statement-title">{tx.title}</div>

                      <div className="statement-deltas">
                        {wDelta !== 0 && (
                          <span
                            className={`delta-chip ${wDelta > 0 ? 'pos' : 'neg'}`}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          >
                            <Wallet {...ICON_BASE} size={11} />
                            กระเป๋า {wDelta > 0 ? `+${wDelta.toLocaleString()}` : wDelta.toLocaleString()}
                          </span>
                        )}
                        {bDelta !== 0 && (
                          <span
                            className={`delta-chip ${bDelta > 0 ? 'bank-pos' : 'bank-neg'}`}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          >
                            <Landmark {...ICON_BASE} size={11} />
                            ธนาคาร {bDelta > 0 ? `+${bDelta.toLocaleString()}` : bDelta.toLocaleString()}
                          </span>
                        )}
                        {wDelta === 0 && bDelta === 0 && (
                          <span className="delta-chip neutral">ไม่เปลี่ยนแปลงยอดเงิน</span>
                        )}
                      </div>

                      <div
                        className="statement-after"
                        style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}
                      >
                        <span>คงเหลือหลังรายการ:</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                          <Wallet {...ICON_BASE} size={11} /> {Number(tx.walletAfter || 0).toLocaleString()}
                        </span>
                        <span>•</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                          <Landmark {...ICON_BASE} size={11} /> {Number(tx.bankAfter || 0).toLocaleString()}
                        </span>
                      </div>
                    </PopItem>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </PopModal>
  );
}