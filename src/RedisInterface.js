const redis = require('redis');
const tsubaki = require('tsubaki');

tsubaki.promisifyAll(redis.RedisClient.prototype);
tsubaki.promisifyAll(redis.Multi.prototype);

module.exports = class RedisInterface {
  constructor(options = {}) {
    this.client = redis.createClient(options);
  }

  init(client) {
    const q = this.client.multi();

    client.users.cache.forEach((u) => { q.sadd('users', u.id); q.set(`users:${u.id}`, u); });
    client.guilds.cache.forEach((g) => { q.sadd('guilds', g.id); q.set(`guilds:${g.id}`, g); });
    client.emojis.cache.forEach((e) => { q.sadd('emojis', g.id); q.set(`emojis:${e.id}`, e); });
    client.channels.cache.forEach((c) => { q.sadd('channels', c.id); q.set(`channels:${c.id}`, c); });

    return this.client.flushallAsync().then(() => q.execAsync());
  }

  addMember(member) {
    return this.client.sismemberAsync('users', member.id).then((is) => {
      if (is) return Promise.resolve();
      return this.addUser(member.user);
    });
  }

  addChannel(channel) {
    return this._addData('channels', channel.id, channel);
  }

  removeChannel(channel) {
    return this._removeData('channels', channel.id);
  }

  addUser(user) {
    return this._addData('users', user.id, user);
  }

  removeUser(user) {
    return this._removeData('users', user.id);
  }

  addGuild(guild) {
    return this._addData('guilds', guild.id, guild);
  }

  removeGuild(guild) {
    return this._removeData('guilds', guild.id);
  }

  addEmoji(emoji) {
    return this._addData('emojis', emoji.id, emoji);
  }

  removeEmoji(emoji) {
    return this._removeData('emojis', emoji.id);
  }

  addMessage(message) {
    return this._addData('messages', `${message.channel.id}:${message.id}`, message).then((res) => {
      const cache = message.client.options.messageCacheLifetime;
      if (cache) setTimeout(() => this.removeMessage(message), cache);
      return res;
    });
  }

  removeMessage(message) {
    return this._removeData('messages', `${message.channel.id}:${message.id}`);
  }

  _addData(type, id, data) {
    return Promise.all([
      this.client.saddAsync(type, id),
      this.client.setAsync(`${type}:${id}`, data),
      this.client.publishAsync(`${type}Add`, id),
    ]);
  }

  _removeData(type, id) {
    return Promise.all([
      this.client.sremAsync(type, id),
      this.client.delAsync(`${type}:${id}`),
      this.client.publishAsync(`${type}Remove`, id),
    ]);
  }

  static clean(obj) {
    const out = {};
    Object.keys(obj).forEach((key) => {
      if (!(obj[key] instanceof Object) && obj[key] !== null && typeof obj[key] !== 'undefined') out[key] = `${obj[key]}`;
    });
    return out;
  }
};
