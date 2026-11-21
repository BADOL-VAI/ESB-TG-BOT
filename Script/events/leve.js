function safeName(str, len = 18) {
  try {
    if (!str) return "Unknown";
    str = String(str).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
    if (!str) return "Unknown";
    const arr = Array.from(str);
    if (arr.length > len) return arr.slice(0, len).join("") + "…";
    return arr.join("");
  } catch {
    return "Unknown";
  }
}

module.exports = {
  config: {
    name: "leave",
    author: "MOHAMMAD BADOL",
    version: "6.0-TEXT-ONLY",
    description: "Goodbye kick+leave - Plain text message only",
    eventType: "left_member"
  },

  BADOL: async function ({ event, api, leftMember, ctx }) {
    try {
      const tg = api?.telegram ? api.telegram : (api || ctx?.telegram || (global.bot && global.bot.telegram));
      if (!tg) return;

      const chat = event?.chat || ctx?.chat;
      if (!chat) return;

      const chatId = chat.id;
      const chatTitle = chat.title || "Group";

      const member = leftMember || event?.left_chat_member || (event?.message && event.message.left_chat_member) || ctx?.left_chat_member;
      if (!member || member.is_bot) return;

      const rawName = member.first_name ? (member.first_name + (member.last_name ? " " + member.last_name : "")) : "User";
      const userName = safeName(rawName, 16);
      const botName = global.config?.botInfo?.name || global.config?.botName || "ESB-BOT";
      const safeGroup = safeName(chatTitle, 18);

      let kickerName = "Unknown", kickType = "LEFT";
      try {
        const actor = event?.from || ctx?.from;
        if (actor) {
          kickerName = safeName(actor.first_name || "Unknown", 12);
          if (actor.id === member.id) {
            kickType = "SELF LEAVE";
          } else {
            kickType = "KICKED BY";
          }
        }
      } catch {}

      let memberCount = 0;
      try { memberCount = await tg.getChatMembersCount(chatId); } catch {}

      const bdTime = new Date().toLocaleString("en-BD", { timeZone: "Asia/Dhaka", hour: "2-digit", minute: "2-digit", hour12: true });
      const reason = kickType === "KICKED BY" ? `👢 Kicked: ${kickerName}` : `🚶 ${kickType}`;

      const msg =
`╭─❖─〔 ${botName} 〕─❖─╮
│ 👋 𝐆𝐎𝐃𝐁𝐘𝐄 𝐅𝐀𝐌𝐈𝐋𝐘!
├──────────────────────┤
│ 👤 𝐍𝐚𝐦𝐞: ${userName}
│ 🆔 𝐈𝐃: ${member.id}
│ 🏠 𝐆𝐫𝐨𝐮𝐩: ${safeGroup}
│ ${reason}
│ ⏰ ${bdTime}
│ 🔢 𝐋𝐞𝐟𝐭: ${memberCount} Members
├──────────────────────┤
│ 😢 Miss you 🌙
╰─❖─〔 𝐆𝐫𝐨𝐮𝐩 𝐆𝐮𝐚𝐫𝐝 〕─❖─╯`;

      await tg.sendMessage(chatId, msg).catch(() => {});

    } catch (e) {
      console.log("[LEAVE ERROR]", e.message);
    }
  }
};
