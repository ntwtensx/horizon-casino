const mongoose = require('mongoose');

// 📜 ประวัติการเดินบัญชี (เก็บสูงสุด 10 รายการล่าสุดต่อผู้เล่น)
const transactionSubSchema = new mongoose.Schema(
  {
    at: { type: Date, default: Date.now },
    type: { type: String, default: 'SPIN' },
    title: { type: String, default: '' },
    walletDelta: { type: Number, default: 0 },
    bankDelta: { type: Number, default: 0 },
    walletAfter: { type: Number, default: 0 },
    bankAfter: { type: Number, default: 0 },
    burned: { type: Number, default: 0 }
  },
  { _id: false }
);

// 👤 Schema ผู้เล่น: แชร์คอลเลกชัน users ร่วมกันระหว่าง Discord, สมาชิกเว็บ และน้องคอร์นจ๊อบ
const userSchema = new mongoose.Schema(
  {
    discordId: { type: String, required: true, unique: true, index: true },
    accountType: { type: String, enum: ['discord', 'web', 'bot'], default: 'discord' },
    name: { type: String, default: '' },
    username: { type: String, default: '' },
    avatarUrl: { type: String, default: '' },
    nickname: { type: String, default: '' },
    inviter: { type: String, default: '' },
    birthdayDay: { type: Number, default: null },
    birthdayMonth: { type: Number, default: null },
    birthdayText: { type: String, default: '' },
    favoriteMenu: { type: String, default: 'ขอคิดดูก่อน' },
    likedMenu1: { type: String, default: 'ขอคิดดูก่อน' },
    likedMenu2: { type: String, default: 'ขอคิดดูก่อน' },
    likedMenus: { type: [String], default: [] },
    walletBalance: { type: Number, default: 0 },
    bankBalance: { type: Number, default: 0 },
    pin: { type: String, default: '' },
    casinoPin: { type: String, default: '' },
    scratchCount: { type: Number, default: 0 },
    lastScratchAt: { type: Date, default: null },
    collectedStamps: { type: [String], default: [] },
    transactions: { type: [transactionSubSchema], default: [] }
  },
  { timestamps: true, collection: 'users' }
);

// 🏰 Schema สถานะโลกร่วมของคาสิโน
const landmarkSubSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    ownerId: { type: String, default: null },
    ownerName: { type: String, default: '' },
    tier: { type: Number, default: 0 },
    curtainClosed: { type: Boolean, default: false }
  },
  { _id: false }
);

const lostWalletSubSchema = new mongoose.Schema(
  {
    ownerName: { type: String, default: 'เศรษฐีปริศนา' },
    amount: { type: Number, default: 0 },
    lostReason: { type: String, default: 'ทำหล่นไว้หน้าร้าน' },
    lostAt: { type: Number, default: () => Date.now() }
  },
  { _id: false }
);

const casinoStateSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: 'global' },
    landmarks: { type: [landmarkSubSchema], default: [] },
    lostWallets: { type: [lostWalletSubSchema], default: [] },
    timeCapsule: {
      type: {
        ownerName: String,
        amount: Number
      },
      default: null
    },
    cursedTipJar: { type: Number, default: 500 },
    soulBonds: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true, collection: 'casinostates' }
);

const User = mongoose.models.User || mongoose.model('User', userSchema);
const CasinoState = mongoose.models.CasinoState || mongoose.model('CasinoState', casinoStateSchema);

module.exports = { User, CasinoState };