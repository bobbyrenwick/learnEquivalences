/* description: Parses end executes mathematical expressions. */

/* lexical grammar */
%lex
%%

\s+                   /* skip whitespace */
[A-Z]           return 'Variable'
[a-z]*"("       return 'Predicate'
[a-z]*          return 'Constant'
<<EOF>>         return 'EOF'
/*
"\u22A4"              return '\u22A4'
"\u22A5"	          return '\u22A5'
"\u2227"              return '\u2227'
"\u2228"              return '\u2228'
"\u00AC"              return '\u00AC'
"\u2192"              return '\u2192'
"\u2194"              return '\u2194'
"("                   return '('
")"                   return ')'
*/

/lex

/* operator associations and precedence */

%token Variable Constant
%right Predicate

%start expressions

%% /* language grammar */

expressions
    : e EOF
        {return $1;}
    ;

e
    :  Variable
        {$$ = new App.Node({ symbol: String(yytext) });}
    | Constant
    	{$$ = new App.Constant({ symbol: String(yytext)});}
    | Predicate
    	{$$ = new App.Predicate();}
    ;

