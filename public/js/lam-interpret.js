//entry point from browser
var env = {};
var out = "";
function interpret(code){
  if (code === "") return "";
  try{
    out = "";
      var scope = {};
      var ast = parse(TokenStream(InputStream(code)));
      //console.log(ast);
      var evaluated = evaluate(ast, env);
      //console.log(env);
      return out + evaluated;
    } catch(err){
      return err.message
    }
}

//top-level eval function
function evaluate(exp, scope){
  console.log(exp);
  switch (exp.type) {
    case "num":
    case "str":
    case "bool":
    return exp.value;

    case "var":
    if (scope[exp.value] === 0 || scope[exp.value]) return scope[exp.value];
    if (env[exp.value] === 0 || env[exp.value]) return env[exp.value];
    throw new Error("Undefined identifier: " + exp.value);

    case "assign":
    if (exp.left.type != "var")
    throw new Error("Cannot assign to " + JSON.stringify(exp.left));
    scope[exp.left.value] = evaluate(exp.right, scope);
    return scope[exp.left.value];

    case "binary":
    return apply_op(exp.operator,
      evaluate(exp.left, scope),
      evaluate(exp.right, scope));

      case "lam":
      return make_lambda(scope, exp);

      case "if":
      var cond = evaluate(exp.cond, scope);
      if (cond !== false) return evaluate(exp.then, scope);
      return exp.else ? evaluate(exp.else, scope) : false;

      case "prog":
      var val = false;
      exp.prog.forEach(function(exp){ val = evaluate(exp, scope) });
      return val;

      case "call":
      if(exp.func.value && exp.func.value === "print"){
        exp.args.forEach(function(arg){out += evaluate(arg)})
        return;
      }
      if(exp.func.value && exp.func.value === "println"){
        exp.args.forEach(function(arg){out += evaluate(arg) + "<br>"})
        return;
      }
      var func = evaluate(exp.func, scope);
      return func.apply(null, exp.args.map(function(arg){
        return evaluate(arg, scope);
      }));

      default:
      throw new Error("I don't know how to evaluate " + exp.type);
    }
  }

  function make_lambda(scope, exp) {
    var inner_env = {};
    for(var k in scope) inner_env[k]=scope[k]; //copies all scope to inner_env
    var static_vars = JSON.parse(JSON.stringify(scope));

    //overwrites scope variable refernces with actual values to maintain closure
    for(var k in static_vars) inner_env[k]=static_vars[k];

    function lambda() {
      var names = exp.vars;
      for (var i = 0; i < names.length; ++i)
      def_lam(names[i], i < arguments.length ? arguments[i] : false, inner_env);
      return evaluate(exp.body, inner_env);
    }
    return lambda;
  }

  function def_lam(name, value, inner_env) {
    return inner_env[name] = value;
  }

  function apply_op(op, a, b) {
    function num(x) {
      if (typeof x != "number")
      throw new Error("Expected number but got " + x);
      return x;
    }
    function div(x) {
      if (num(x) == 0)
      throw new Error("Divide by zero");
      return x;
    }
    switch (op) {
      case "^": return num(a) ** num(b);
      case "+": return num(a) + num(b);
      case "-": return num(a) - num(b);
      case "*": return num(a) * num(b);
      case "/": return num(a) / div(b);
      case "%": return num(a) % div(b);
      case "&&": return a !== false && b;
      case "||": return a !== false ? a : b;
      case "<": return num(a) < num(b);
      case ">": return num(a) > num(b);
      case "<=": return num(a) <= num(b);
      case ">=": return num(a) >= num(b);
      case "==": return a === b;
      case "!=": return a !== b;
    }
    throw new Error("Can't apply operator " + op);
  }

  function InputStream(input) {
    var pos = 0, line = 1, col = 0;
    return {
      next  : next,
      peek  : peek,
      eof   : eof,
      croak : croak,
    };
    function next() {
      var ch = input.charAt(pos++);
      if (ch == "\n") line++, col = 0; else col++;
      return ch;
    }
    function peek() {
      return input.charAt(pos);
    }
    function eof() {
      return peek() == "";
    }
    function croak(msg) {
      throw new Error(msg + " (" + line + ":" + col + ")");
    }
  }

  function TokenStream(input) {
    var current = null;
    var keywords = " if then else lam true false ";
    return {
      next  : next,
      peek  : peek,
      eof   : eof,
      croak : input.croak
    };
    function is_keyword(x) {
      return keywords.indexOf(" " + x + " ") >= 0;
    }
    function is_digit(ch) {
      return /[0-9]/i.test(ch);
    }
    function is_id_start(ch) {
      return /[a-zÎ»_]/i.test(ch);
    }
    function is_id(ch) {
      return is_id_start(ch) || "?!-<>=0123456789".indexOf(ch) >= 0;
    }
    function is_op_char(ch) {
      return "^+-*/%=&|<>!".indexOf(ch) >= 0;
    }
    function is_punc(ch) {
      return ",;(){}[]".indexOf(ch) >= 0;
    }
    function is_whitespace(ch) {
      return " \t\n".indexOf(ch) >= 0;
    }
    function read_while(predicate) {
      var str = "";
      while (!input.eof() && predicate(input.peek()))
      str += input.next();
      return str;
    }
    function read_number() {
      var has_dot = false;
      var number = read_while(function(ch){
        if (ch == ".") {
          if (has_dot) return false;
          has_dot = true;
          return true;
        }
        return is_digit(ch);
      });
      return { type: "num", value: parseFloat(number) };
    }
    function read_ident() {
      var id = read_while(is_id);
      return {
        type  : is_keyword(id) ? "kw" : "var",
        value : id
      };
    }
    function read_escaped(end) {
      var escaped = false, str = "";
      input.next();
      while (!input.eof()) {
        var ch = input.next();
        if (escaped) {
          str += ch;
          escaped = false;
        } else if (ch == "\\") {
          escaped = true;
        } else if (ch == end) {
          break;
        } else {
          str += ch;
        }
      }
      return str;
    }
    function read_string_double() {
      return { type: "str", value: read_escaped('"') };
    }
    function read_string_single() {
      return { type: "str", value: read_escaped("'") };
    }
    function skip_comment() {
      read_while(function(ch){ return ch != "\n" });
      input.next();
    }
    function read_next() {
      read_while(is_whitespace);
      if (input.eof()) return null;
      var ch = input.peek();
      if (ch == "#") {
        skip_comment();
        return read_next();
      }
      if (ch == '"') return read_string_double();
      if (ch == "'") return read_string_single();
      if (is_digit(ch)) return read_number();
      if (is_id_start(ch)) return read_ident();
      if (is_punc(ch)) return {
        type  : "punc",
        value : input.next()
      };
      if (is_op_char(ch)) return {
        type  : "op",
        value : read_while(is_op_char)
      };
      input.croak("Can't handle character: " + ch);
    }
    function peek() {
      return current || (current = read_next());
    }
    function next() {
      var tok = current;
      current = null;
      return tok || read_next();
    }
    function eof() {
      return peek() == null;
    }
  }

  function parse(input) {
    var PRECEDENCE = {
      "=": 1,
      "||": 2,
      "&&": 3,
      "<": 7, ">": 7, "<=": 7, ">=": 7, "==": 7, "!=": 7,
      "+": 10, "-": 10,
      "*": 20, "/": 20, "%": 20, "^" : 25
    };
    var FALSE = { type: "bool", value: false };
    return parse_toplevel();
    function is_punc(ch) {
      var tok = input.peek();
      return tok && tok.type == "punc" && (!ch || tok.value == ch) && tok;
    }
    function is_kw(kw) {
      var tok = input.peek();
      return tok && tok.type == "kw" && (!kw || tok.value == kw) && tok;
    }
    function is_op(op) {
      var tok = input.peek();
      return tok && tok.type == "op" && (!op || tok.value == op) && tok;
    }
    function skip_punc(ch) {
      if (is_punc(ch)) input.next();
      else input.croak("Expecting punctuation: \"" + ch + "\"");
    }
    function skip_kw(kw) {
      if (is_kw(kw)) input.next();
      else input.croak("Expecting keyword: \"" + kw + "\"");
    }
    function skip_op(op) {
      if (is_op(op)) input.next();
      else input.croak("Expecting operator: \"" + op + "\"");
    }
    function unexpected() {
      input.croak("Unexpected token: " + JSON.stringify(input.peek()));
    }
    function maybe_binary(left, my_prec) {
      var tok = is_op();
      if (tok) {
        var his_prec = PRECEDENCE[tok.value];
        if (his_prec > my_prec) {
          input.next();
          return maybe_binary({
            type     : tok.value == "=" ? "assign" : "binary",
            operator : tok.value,
            left     : left,
            right    : maybe_binary(parse_atom(), his_prec)
          }, my_prec);
        }
      }
      return left;
    }
    function delimited(start, stop, separator, parser) {
      var a = [], first = true;
      skip_punc(start);
      while (!input.eof()) {
        if (is_punc(stop)) break;
        if (first) first = false; else skip_punc(separator);
        if (is_punc(stop)) break;
        a.push(parser());
      }
      skip_punc(stop);
      return a;
    }
    function parse_call(func) {
      return {
        type: "call",
        func: func,
        args: delimited("(", ")", ",", parse_expression),
      };
    }
    function parse_varname() {
      var name = input.next();
      if (name.type != "var") input.croak("Expecting variable name");
      return name.value;
    }
    function parse_if() {
      skip_kw("if");
      var cond = parse_expression();
      if (!is_punc("{")) skip_kw("then");
      var then = parse_expression();
      var ret = {
        type: "if",
        cond: cond,
        then: then,
      };
      if (is_kw("else")) {
        input.next();
        ret.else = parse_expression();
      }
      return ret;
    }
    function parse_lambda() {
      return {
        type: "lam",
        vars: delimited("(", ")", ",", parse_varname),
        body: parse_expression()
      };
    }
    function parse_bool() {
      return {
        type  : "bool",
        value : input.next().value == "true"
      };
    }
    function maybe_call(expr) {
      expr = expr();
      return is_punc("(") ? parse_call(expr) : expr;
    }
    function parse_atom() {
      return maybe_call(function(){
        if (is_punc("(")) {
          input.next();
          var exp = parse_expression();
          skip_punc(")");
          return exp;
        }
        if (is_punc("{")) return parse_prog();
        if (is_kw("if")) return parse_if();
        if (is_kw("true") || is_kw("false")) return parse_bool();
        if (is_kw("lam") || is_kw("Î»")) {
          input.next();
          return parse_lambda();
        }
        var tok = input.next();
        if (tok.type == "var" || tok.type == "num" || tok.type == "str")
        return tok;
        unexpected();
      });
    }
    function parse_toplevel() {
      var prog = [];
      while (!input.eof()) {
        prog.push(parse_expression());
        if (!input.eof()) skip_punc(";");
      }
      return { type: "prog", prog: prog };
    }
    function parse_prog() {
      var prog = delimited("{", "}", ";", parse_expression);
      if (prog.length == 0) return FALSE;
      if (prog.length == 1) return prog[0];
      return { type: "prog", prog: prog };
    }
    function parse_expression() {
      return maybe_call(function(){
        return maybe_binary(parse_atom(), 0);
      });
    }
  }
