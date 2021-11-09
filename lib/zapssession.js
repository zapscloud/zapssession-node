/*!
 * Zapscloud Session
 */

var debug = require('debug')('zapssession:main')

var noop = function () {};

/**
 * One day in seconds.
 */
var oneDay = 86400;

function getTTL(store, sess) {
  var maxAge = sess.cookie && sess.cookie.maxAge ? sess.cookie.maxAge : null;
  return store.ttl || (typeof maxAge === 'number' ? Math.floor(maxAge / 1000) : oneDay);
}

module.exports = function (session) {
  var Store = session.Store

  function ZapsSession(options) {
    if (!(this instanceof ZapsSession)) {
      throw new TypeError('Cannot call ZapsSession constructor as a function');
    }

    if (!options.zapsdb) {
      throw new Error('A client must be directly provided to the ZapsDB Session')
    }

    options = options || {};
    this.prefix = options.prefix || 'sess';

    Store.call(this, options);
    this.ttl = options.ttl;
    this.zapsdb = options.zapsdb
    this.collection = (options.collection == null ? 'zaps_session' : `zaps_${options.collection}`)

    check_create_session_collection(this.zapsdb, this.collection)
      .then(function (response) {
        debug('Session collection created');
      })
      .catch(function (err) {
        debug('Error on GET', err);
      });

  }

  ZapsSession.prototype.__proto__ = Store.prototype;

  ZapsSession.prototype.get = function (sid, fn) {
    debug('GET "%s"', sid);
    fn = fn || noop;
    sid = this.prefix + sid;

    var zapsdb = this.zapsdb;
    var collection = this.collection;

    zapsdb.getOne(collection, sid)
      .then(function (data) {
        return fn(null, data);
      })
      .catch(function (err) {
        debug('Error on GET', err);
        if (err.error_code == '400') {
          debug('Error 400')
          return fn();
        } else {
          debug('Error ', err.error_code )
          return fn(err);
        }
      });
  };

  ZapsSession.prototype.set = function (sid, sess, fn) {
    debug('SET session "%s"', sid);
    fn = fn || noop;
    sid = this.prefix + sid;
    var ttl = getTTL(this, sess);

    var zapsdb = this.zapsdb;
    var collection = this.collection;

    sess.sid = sid;
    sess.expiry = ttl;
    debug(sess);

    debug(collection, sid);
    zapsdb.getOne(collection, sid)
      .then(function (getresponse) {
        debug('Update ', sid, sess)
        delete sess._id;
        return zapsdb.updateOne(collection, sid, sess);
      })
      .catch(function (err) {
        debug('Insert', err, sess)
        return zapsdb.insertOne(collection, sess);
      })

      .then(function (data) {
        debug('Data', data);
        fn(null, data);
      })
      .catch(function (err) {
        debug('Error on SET', err);
        return fn(err);
      })
  };

  ZapsSession.prototype.destroy = function (sid, fn) {
    debug('DESTROY session "%s"', sid);
    fn = fn || noop;
    sid = this.prefix + sid;

    var zapsdb = this.zapsdb;
    var collection = this.collection;

    zapsdb.deleteOne(collection, sid)
      .then(function(data){
        debug('Deleted ', data);
        return fn(null, data);
      })
      .catch(function (err) {
        debug('Error on DESTROY', err);
        return fn(err);
      });
  }


  ZapsSession.prototype.touch = function (sid, sess, fn) {
    // re-post data to refresh TTL
    debug('TOUCH session "%s"', sid);
    fn = fn || noop;
    sid = this.prefix + sid;
    var self = this;

    var zapsdb = this.zapsdb;
    var collection = this.collection;

    zapsdb.getOne(collection, sid)
      .then(function (data) {
        // update TTL
        var currentSession = data;
        currentSession.cookie = sess.cookie;
        var ttl = getTTL(self, sess);
        // update
        zapsdb.updateOne(collection, sid, ttl)
          .then(function () {
            fn(null, null);
          })
          .catch(function (err) {
            debug('Error on TOUCH - failed updating', err);
            return fn(err);
          });
      })
      .catch(function (err) {
        debug('Error on TOUCH - session not found', err);
        return fn(err);
      });
  };

  ZapsSession.prototype.clear = function (fn) {
    fn = fn || noop;
    this.zapsdb.deleteMany(this.collection)
      .then(function (data) {
        debug('Response Query', data)
        fn(null, null);
      })
      .catch(function (err) {
        debug('Error Get Details', err)
        return fn(err);
      })
  }

  function check_create_session_collection(zapsdb, collection) {
    return new Promise((resolve, reject) => {
      zapsdb.getCollection(collection)
        .then(function (response) {
          resolve(response)
        })
        .catch(function (err) {
          if (err.status && err.status == 410) {
            zapsdb.createCollection(collection, 'sid', 'Zaps Session Stroage')
              .then(function (response) {
                debug('Collection created for session ')
                resolve(response)
              })
              .catch(function (err) {
                debug('Session collection create error ', err)
                reject(err);
              })
          } else {
            reject(err);
          }
        });
    });
  }

  return ZapsSession;
}