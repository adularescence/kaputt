const Discord = require("discord.js")
const RichEmbed = Discord.RichEmbed;
const Guild = Discord.Guild;

const config = require("./bot_config.json");
const auth = require("./auth.json");

const client = new Discord.Client();
client.login(auth.token);

client.on("ready", () => {
  console.log("I am ready!");
  client.user.setPresence({
    game: { name: ";;help for help" },
    status: "idle"
  });  
});

var message_list_one_word_story = [];
var listening_one_word_story = false;
var record_member_status = false;
var schlafen = {};
var counter_schlafen = 0;

client.on("message", (message) => {
  if (listening_one_word_story === true) { 
    if (message.content === ";;ows stop") {
      listening_one_word_story = false;
      message.content = ";;ows show"; 
    } else if (message.content !== ";;ows show") {
      message_list.push(message.content);
      return;
    }
  }
  if (message.author.bot || message.content.indexOf(config.prefix) !== 0) {
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
        show_help(message);
        return;
      } else if (options.length < 2) {
        message.channel.send(new RichEmbed().setDescription("Not enough options."));
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
        message.channel.send(new RichEmbed().setDescription("Bad subcommand for **;;record**"));
        show_help(message);
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
        message.channel.bulkDelete(fetched);
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
        var member = client.users.get(message.mentions.users.first().id);
        embed.setImage(member.avatarURL); 
      } 
      message.channel.send(embed); 
      break;
    case "bye":
      console.log(message.author.username + " killed me!");
      record_member_status = false;
      client.destroy();
      process.exit(0);
      break;
    case "ows":
      switch (args[0]) {
        case "show":
          var msg = "";
          for (var i = 0; i < message_list.length; i++) {
            msg += message_list[i] + " ";
          }
          message.channel.send(new RichEmbed().setDescription(msg.trim()));
          break;
        case "start":
          listening_one_word_story = true;
          message_list = []
          break;
        default:
          message.channel.send(new RichEmbed().setDescription("Bad subcommand for **;;ows**"));
          show_help(message);
      }
      break;
    default:
      if (cmd !== "help") {
        message.channel.send(new RichEmbed().setDescription("Bad command: **;;" + cmd + "**"));
      }
      show_help(message);
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

function show_help(message) {
  var embed = new RichEmbed();
  embed.setTitle("**Usable commands**");
  embed.setDescription("**;;command** ***subcommand*** [choose one] _argument_ _?optional argument?_");
  embed.addField("**;;avatar** _?@mention?_", "shows your avatar (default), or the avatar of the mention");
  embed.addField("**;;bye**", "kills me :cry:");
  embed.addField("**;;delete** _?number?_",
    "delete the commanding message, the previous message (default), or _number_ previous messages (up to 99)");
  embed.addField("**;;echo**" , "repeats everything after **;;echo**");
  embed.addField("**;;foo**", "?");
  embed.addField("**;;help**", "shows this");
  embed.addField("**;;ows** ***[show start stop]***",
    "\n***show:*** shows the current one word story" +
    "\n***start:*** begins listening for one-word-story" +
    "\n***stop:*** finishes listening for one-word-story, and then shows it");
  embed.addField("**;;ping**", "?");
  embed.addField("**;;poll** _query_ _opt0_ _opt1_ _?opt2?_ _?opt3?_ ... _?opt9?_", "make a poll with the given query and options (up to 10 options)");
  embed.addField("**;;record** ***[show start stop]***", "Records activities by the minute. Only works for meeeeeeee (for now)");
  message.channel.send(embed);
}
