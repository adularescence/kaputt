const Discord = require("discord.js")
const RichEmbed = Discord.RichEmbed;
const Guild = Discord.Guild;

const config = require("./bot_config.json");
const auth = require("./auth.json");

const client = new Discord.Client();
client.login(auth.token);

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
var story_word_allowance = -1;
var story_list = [];
var story_listening = false;

// record my (for now) activity vars
var record_member_status = false;
var schlafen = {};
var counter_schlafen = 0;

client.on("ready", () => {
  console.log("I am ready!");
  client.user.setPresence({
    game: { name: "" + config.prefix + "help for help" },
    status: "online"
  });  
});

client.on("message", (message) => {
  if (message.author.bot) {
    return;
  }
  if (story_listening === true) { 
    if (message.content === "" + config.prefix + "story stop") {
      story_listening = false;
      message.content = "" + config.prefix + "story show";
    } else if (message.content !== "" + config.prefix + "story show") {
      if (message.content.split(/ +/g).length !== story_word_allowance) {
        message.reply("you must use " + story_word_allowance + " words my dude");
      } else {
        story_list.push(message.content);
        return;
      }
    }
  }
  if (message.content.indexOf(config.prefix) !== 0) {
    return;
  }

  const args = message.content.slice(config.prefix.length).trim().split(/ +/g);
  const cmd = args.shift().toLowerCase();

  switch (cmd) {
    case "poll":
      var options = [];
      for (var i = 0; i < args.length;) {
        var opt = "";
        if (args[i].charAt(0) === "\"") {
          var end_of_opt = false;
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
      var number_emotes = [
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
      var embed = new RichEmbed();
      embed.setTitle(options[0]);
      for (var i = 1; i < options.length; i++) {
        embed.addField(number_emotes[i - 1], options[i]);
      }
      message.channel.send(embed)
        .then(message => {
          for (var i = 0; i < options.length - 1; i++) {
            message.react(number_emotes[i]); 
          }
        });
      break;
    case "record":
      if (args[0] === "start") {
        var guilds = client.guilds.array();
        for (var i = 0; i < guilds.length; i++) {
          if (guilds[i].id == message.guild.id) {
            console.log(guilds[i].name);
            record_member_status = true;
            start_record(guilds[i]);
          }
        }
      } else if (args[0] === "stop" || args[0] === "show") {
        if (cmd[0] === "stop") {
          record_member_status = false;
        }
        var embed = new RichEmbed().setTitle("In the past " + counter_schlafen + " minutes, you have played...");
        for (var i = 0; i < schlafen.activity.length; i++) {
          embed.addField(schlafen.activity[i].name, "For " + schlafen.activity[i].duration);
        }
        message.channel.send(embed);
      } else {
        message.channel.send("Bad subcommand for **" + config.prefix + "record**", help_embed);
      }
      break;
    case "delete":
      var limit = args.length === 0 ? 1 : args[0];
      if (limit > 99) {
        message.channel.send(new RichEmbed().setDescription("You may only delete up to 99 messages at once."));
        return;
      }
      async function clear() {
        const fetched = await message.channel.fetchMessages({limit: ++limit});
        message.channel.bulkDelete(fetched)
        .catch(() => {
          message.channel.send(new RichEmbed().setDescription("Some of the messages to delete are more than 2 weeks old.\nA limitation in Discord's API prevents me from deleting messages older than that!"))
        });
      }
      clear();
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
      var embed = new RichEmbed();
      if (args.length === 0) {
        embed.setImage(message.author.avatarURL);
      } else {
        var mention = message.mentions.users.first();
        if (typeof mention !== "undefined") {
          embed.setImage(client.users.get(mention.id).avatarURL);
        } else {
          embed.setDescription("User not found!");
        }
      } 
      message.channel.send(embed); 
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
      switch (args[0]) {
        case "show":
          if (story_list.length === 0) {
            message.channel.send(new RichEmbed().setDescription("There has yet to be a story since this bot was booted up, or the previous story was blank."));
          } else {
            var msg = "";
            for (var i = 0; i < story_list.length; i++) {
              msg += story_list[i] + " ";
            }
            message.channel.send("Previously on " + story_word_allowance + "-word-story:", new RichEmbed().setDescription(msg.trim()));
          }
          break;
        case "start":
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
      break;
    default:
      if (cmd !== "help") {
        message.channel.send("Bad command: **" + config.prefix + cmd + "**", help_embed);
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

function start_record(guild) {
  schlafen = {
    "activity": []
  };
  setInterval(async () => {
    if (record_member_status == false) { 
      return;
    }
    counter_schlafen++;
    var game = guild.members.get(config.schlafen).presence.game;
    game = game == null ? "nothing" : game.name;
    var newGame = true;
    for (var i = 0; i < schlafen.activity.length; i++) {
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