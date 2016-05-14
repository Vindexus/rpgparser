var fs = require('fs');
var jquery = require('jquery');

var factory = function(options) {
  var env = require('jsdom').env;
  var $;
  var defaults = {
    gameDataDir: '/gameData', //Where the game data is located
    pagesDir: '/page',
    templatesDir: '/templates',
    outputInDesignDir: false,
    outputWebDir: false,
    folders: [], //One file returning many objects
    simples: [], //One file returning many objects
    fileHeaders: {
      indesign: '<?xml version="1.0" encoding="UTF-8" standalone="no" ?>\n' + 
        '<Root>',
      web: ''
    },
    fileFooters: {
      indesign: '</Root>',
      web: ''
    }
  };
  var templates = {};

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

      if(!gameData[folder][key].hasOwnProperty('key')) {
        gameData[folder][key].key = key;
      }
    }
  }

  if(options.templatesDir) {
    var templates = fs.readdirSync(options.templatesDir);

    for(var i in templates) {
      var templateFilename = templates[i];
      var name = templateFilename.replace(/\.[^/.]+$/, "")
      var templateLocation = options.templatesDir + '/' + templateFilename;
      var content = fs.readFileSync(templateLocation, 'utf8');

      templates[name] = content;
      console.log('Loaded template: ' + name);
    }
  }

  function logParse(type, from, to, meta) {
    to = to == undefined ? '' : to;
    meta = meta == undefined ? '' : meta;
    to = to.length > 30 ? to.substr(0,27) + '...' : '';
    to.split("\n", ' ');
    console.log(type + '[' + from + ']' + (meta.length > 0 ? ('[' + meta + ']') : '') + ' => ' + to);
  }

  function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
  }

  function getTagPathData(obj) {
    var path = obj.attr('path');
    return pathToData(path);
  }

  function getTagPathParsed(obj, parseType) {
    return parseRPGText(getTagPathData(obj), parseType);
  }

  function pathToParsed(path, parseType) {
    return parseRPGText(pathToData(path), parseType);
  }

  function pathToData(path) {
    path = path.replace(/(\[.*?\])/g, function(org, p1) {
      var datpath = p1.substr(1,p1.length-2);
      var r = pathToData(datpath);
      return r;
    });
    var parts = path.split('.');
    var data = gameData[parts[0]];
    var len = parts.length;

    if(data == undefined) {
      console.error('Couldn\'t find data for path: ' + path)
    }

    for(var i = 1; i < len; i++) {
      if(!data.hasOwnProperty(parts[i])) {
        return false;
      }

      data = data[parts[i]];
    }
    return data;
  }

  var manipulators = 0;
  function getManipulater(content) {
    var id = 'manipulator-' + manipulators;

    manipulators++;

    $('<div id="' + id + '""></div>').appendTo('body');
    var manipulator = $('#' + id);
    manipulator.html(content);

    return manipulator;
  }

  function parseRPGText(rpgtext, parseType) {
    var m = getManipulater(rpgtext);

    var standardTags = ['name', 'description'];

    m.find('if').each(function () {
      var $this = $(this);
      var obj = getTagPathParsed($this);

      if(!obj) {
        //logParse('if', $this.attr('path'), '', false);
        $this.remove();
      }
      else {
        //logParse('if', $this.attr('path'), $this.html(), true);
        $this.replaceWith($this.html());
      }
    });
    
    m.find('loop').each(function () {
      var $this = $(this);
      var items = pathToData($this.attr('items'));
      var parsedItems = [];
      var rawItemText = $this.html();

      console.log('Looping through ' + $this.attr('items'));

      for(var i in items) {
        var unparsed = $this.html();
        unparsed = unparsed.split('{{item}}').join(items[i]);
        parsedItems.push(parseRPGText(unparsed));
      }     

      console.log('DONE LOOPING');

      $this.replaceWith(parsedItems.join($this.attr('glue')));
    });

    m.find('template').each(function () {
      var $this = $(this);
      var type = $this.attr('type');

      if(!templates.hasOwnProperty(type)) {
        console.error('Template type not found: ' + type);
        return;
      }

      var templateText = templates[type];

      var attributes = [];
      var meta = [];
      $.each($this[0].attributes, function(index, attr) {
        if(attr.name != 'type') {
          attributes[attr.name] = attr.value;
          meta.push('{' + attr.name + ': "' + attr.value + '"}')
        }
      });

      for(var key in attributes) {
        var val = attributes[key];
        templateText = templateText.split('{{' + key + '}}').join(val);
      }

      var parsed = parseRPGText(templateText);

      logParse('template', type, parsed, meta.join(","));

      //console.log('template[' + type + '][' + attributes.join(',') + '] => ' + parsed);

      $this.replaceWith(parsed);
    });

    for(var i in standardTags) {
      var tag = standardTags[i];
      m.find(tag).each(function () {
        var $this = $(this);
        var gameObj = getTagPathData($this);
        var parsed = parseRPGText(gameObj[tag], parseType);

        //logParse(tag, $this.attr('path'), parsed);
        $this.replaceWith('<span class="' + tag + '">' + parsed + '</span>');
      });

      m.find('[gamedata]').each(function () {
        var $this = $(this);
        var path = $this.attr('gamedata');
        var parsed = pathToParsed(path);
        //logParse('gamedata', $this.attr('gamedata'), parsed, 'attr');
        $this.removeAttr('gamedata');
        $this.html(parsed);
      });
    }

    m.find('gamedata').each(function () {
      var $this = $(this);
      var parsed = getTagPathParsed($this);
      $this.replaceWith('<span>' + parsed + '</span>');
      //logParse('gamedata', $this.attr('path'), parsed, 'element');
    });

    if(parseType == 'web') {
      m.find('[aid\\:pstyle],[aid\\:cstyle]').each(function () {
        $(this).removeAttr('aid:pstyle').removeAttr('aid:cstyle');
      });
    }
    else if(parseType == 'indesign') {
      m.find('[class]').each(function () {
        $(this).removeAttr('class');
      });
    }

    m.find('script').remove();

    var parsed = m.html();
    return parsed;
  }

  function parsePageToFile(pageFile, parseType, destFile) {
    var pageContent = fs.readFileSync(pageFile, 'utf8');
    var parsedText = parseRPGText(pageContent, parseType);
    var newContent = options.fileHeaders[parseType] + parsedText + options.fileFooters[parseType];
    try {
      fs.writeFile(destFile, newContent, function(err, result) {
        if(err) {
          console.log(':(', err);
        }
        else {
          console.log(pageFile + ' parsed and saved into ' + destFile);
        }
      });
    }
    catch(ex) {
      console.error(ex);
    }
  }

  env('', function(errors, window) {
    $ = require('jquery')(window);
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
  });

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
