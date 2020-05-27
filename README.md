# zapssession
_Zapscloud Session API Client_

NodeJS express-session storage for ZapsDB.

**Initialize Library with config values**
    
    const config = require('./config.json')
    const session = require('express-session')
    const ZapsSession = require('@zapscloud/zapssession')(session)

    var _zapsconfig = {
        url: config.zapsurl,
        app: config.zapsapp,
        authkey: config.zapskey,
        authsecret: config.zapssecret
    }

    app.use(session({
        key: 'user_sid',
        secret: 'sessionsecret',
        resave: true,
        saveUninitialized: false,
        store: new ZapsSession({
            zapsdb: new ZapsDB(_zapsconfig),
            collection: 'appsession'
        }),
        cookie: {
            maxAge: 86400000
        }
    }));
    