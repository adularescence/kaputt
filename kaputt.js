const Discord = require("discord.js")
const RichEmbed = Discord.RichEmbed;
const Guild = Discord.Guild;

const http = require("http");
const request = require("request");

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
    if (message.content === ";;end") {
      listening_one_word_story = false;
      var msg = "";
      for (var i = 0; i < message_list.length; i++) {
        msg += message_list[i] + " ";
      }
      message.channel.send(new RichEmbed().setDescription(msg.trim())); 
      return;
    }
    message_list.push(message.content);
    return;
  }
  if (message.author.bot || message.content.indexOf(config.prefix) !== 0) {
    return;
  }

  const args = message.content.slice(config.prefix.length).trim().split(/ +/g);
  const cmd = args.shift().toLowerCase();

  switch(cmd) {
    case "record": 
      var guilds = client.guilds.array();
      for (var i = 0; i < guilds.length; i++) {
        if (guilds[i].id == message.guild.id) {
          console.log(guilds[i].name);
          record_member_status = true;
          start_record(guilds[i]);
        }
      }
      break;
    case "stop":
      record_member_status = false;
      var embed = new RichEmbed().setTitle("In the past " + counter_schlafen + " seconds, you have played...");
      for (var i = 0; i < schlafen.activity.length; i++) {
        embed.addField(schlafen.activity[i].name, "For " + schlafen.activity[i].duration);
      }
      message.channel.send(embed);
      break;
    case "delete":
      var limit = args.length === 0 ? 1 : args[0];
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
    case "start":
      listening_one_word_story = true;
      message_list = []
      break;
    case "print":
      var msg = "";
      for (var i = 0; i < message_list.length; i++) {
        msg += message_list[i] + " ";
      }
      message.channel.send(new RichEmbed().setDescription(msg.trim()));
      break;
    default:
      if (cmd !== "help") {
        message.channel.send(new RichEmbed().setDescription("Bad command: ;;" + cmd));
      }
      var embed = new RichEmbed();
      embed.setTitle("**Usable commands**");
      embed.addField(";;avatar [@mention]", "shows your avatar (default), or the one of the mention");
      embed.addField(";;bye", "kills me :cry:");
      embed.addField(";;delete [number]", "deletes the commanding message, and [number] of messages before it (number needs to be less than 100)");
      embed.addField(";;echo" , "repeats everything after ;;echo"); 
      embed.addField(";;end", "finishes listening for one-word-story, and then displays it");
      embed.addField(";;foo", "?");
      embed.addField(";;help", "shows this");
      embed.addField(";;ping", "?");
      embed.addField(";;print", "shows the current one-word-story");
      embed.addField(";;start", "begins listening for one-word-story");
      message.channel.send(embed);
  }
});

client.on("messageDelete", (message) => {
  console.log(message.content); 
});

client.on("typingStart", (channel, user) => {
  console.log(`${user.username} is typing in ${channel.name}`);
});

client.on("messageReactionAdd", (messageReaction, user) => { 
  messageReaction.message.channel.send("user " + user.username + " reacted with " + messageReaction.emoji + " to message " + messageReaction.message.content);
}); 
client.on("messageReactionRemove", (messageReaction, user) => {
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
  }, 1000);
}
