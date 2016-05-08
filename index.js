var fs = require("fs");
var jsdom = require("jsdom");

var factory = function(options) {
  var defaults = {
    gameDataDir: '/gameData', //Where the game data is located
    pagesDir: '/page',
    outputInDesignDir: false,
    outputWebDir: false,
    folders: [], //One file returning many objects
    simples: [] //One file returning many objects
  };
  var gameData = {};
  
  for(var key in defaults) {
    options[key] = options.hasOwnProperty(key) ? options[key] : defaults[key];
  }

  console.log(options);
    
  for(var i in options.simples) {
    var key =  options.simples[i];
    gameData[key] = require(options.gameDataDir + '\\' + key);
  }

  for(var i in options.folders) {
    var folder = options.folders[i];
    var objects = {};
    var files = fs.readdirSync(options.gameDataDir + '\\' + folder);

    if(!gameData.hasOwnProperty(folder)) {
      gameData[folder] = {};  
    }

    for(var i in files) {
      var file = files[i];
      var key = file.substr(0,file.length-3);
      gameData[folder][key] = require(options.gameDataDir + '/' + folder + '/' + file);

      if(!gameData[folder][key].hasOwnProperty("key")) {
        gameData[folder][key].key = key;
      }
    }
  }


  for(var key in gameData.skills) {
    gameData.skills[key].key = key;

    if(!gameData.skills[key].hasOwnProperty("name")) {
      var parts = key.split("_").map(function (value) {
        return capitalizeFirstLetter(value);
      });

      gameData.skills[key].name = parts.join(" ");
    }
  }

  function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
  }

  function getTagObj(obj) {
    var path = obj.attr("path");
    return pathToObj(path);
  }

  function pathToObj(path) {
    console.log("before", path);
    path = path.replace(/(\[.*?\])/g, function(org, p1) {
      console.log("p1", p1);
      var datpath = p1.substr(1,p1.length-2);
      console.log("datpath", datpath);
      var r = pathToObj(datpath);
      console.log("r", r);
      return r;
    });
    console.log("after", path);
    var parts = path.split(".");
    var obj = gameData[parts[0]];
    var len = parts.length;

    for(var i = 1; i < len; i++) {
      if(!obj.hasOwnProperty(parts[i])) {
        return false;
      }

      obj = obj[parts[i]];
    }
    console.log("obj", obj);
    return obj;
  }

  function parsePageContent(pageContent, parseType, callback) {
    jsdom.env(
      pageContent,
      ["http://code.jquery.com/jquery.js"],
      function (err, window) {
        //console.log('window', window);
        console.log('----');
        console.log(window.document.documentElement.outerHTML);
        console.log('~~~~~~~~~~~~~~');

        var $ = window.$;

        $('if').each(function () {
          var $this = $(this);
          var obj = getTagObj($this);

          if(!obj) {
            $this.replaceWith('');
          }
          else {
            $this.replaceWith($this.html());
          }
        });

        var standardTags = ['name', 'description'];

        for(var i in standardTags) {
          var tag = standardTags[i];
          $(tag).each(function () {
            var $this = $(this);
            var gameObj = getTagObj($this);

            $this.replaceWith('<span class="' + tag + '">' + gameObj[tag] + '</span>');
          });

          $('[gamedata]').each(function () {
            var $this = $(this);
            var path = $this.attr('gamedata');
            $this.removeAttr("gamedata");
            $this.html(pathToObj(path));
          });
        }

        $('gamedata').each(function () {
          var $this = $(this);
          var gamedata = getTagObj($this);
          $this.replaceWith('<span>' + gamedata + '</span>');
        });

        if(parseType == 'web') {
          $('[aid\\:pstyle],[aid\\:cstyle]').each(function () {
            $(this).removeAttr('aid:pstyle').removeAttr('aid:cstyle');
          });
        }
        else if(parseType == 'indesign') {
          console.log("INDESIGNINDESIGNDESINGDSDEINGSDESING");
          $('[class]').each(function () {
            console.log("remove class for " + $(this).text() + ": " + $(this).attr("class"));
            $(this).removeAttr('class');
          });
        }

        $('script').each(function() {
          $(this).replaceWith('');
        });

        var parsed = $('body').html();
        console.log('----');
        console.log('parsed', parsed);
        callback(parsed);
      }
    );
  }

  function parsePageToFile(pageFile, parseType, destFile) {
    var pageContent = fs.readFileSync(options.pagesDir + '/' + pageName, 'utf8');
    parsePageContent(pageContent, parseType, function(parsedContent) {
      console.log("destFile", destFile);
      console.log("parsedContent", parsedContent);
      try {
        fs.writeFile(destFile, parsedContent, function(err, result) {
          if(err) {
            console.log(":(", err);
          }
        });
      }
      catch(ex) {
        console.error(ex);
      }
    });
  }

  //Let's go through all the pages that we can find and save them to XML and HTML files
  if(options.pagesDir) {
    var pages = fs.readdirSync(options.pagesDir);

    for(var i in pages) {
      var pageName = pages[i];
      var pageLocation = options.pageDir + '/' + pageName;
      

      console.log("pageName", pageName);

      if(options.outputWebDir) {
        var webDest = options.outputWebDir + '/' + pageName + '.html';
        parsePageToFile(pageLocation, 'web', webDest);
      }

      if(options.outputInDesignDir) {
        var inDesignDest = options.outputInDesignDir + '/' + pageName + '.xml';
        parsePageToFile(pageLocation, 'indesign', inDesignDest);
      }
    }
  }

  return {
    gameData: function () {
      return gameData;
    },
    parsePageToInDesign: function(page, callback) {
      return parsePage(page, 'indesign', callback);
    },
    parsePageToWeb: function(page, callback) {
      return pagePage(page, 'web', callback);
    }
  };
}

module.exports = factory;
