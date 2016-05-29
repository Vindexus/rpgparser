var fs = require('fs');
var jquery = require('jquery');
var pluralize = require('pluralize');
var Mustache = require('mustache');

var factory = function(options, callback) {
  var env = require('jsdom').env;
  var $;
  var gameData = {};
  var templates = {};
  
  var defaults = {
    gameDataDir: '/gameData', //Where the game data is located
    pagesDir: '/pages',
    templatesDir: false,
    outputInDesignDir: false,
    outputWebDir: false,
    folders: [], //One file returning many objects
    simples: [], //One file returning many objects
    fileHeaders: {
      indesign: '<?xml version="1.0" encoding="UTF-8" standalone="no" ?>\n',
      web: ''
    },
    fileFooters: {
      indesign: '',
      web: ''
    },
    classesToPstyle: {
    },
    classToXml: {

    },
    blank: '__________'
  };

  //Extra parsing based on parsing type
  //web, indesign, etc
  var typeParsers = {
    web: function(text) {
      var m = getManipulater(text);
      m.find('[aid\\:pstyle],[aid\\:cstyle]').each(function () {
        $(this).removeAttr('aid:pstyle').removeAttr('aid:cstyle');
      });
      return m.html();
    },
    indesign: function(text) {
      var m = getManipulater(text);
      m.find('br').remove();
      m.find('[class]').each(function () {
        var classStr = this.className;

        console.log('CLASS', classStr);

        if(options.classToXml.hasOwnProperty(classStr)) {
          console.log('replace this class ' + classStr + ' with' + options.classToXml[classStr]);
          var tag = options.classToXml[classStr];

          if(tag == true) {
            tag = classStr;
          }

          return $(this).replaceWith('<' + tag + '>' + $(this).html() + '</' + tag + '>');
        }        

        var classes = this.className.split(/\s+/);

        for(var i in classes) {
          var c = classes[i];
          if(options.classesToPstyle.hasOwnProperty(c)) {
            $(this).attr('aid:pstyle', options.classesToPstyle[c]);
          }
        }

        $(this).removeAttr('class');
      });

      return m.html();
    }
  }

  for(var key in defaults) {
    options[key] = options.hasOwnProperty(key) ? options[key] : defaults[key];
  }

  env('', function(errors, window) {
    $ = require('jquery')(window);


    $.fn.mapAttributes = function(prefix) {
      var maps = [];
      $(this).each(function() {
        var map = {};
        for(var key in this.attributes) {
          if(!isNaN(key)) {
            if(!prefix || this.attributes[key].name.substr(0,prefix.length) == prefix) {
              map[this.attributes[key].name] = this.attributes[key].value;
            }
          }
        }
        maps.push(map);
      });
      return (maps.length > 1 ? maps : maps[0]);
    }

    loadGameData();
    loadTemplates();
    callback();
  });

  function _parsePagesTo (toOpts) {
    var defaults = {
      type: 'web',
      extension: 'html'
    }

    for(var i in defaults) {
      toOpts[i] = toOpts.hasOwnProperty(i) ? toOpts[i] : defaults[i];
    }

    //Let's go through all the pages that we can find and save them to XML and HTML files
    if(options.pagesDir) {
      var pages = fs.readdirSync(options.pagesDir);

      for(var i in pages) {
        var pageName = pages[i];

        //Skip the _ ones
        if(pageName.substr(0,1) == '_') {
          continue;
        }

        var pageNoExt = pageName.replace(/\.[^/.]+$/, "")
        var pageLocation = options.pagesDir + '/' + pageName;
        
        var dest = toOpts.to + '/' + pageNoExt + '.' + toOpts.extension;
        parsePageToFile(pageLocation, dest, toOpts);

      }
    }    
  };

  loadGameData = function () {
    for(var i in options.simples) {
      var key =  options.simples[i];
      console.log('Loading simple: ' + key);
      gameData[key] = require(options.gameDataDir + '\\' + key);
      console.log('gamedata[' + key + ']', gameData[key]);
    }

    for(var i in options.folders) {
      var folder = options.folders[i];
      console.log('Loading folder: ' + folder);
      var objects = {};
      var files = fs.readdirSync(options.gameDataDir + '\\' + folder);

      if(!gameData.hasOwnProperty(folder)) {
        gameData[folder] = {};  
      }

      for(var i in files) {
        var file = files[i];
        console.log('Loading folder file: ' + folder + '/' + file)
        var key = file.substr(0,file.length-3);
        var path = options.gameDataDir + '/' + folder + '/' + file;

        gameData[folder][key] = require(path);

        if(typeof(gameData[folder][key]) == 'string') {
          gameData[folder][key] = {
            description: gameData[folder][key]
          }
        }

        //A file at moves/super_strike.js will have a key of super_strike unless you specify your own
        if(!gameData[folder][key].hasOwnProperty('key')) {
          gameData[folder][key].key = key;
        }

        //A file at moves/super_strike.js will have the .name property of Super Strike if you don't provide one
        //You should override for punctation. vipers_strike.js might have {name: 'Viper\'s Strike'} to add the apostrophe
        if(!gameData[folder][key].hasOwnProperty('name')) {
          gameData[folder][key].name = key.split('_').map(function (str) {
            return capitalizeFirstLetter(str)
          }).join(' ');
        }
      }
    }
  }
  
  loadTemplates = function () {
    templates = {};
    if(options.templatesDir) {
      var templateFiles = fs.readdirSync(options.templatesDir);

      for(var i in templateFiles) {
        var templateFilename = templateFiles[i];
        var name = templateFilename.replace(/\.[^/.]+$/, "")
        var templateLocation = options.templatesDir + '/' + templateFilename;
        var content = fs.readFileSync(templateLocation, 'utf8');

        templates[name] = content;
        console.log('Loaded template: ' + name);
      }
    }
    else {
      console.log('No template folder specified.')
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

  function parsePathSubPath(path) {
    return path.replace(/(\[.*?\])/g, function(org, p1) {
      var datpath = p1.substr(1,p1.length-2);
      console.log('datpath', datpath);
      var r = pathToData(datpath);

      if(!r) {
        console.error('Coulnt find data for path "' + datpath + '" inside relative path ' + path);
      }

      return r;
    });
  }

  function getElPath(el) {
    var path = el.attr('path');

    if(!path) {
      if(el.attr('gamedata')) {
        return el.attr('gamedata');
      }

      var atts = el.mapAttributes();
      $.each(atts, function(name, value) {
        name = pluralize(name);
        if(gameData.hasOwnProperty(name)) {
          console.log('found ' + name + ' in gameData');
          path = name + '.' + value;
          return path;
        }
        else if(value.indexOf('[') >= 0) {
          console.log('found [, assuming this is a relative path: ' + value);
          path = name + '.' + parsePathSubPath(value)

          console.log('relative path after', path);

          return path;
        }
        console.log('no path found for attr ' + name + '=' + value)
      });
    }

    return parsePathSubPath(path);
  }

  function getElData(el) {
    var path = getElPath(el);
    var data = pathToData(path);

    if(!!data) {
      return data;
    }

    el.replaceWith('ERROR LOADING: "' + path + '"');
    return false;
  }

  function getElPathParsed(el, opts) {
    return pathToParsed(getElPath(el), opts);
  }

  function pathToParsed(path, opts) {
    var data = pathToData(path);

    if(data == undefined) {
      return '<span class="error">ERROR LOADING PATH: ' + path + '</span>';
    }

    return parseRPGText(data, opts);
  }

  function pathToData(path) {
    var parts = path.split('.');
    var data = gameData[parts[0]];
    var len = parts.length;

    if(data == undefined) {
      console.error('Couldn\'t find data for path: ' + path[0])
      return false;
    }

    for(var i = 1; i < len; i++) {
      if(!data.hasOwnProperty(parts[i])) {
        console.error('Couldn\'t find data after going ' + i + ' deep into the parts ' + parts[i]);
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

  function parseRPGText(rpgtext, opts) {
    var m = getManipulater(rpgtext);
    var standardTags = ['name', 'description']; //TODO: put these into the options

    m.find('if').each(function (index) {
      if(index == 0) {
        console.log('++DOING IFS++ (' + m.find('if').length + ' found)');
      }
      var $this = $(this);
      var obj = getElPathParsed($this, opts);

      if(!obj) {
        logParse('if', $this.attr('path'), '', 'false');
        $this.remove();
      }
      else {
        logParse('if', $this.attr('path'), $this.html(), 'true');
        $this.replaceWith($this.html());
      }
    });
    
    m.find('loop').each(function (index) {
      if(index == 0) {
        console.log('++DOING LOOPS++ (' + m.find('loop').length + ' found)');
      }

      var $this = $(this);
      var $items = $this.attr('items');
      var items = $items.indexOf(',') >= 0 ? $items.split(',') : pathToData($items); //Items is either a comma delimited list of strings, or a path to an array

      var parsedItems = [];
      var rawItemText = $this.html();

      for(var i in items) {
        var unparsed = $this.html();
        var item = items[i];
        console.log("item", items[i]);
        if(typeof(item) == 'string') {
          unparsed = unparsed.split('__item__').join(item);
        }
        else {
          for(var k in item) {
            unparsed = unparsed.split('__item.' + k + '__').join(item[k]);
          }
        }
        parsedItems.push(parseRPGText(unparsed, opts));
      }     

      var glue = $this.attr('glue') ? $this.attr('glue') : '';

      if(glue == '\\n') {
        glue = "\n";
      }

      $this.replaceWith(parsedItems.join(glue));
    });

    m.find('template').each(function (index) {
      if(index == 0) {
        console.log('++DOING TEMPLATES++ (' + m.find('template').length + ' found)');
      }

      var $this = $(this);
      var type = $this.attr('type');

      if(!templates.hasOwnProperty(type)) {
        console.error('Template type not found: ' + type);
        return;
      }

      var templateText = templates[type];

      var templateVars = [];
      var meta = [];
      $.each($this[0].attributes, function(index, attr) {
        if(attr.name != 'type') {
          templateVars[attr.name] = attr.value;
          meta.push('{' + attr.name + ': "' + attr.value + '"}')
        }
      });

      console.log('templateVariables', templateVars);

      for(var key in templateVars) {
        var val = templateVars[key];
        templateText = templateText.split('__' + key + '__').join(val);
      }

      var parsed = parseRPGText(templateText, opts);

      logParse('template', type, parsed, meta.join(","));

      //console.log('template[' + type + '][' + attributes.join(',') + '] => ' + parsed);

      $this.replaceWith(parsed);
    });

    for(var i in standardTags) {
      var tag = standardTags[i];
      m.find(tag).each(function (index) {
        if(index == 0) {
          console.log('++DOING STANDARD ' + tag + '++ (' + m.find(tag).length + ' found)');
        }
        var $this = $(this);
        var gameObj = getElData($this);

        if(!gameObj) {
          return;
        }

        var parsed = parseRPGText(gameObj[tag], opts);

        logParse(tag, $this.attr('path'), parsed);
        $this.replaceWith(parsed);
      });    
    }

    m.find('[gamedata]').each(function (index) {
      if(index == 0) {
        console.log('++DOING GAMEDATA TAGS++ (' + m.find('[gamedata]').length + ' found)');
      }
      var $this = $(this);
      var parsed = getElData($this);
      logParse('gamedata', $this.attr('gamedata'), parsed, 'attr');
      $this.removeAttr('gamedata');
      $this.html(parsed);
    });


    m.find('gamedata').each(function () {
      console.log('++DOING GAMEDATA ELEMENTS++ (' + m.find('gamedata').length + ' found)');
      var $this = $(this);
      var parsed = getElPathParsed($this, opts);
      $this.replaceWith(parsed);
      logParse('gamedata', $this.attr('path'), parsed, 'element');
    });

    m.find('blank').replaceWith(options.blank);

    m.find('script').remove();

    if(opts.type) {
      var qry = '[only-for][only-for!="' + opts.type + '"]';
      console.log('qry', qry);
      m.find(qry).remove();
    }

    var parsed = m.html();

    //This should be how you put in a lot of your data
    //The jquery selector stuff above is legacy that I'm too lazy to completely remove because it works
    //But the mustache stuff should eventually take over
    parsed = mustacheText(parsed);

    return parsed;
  }

  function mustacheText(text) {
    return Mustache.render(text, gameData);
  }

  function parsePageToFile(pageFile, destFile, opts) {
    var pageContent = fs.readFileSync(pageFile, 'utf8');
    var parsedText = parseRPGText(pageContent, opts);

    if(typeof typeParsers[opts.type] == 'function') {
      console.log('do extra parsing');
      parsedText = typeParsers[opts.type](parsedText);
    }

    var newContent = options.fileHeaders[opts.type] + parsedText + options.fileFooters[opts.type];
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

  return {
    parsePagesTo: function (opts) {
      return _parsePagesTo(opts);
    }
  };
}

module.exports = factory;