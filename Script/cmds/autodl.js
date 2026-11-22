// Path: Script/cmds/autodl.js  |  ESB fixed — no spam, next link works
const { alldown } = require('nayan-media-downloaders');
const axios = require('axios');

// শুধু চলমান ডাউনলোড আটকাবে (এক চ্যাটে একসাথে একটা)
const busyChats = new Set();
// একই লিংক ৮ সেকেন্ডের মধ্যে রিপিট হলে স্কিপ
const recentLinks = new Map();
const SAME_LINK_CD = 8000;

function getLang(uid) {
  try {
    const kb = require('../../BADOL/replyKeyboardConfig');
    if (kb?.getUserLang) return kb.getUserLang(uid) || 'en';
  } catch {}
  return 'en';
}

module.exports = {
  config: {
    name: 'autodl',
    aliases: ['autoMediaDownloader', 'alldown', 'dl', 'down'],
    author: 'MOHAMMAD BADOL',
    version: '3.6 NO-STUCK LOCK | B4D9L',
    description: 'Auto social media downloader for all platforms',
    category: 'downloader',
    usePrefix: false,
    cooldown: 3,
    role: 0
  },

  BADOL: async function ({ event, api, args, message, userId, chatId }) {
    const text = (args || []).join(' ').trim();
    if (!text) return;
    return module.exports._run({
      text,
      msg: event,
      chatId: chatId || event?.chat?.id,
      api,
      userId: userId || event?.from?.id
    });
  },

  onChat: async function (raw) {
    try {
      const msg = raw.msg || raw.event || raw;
      const event = raw.event || msg;
      const api = raw.api || raw.bot;
      const chatId = raw.chatId || msg?.chat?.id || event?.chat?.id;
      const userId = raw.userId || msg?.from?.id || event?.from?.id;

      const text = msg?.text || msg?.caption || event?.text || event?.caption || '';
      if (!text || !String(text).includes('http')) return;
      if (msg?.from?.is_bot || event?.from?.is_bot) return;

      const prefix = global.config?.botInfo?.prefix || '/';
      const t = String(text).trim();
      if (t.startsWith(prefix)) {
        const cmd = t.slice(prefix.length).split(/\s+/)[0]?.toLowerCase();
        if (['autodl', 'alldown', 'dl', 'down', 'automediadownloader'].includes(cmd)) return;
      }

      const supported = [
        'facebook.com', 'fb.watch', 'fb.me', 'fb.share',
        'instagram.com', 'instagr.am', 'reel',
        'tiktok.com',
        'youtube.com', 'youtu.be',
        'pinterest.com', 'pin.it',
        'twitter.com', 'x.com'
      ];
      if (!supported.some(d => String(text).toLowerCase().includes(d))) return;

      return module.exports._run({
        text,
        msg: msg || event,
        chatId,
        api: api || raw.bot,
        userId
      });
    } catch (e) {
      console.error('[autodl onChat]', e.message);
    }
  },

  _run: async function ({ text, msg, chatId, api, userId }) {
    if (!chatId) return;

    const urlMatch = String(text).match(/https?:\/\/[^\s]+/);
    let videoLink = (urlMatch ? urlMatch[0] : String(text).trim()).replace(/[.,;!?]$/, '');
    const linkKey = videoLink.split('?')[0].toLowerCase();
    const chatKey = String(chatId);

    // ইতিমধ্যে এই চ্যাটে ডাউনলোড চলছে → একবারই মেসেজ
    if (busyChats.has(chatKey)) {
      return;
    }

    // একই লিংক খুব তাড়াতাড়ি আবার → স্কিপ (স্প্যাম নয়)
    const last = recentLinks.get(linkKey);
    if (last && Date.now() - last < SAME_LINK_CD) {
      return;
    }

    busyChats.add(chatKey);
    recentLinks.set(linkKey, Date.now());

    // সেফটি: ২ মিনিট পর জোর করে লক খুলবে
    const forceUnlock = setTimeout(() => busyChats.delete(chatKey), 120000);

    const tg = api?.telegram || api;
    if (!tg || typeof tg.sendMessage !== 'function') {
      busyChats.delete(chatKey);
      clearTimeout(forceUnlock);
      console.error('[autodl] no telegram api');
      return;
    }

    const lang = getLang(userId);
    const waitText = lang === 'bn' ? '⏳ `ডাউনলোড হচ্ছে...`' : '⏳ `Downloading...`';
    const replyTo = msg?.message_id;
    let waitMsg = null;

    try {
      waitMsg = await tg
        .sendMessage(chatId, waitText, {
          reply_to_message_id: replyTo,
          parse_mode: 'Markdown'
        })
        .catch(() => null);
    } catch {}

    try {
      const res = await alldown(videoLink);
      const videoUrl =
        res?.data?.high ||
        res?.data?.low ||
        res?.data?.video ||
        res?.data?.url ||
        res?.result;
      const title =
        res?.data?.title ||
        res?.title ||
        (lang === 'bn' ? 'টাইটেল পাওয়া যায়নি' : 'No Title Found');

      if (!videoUrl) throw new Error('No URL Found');

      const cleanTitle = String(title).slice(0, 40).replace(/[<>]/g, '');
      const caption =
        lang === 'bn'
          ? `╭───⦿ ডাউনলোড সম্পন্ন ⦿───╮
│
├─🎬 টাইটেল: ${cleanTitle}
│
├─🤖 বট: MCS-TG-STORE
├─👑 ডেভ: B4D9L
│
╰─────────────────⦿`
          : `╭───⦿ DOWNLOADED ⦿───╮
│
├─🎬 Title: ${cleanTitle}
│
├─🤖 BOT: MCS-TG-STORE
├─👑 DEV: B4D9L
│
╰─────────────────⦿`;

      const directBtn = lang === 'bn' ? '📥 ডাইরেক্ট ডাউনলোড লিংক' : '📥 Direct Download Link';
      const replyMarkup = {
        inline_keyboard: [
          [
            { text: '👑 B4D9L', url: 'https://t.me/B4D9L_007' },
            { text: '💸 TEAM', url: 'https://t.me/SB_PREMIUM_ZONE' }
          ],
          [{ text: directBtn, url: videoUrl }]
        ]
      };

      try {
        await tg.sendVideo(chatId, videoUrl, {
          caption,
          parse_mode: 'Markdown',
          reply_to_message_id: replyTo,
          reply_markup: replyMarkup
        });
      } catch (errVideo) {
        const videoResponse = await axios.get(videoUrl, {
          responseType: 'arraybuffer',
          timeout: 30000,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        await tg.sendVideo(
          chatId,
          { source: Buffer.from(videoResponse.data) },
          {
            caption,
            parse_mode: 'Markdown',
            reply_to_message_id: replyTo,
            reply_markup: replyMarkup
          }
        );
      }

      if (waitMsg?.message_id) {
        await tg.deleteMessage(chatId, waitMsg.message_id).catch(() => {});
      }
    } catch (e) {
      console.error('AutoDown Error:', e.message);
      if (waitMsg?.message_id) {
        const failText =
          lang === 'bn'
            ? '❌ ডাউনলোড ব্যর্থ! লিংকটি প্রাইভেট, অনেক বড় বা সাপোর্টেড নয়।'
            : '❌ Failed to download! Link might be private, too large, or unsupported.';
        await tg
          .editMessageText(failText, {
            chat_id: chatId,
            message_id: waitMsg.message_id
          })
          .catch(() => {});
      }
    } finally {
      // লক এখানেই খুলে দাও — পরের লিংক সাথে সাথে চলবে
      clearTimeout(forceUnlock);
      busyChats.delete(chatKey);
    }
  }
};
