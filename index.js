var fs = require("fs");
var jquery = require("jQuery");

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

  function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
  }

  function getTagObj(obj) {
    var path = obj.attr("path");
    return pathToObj(path);
  }

  function pathToObj(path) {
    path = path.replace(/(\[.*?\])/g, function(org, p1) {
      var datpath = p1.substr(1,p1.length-2);
      var r = pathToObj(datpath);
      return r;
    });
    var parts = path.split(".");
    var obj = gameData[parts[0]];
    var len = parts.length;

    for(var i = 1; i < len; i++) {
      if(!obj.hasOwnProperty(parts[i])) {
        return false;
      }

      obj = obj[parts[i]];
    }
    return obj;
  }

  function parsePageContent(pageContent, parseType, callback) {
    var env = require('jsdom').env;
    env(pageContent, function (errors, window) {
      console.log(errors);

      var $ = require('jquery')(window);
      var standardTags = ['name', 'description'];

      $('if').each(function () {
        var $this = $(this);
        var obj = getTagObj($this);

        if(!obj) {
          $this.remove();
        }
        else {
          $this.replaceWith($this.html());
        }
      });

      for(var i in standardTags) {
        var tag = standardTags[i];
        $(tag).each(function () {
          var $this = $(this);
          var gameObj = getTagObj($this);

          console.log("tag: " + tag + ", attr: " + $this.attr("path") + " should be " + gameObj[tag]);

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
        $('[class]').each(function () {
          $(this).removeAttr('class');
        });
      }

      $('script').remove();

      var parsed = $('body').html();
      callback(parsed);
    });
    console.log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
  }

  function parsePageToFile(pageFile, parseType, destFile) {
    var pageContent = fs.readFileSync(options.pagesDir + '/' + pageName, 'utf8');
    parsePageContent(pageContent, parseType, function(parsedContent) {
      try {
        fs.writeFile(destFile, parsedContent, function(err, result) {
          if(err) {
            console.log(":(", err);
          }
          else {
            console.log(pageFile + " parsed and saved into " + destFile);
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
      var pageLocation = options.pagesDir + '/' + pageName;
      
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
