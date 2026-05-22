// FIND THIS INSIDE MULTI ROLL:

return i.editReply({
  content: (`**CHARACTER ROLL x${amount}**\n` + lines.join('\n')).slice(0, 1800),
  embeds: embeds.slice(0, 10),
  files: files.slice(0, 10)
});

// REPLACE IT WITH THIS:

return i.editReply({
  embeds: embeds.slice(0, 10),
  files: files.slice(0, 10),
  content:
    (`## CHARACTER ROLL x${amount}\n\n` +
    lines.join('\n')).slice(0, 1800)
});


// THIS MAKES:
// 1. Character images/cards appear FIRST
// 2. Names + power + rarity appear BELOW the images
