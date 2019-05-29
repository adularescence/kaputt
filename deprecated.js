// stuff is here for reference
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