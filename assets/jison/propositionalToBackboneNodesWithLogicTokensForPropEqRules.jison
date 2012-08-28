/* description: Parses both propositional and first order logic */
/* get rid of letters a-z for both constant and pred */
/* lexical grammar */
%lex
%%

\s+                   /* skip whitespace */
','                   return ','
[A-Z]                 return 'Variable'
[a-z]+'('             return 'Predicate'
[a-z]+                return 'Constant'
"\u2200"              return '\u2200'
"\u2203"              return '\u2203'
"\u22A4"              return '\u22A4'
"\u22A5"	          return '\u22A5'
"\u2227"              return '\u2227'
"\u2228"              return '\u2228'
"\u00AC"              return '\u00AC'
"\u2192"              return '\u2192'
"\u2194"              return '\u2194'
"("                   return '('
")"                   return ')'
<<EOF>>               return 'EOF'

/lex

/* operator associations and precedence */

%token Variable Constant '\u22A4' '\u22A5' Predicate
%left '\u2194'
%left '\u2192'
%left '\u2228'
%left '\u2227'
%token '(' ')'
%right '\u00AC' '\u2200' '\u2203'

%start expressions

%% /* language grammar */

expressions
    : predsentence EOF
        {return $1;}
    | propsentence EOF
        {return $1;}
    ;

propsentence :
     '\u00AC' propsentence
        {$$ = new App.NegationNode({right: $2});}
    | propsentence '\u2227' propsentence
        {$$ = new App.AndNode({ left: $1, right: $3});}
    | propsentence '\u2228' propsentence
        {$$ = new App.OrNode({ left: $1, right: $3});}
    | propsentence '\u2192' propsentence
        {$$ = new App.ImplyNode({ left: $1, right: $3});}
    | propsentence '\u2194' propsentence
        {$$ = new App.DimplyNode({ left: $1, right: $3});}
    | '(' propsentence ')'
        {$$ = $2;} 
    | Variable
        {$$ = new App.Node({ symbol: String(yytext) });}
    | '\u22A5'
        {$$ = new App.Contradiction();}
    | '\u22A4'
        {$$ = new App.Tautology();}
    ;

predsentence
    : '\u00AC' predsentence
    	{$$ = new App.NegationNode({right: $2});}
    | predsentence '\u2227' predsentence
        {$$ = new App.AndNode({ left: $1, right: $3});}
    | predsentence '\u2228' predsentence
        {$$ = new App.OrNode({ left: $1, right: $3});}
    | predsentence '\u2192' predsentence
        {$$ = new App.ImplyNode({ left: $1, right: $3});}
    | predsentence '\u2194' predsentence
        {$$ = new App.DimplyNode({ left: $1, right: $3});}
    | '(' predsentence ')'
        {$$ = $2;} 
    | '\u2203' 'Variable' predsentence
        {$$ = new App.ExistensialQuantifier({ variable: $2, right : $3 });}
    | '\u2200' 'Variable' predsentence
        {$$ = new App.UniversalQuantifier({ variable: $2, right : $3 });}
    | '\u2203' 'Variable' propsentence
        {$$ = new App.ExistensialQuantifier({ variable: $2, right : $3 });}
    | '\u2200' 'Variable' propsentence
        {$$ = new App.UniversalQuantifier({ variable: $2, right : $3 });}
    | 'Predicate' listofterms ')'
        {$$ = new App.Predicate({ terms  : $2, symbol : $1.substr(0, $1.length - 1) });}
    ;
    

listofterms
    : term
    	{$$ = [$1]; }
    | listofterms ',' term
    	{  $1.push($3);
           $$ = $1; }
    ;

term
    : '\u22A4' 
        {$$ = new App.Tautology(); }
    | '\u22A5'
        {$$ = new App.Contradiction();}
    | 'Constant'
        {$$ = new App.Constant({ symbol : String(yytext) });}
    | 'Variable'
        {$$ = new App.Node({ symbol : String(yytext) });}
    ;