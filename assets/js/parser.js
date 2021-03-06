var App = App || {};
/* Jison generated parser */
App.parser = (function(){
var parser = {trace: function trace() { },
yy: {},
symbols_: {"error":2,"expressions":3,"predsentence":4,"EOF":5,"propsentence":6,"\u00AC":7,"\u2227":8,"\u2228":9,"\u2192":10,"\u2194":11,"(":12,")":13,"Variable":14,"\u22A5":15,"\u22A4":16,"\u2203":17,"\u2200":18,"Predicate":19,"listofterms":20,"term":21,",":22,"Constant":23,"$accept":0,"$end":1},
terminals_: {2:"error",5:"EOF",7:"\u00AC",8:"\u2227",9:"\u2228",10:"\u2192",11:"\u2194",12:"(",13:")",14:"Variable",15:"\u22A5",16:"\u22A4",17:"\u2203",18:"\u2200",19:"Predicate",22:",",23:"Constant"},
productions_: [0,[3,2],[3,2],[6,2],[6,3],[6,3],[6,3],[6,3],[6,3],[6,1],[6,1],[6,1],[4,2],[4,3],[4,3],[4,3],[4,3],[4,3],[4,3],[4,3],[4,3],[4,3],[4,3],[20,1],[20,3],[21,1],[21,1],[21,1],[21,1]],
performAction: function anonymous(yytext,yyleng,yylineno,yy,yystate,$$,_$) {

var $0 = $$.length - 1;
switch (yystate) {
case 1:return $$[$0-1];
break;
case 2:return $$[$0-1];
break;
case 3:this.$ = new App.NegationNode({right: $$[$0]});
break;
case 4:this.$ = new App.AndNode({ left: $$[$0-2], right: $$[$0]});
break;
case 5:this.$ = new App.OrNode({ left: $$[$0-2], right: $$[$0]});
break;
case 6:this.$ = new App.ImplyNode({ left: $$[$0-2], right: $$[$0]});
break;
case 7:this.$ = new App.DimplyNode({ left: $$[$0-2], right: $$[$0]});
break;
case 8:this.$ = $$[$0-1];
break;
case 9:this.$ = new App.Node({ symbol: String(yytext) });
break;
case 10:this.$ = new App.Contradiction();
break;
case 11:this.$ = new App.Tautology();
break;
case 12:this.$ = new App.NegationNode({right: $$[$0]});
break;
case 13:this.$ = new App.AndNode({ left: $$[$0-2], right: $$[$0]});
break;
case 14:this.$ = new App.OrNode({ left: $$[$0-2], right: $$[$0]});
break;
case 15:this.$ = new App.ImplyNode({ left: $$[$0-2], right: $$[$0]});
break;
case 16:this.$ = new App.DimplyNode({ left: $$[$0-2], right: $$[$0]});
break;
case 17:this.$ = $$[$0-1];
break;
case 18:this.$ = new App.ExistensialQuantifier({ variable: $$[$0-1], right : $$[$0] });
break;
case 19:this.$ = new App.UniversalQuantifier({ variable: $$[$0-1], right : $$[$0] });
break;
case 20:this.$ = new App.ExistensialQuantifier({ variable: $$[$0-1], right : $$[$0] });
break;
case 21:this.$ = new App.UniversalQuantifier({ variable: $$[$0-1], right : $$[$0] });
break;
case 22:this.$ = new App.Predicate({ terms  : $$[$0-1], symbol : $$[$0-2].substr(0, $$[$0-2].length - 1) });
break;
case 23:this.$ = [$$[$0]]; 
break;
case 24:  $$[$0-2].push($$[$0]);
           this.$ = $$[$0-2]; 
break;
case 25:this.$ = new App.Tautology(); 
break;
case 26:this.$ = new App.Contradiction();
break;
case 27:this.$ = new App.Constant({ symbol : String(yytext) });
break;
case 28:this.$ = new App.Node({ symbol : String(yytext) });
break;
}
},
table: [{3:1,4:2,6:3,7:[1,4],12:[1,5],14:[1,9],15:[1,10],16:[1,11],17:[1,6],18:[1,7],19:[1,8]},{1:[3]},{5:[1,12],8:[1,13],9:[1,14],10:[1,15],11:[1,16]},{5:[1,17],8:[1,18],9:[1,19],10:[1,20],11:[1,21]},{4:22,6:23,7:[1,4],12:[1,5],14:[1,9],15:[1,10],16:[1,11],17:[1,6],18:[1,7],19:[1,8]},{4:24,6:25,7:[1,4],12:[1,5],14:[1,9],15:[1,10],16:[1,11],17:[1,6],18:[1,7],19:[1,8]},{14:[1,26]},{14:[1,27]},{14:[1,33],15:[1,31],16:[1,30],20:28,21:29,23:[1,32]},{5:[2,9],8:[2,9],9:[2,9],10:[2,9],11:[2,9],13:[2,9]},{5:[2,10],8:[2,10],9:[2,10],10:[2,10],11:[2,10],13:[2,10]},{5:[2,11],8:[2,11],9:[2,11],10:[2,11],11:[2,11],13:[2,11]},{1:[2,1]},{4:34,7:[1,35],12:[1,36],17:[1,6],18:[1,7],19:[1,8]},{4:37,7:[1,35],12:[1,36],17:[1,6],18:[1,7],19:[1,8]},{4:38,7:[1,35],12:[1,36],17:[1,6],18:[1,7],19:[1,8]},{4:39,7:[1,35],12:[1,36],17:[1,6],18:[1,7],19:[1,8]},{1:[2,2]},{6:40,7:[1,41],12:[1,42],14:[1,9],15:[1,10],16:[1,11]},{6:43,7:[1,41],12:[1,42],14:[1,9],15:[1,10],16:[1,11]},{6:44,7:[1,41],12:[1,42],14:[1,9],15:[1,10],16:[1,11]},{6:45,7:[1,41],12:[1,42],14:[1,9],15:[1,10],16:[1,11]},{5:[2,12],8:[2,12],9:[2,12],10:[2,12],11:[2,12],13:[2,12]},{5:[2,3],8:[2,3],9:[2,3],10:[2,3],11:[2,3],13:[2,3]},{8:[1,13],9:[1,14],10:[1,15],11:[1,16],13:[1,46]},{8:[1,18],9:[1,19],10:[1,20],11:[1,21],13:[1,47]},{4:48,6:49,7:[1,4],12:[1,5],14:[1,9],15:[1,10],16:[1,11],17:[1,6],18:[1,7],19:[1,8]},{4:50,6:51,7:[1,4],12:[1,5],14:[1,9],15:[1,10],16:[1,11],17:[1,6],18:[1,7],19:[1,8]},{13:[1,52],22:[1,53]},{13:[2,23],22:[2,23]},{13:[2,25],22:[2,25]},{13:[2,26],22:[2,26]},{13:[2,27],22:[2,27]},{13:[2,28],22:[2,28]},{5:[2,13],8:[2,13],9:[2,13],10:[2,13],11:[2,13],13:[2,13]},{4:22,7:[1,35],12:[1,36],17:[1,6],18:[1,7],19:[1,8]},{4:24,7:[1,35],12:[1,36],17:[1,6],18:[1,7],19:[1,8]},{5:[2,14],8:[1,13],9:[2,14],10:[2,14],11:[2,14],13:[2,14]},{5:[2,15],8:[1,13],9:[1,14],10:[2,15],11:[2,15],13:[2,15]},{5:[2,16],8:[1,13],9:[1,14],10:[1,15],11:[2,16],13:[2,16]},{5:[2,4],8:[2,4],9:[2,4],10:[2,4],11:[2,4],13:[2,4]},{6:23,7:[1,41],12:[1,42],14:[1,9],15:[1,10],16:[1,11]},{6:25,7:[1,41],12:[1,42],14:[1,9],15:[1,10],16:[1,11]},{5:[2,5],8:[1,18],9:[2,5],10:[2,5],11:[2,5],13:[2,5]},{5:[2,6],8:[1,18],9:[1,19],10:[2,6],11:[2,6],13:[2,6]},{5:[2,7],8:[1,18],9:[1,19],10:[1,20],11:[2,7],13:[2,7]},{5:[2,17],8:[2,17],9:[2,17],10:[2,17],11:[2,17],13:[2,17]},{5:[2,8],8:[2,8],9:[2,8],10:[2,8],11:[2,8],13:[2,8]},{5:[2,18],8:[2,18],9:[2,18],10:[2,18],11:[2,18],13:[2,18]},{5:[2,20],8:[2,20],9:[2,20],10:[2,20],11:[2,20],13:[2,20]},{5:[2,19],8:[2,19],9:[2,19],10:[2,19],11:[2,19],13:[2,19]},{5:[2,21],8:[2,21],9:[2,21],10:[2,21],11:[2,21],13:[2,21]},{5:[2,22],8:[2,22],9:[2,22],10:[2,22],11:[2,22],13:[2,22]},{14:[1,33],15:[1,31],16:[1,30],21:54,23:[1,32]},{13:[2,24],22:[2,24]}],
defaultActions: {12:[2,1],17:[2,2]},
parseError: function parseError(str, hash) {
    throw { message: str, charPosition: hash.charPosition };
},
parse: function parse(input) {
    var self = this,
        stack = [0],
        vstack = [null], // semantic value stack
        lstack = [], // location stack
        table = this.table,
        yytext = '',
        yylineno = 0,
        yyleng = 0,
        recovering = 0,
        TERROR = 2,
        EOF = 1;

    //this.reductionCount = this.shiftCount = 0;

    this.lexer.setInput(input);
    this.lexer.yy = this.yy;
    this.yy.lexer = this.lexer;
    this.yy.parser = this;
    if (typeof this.lexer.yylloc == 'undefined')
        this.lexer.yylloc = {};
    var yyloc = this.lexer.yylloc;
    lstack.push(yyloc);

    var ranges = this.lexer.options && this.lexer.options.ranges;

    if (typeof this.yy.parseError === 'function')
        this.parseError = this.yy.parseError;

    function popStack (n) {
        stack.length = stack.length - 2*n;
        vstack.length = vstack.length - n;
        lstack.length = lstack.length - n;
    }

    function lex() {
        var token;
        token = self.lexer.lex() || 1; // $end = 1
        // if token isn't its numeric value, convert
        if (typeof token !== 'number') {
            token = self.symbols_[token] || token;
        }
        return token;
    }

    var symbol, preErrorSymbol, state, action, a, r, yyval={},p,len,newState, expected;
    while (true) {
        // retreive state number from top of stack
        state = stack[stack.length-1];

        // use default actions if available
        if (this.defaultActions[state]) {
            action = this.defaultActions[state];
        } else {
            if (symbol === null || typeof symbol == 'undefined') {
                symbol = lex();
            }
            // read action for current state and first input
            action = table[state] && table[state][symbol];
        }

        // handle parse error
        _handle_error:
        if (typeof action === 'undefined' || !action.length || !action[0]) {

            var errStr = '';
            if (!recovering) {
                // Report error
                expected = [];
                for (p in table[state]) if (this.terminals_[p] && p > 2) {
                    expected.push("'"+this.terminals_[p]+"'");
                }
                if (this.lexer.showPosition) {
                    errStr = 'Parse error at character '+(this.lexer.charPosition())+":<br />Expecting "+expected.join(', ') + ", got '" + (this.terminals_[symbol] || symbol)+ "'";
                } else {
                    errStr = 'Parse error at character '+(this.lexer.charPosition())+": Unexpected " +
                                  (symbol == 1 /*EOF*/ ? "end of input" :
                                              ("'"+(this.terminals_[symbol] || symbol)+"'"));
                }
                this.parseError(errStr,
                    {text: this.lexer.match, token: this.terminals_[symbol] || symbol, line: this.lexer.yylineno, loc: yyloc, expected: expected, charPosition: this.lexer.charPosition()});
            }

            // just recovered from another error
            if (recovering == 3) {
                if (symbol == EOF) {
                    throw new Error(errStr || 'Parsing halted.');
                }

                // discard current lookahead and grab another
                yyleng = this.lexer.yyleng;
                yytext = this.lexer.yytext;
                yylineno = this.lexer.yylineno;
                yyloc = this.lexer.yylloc;
                symbol = lex();
            }

            // try to recover from error
            while (1) {
                // check for error recovery rule in this state
                if ((TERROR.toString()) in table[state]) {
                    break;
                }
                if (state === 0) {
                    throw new Error(errStr || 'Parsing halted.');
                }
                popStack(1);
                state = stack[stack.length-1];
            }

            preErrorSymbol = symbol == 2 ? null : symbol; // save the lookahead token
            symbol = TERROR;         // insert generic error symbol as new lookahead
            state = stack[stack.length-1];
            action = table[state] && table[state][TERROR];
            recovering = 3; // allow 3 real symbols to be shifted before reporting a new error
        }

        // this shouldn't happen, unless resolve defaults are off
        if (action[0] instanceof Array && action.length > 1) {
            throw new Error('Parse Error: multiple actions possible at state: '+state+', token: '+symbol);
        }

        switch (action[0]) {

            case 1: // shift
                //this.shiftCount++;

                stack.push(symbol);
                vstack.push(this.lexer.yytext);
                lstack.push(this.lexer.yylloc);
                stack.push(action[1]); // push state
                symbol = null;
                if (!preErrorSymbol) { // normal execution/no error
                    yyleng = this.lexer.yyleng;
                    yytext = this.lexer.yytext;
                    yylineno = this.lexer.yylineno;
                    yyloc = this.lexer.yylloc;
                    if (recovering > 0)
                        recovering--;
                } else { // error just occurred, resume old lookahead f/ before error
                    symbol = preErrorSymbol;
                    preErrorSymbol = null;
                }
                break;

            case 2: // reduce
                //this.reductionCount++;

                len = this.productions_[action[1]][1];

                // perform semantic action
                yyval.$ = vstack[vstack.length-len]; // default to $$ = $1
                // default location, uses first token for firsts, last for lasts
                yyval._$ = {
                    first_line: lstack[lstack.length-(len||1)].first_line,
                    last_line: lstack[lstack.length-1].last_line,
                    first_column: lstack[lstack.length-(len||1)].first_column,
                    last_column: lstack[lstack.length-1].last_column
                };
                if (ranges) {
                  yyval._$.range = [lstack[lstack.length-(len||1)].range[0], lstack[lstack.length-1].range[1]];
                }
                r = this.performAction.call(yyval, yytext, yyleng, yylineno, this.yy, action[1], vstack, lstack);

                if (typeof r !== 'undefined') {
                    return r;
                }

                // pop off stack
                if (len) {
                    stack = stack.slice(0,-1*len*2);
                    vstack = vstack.slice(0, -1*len);
                    lstack = lstack.slice(0, -1*len);
                }

                stack.push(this.productions_[action[1]][0]);    // push nonterminal (reduce)
                vstack.push(yyval.$);
                lstack.push(yyval._$);
                // goto new state = table[STATE][NONTERMINAL]
                newState = table[stack[stack.length-2]][stack[stack.length-1]];
                stack.push(newState);
                break;

            case 3: // accept
                return true;
        }

    }

    return true;
}};
/* Jison generated lexer */
var lexer = (function(){
var lexer = ({EOF:1,
parseError:function parseError(str, hash) {
        if (this.yy.parser) {
            this.yy.parser.parseError(str, hash);
        } else {
            throw new Error(str);
        }
    },
setInput:function (input) {
        this._input = input;
        this._more = this._less = this.done = false;
        this.yylineno = this.yyleng = 0;
        this.yytext = this.matched = this.match = '';
        this.conditionStack = ['INITIAL'];
        this.yylloc = {first_line:1,first_column:0,last_line:1,last_column:0};
        if (this.options.ranges) this.yylloc.range = [0,0];
        this.offset = 0;
        return this;
    },
input:function () {
        var ch = this._input[0];
        this.yytext += ch;
        this.yyleng++;
        this.offset++;
        this.match += ch;
        this.matched += ch;
        var lines = ch.match(/(?:\r\n?|\n).*/g);
        if (lines) {
            this.yylineno++;
            this.yylloc.last_line++;
        } else {
            this.yylloc.last_column++;
        }
        if (this.options.ranges) this.yylloc.range[1]++;

        this._input = this._input.slice(1);
        return ch;
    },
unput:function (ch) {
        var len = ch.length;
        var lines = ch.split(/(?:\r\n?|\n)/g);

        this._input = ch + this._input;
        this.yytext = this.yytext.substr(0, this.yytext.length-len-1);
        //this.yyleng -= len;
        this.offset -= len;
        var oldLines = this.match.split(/(?:\r\n?|\n)/g);
        this.match = this.match.substr(0, this.match.length-1);
        this.matched = this.matched.substr(0, this.matched.length-1);

        if (lines.length-1) this.yylineno -= lines.length-1;
        var r = this.yylloc.range;

        this.yylloc = {first_line: this.yylloc.first_line,
          last_line: this.yylineno+1,
          first_column: this.yylloc.first_column,
          last_column: lines ?
              (lines.length === oldLines.length ? this.yylloc.first_column : 0) + oldLines[oldLines.length - lines.length].length - lines[0].length:
              this.yylloc.first_column - len
          };

        if (this.options.ranges) {
            this.yylloc.range = [r[0], r[0] + this.yyleng - len];
        }
        return this;
    },
more:function () {
        this._more = true;
        return this;
    },
less:function (n) {
        this.unput(this.match.slice(n));
    },
pastInput:function () {
        var past = this.matched.substr(0, this.matched.length - this.match.length);
        return (past.length > 20 ? '...':'') + past.substr(-20).replace(/\n/g, "");
    },
upcomingInput:function () {
        var next = this.match;
        if (next.length < 20) {
            next += this._input.substr(0, 20-next.length);
        }
        return (next.substr(0,20)+(next.length > 20 ? '...':'')).replace(/\n/g, "");
    },
// Added by Bob Renwick for returning custom errors
charPosition:function () {
    var pre = this.pastInput();
    return pre.length+1;
},
showPosition:function () {
        var pre = this.pastInput();
        var c = new Array(pre.length + 1).join("-");
        return pre + this.upcomingInput() + "\n" + c+"^";
    },
next:function () {
        if (this.done) {
            return this.EOF;
        }
        if (!this._input) this.done = true;

        var token,
            match,
            tempMatch,
            index,
            col,
            lines;
        if (!this._more) {
            this.yytext = '';
            this.match = '';
        }
        var rules = this._currentRules();
        for (var i=0;i < rules.length; i++) {
            tempMatch = this._input.match(this.rules[rules[i]]);
            if (tempMatch && (!match || tempMatch[0].length > match[0].length)) {
                match = tempMatch;
                index = i;
                if (!this.options.flex) break;
            }
        }
        if (match) {
            lines = match[0].match(/(?:\r\n?|\n).*/g);
            if (lines) this.yylineno += lines.length;
            this.yylloc = {first_line: this.yylloc.last_line,
                           last_line: this.yylineno+1,
                           first_column: this.yylloc.last_column,
                           last_column: lines ? lines[lines.length-1].length-lines[lines.length-1].match(/\r?\n?/)[0].length : this.yylloc.last_column + match[0].length};
            this.yytext += match[0];
            this.match += match[0];
            this.matches = match;
            this.yyleng = this.yytext.length;
            if (this.options.ranges) {
                this.yylloc.range = [this.offset, this.offset += this.yyleng];
            }
            this._more = false;
            this._input = this._input.slice(match[0].length);
            this.matched += match[0];
            token = this.performAction.call(this, this.yy, this, rules[index],this.conditionStack[this.conditionStack.length-1]);
            if (this.done && this._input) this.done = false;
            if (token) return token;
            else return;
        }
        if (this._input === "") {
            return this.EOF;
        } else {
            return this.parseError('Lexical error at character '+ this.charPosition() + '. Unrecognized text.',
                {text: "", token: null, line: this.yylineno, charPosition: this.charPosition() });
        }
    },
lex:function lex() {
        var r = this.next();
        if (typeof r !== 'undefined') {
            return r;
        } else {
            return this.lex();
        }
    },
begin:function begin(condition) {
        this.conditionStack.push(condition);
    },
popState:function popState() {
        return this.conditionStack.pop();
    },
_currentRules:function _currentRules() {
        return this.conditions[this.conditionStack[this.conditionStack.length-1]].rules;
    },
topState:function () {
        return this.conditionStack[this.conditionStack.length-2];
    },
pushState:function begin(condition) {
        this.begin(condition);
    }});
lexer.options = {};
lexer.performAction = function anonymous(yy,yy_,$avoiding_name_collisions,YY_START) {

var YYSTATE=YY_START
switch($avoiding_name_collisions) {
case 0:/* skip whitespace */
break;
case 1:return 22
break;
case 2:return 14
break;
case 3:return 19
break;
case 4:return 23
break;
case 5:return 18
break;
case 6:return 17
break;
case 7:return 16
break;
case 8:return 15
break;
case 9:return 8
break;
case 10:return 9
break;
case 11:return 7
break;
case 12:return 10
break;
case 13:return 11
break;
case 14:return 12
break;
case 15:return 13
break;
case 16:return 5
break;
}
};
lexer.rules = [/^(?:\s+)/,/^(?:,)/,/^(?:[A-Z])/,/^(?:[a-z]+\()/,/^(?:[a-z]+)/,/^(?:\u2200)/,/^(?:\u2203)/,/^(?:\u22A4)/,/^(?:\u22A5)/,/^(?:\u2227)/,/^(?:\u2228)/,/^(?:\u00AC)/,/^(?:\u2192)/,/^(?:\u2194)/,/^(?:\()/,/^(?:\))/,/^(?:$)/];
lexer.conditions = {"INITIAL":{"rules":[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16],"inclusive":true}};
return lexer;})()
parser.lexer = lexer;function Parser () { this.yy = {}; }Parser.prototype = parser;parser.Parser = Parser;
return new Parser;
})();
if (typeof require !== 'undefined' && typeof exports !== 'undefined') {
exports.parser = parser;
exports.Parser = parser.Parser;
exports.parse = function () { return parser.parse.apply(parser, arguments); }
exports.main = function commonjsMain(args) {
    if (!args[1])
        throw new Error('Usage: '+args[0]+' FILE');
    var source, cwd;
    if (typeof process !== 'undefined') {
        source = require("fs").readFileSync(require("path").resolve(args[1]), "utf8");
    } else {
        source = require("file").path(require("file").cwd()).join(args[1]).read({charset: "utf-8"});
    }
    return exports.parser.parse(source);
}
if (typeof module !== 'undefined' && require.main === module) {
  exports.main(typeof process !== 'undefined' ? process.argv.slice(1) : require("system").args);
}
}