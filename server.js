var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var bodyParser = require('body-parser')
var JsonDB = require('node-json-db');
var vm = require('vm');
var db = new JsonDB("homeSystem", true, true);

app.use(bodyParser.json());



var bindings = [
  {
    title:'Test binding',
    evt:'sklepar',
    code:'console.log("hittat data",d); evt.emit("Light5",{state:"ON"});'
  },
  {
    title:'Test binding2',
    evt:'Light1',
    code:'if (data.state=="ON") { console.log("påsatt lampa släcker efter 1sek"); setTimeout(function() { evt.emit("Light1","OFF"); },1000);}'
  }
];


var opt = {
   root: './',
   dotfiles: 'deny'
 };



var eventLog = [];
var eventPers = {};
var maxLen = 4096;
var evts = {};

handlers = {

};


evt = {
  on:function(evt,cb) {
    if (!evts[evt])
      evts[evt] = [];
    evts[evt].push(cb);

  },
  unbind:function(evt,cb) {
    delete evts[evt][cb];
  },
  emit:function(evt,data) {
    var cmds = evts[evt];

    if (cmds)
    {
      cmds.forEach(function(v) {
        v.apply(this,[data]);
      });
    }
    var d = {id:evt,data:data, ts: new Date()};
    if (eventLog.length>=maxLen)
      eventLog.slice();
    eventLog.push(d);
    eventPers[evt] = d;
    io.sockets.emit('evt',d);
  }
}

function registerHandler(id,d) {
  handlers[id] = d;
  if (d.init) {
    d.init(evt,function(itms) {
      for(var i in itms) {
        eventPers[i] = itms[i];
      };
    });
  }
}

registerHandler('tellstik',{
  init:function(evt,cb) {
    var t = this;
    var d = {
      Light1:{state:'OFF',states:['ON','OFF']},
      Light2:{state:'OFF',states:['ON','OFF']},
      LightDimmer:{state:0,states:{min:0,max:100}}
    };
    cb(d);
    for(var name in d) {
      (function(i) {
        evt.on(i,function(data) {
          if (data.state==1 || data.state=="ON")
            t.on(i);
          else
            t.off(i);
        });
      })(name);
    }
  },
  on:function(item) {
    console.log('turning on '+item);
  },
  off:function(item) {
    console.log('turning off '+item);
  }
});




function parseBinding(d) {
  var sandbox = {
    log:function() {
      console.log.apply(this,arguments);
    },
    emit:function(e,data) {
      evt.emit(e,data);
    }
  };
  vm.createContext(sandbox);
  var ret = {
    data:d,
    evt:d.evt,
    command:function(data) {
      //sandbox.data = data;
      eval(d.code);
      //vm.runInThisContext();
    }
  };
  evt.on(d.evt,function(d) {
    ret.command(d);
  });
  return ret;
}

for(var i=0;i<bindings.length;i++) {
  console.log('parse',i);
  parseBinding(bindings[i]);
}


setInterval(function() {
  evt.emit('timedevent',new Date());
},5000);

app.get('/', function(req, res){
  res.sendFile('index.html',opt,function(err) {
    if (err) {
      console.log(err);
      res.status(err.status).end();
    }
  });
});

app.get('/api/:cmd',function(req,res) {
  console.log(req.params.cmd);
  switch(req.params.cmd) {
    case 'all':
      res.send(eventPers);
    break;
    case 'log':
      res.send(eventLog);
    break;
    case 'bindings':
      res.send(bindings);
    break;
    default:
      res.send({});
  }
});

io.on('connection', function(socket){
  console.log('användare inne');
  socket.on('evt',function(d,data) {
    //console.log('got event',d);
    evt.emit(d.evt,d.data);
  });
  socket.emit('evt',{evt:'welcome'});
});

http.listen(80, function(){
  console.log('listening on *:80');
});

evt.emit('started', new Date());
evt.emit('sklepar', 'hejsan');
/*
var handlers = {};
var items = {};

var HomeSystem = {
  register:function(id,o) {
    handlers[id] = new o(HomeSystem);
    io.emit('plugin','add',id);
  }
}

HomeSystem.register('sklep',function (hs) {
  this.apiCall = function(url,cb) {
    cb({data:url});
  }
});
*/
