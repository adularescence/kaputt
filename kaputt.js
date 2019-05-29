const Discord = require("discord.js")
const RichEmbed = Discord.RichEmbed;
const Guild = Discord.Guild;

const config = require("./bot_config.json");
const auth = require("./auth.json");

const discord_client = new Discord.Client();
discord_client.login(auth.token);

const nh = require("nhentai-js");
const Danbooru = require("danbooru");
const booru = new Danbooru(auth.danbooru_login + ":" + auth.danbooru_api);

const Postgres = require("pg");
// const pg_pool = new Pool({
//   user: "kaputt",
//   host: "localhost",
//   database: "kaputt_db",
//   password: auth.pg_password,
//   port: auth.pg_port
// });
const pg_client = new Postgres.Client({
  user: "kaputt",
  host: "localhost",
  database: "kaputt_db",
  password: auth.pg_password,
  port: auth.pg_port
});
pg_client.connect();

const help_embed = new RichEmbed()
.setTitle("**Usable commands**")
.setDescription("**" + config.prefix + "command** ***subcommand*** [choose one] _argument_ _?optional argument?_")
.addField("**" + config.prefix + "avatar** _?@mention?_", "shows your avatar (default), or the avatar of the mention")
.addField("**" + config.prefix + "bye**", "kills me :cry:")
.addField(`**${config.prefix}db** ***[insert select]***`, `figuring this thing out`)
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

// <words>-word-story variables
let story_word_allowance = -1;
const story_list = [];
let story_listening = false;

// deprecated soon
// record the activities of members on my test server (for now)
let record_member_status = false;
const record_map = new Map();
let minutes_since_start = 0;

// active record
let active_record_map = new Map();

discord_client.on("ready", () => {
  console.log("I am ready!");
  discord_client.user.setPresence({
    game: { name: "" + config.prefix + "help for help" },
    status: "online"
  });

  // initialize the active recording map
  discord_client.guilds.forEach(guild => {
    active_record_map.set(guild.id, new Map());
    guild.members.forEach(member => {
      active_record_map.get(guild.id).set(member.user.id, {
        recording: false,
        time: 0,
        username: member.user.username,
        activities: new Map()
      });
    });
  });
  active_record();
});

discord_client.on("message", (message) => {
  // record messages
  const text = "INSERT INTO test_server_messages (id, author_id, content, timestamp) VALUES ($1, $2, $3, $4) RETURNING *";
  const values = [message.id, message.author.id, message.content, message.createdTimestamp];
  pg_client.query(text, values)
  .then(res => {
    res.rows.forEach(entry => console.log(entry));
  })
  .catch(e => console.log(e.stack));

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
        discord_client.destroy();
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
    case "db":
      command_db(message, args);
      break;
    case "test":
      if (message.author.id !== config.me) return;
      enable_active_record(message.guild, message.member);
      break;
    case "test2":
      if (message.author.id !== config.me) return;
      // print out the activities of the member
      for (let guild of active_record_map.keys()) {
        console.log(guild);
        for (let member of active_record_map.get(guild).keys()) {
          console.log(active_record_map.get(guild).get(member).username);
          let activities = active_record_map.get(guild).get(member).activities;
          if (activities.size === 0) {
            console.log("did jack shit");
          } else {
            console.log(activities);
          }
        }
      }
      break;
    default:
      if (cmd !== "help") {
        message.channel.send(`Bad command: **${config.prefix}${cmd}**`, help_embed);
      } else {
        message.channel.send(help_embed);
      }
  }
});

discord_client.on("messageDelete", (message) => {
  console.log(message.content); 
});

discord_client.on("typingStart", (channel, user) => {
  console.log(`${user.username} is typing in ${channel.name}`);
});

discord_client.on("messageReactionAdd", (messageReaction, user) => { 
  if (user.bot) return;
  messageReaction.message.channel.send("user " + user.username + " reacted with " + messageReaction.emoji + " to message " + messageReaction.message.content);
}); 

discord_client.on("messageReactionRemove", (messageReaction, user) => {
  if (user.bot) return;
  messageReaction.message.channel.send("user " + user.username + " removed reaction " + messageReaction.emoji + " from message " + messageReaction.message.content);
});

// Command functions

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
    // will react with the number emotes in correct order
    const sequential_react = async () => {
      for (let i = 0; i < options.length - 1; i++) await message.react(number_emotes[i]);
    }
    sequential_react();
  });
}

const command_record = (message, args) => {
  if (args[0] === "start") {
    if (message.guild.id !== config.test_guild) {
      message.channel.send(new RichEmbed().setTitle("Sorry, right now recording available only for my test server."));
      return;
    }
    record_member_status = true;
    console.log(message.guild.name);
    start_record(message.guild);
    // const guilds = discord_client.guilds.array();
    // for (let i = 0; i < guilds.length; i++) {
    //   if (guilds[i].id == message.guild.id) {
    //     // TODO debug
    //     console.log(guilds[i].name);
    //     record_member_status = true;
    //     start_record(guilds[i]);
    //   }
    // }
  } else if (args[0] === "stop" || args[0] === "show") {
    if (record_members.length === 0) {
      message.channel.send(new RichEmbed().setTitle("Nothing has been recorded yet..."));
      return;
    }
    if (args[0] === "stop") {
      record_member_status = false;
    }
    const embed = new RichEmbed().setTitle("In the past " + minutes_since_start + " minutes, the members on this server have played...");
    record_members.forEach(member => {
      let text = "";
      member.activities.forEach(activity => {
        text += activity.name + " for " + activity.duration + "\n";
      });
      embed.addField(member.username, text);
    });
    message.channel.send(embed);
  } else {
    message.channel.send("Bad subcommand for **" + config.prefix + "record**", help_embed);
  }
}

const active_record = () => {
  setInterval(async () => {
    discord_client.guilds.forEach(guild => {
      guild.members.forEach(member => {
        if (active_record_map.get(guild.id).get(member.user.id).recording) {
          let game = member.presence.game === null ? "nothing" : member.presence.game.name;
          active_record_map.get(guild.id).get(member.user.id).time++;
          if (active_record_map.get(guild.id).get(member.user.id).activities.has(game)) {
            active_record_map.get(guild.id).get(member.user.id).activities.set(game, active_record_map.get(guild.id).get(member.user.id).activities.get(game) + 1);
          } else {
            active_record_map.get(guild.id).get(member.user.id).activities.set(game, 1);
          }
        }
      });
    });
  }, 1000);
}

const enable_active_record = (guild, member) => {
  active_record_map.get(guild.id).get(member.user.id).recording = true;
  active_record_map.get(guild.id).get(member.user.id).activities.clear();
  active_record_map.get(guild.id).get(member.user.id).time = 0;
}

const disable_active_record = (guild, member) => {
  active_record_map.get(guild.id).get(member.user.id).recording = false;
}

const start_record = (guild) => {
  guild.members.forEach(member => record_members.push({username: member.user.username, id: member.user.id, activities: [] }));
  setInterval(async () => {
    if (record_member_status == false) { 
      return;
    }
    minutes_since_start++;
    guild.members.forEach(guild_member => {
      let game = guild_member.presence.game;
      game = game === null ? "nothing": game.name;
      let newGame = true;
      record_members.forEach(member => {
        if (member.id === guild_member.id) {
          for (let i = 0; i < member.activities.length; i++) {
            if (member.activities[i].name === game) {
              newGame = false;
              member.activities[i].duration++;
            }
          }
          if (newGame) {
            member.activities.push({
              "name": game,
              "duration": 1
            });
          }
        }
      });
    });
    // call the ;db update code here
    //bogus_code(guild);
  }, 60000);
}

const command_delete = (message, args) => {
  const to_be_deleted = args.length === 0 ? 1 : args[0]++;
  if (to_be_deleted > 100) {
    message.channel.send(new RichEmbed().setDescription("You may only delete up to 99 messages at once."));
    return;
  }
  const clear = async () => {
    const fetched = await message.channel.fetchMessages({ limit: to_be_deleted });
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
      embed.setImage(discord_client.users.get(mention.id).avatarURL);
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

const command_db = (message, args) => {
  switch (args[0]) {
    case "select":
      // shows all the avatars collected from ;db insert
      pg_client.query("SELECT * FROM command_record_test", (err, res) => {
        res.rows.forEach(entry => message.channel.send(`https://cdn.discordapp.com/avatars/${entry.id}/${entry.avatar}.png?size=2048`));
      });
      break;
    case "insert":
      // right now, inserts user id and avatar into a table, which can be retrieved using ;db select
      // if (message.author.id !== config.me) return;
      const insert_text = "INSERT INTO command_record_test (id, username, discriminator, avatar) VALUES ($1, $2, $3, $4) RETURNING *";
      const insert_values = [message.author.id, message.author.username, message.author.discriminator, message.author.avatar];
      pg_client.query(insert_text, insert_values)
      .then(res => {
        res.rows.forEach(entry => console.log(entry));
      })
      .catch(e => console.error(e.stack));
      break;
    case "populate":
      // populate record_map with preexisting data
      pg_client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'")
      .then(res => {
        res.rows.forEach(entry => {
          // may need to change to regex
          if (entry.table_name.startsWith("guild_")) {
            //console.log(entry.table_name.match(/[0-9]+/g)[0]);
            record_map.set(entry.table_name.match(/[0-9]+/g)[0], []);
          }
        });

        for (let guild of record_map.keys()) {
          pg_client.query(`SELECT * FROM guild_${guild}_member_activities_test`)
          .then(res => {
            res.rows.forEach(entry => {
              let parsed_activities = [];
              entry.activities.forEach(activity => {
                parsed_activities.push({
                  name: activity.name,
                  duration: activity.duration
                });
              });
              record_map.get(guild).push({
                id: entry.id,
                username: entry.username,
                activities: parsed_activities
              });
            });

            record_map.forEach(data => {
              console.log(data);
            });
          })
          .catch(e => console.log(e.stack));
        }
      })
      .catch(e => console.log(e.stack));
      break;
    case "update":
      // broken right now, skip
      return;
      // add code that updates all guilds' activity tables
      // psql create table
      // certified working 100% - May 17, 2019
      // let guild_id = "";
      // discord_client.guilds.forEach(guild => {
      //   if (message.guild.id === guild.id) guild_id = guild.id;
      // });
      // const create_text = "CREATE TABLE guild_" + message.guild.id + "_member_activities_test (id TEXT PRIMARY KEY, username TEXT NOT NULL, activities JSONB NOT NULL)"
      // pg_client.query(create_text)
      // .then(res => console.log(res))
      // .catch(e => console.log(e.stack));
      // break;
      console.log(JSON.stringify(record_members[0].activities));
      const update_text = "INSERT INTO guild_" + guild.id + "_member_activities_test (id, username, activities) VALUES ($1, $2, $3) RETURNING *";
      record_members.forEach(member => {
        pg_client.query(update_text, [member.id, member.username, JSON.stringify(member.activities)])
        .then(res => {
          console.log(res.rows[0]);
        })
        .catch(e => console.log(e.stack));
      });
      break;
    // case "delete":
    //   pg_client.query("DELETE FROM test_table WHERE id = " + args[1])
    //   .then(res => console.log)
    //   .catch(e => console.error(e.stack));
    // case "kill":
    //   pg_client.end();
    //   break;
    default:
      message.channel.send("bad command");
  }
}