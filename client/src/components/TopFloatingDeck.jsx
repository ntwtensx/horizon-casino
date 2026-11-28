import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Crown,
  TrendingDown,
  Sparkles,
  RefreshCw,
  X,
  Wallet,
  Landmark,
  BookOpen,
  Coins,
  MessageCircle,
  Globe,
  Bot,
  Trophy,
  Castle,
  CircleOff
} from 'lucide-react';
import '../styles/modals-smart.css';
import { AnimatedText, FloatingDrawer, PopModal, PopItem, ICON_BASE } from './MotionPrimitives.jsx';

const DEFAULT_AVATAR = 'https://cdn.discordapp.com/embed/avatars/0.png';

// รูปทรงเรขาคณิต SVG + คู่สีไล่เฉด 2 สี + โทนสีนวลฟุ้งประจำแลนด์มาร์กทั้ง 5 โซน
const GEO_SHAPES = {
  GARDEN: {
    tone: 'lm-garden',
    glow: 'rgba(86, 168, 117, 0.55)',
    d: 'M22 3 L40 16 L33 38 L11 38 L4 16 Z',
    c1: '#5EA377',
    c2: '#A8E6CF',
    stroke: '#3A7D54',
    e1: '#E5F2EA',
    e2: '#F6FBF8'
  },
  SAKURA: {
    tone: 'lm-sakura',
    glow: 'rgba(235, 126, 164, 0.55)',
    d: 'M22 3 L27.6 14.4 L40 16 L30.8 24.7 L33.2 37.5 L22 31.2 L10.8 37.5 L13.2 24.7 L4 16 L16.4 14.4 Z',
    c1: '#F48FB1',
    c2: '#FFD3B6',
    stroke: '#C95D82',
    e1: '#FBEAF0',
    e2: '#FFF6F2'
  },
  MEADOW: {
    tone: 'lm-meadow',
    glow: 'rgba(148, 116, 219, 0.55)',
    d: 'M22 3 L38 12.2 L38 31.8 L22 41 L6 31.8 L6 12.2 Z',
    c1: '#9B7EDE',
    c2: '#C4B5FD',
    stroke: '#6D4FB3',
    e1: '#EFEAFC',
    e2: '#F8F5FF'
  },
  BEACH: {
    tone: 'lm-beach',
    glow: 'rgba(67, 181, 232, 0.55)',
    d: 'M22 3 L40 22 L22 41 L4 22 Z',
    c1: '#4FC3F7',
    c2: '#FFE082',
    stroke: '#2E8DB8',
    e1: '#E6F5FC',
    e2: '#FFF9E8'
  },
  RIVER: {
    tone: 'lm-river',
    glow: 'rgba(68, 171, 160, 0.55)',
    d: 'M12 4 H32 Q40 4 40 12 V25 Q40 36 22 41 Q4 36 4 25 V12 Q4 4 12 4 Z',
    c1: '#4DB6AC',
    c2: '#90CAF9',
    stroke: '#2F827A',
    e1: '#E5F4F2',
    e2: '#F0F7FE'
  }
};

const LB_TABS = [
  { id: 'ALL', label: 'ทั้งหมด', Icon: null },
  { id: 'RICH', label: 'มีเงิน', Icon: Crown },
  { id: 'BROKE', label: 'หมดตัว', Icon: CircleOff },
  { id: 'DEBT', label: 'หนี้', Icon: TrendingDown }
];

const shortName = (p) => (p?.nickname?.trim() ? p.nickname.trim() : p?.displayName || 'สมาชิก');
const netWorthOf = (p) => Number(p?.walletBalance || 0) + Math.max(0, Number(p?.bankBalance || 0));

function AccountTag({ type }) {
  if (type === 'bot') {
    return (
      <span className="account-type-tag bot" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
        <Bot {...ICON_BASE} size={11} /> บอท
      </span>
    );
  }
  if (type === 'web') {
    return (
      <span className="account-type-tag web" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
        <Globe {...ICON_BASE} size={11} /> เว็บ
      </span>
    );
  }
  return (
    <span className="account-type-tag discord" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
      <MessageCircle {...ICON_BASE} size={11} /> Discord
    </span>
  );
}

export default function TopFloatingDeck({
  landmarks = [],
  players = [],
  activePlayerId = '',
  selectedLmId: controlledLmId,
  onSelectLandmark,
  onCloseDrawers,
  onRefreshPlayers
}) {
  const [internalLmId, setInternalLmId] = useState(null);
  const [lbOpen, setLbOpen] = useState(false);
  const [lbTab, setLbTab] = useState('ALL');
  const [refreshing, setRefreshing] = useState(false);

  const isControlled = typeof onSelectLandmark === 'function';
  const selectedLmId = isControlled ? controlledLmId : internalLmId;

  const setLandmarkDrawer = (id) => {
    if (isControlled) onSelectLandmark(id);
    else setInternalLmId((curr) => (id == null || curr === id ? null : id));
  };

  const ranking = useMemo(() => {
    const withNet = (players || []).map((p) => ({ ...p, netWorth: netWorthOf(p) }));
    const rich = withNet.filter((p) => p.netWorth > 0).sort((a, b) => b.netWorth - a.netWorth);
    const broke = withNet
      .filter((p) => p.netWorth === 0)
      .sort((a, b) => a.displayName.localeCompare(b.displayName, 'th'));
    const debt = withNet.filter((p) => p.netWorth < 0).sort((a, b) => a.netWorth - b.netWorth);
    return { rich, broke, debt };
  }, [players]);

  const sultan = ranking.rich[0] || null;
  const otherRich = ranking.rich.slice(1);
  const beggar = ranking.debt[0] || null;
  const otherDebt = ranking.debt.slice(1);
  const ownedCount = landmarks.filter((l) => l.owned).length;

  const tabCounts = {
    ALL: players.length,
    RICH: ranking.rich.length,
    BROKE: ranking.broke.length,
    DEBT: ranking.debt.length
  };
  const activeLbTabIdx = Math.max(0, LB_TABS.findIndex((t) => t.id === lbTab));

  const orderedLandmarks = useMemo(() => {
    if (!selectedLmId) return landmarks;
    const picked = landmarks.find((l) => l.id === selectedLmId);
    if (!picked) return landmarks;
    return [picked, ...landmarks.filter((l) => l.id !== selectedLmId)];
  }, [landmarks, selectedLmId]);

  const handleRefresh = async () => {
    if (!onRefreshPlayers || refreshing) return;
    setRefreshing(true);
    await onRefreshPlayers();
    setRefreshing(false);
  };

  const handleOpenLeaderboard = () => {
    if (typeof onCloseDrawers === 'function') onCloseDrawers();
    else setLandmarkDrawer(null);
    setLbOpen(true);
  };

  const renderPlayerRow = (p, idx, group) => {
    const isTopSultan = group === 'RICH' && idx === 0;
    const isTopBeggar = group === 'DEBT' && idx === 0;
    const rowCls = [
      'lb-player-row',
      isTopSultan ? 'rank-sultan foil-sheen' : '',
      isTopBeggar ? 'rank-beggar' : '',
      p.userId === activePlayerId ? 'is-me' : ''
    ]
      .filter(Boolean)
      .join(' ');

    const netCls = p.netWorth > 0 ? 'pos' : p.netWorth < 0 ? 'neg' : 'zero';

    return (
      <PopItem key={p.userId} index={idx} step={0.025} maxStagger={12} className={rowCls}>
        <div className="lb-rank-num">
          {isTopSultan ? (
            <Crown {...ICON_BASE} size={14} />
          ) : isTopBeggar ? (
            <TrendingDown {...ICON_BASE} size={14} />
          ) : (
            `#${idx + 1}`
          )}
        </div>
        <img
          className="lb-row-avatar"
          src={p.avatar || DEFAULT_AVATAR}
          alt={p.displayName}
          loading="lazy"
          onError={(e) => {
            e.currentTarget.src = DEFAULT_AVATAR;
          }}
        />
        <div className="lb-row-info">
          <div className="lb-row-name-line">
            <span>{p.displayName}</span>
            <AccountTag type={p.accountType} />
          </div>
          <div className="lb-row-breakdown">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <Wallet {...ICON_BASE} size={11} /> {Number(p.walletBalance || 0).toLocaleString()}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <Landmark {...ICON_BASE} size={11} /> {Number(p.bankBalance || 0).toLocaleString()}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <BookOpen {...ICON_BASE} size={11} /> {p.collectedStamps?.length || 0}
            </span>
          </div>
        </div>
        <div className={`lb-row-net ${netCls}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
          <span>{p.netWorth > 0 ? `+${p.netWorth.toLocaleString()}` : p.netWorth.toLocaleString()}</span>
          <Coins {...ICON_BASE} size={13} />
        </div>
      </PopItem>
    );
  };

  return (
    <>
      <section className="top-floating-deck" aria-label="แถบลอยแลนด์มาร์กและอันดับการเงิน">
        {/* กล่องลอยแลนด์มาร์ก 5 โซน */}
        <div className="lm-geo-deck" role="group" aria-label="แลนด์มาร์กริมหน้าต่าง 5 โซน">
          {landmarks.map((lm, i) => {
            const shape = GEO_SHAPES[lm.id] || GEO_SHAPES.RIVER;
            const gradId = `lm-grad-${lm.id}`;
            return (
              <motion.button
                key={lm.id}
                type="button"
                className={`lm-geo-btn ${lm.owned ? 'owned' : 'empty'}`}
                style={lm.owned ? { '--lm-icon-glow': shape.glow } : undefined}
                initial={{ opacity: 0, scale: 0.6, y: -6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 420, damping: 20, delay: 0.08 + i * 0.045 }}
                onClick={() => setLandmarkDrawer(lm.id)}
                title={lm.owned ? `${lm.name} • ${lm.ownerName} (ขั้น ${lm.tier})` : `${lm.name} • ว่าง`}
                aria-label={`ดูรายละเอียดแลนด์มาร์ก ${lm.name}`}
              >
                <svg className="lm-geo-svg" viewBox="0 0 44 44" aria-hidden="true">
                  <defs>
                    <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor={lm.owned ? shape.c1 : shape.e1} />
                      <stop offset="100%" stopColor={lm.owned ? shape.c2 : shape.e2} />
                    </linearGradient>
                  </defs>
                  <path
                    d={shape.d}
                    fill={`url(#${gradId})`}
                    stroke={lm.owned ? shape.stroke : '#C9B4A1'}
                    strokeWidth={lm.owned ? '2.2' : '1.5'}
                    strokeDasharray={lm.owned ? undefined : '3 2'}
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="lm-geo-emoji">{lm.icon}</span>
                {lm.owned && lm.tier > 0 && <span className="lm-geo-tier">{lm.tier}</span>}
                {lm.curtainClosed && <span className="lm-geo-curtain">🪟</span>}
              </motion.button>
            );
          })}
        </div>

        {/* แถบลอย Leaderboard */}
        <button
          type="button"
          className="lb-mini-bar"
          onClick={handleOpenLeaderboard}
          title="คลิกเพื่อเปิดตารางอันดับการเงินของทุกคนในคาเฟ่"
        >
          <div className="lb-side sultan">
            {sultan ? (
              <>
                <span className="lb-crown-badge sultan">
                  <span className="lb-crown-icon" style={{ display: 'inline-flex', alignItems: 'center' }}>
                    <Crown {...ICON_BASE} size={13} />
                  </span>
                  <span className="lb-champ-name">{shortName(sultan)}</span>
                </span>
                {otherRich.length > 0 && (
                  <span className="lb-avatar-stack" aria-hidden="true">
                    {otherRich.slice(0, 4).map((p) => (
                      <img
                        key={p.userId}
                        className="lb-mini-avatar"
                        src={p.avatar || DEFAULT_AVATAR}
                        alt=""
                        onError={(e) => {
                          e.currentTarget.src = DEFAULT_AVATAR;
                        }}
                      />
                    ))}
                    {otherRich.length > 4 && <span className="lb-more-dot">+{otherRich.length - 4}</span>}
                  </span>
                )}
              </>
            ) : (
              <span className="lb-crown-badge peace">
                <Crown {...ICON_BASE} size={12} /> รอสุลต่านคนแรก
              </span>
            )}
          </div>

          <span className="lb-divider" aria-hidden="true" />

          <div className="lb-side beggar">
            {beggar ? (
              <>
                {otherDebt.length > 0 && (
                  <span className="lb-avatar-stack" aria-hidden="true">
                    {otherDebt.slice(0, 3).map((p) => (
                      <img
                        key={p.userId}
                        className="lb-mini-avatar is-debt"
                        src={p.avatar || DEFAULT_AVATAR}
                        alt=""
                        onError={(e) => {
                          e.currentTarget.src = DEFAULT_AVATAR;
                        }}
                      />
                    ))}
                    {otherDebt.length > 3 && <span className="lb-more-dot">+{otherDebt.length - 3}</span>}
                  </span>
                )}
                <span className="lb-crown-badge beggar">
                  <span className="lb-crown-icon" style={{ display: 'inline-flex', alignItems: 'center' }}>
                    <TrendingDown {...ICON_BASE} size={13} />
                  </span>
                  <span className="lb-champ-name">{shortName(beggar)}</span>
                </span>
              </>
            ) : (
              <span className="lb-crown-badge peace">
                <Sparkles {...ICON_BASE} size={12} /> ไร้หนี้ทั้งร้าน
              </span>
            )}
          </div>
        </button>
      </section>

      {/* ลิ้นชักลอยรายละเอียดแลนด์มาร์ก */}
      <FloatingDrawer isOpen={Boolean(selectedLmId)} onClose={() => setLandmarkDrawer(null)}>
        <div className="drawer-row-between">
          <div className="brand-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Castle {...ICON_BASE} size={16} />
            <span>แลนด์มาร์กริมหน้าต่าง</span>
            <span className="brand-badge">ถือครอง {ownedCount}/5 โซน</span>
          </div>
          <button
            type="button"
            className="drawer-close-pill"
            onClick={() => setLandmarkDrawer(null)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}
          >
            <X {...ICON_BASE} size={13} /> พับเก็บ
          </button>
        </div>

        <div className="landmark-rows-list">
          {orderedLandmarks.map((lm, idx) => {
            const shape = GEO_SHAPES[lm.id] || GEO_SHAPES.RIVER;
            return (
              <PopItem
                key={lm.id}
                index={idx}
                data-tone={lm.owned ? shape.tone : undefined}
                className={`landmark-row-card ${lm.owned ? 'owned foil-sheen' : 'empty'} ${
                  lm.id === selectedLmId ? 'is-highlighted' : ''
                }`}
              >
                <div className="landmark-row-icon">{lm.icon}</div>
                <div className="landmark-row-body">
                  <div className="landmark-row-head">
                    <span className="landmark-row-name">{lm.name}</span>
                    <span className={`landmark-tier-pill ${lm.owned ? 'owned' : 'empty'}`}>
                      {lm.owned ? `ขั้น ${lm.tier} • ${lm.pct}%` : 'ว่าง • 0%'}
                    </span>
                  </div>
                  <div className="landmark-row-owner">
                    {lm.owned ? (
                      <>
                        <span>
                          ผู้ถือหุ้น: <strong>{lm.ownerName}</strong>
                        </span>
                        {lm.curtainClosed && (
                          <span className="landmark-curtain-tag">🪟 ปิดผ้าม่านพัก 1 รอบ</span>
                        )}
                      </>
                    ) : (
                      <span>ยังไม่มีผู้ถือครอง — ปั่นสล็อตลุ้นรับสิทธิ์ขั้นที่ 1 (17%) ฟรี!</span>
                    )}
                  </div>
                </div>
              </PopItem>
            );
          })}
        </div>
      </FloatingDrawer>

      {/* 🏆 หน้าต่าง Leaderboard เต็มรูปแบบ (Sunflower Glow & Rose Champagne • ความสูงคงที่ + Pill Slider 4 ช่อง) */}
      <PopModal
        isOpen={lbOpen}
        onClose={() => setLbOpen(false)}
        cardClassName="smart-lb-modal"
      >
        <div className="lb-hero-header">
          <div className="lb-hero-top">
            <div>
              <span className="lb-hero-badge">
                <Crown {...ICON_BASE} size={11} /> Horizon Wealth Hall
              </span>
              <h2 className="lb-hero-title">
                <Trophy {...ICON_BASE} size={19} />
                <AnimatedText text="อันดับการเงิน Horizon Cafe" variant="pop" by="word" stagger={0.028} />
              </h2>
              <p className="lb-hero-sub">
                คำนวณจากยอดสุทธิรวม (กระเป๋า + ธนาคาร) • สมาชิกทั้งหมด {players.length} คน
              </p>
            </div>
            <div className="lb-header-actions">
              <button
                type="button"
                className="lb-action-circle"
                onClick={handleRefresh}
                disabled={refreshing}
                aria-label="รีเฟรชอันดับ"
              >
                <motion.span
                  animate={refreshing ? { rotate: 360 } : { rotate: 0 }}
                  transition={refreshing ? { repeat: Infinity, duration: 0.7, ease: 'linear' } : { duration: 0.2 }}
                  style={{ display: 'inline-flex', alignItems: 'center' }}
                >
                  <RefreshCw {...ICON_BASE} size={15} />
                </motion.span>
              </button>
              <button
                type="button"
                className="lb-action-circle"
                onClick={() => setLbOpen(false)}
                aria-label="ปิด"
              >
                <X {...ICON_BASE} size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* 🎛️ แถบแท็บเลื่อน 4 ช่องแบบ Smooth Pill Slider */}
        <div className="lb-segment-wrap">
          <div className="lb-segment-track" role="tablist" aria-label="กรองอันดับการเงิน">
            <motion.div
              className="lb-segment-slider"
              initial={false}
              animate={{ x: `${activeLbTabIdx * 100}%` }}
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            />
            {LB_TABS.map((t) => {
              const TabIcon = t.Icon;
              const isActive = lbTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={`lb-segment-btn ${isActive ? 'is-active' : ''}`}
                  onClick={() => setLbTab(t.id)}
                >
                  {TabIcon && <TabIcon {...ICON_BASE} size={12} />}
                  <span>{t.label}</span>
                  <span className="lb-tab-count">{tabCounts[t.id]}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 📜 พื้นที่รายการเลื่อนภายในความสูงคงที่ */}
        <div className="lb-body-viewport">
          {(lbTab === 'ALL' || lbTab === 'RICH') && (
            <div className="lb-section-block">
              <div className="lb-smart-section-head">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <Crown {...ICON_BASE} size={14} /> รวยสุด ➔ มีเงิน
                </span>
                <span className="lb-smart-section-pill">{ranking.rich.length} คน</span>
              </div>
              {ranking.rich.length === 0 ? (
                <div className="statement-empty">ยังไม่มีใครถือทรัพย์สินสุทธิเป็นบวกเลยค่ะ</div>
              ) : (
                ranking.rich.map((p, i) => renderPlayerRow(p, i, 'RICH'))
              )}
            </div>
          )}

          {(lbTab === 'ALL' || lbTab === 'BROKE') && (
            <div className="lb-section-block">
              <div className="lb-smart-section-head">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <CircleOff {...ICON_BASE} size={14} /> หมดตัว (0 เหรียญ)
                </span>
                <span className="lb-smart-section-pill">{ranking.broke.length} คน</span>
              </div>
              {ranking.broke.length === 0 ? (
                <div className="statement-empty">ไม่มีสมาชิกที่มียอด 0 เหรียญพอดีค่ะ</div>
              ) : (
                ranking.broke.map((p, i) => renderPlayerRow(p, i, 'BROKE'))
              )}
            </div>
          )}

          {(lbTab === 'ALL' || lbTab === 'DEBT') && (
            <div className="lb-section-block">
              <div className="lb-smart-section-head">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <TrendingDown {...ICON_BASE} size={14} /> จนที่สุด ➔ หนี้น้อยสุด
                </span>
                <span className="lb-smart-section-pill">{ranking.debt.length} คน</span>
              </div>
              {ranking.debt.length === 0 ? (
                <div className="statement-empty">เยี่ยมมาก! ตอนนี้ทั้งร้านยังไม่มีใครติดหนี้เลยค่ะ</div>
              ) : (
                ranking.debt.map((p, i) => renderPlayerRow(p, i, 'DEBT'))
              )}
            </div>
          )}
        </div>
      </PopModal>
    </>
  );
}