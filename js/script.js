$(function() {
  var value,
      trigger = 0,
      testy = new Testy();

  testy.init();

  $('#source').on('keydown', function() {
    value = $(this).val();
    var current = ++trigger;
    setTimeout(function() {
      if (value == $('#source').val() || trigger != current)
        return;

      testy.parse($('#source').val());
    }, 90);
  });

  $('#time').on('change', function() {
    testy.timer.offset($(this).val());
    testy.timer.display();
  });

  $('#check').on('click', function() {
    var $this = $(this),
        correct = 0,
        count = 0,
        $questions = $('#question input, #question select');

    $questions.each(function() {
      count++;

      if ($(this).data('answer') != $(this).val()) {
        $(this).css({'border-bottom-color': '#f00', 'color': '#f00'});
      } else {
        correct++;
      }

      $(this).attr('disabled', true);
      $(this).blur();
    });

    $this.attr('disabled', true);
    $this.text((Math.floor((correct / count) * 100) || 0) + '%');

    setTimeout(function() {
      $this.attr('disabled', false).text('Check Answers');
      $questions.attr('disabled', false);
    }, 2000);
  });

  $('#question input, #question select').live({
    'focus keydown': function() {
      $(this).css({'border-bottom-color': '', 'color': ''});
    },

    'keydown': function(key) {
      var $this = $(this), found = false, $inputs = $('#question').find('input, select');

      if (key.which == 32 || /^\s/.test($this.val()))
        setTimeout(function() { $this.val($this.val().replace(/^\s+/, '')); }, 1);
      console.log(key);
      if (key.which != 13 && !(key.which == 32 && $this.val().length == +$this.attr('maxlength')))
        return;

      $inputs.each(function() {
        if (found) {
          var that = $(this);
          that.focus();
          setTimeout(function() { that.val(that.val().replace(/^\s+/, '')); }, 1);
          return false;
        }

        if (!found)
          found = $this.is(this);
      });

      if ($this.is($inputs.last()))
        $('#check').trigger('click');
    }
  });

  $('#toolbar .text').click(function() {
    var $source = $('#source'), $selection = $source.selection();

    if ($selection === '') {
      $source.focus();
      return;
    }

    selection = ('[' + $selection
                 .replace(/\[([^\[\]]*)\]|^\[|\]$/g, '$1')
                 .replace(/((?:[^\w\s]+\s*)+)/g, ']$1[') + ']')
                 .replace(/\[\]|^(\[)(\s+)|(\s+)(\])$/g, '$2$1$4$3');

    if (/^\[.*\]$/.test($selection) || selection == $selection) {
      $source.selection(selection.replace(/\[([^\[\]]*)\]|^\[|\]$/g, '$1'));
    } else {
      $source.selection(selection);
    }

    testy.parse($source.val());

    setTimeout(function() { $source.focus(); }, 0);
  });

  testy.parse($('#source').focus().val());
});

function Testy() {
  var my, words = 0, replace = {
    // word count - for the timer
    '[\\s,]+': function(m) {
      words += 1;
      return m;
    },

    // escapes
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',

    // force double-space
    '([?.!]"?)[ \\t]+': '$1&nbsp;&nbsp;',

    // real em-dash
    '--': '&mdash;',

    // real quotes
    '(^|\\s)"|\u0093|\u201c': '$1&#147;',
    '"|\u0094|\u201d': '&#148;',
    "'": '&#146;',

    // reserved characters
    '([\\[\\]{}=^]|&[lg]t;)\\1': function(m) {
      m = m.replace(/&lt;/g, '<').replace(/&gt;/g, '>');
      return '&#' + m.charCodeAt(0) + ';';
    },

    // markdown-like syntax
    '(\\n\\r|\\r\\n|\\n|\\r)': '<br>',
    '((?:^|<br>)(?:&nbsp;|\\s)*)=([^=}]+)=': '$1<h4>$2</h4>',
    '\\^(([^^<]|<[^b])+)\\^': '<sup>$1</sup>',
    '\\b_(([^_<]|<[^b])+)_\\b': '<em>$1</em>',

    // images
    '{([^{}]+\\.png)}': '<img src="/img/16x16/$1">',

    // sounds
    '{([$-])*([^{}]+\\.wav)}': function(m, flags, src) {
      var autoplay = /\$/.test(flags),
          controls = !/\-/.test(flags);

      src = src.replace(/([^a-z0-9.]|\.{2,})+/g, '_');

      return '<audio src="' + src + '"></audio>';
    },

    // videos
    '{(?:[^}]+[/=])?([a-zA-Z0-9_-]{11})([#&][^}]*)?}': function(m, video) {
      return 'YT:' + video;
    },

    // math
    '&lt;((?:[^&]|&[^lg][^t])*)&gt;': function(m, expr) {
      var e, result;

      // strip whitespace
      expr = expr.replace(/\s+/g, '');

      // parse ranges
      expr = expr.replace(/(\d+)\.\.(\d+)/g, function(n, mi, mx) {
        var min = Math.min(mi, mx),
            max = Math.max(mi, mx);

        return Math.floor(min + (Math.random() * ((max + 1) - min)));
      });

      // pretty printing
      expr = expr.replace(/([()\^*\/+\-])([+\-](?:\d|\.))?/g, ' $1 $2');

      // error checking
      if (/\.\./.test(expr))
        return '<span style="color:#f00">' + expr + '</span>';

      try {
        var x, evil = eval;
        // zap inputs down to their answer
        x = expr.replace(/\[([^\[\],]+)[^\[\]]*\]/g, '$1');

        // make sure it smells like math, then eval it to the result
        result = +evil(x.match(/(-?\d+(\.\d+)?\s*[+\-\/*]?\s*([()]\s*)*)+/)[0]).toFixed(2);
      } catch(e) {
        return '<span style="color:#f00">' + expr + '</span>';
      }

      // if we have no inputs, turn the result into an input
      if (!/\[|\]/.test(expr))
        result = '[' + result + ']';

      // return the expression and result
      return expr + ' = ' + result;
    },

    // text
    '\\[([^[\\]]*)\\]': function(m, n) {
      var i,
          out    = '<option value="" disabled>Choose</option>',
          value  = [],
          token  = n.replace(/\s+/g, ' ').split(','),
          answer = token[0].replace(/^\s+|\s+$/, '');

      if (token.length == 1) {
        value = answer.split(' ');
        out = '';

        for (i=0; i<value.length; i++)
          out += '<input type="text" data-answer="' + value[i] + '" maxlength="' + value[i].length + '">';

        words += value.length * 2;
        return out.replace(/></g, '> <');
      }

      while (token.length)
        value.push(token.splice(Math.floor(Math.random() * token.length), 1)[0].replace(/^\s+|\s+$/, ''));

      for (i=0; i<value.length; i++) {
        if (value[i] !== '')
          out += '<option value="' + value[i] + '">' + value[i] + '</option>';
      }

      words += value.length * 2;
      return '<select data-answer="' + answer + '">' + out + '</select>';
    },

    // make punctuation wrap with certain elements
    '((?:[^\\s<>;]|&#\\d+;)+(?:<(inp|img)[^>]+>|<sel.+?ect>)|(?:<(inp|img)[^>]+>|<sel.+?ect>)(?:[^\\s<>&]|&#\\d+;)+)': '<span>$1</span>'
  };

  my = {
    init: function(e) {
      var f = function($) { return (e && e[$] && e[$].jquery) ? e[$] : undefined; };

      my.question.element = f('question') || $('#question');
      my.lesson.element   = f('lesson')   || $('#lesson');
      my.timer.element    = f('timer')    || $('#timer');

      my.timer.offset     = f('offset')   || 0;
    },

    lesson: {
      element: undefined
    },

    timer: {
      element: undefined,
      interval: undefined,

      initial: 0,
      time: 0,
      offset: 0,

      display: function() {
        var time = (my.timer.initial + my.timer.offset) - my.timer.time;

        prefix = '';
        my.timer.element.css('color', '#f00');

        if (time > 0)
          my.timer.element.css('color', '');

        if (time < 0) {
          time = -time;
          prefix = '-';
        }

        minutes = Math.floor(time / 60);
        seconds = ('00' + (time % 60)).substr(-2);
        my.timer.element.html(prefix + minutes + ':' + seconds);
      },

      start: function() {
        if (my.timer.interval) {
          clearInterval(my.timer.interval);
          my.timer.interval = undefined;
        }

        my.timer.interval = setInterval(function() {
          my.timer.time++;
          my.timer.display();
        }, 1000);
      },

      stop: function() {
        if (!my.timer.interval)
          return;

        clearInterval(my.timer.interval);
        my.timer.interval = undefined;
      },

      reset: function() {
        my.timer.stop();
        my.timer.time = 0;
      },

      set: function(time) {
        my.timer.initial = parseInt(time, 10);
        my.timer.display();
      }
    },

    parse: function(source) {
      var $magic = $('<span class="magic"/>');

      words = 0;

      Object.keys(replace).forEach(function(r) {
        source = source.replace(new RegExp(r, 'g'), replace[r]);
      });

      my.timer.set(20 + Math.floor(words / 75 * 60));

      my.question.element.html(source);

      $magic.appendTo(my.lesson.element);

      $('input', my.question.element).each(function() {
        var $this = $(this);

        $magic.text($this.data('answer'));

        $this.css('width', (parseInt($magic.css('width'), 10) + 10) + 'px');
      });

      $magic.remove();
    },

    question: {
      element: undefined,

      check: function() {
      }
    }
  };

  this.init = my.init;

  this.timer = {
    start: my.timer.start,
    stop: my.timer.stop,
    reset: my.timer.reset,
    set: my.timer.set,
    offset: function(offset) {
      my.timer.offset = parseInt(offset, 10) || 0;
      my.timer.display();
    }
  };

  this.parse = my.parse;

  this.question = {
    check: my.question.check
  };
}

/*
* jQuery text selection plugin
*
* Copyright (c) 2011 rummik
* Provided in the Public Domain (or under the WTFPL, at your choice)
*
* Author: rummik <k@9k1.us> (http://www.rummik.com/)
* Version: 0.1.1
*/

(function($) {
  var selection = {
    getIndex: function(elem) {
      var start, end;

      if (!elem)
        return undefined;

      if ('selectionStart' in elem) {
        start = elem.selectionStart;
        end   = elem.selectionEnd;
      } else {
        return undefined;
      }

      start = Math.min(start, end);
      end   = Math.max(start, end);

      return {start: start, end: end};
    },

    setIndex: function(elem, start, end) {
      if (!elem)
        return undefined;

      start = Math.min(start, end);
      end   = Math.max(start, end);

      if ('selectionStart' in elem) {
        elem.selectionStart = start;
        elem.selectionEnd   = end;
      }
    }
  };

  $.fn.selection = function(text) {
    var sel, elem = this[0];

    if (!arguments.length) {
      if ((sel = selection.getIndex(elem)) !== undefined)
        return $(elem).val().substr(sel.start, sel.end - sel.start);
      else
        return '';
    }

    return this.each(function() {
      if ((sel = selection.getIndex(this)) !== undefined) {
        $(this).val($(this).val().substr(0, sel.start) + text + $(this).val().substr(sel.end));
        selection.setIndex(this, sel.start, text.length + sel.start);
      }
    });
  };
})(jQuery);
