const Discord = require("discord.js")
const RichEmbed = Discord.RichEmbed;
const Guild = Discord.Guild;

const config = require("./bot_config.json");
const auth = require("./auth.json");

const client = new Discord.Client();
client.login(auth.token);

const nh = require("nhentai-js");
const Danbooru = require("danbooru");
const booru = new Danbooru(auth.danbooru_login + ":" + auth.danbooru_api);

const help_embed = new RichEmbed()
  .setTitle("**Usable commands**")
  .setDescription("**" + config.prefix + "command** ***subcommand*** [choose one] _argument_ _?optional argument?_")
  .addField("**" + config.prefix + "avatar** _?@mention?_", "shows your avatar (default), or the avatar of the mention")
  .addField("**" + config.prefix + "bye**", "kills me :cry:")
  .addField("**" + config.prefix + "delete** _?number?_",
    "delete the commanding message, the previous message (default), or _number_ previous messages (up to 99)")
  .addField("**" + config.prefix + "echo**" , "repeats everything after **" + config.prefix + "echo**")
  .addField("**" + config.prefix + "foo**", "?")
  .addField("**" + config.prefix + "help**", "shows this")
  .addField("**" + config.prefix + "story** ***[show {start <words>} stop]***",
    "\n***show:*** shows the most recent or current <words>-word-story" +
    "\n***start <words>:*** begins listening for a new <words>-word-story" +
    "\n***stop:*** finishes listening for <words>-word-story, and then shows it")
  .addField("**" + config.prefix + "ping**", "?")
  .addField("**" + config.prefix + "poll** _query_ _opt0_ _opt1_ _?opt2?_ _?opt3?_ ... _?opt9?_", "make a poll with the given query and options (up to 10 options)")
  .addField("**" + config.prefix + "record** ***[show start stop]***", "Records activities by the minute. Only works for meeeeeeee (for now)");

// <words>-word-story vars
let story_word_allowance = -1;
const story_list = [];
let story_listening = false;

// record my (for now) activity vars
let record_member_status = false;
let schlafen = {};
let counter_schlafen = 0;

client.on("ready", () => {
  console.log("I am ready!");
  client.user.setPresence({
    game: { name: "" + config.prefix + "help for help" },
    status: "online"
  });  
});

client.on("message", (message) => {
  // console.log(message);

  // ignore bots
  if (message.author.bot) return;

  // only a few commands will work while a story is running
  if (story_listening === true) {
    // stops the story if the message is "story stop"
    if (message.content === "" + config.prefix + "story stop") {
      story_listening = false;
      // displays the story by changing the message to story show, which allows the function to continue
      message.content = "" + config.prefix + "story show";
    } else if (message.content !== "" + config.prefix + "story show") {
      // if the message is not story show, check word count and add to story or reject
      if (message.content.split(/ +/g).length !== story_word_allowance) {
        message.reply("you must use " + story_word_allowance + " words my dude");
      } else {
        story_list.push(message.content);
        return;
      }
    }
  }

  // ignore messages that don't start with the command prefix
  if (message.content.indexOf(config.prefix) !== 0) {
    return;
  }

  const args = message.content.slice(config.prefix.length).trim().split(/ +/g);
  const cmd = args.shift().toLowerCase();

  switch (cmd) {
    case "poll":
      command_poll(message, args);
      break;
    case "record":
      command_record(message, args);
      break;
    case "delete":
      command_delete(message, args);
      break;
    case "ping": 
      message.channel.send(new RichEmbed().setDescription("pong!"));
      break;
    case "foo":
      message.channel.send(new RichEmbed().setDescription("bar!"));
      break;
    case "echo":
      if (args.length === 0) return;
      message.channel.send(new RichEmbed().setDescription(message.content.substring(cmd.length + config.prefix.length), { tts: true }));
      break;
    case "avatar":
      command_avatar(message, args); 
      break;
    case "bye":
      message.channel.send(new RichEmbed().setDescription("<@" + message.author.id + "> killed me!"))
      .then(() => {
        record_member_status = false;
        console.log(message.author.username + " killed me!");
        client.destroy();
        process.exit(0);
      });
    case "story":
      command_story(message, args);
      break;
    case "nh":
      command_nh(message, args);
      break;
    case "danbooru":
      command_danbooru(message, args);
      break;
    default:
      if (cmd !== "help") {
        message.channel.send(`Bad command: **${config.prefix}${cmd}**`, help_embed);
      } else {
        message.channel.send(help_embed);
      }
  }
});

client.on("messageDelete", (message) => {
  console.log(message.content); 
});

client.on("typingStart", (channel, user) => {
  console.log(`${user.username} is typing in ${channel.name}`);
});

client.on("messageReactionAdd", (messageReaction, user) => { 
  if (user.bot) return;
  messageReaction.message.channel.send("user " + user.username + " reacted with " + messageReaction.emoji + " to message " + messageReaction.message.content);
}); 
client.on("messageReactionRemove", (messageReaction, user) => {
  if (user.bot) return;
  messageReaction.message.channel.send("user " + user.username + " removed reaction " + messageReaction.emoji + " from message " + messageReaction.message.content);
});

// Command functions

const start_record = (guild) => {
  schlafen = {
    "activity": []
  };
  setInterval(async () => {
    if (record_member_status == false) { 
      return;
    }
    counter_schlafen++;
    let game = guild.members.get(config.schlafen).presence.game;
    game = game == null ? "nothing" : game.name;
    let newGame = true;
    for (let i = 0; i < schlafen.activity.length; i++) {
      if (schlafen.activity[i].name == game) {
        newGame = false;
        schlafen.activity[i].duration++;
      }
    }
    if (newGame) {
      schlafen.activity.push({
        "name": game,
        "duration": 1
      });
    }
  }, 60000);
}

const command_poll = (message, args) => {
  const options = [];
  // parse multi-word quoted options and get options
  for (let i = 0; i < args.length;) {
    let opt = "";
    if (args[i].charAt(0) === "\"") {
      let end_of_opt = false;
      while (!end_of_opt) {
        opt += args[i] + " "; 
        if (args[i].charAt(args[i].length - 1) === "\"") {
          end_of_opt = true;
        }
        i++;
      } 
    } else {
      opt = args[i] + " ";
      i++;
    }
    options.push(opt.trim().replace(/\"/g, ""));
  }
  if (options.length > 11) {
    message.channel.send(new RichEmbed().setDescription("Too many options."));
    return;
  } else if (options.length < 2) {
    message.channel.send(new RichEmbed().setDescription("Not enough options."));
    return;
  }
  const number_emotes = [
    "\u0030\u20E3", // 0
    "\u0031\u20E3", // 1
    "\u0032\u20E3", // 2
    "\u0033\u20E3", // 3
    "\u0034\u20E3", // 4
    "\u0035\u20E3", // 5
    "\u0036\u20E3", // 6
    "\u0037\u20E3", // 7
    "\u0038\u20E3", // 8
    "\u0039\u20E3"  // 9
  ];
  const embed = new RichEmbed();
  embed.setTitle(options[0]);
  for (let i = 1; i < options.length; i++) {
    embed.addField(number_emotes[i - 1], options[i]);
  }
  message.channel.send(embed)
  .then(message => {
    for (let i = 0; i < options.length - 1; i++) {
      message.react(number_emotes[i]); 
    }
  });
}

const command_record = (message, args) => {
  if (args[0] === "start") {
    const guilds = client.guilds.array();
    for (let i = 0; i < guilds.length; i++) {
      if (guilds[i].id == message.guild.id) {
        // TODO debug
        console.log(guilds[i].name);
        record_member_status = true;
        start_record(guilds[i]);
      }
    }
  } else if (args[0] === "stop" || args[0] === "show") {
    if (cmd[0] === "stop") {
      record_member_status = false;
    }
    const embed = new RichEmbed().setTitle("In the past " + counter_schlafen + " minutes, you have played...");
    for (let i = 0; i < schlafen.activity.length; i++) {
      embed.addField(schlafen.activity[i].name, "For " + schlafen.activity[i].duration);
    }
    message.channel.send(embed);
  } else {
    message.channel.send("Bad subcommand for **" + config.prefix + "record**", help_embed);
  }
}

const command_delete = (message, args) => {
  const limit = args.length === 0 ? 1 : args[0]++;
  if (limit > 100) {
    message.channel.send(new RichEmbed().setDescription("You may only delete up to 99 messages at once."));
    return;
  }
  const clear = async () => {
    const fetched = await message.channel.fetchMessages({ limit: limit });
    message.channel.bulkDelete(fetched)
    .catch(() => {
      message.channel.send(new RichEmbed().setDescription("Some of the messages to delete are more than 2 weeks old.\nA limitation in Discord's API prevents me from deleting messages older than that!"))
    });
  };
  clear();
}

const command_danbooru = (message, args) => {
  let search_tags = "";
  if (args.length === 0) {
    // default tags for no args
    tags = "order:rank rating:safe";
  } else {
    args.forEach(tag => search_tags += `${tag} `);
    search_tags = search_tags.trim();
  }
  booru.posts({ tags: search_tags })
  .then(posts => {
    const index = Math.floor(Math.random() * posts.length);
    const post = posts[index];
    const url = booru.url(post.file_url);
    const name = `${post.md5}.${post.file_ext}`;
    message.channel.send(new RichEmbed().setImage(post.file_url));
    console.log(post);
    /*http.get(url, response => {
      console.log(response);
      response.pipe(require("fs").createWriteStream(name));
    });*/
  });
}

const command_avatar = (message, args) => {
  const embed = new RichEmbed();
  if (args.length === 0) {
    // default is caller's avatar
    embed.setImage(message.author.avatarURL);
  } else {
    const mention = message.mentions.users.first();
    if (typeof mention !== "undefined") {
      embed.setImage(client.users.get(mention.id).avatarURL);
    } else {
      embed.setDescription("User not found!");
    }
  } 
  message.channel.send(embed);
}

const command_story = (message, args) => {
  switch (args[0]) {
    case "show":
      if (story_list.length === 0) {
        message.channel.send(new RichEmbed().setDescription("There has yet to be a story since this bot was booted up, or the previous story was blank."));
      } else {
        let msg = "";
        story_list.forEach(word => msg += `${word} `);
        message.channel.send("Previously on " + story_word_allowance + "-word-story:", new RichEmbed().setDescription(msg.trim()));
      }
      break;
    case "start":
      // parseInt(input, radix);
      story_word_allowance = parseInt(args[1], 10);
      if (!Number.isNaN(story_word_allowance) && story_word_allowance > 0) {
        story_listening = true;
        story_list = []
        message.channel.send(new RichEmbed().setDescription("New " + story_word_allowance + " word story. Listening..."));
      } else {
        message.channel.send(new RichEmbed().setDescription("You need to specify >0 words for <words>-word-story (i.e. **" + config.prefix + "story start 4** for four-word-story)"));
      }
      break;
    default:
      message.channel.send("Bad subcommand for **" + config.prefix + "story**", help_embed);
  }
}

const command_nh = (message, args) => {
  if ((args.length < 1) || (args.length > 3) || (args.length === 3 && args[1] !== "no" && args[2] !== "cover")) {
    message.channel.send(new RichEmbed().setTitle("Usage").setDescription(config.prefix + "nh <id> [no cover]"));
    return;
  } 
  const no_cover = args.length === 3 && args[1] === "no" && args[2] === "cover";
  nh.getDoujin(args[0]).then(doujin => {
    const parr = (arr) => {
      let msg = "";
      for (let i = 0; i < arr.length; i++) {
        msg += arr[i].replace(",", "");
        if (i !== arr.length - 1) {
          msg += ", ";
        }
      }
      return msg;
    }
    const embed = new RichEmbed().setTitle(doujin.link);
    // Title will be in the `title pretty` format
    embed.addField("Title", doujin.title.replace(/\((.*?)\)/g, "").replace(/\[(.*?)\]/g, "").trim());
    embed.addField("Number of Pages", doujin.pages.length);
    const fields = ["characters", "parodies", "tags", "artists", "groups", "languages", "categories"];
    if (doujin.details.characters !== undefined) embed.addField("Characters", parr(doujin.details.characters));
    if (doujin.details.parodies !== undefined) embed.addField("Parodies", parr(doujin.details.parodies));
    if (doujin.details.tags !== undefined) embed.addField("Tags", parr(doujin.details.tags));
    if (doujin.details.artists !== undefined) embed.addField("Artists", parr(doujin.details.artists));
    if (doujin.details.groups !== undefined) embed.addField("Groups", parr(doujin.details.groups));
    if (doujin.details.languages !== undefined) embed.addField("Languages", parr(doujin.details.languages));
    if (doujin.details.categories !== undefined) embed.addField("Categories", parr(doujin.details.categories));
    if (!no_cover) embed.setImage(doujin.pages[0]);
    message.channel.send(embed);
  })
  .catch(error => {
    console.error(error);
    message.channel.send(new RichEmbed().setTitle("No gallery found for " + args[0]));
  });
}