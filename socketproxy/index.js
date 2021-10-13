const express = require("express");
const app = express();
const server = require("http").createServer(app);

app.use(express.static("public"));

app.get("/", function (req, res) {
  res.send("ok");
});

const listener = server.listen(6001, function () {
  console.log("Your app is listening on port " + listener.address().port);
});

const io = require("socket.io")(server);
const iostream = require("socket.io-stream");
const Discord = require("discord.js");
const DiscordVoice = require("@discordjs/voice");

let clients = {};

io.on("connection", (socket) => {
  console.log("Socket connected!");
  socket.on("login", (d) => {
    let bot = new Discord.Client({
      intents: Object.values(Discord.Intents.FLAGS), // fuck you discord lmao
    });
    bot.on("ready", async () => {
      await bot.user.fetch();
      socket.emit("botready", bot.user.toJSON());
    });
    bot.login(d);
    clients[socket.id] = bot;

    socket.on("disconnect", () => {
      bot.destroy();
    });

    let fetchedAuthors = [];
    bot.on("messageCreate", async (message) => {
      let json = message.toJSON();
      if (!fetchedAuthors.includes(message.author.id)) {
        await message.author.fetch();
        fetchedAuthors.push(message.author.id);
      }
      json.author = message.author.toJSON();
      json.channel = message.channel.toJSON();
      if (message.guild) json.guild = message.guild.toJSON();
      if (message.member) json.member = message.member.toJSON();
      socket.emit("messageCreate", json);
    });
    bot.on("messageUpdate", async (message) => {
      let json = message.toJSON();
      if (!fetchedAuthors.includes(message.author.id)) {
        await message.author.fetch();
        fetchedAuthors.push(message.author.id);
      }
      json.author = message.author.toJSON();
      json.channel = message.channel.toJSON();
      if (message.guild) json.guild = message.guild.toJSON();
      if (message.member) json.member = message.member.toJSON();
      socket.emit("messageUpdate", json);
    });

    socket.on("guild", async (id) => {
      let g = bot.guilds.cache.get(id);
      let json = g.toJSON();
      json.channels = g.channels.cache
        .filter((c) => c.permissionsFor(c.guild.me).has("VIEW_CHANNEL"))
        .map((c) => {
          let json = c.toJSON();
          json.canSend = c.permissionsFor(c.guild.me).has("SEND_MESSAGES");
          if (c.parent) json.parent = c.parent.toJSON();
          return json;
        });
      socket.emit("doneguild", json);
    });

    let fetched = [];
    socket.on("fetchMessages", async (id) => {
      let channel = bot.channels.cache.get(id);
      if (!channel) channel = await bot.channels.fetch(id);
      if (!channel) return;
      let messages = channel.messages?.cache || [];
      if (!fetched.includes(channel?.id)) {
        await channel.messages.fetch({
          limit: 100,
          before: channel.messages.cache?.last()?.id,
        });
        await channel.messages.fetch({
          limit: 100,
          before: channel.messages.cache?.last()?.id,
        });
        messages = channel.messages?.cache;
      }
      socket.emit(
        "messages",
        channel.id,
        messages.map((msg) => {
          let json = msg.toJSON();
          json.author = {
            username: msg.author.username,
            tag: msg.author.tag,
          };
          if (msg.member) json.member = msg.member.toJSON();
          return json;
        })
      );
    });

    socket.on("sendMessage", (id, content) => {
      bot.channels.cache.get(id)?.send(content);
    });

    socket.on("joinVoice", (id) => {
      bot.channels.cache.get(id)?.socket.emit("joinedVoice");
    });
    iostream(socket).on("voiceStream", (stream) => {});
  });
});