const FIXED_BOT_NAME = "ESB-BOT";
const FIXED_OWNER_NAME = "ESB TEAM";
const FIXED_PREFIX = "/";

const WELCOME_BUTTONS = {
  inline_keyboard: [
    [{ text: "👑 Contact Owner", url: "https://t.me/B4D9L_007" }],
    [{ text: "📢 Support Group", url: "https://t.me/ESB_TEAM_1" }]
  ]
};

module.exports = {
  config: {
    name: "welcome",
    author: "MOHAMMAD BADOL",
    version: "7.0-TEXT-ONLY",
    description: "Welcome new members with plain text message only",
    eventType: "new_member"
  },

  BADOL: async function ({ event, api, newMembers, ctx, chatId: passedChatId }) {
    try {
      const tg = api || ctx?.telegram;
      if (!tg) return;

      const msg = event || ctx?.message || {};
      const chatId = passedChatId || msg.chat?.id || ctx?.chat?.id;
      if (!chatId) return;

      const members = newMembers || msg.new_chat_members || ctx?.message?.new_chat_members || [];
      if (!members.length) return;

      const chatTitle = msg.chat?.title || ctx?.chat?.title || "Group";
      const botName = FIXED_BOT_NAME;
      const ownerName = FIXED_OWNER_NAME;
      const prefix = global.config?.botInfo?.prefix || FIXED_PREFIX;

      for (const member of members) {
        if (!member) continue;

        // Bot itself added
        if (member.is_bot) {
          let myId = null;
          try { myId = (await tg.getMe()).id; } catch {}
          if (myId && String(member.id) === String(myId)) {
            const addedByName = event?.from?.first_name || ctx?.from?.first_name || "Admin";
            const addedByUsername = event?.from?.username ? "@" + event.from.username : (ctx?.from?.username ? "@" + ctx?.from.username : "—");
            const displayTitle = String(chatTitle).slice(0, 24);
            const botWelcomeMessage =
`╭─❖─〔 ${botName} 〕─❖─╮
│ 🤖 𝐇𝐄𝐋𝐎 ${displayTitle.toUpperCase()}!
├──────────────────────┤
│ ✅ 𝐓𝐡𝐚𝐧𝐤 𝐲𝐨𝐮 𝐟𝐨𝐫 𝐚𝐝𝐝𝐢𝐧𝐠 𝐦𝐞!
│
│ 👤 𝐀𝐝𝐝𝐞𝐝 𝐛𝐲: ${addedByName}
│ 📝 ${addedByUsername}
│ 👑 𝐎𝐰𝐧𝐞𝐫: ${ownerName}
│ ⚙️ 𝐏𝐫𝐞𝐟𝐢𝐱: ${prefix}
│ 💡 ${prefix}help for all cmds
├──────────────────────┤
╰─❖─〔 𝐄𝐒𝐁-𝐁𝐎𝐓 〕─❖─╯`;

            await tg.sendMessage(chatId, botWelcomeMessage, { reply_markup: WELCOME_BUTTONS }).catch(() => {});
            continue;
          }
          continue; // other bots skip
        }

        const userName = (member.first_name || "") + (member.last_name ? " " + member.last_name : "") || "User";
        const userId = member.id;
        const username = member.username ? `@${member.username}` : "No username";
        const adderName = event?.from?.first_name || ctx?.from?.first_name || "Unknown";

        const bdTime = new Date().toLocaleString("en-BD", { timeZone: "Asia/Dhaka", hour: "2-digit", minute: "2-digit", hour12: true });
        const bdDate = new Date().toLocaleString("en-BD", { timeZone: "Asia/Dhaka", day: "2-digit", month: "short", year: "numeric" });

        const welcomeMessage = `╔══════════════════════╗
║ ✨ WELCOME FAMILY ✨ ║
╚══════════════════════╝

┏━━━━━━━━━━━━━━━━━━━━━┓
┃ 👤 𝗡𝗮𝗺𝗲 : ${userName}
┃ 🆔 𝗨𝗜𝗗 : ${userId}
┃ 📝 𝗨𝘀𝗲𝗿 : ${username}
┃ 🏠 𝗚𝗿𝗼𝘂𝗽 : ${chatTitle}
┃ ➕ 𝗔𝗱𝗱𝗲𝗱 : ${adderName}
┃ ⏰ 𝗧𝗶𝗺𝗲 : ${bdTime}
┃ 📅 𝗗𝗮𝘁𝗲 : ${bdDate}
┗━━━━━━━━━━━━━━━━━━━━━┛

🌟 আমাদের পরিবারে আপনাকে স্বাগতম 🌟`;

        await tg.sendMessage(chatId, welcomeMessage).catch(() => {});
      }
    } catch (error) {
      console.log("[JOIN ERROR]", error.message || error);
      try { if (global.log) global.log.error("Error in welcome event:", error); } catch {}
    }
  }
};
