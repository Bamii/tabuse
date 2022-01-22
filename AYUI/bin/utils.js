export default TA_UTILS = (function() {
  const isEqual = (a,b) => {
    if(Array.isArray(a) && Array.isArray(b)) {
      if(a.length != b.length) return false;

      return a.some((el, index) => {
        if(Array.isArray(el) && Array.isArray(b[index])) {
          isEqual(el, b[index])
        }
        return el == b[index]
      })
    }

    return typeof(a) == typeof(b) ? a === b : false;
  }

  const memoize = (type) => {
    let values = new Map();

    return function(fn, args, thisArg, identifier = null) {
      const argsrep = args.join(",")
      let key = identifier || argsrep;

      if (values.has(key)) {
        return values.get(key)
      }
      const res = fn.apply(thisArg, args)
      values.set(key, res)
      return res;
    }
  }

  const checkTokenType = el => {
    if (el[0] === "'" || el[0] === '"') {
      return 'string';
    }
    return 'variable';
  }

  const getType = o => Object.prototype.toString.call(o).split(' ')[1].slice(0, -1).toLowerCase();

  const is = (type, value) => getType(value).toLowerCase() === type.toLowerCase();

  const checkVariableLocation = (...args) =>{
    const locations = [...args]
    return function(variable) {
      const varLocation = locations.find(location => location.hasOwnProperty(variable))
      return varLocation && varLocation[variable];
    }
  }

  const stripQuotes = el => {
    return itemInPosition(el.split(el[0]), 1).trim();
  }

  const itemInPosition = (array, pos) => array[pos]

  // ::TODO::should add <fuction> support for variables.
  const normalizeArgs = (args, locateVariable) => {
    if(!args) return []
    if(!is('array', args)) args = args.split(",");

    return args.map((arg) => {
      arg = arg.trim()

      switch(checkTokenType(arg)) {
        case 'string':
          return stripQuotes(arg);

        case 'variable':
          return locateVariable(arg);
      }
    })
  }

  const getValueFromObject = (object, chain) => {
    return chain.reduce((acc, curr) => {
      return acc[curr]
    }, object)
  }

  const parse = (stream) => {
    const open = stream.indexOf('(');
    if(open < 0) return { value: stream }

    return {
      fn: stream.slice(0, open),
      variables: stream.slice(open+1, stream.length-1).trim().split(","),
    }
  }

  const evaluate = async (tokens, locateVariable, TABUSE_UI, ...extras) => {
    let { fn, variables, value } = tokens;
    let variableValue = locateVariable(fn || value)
    let args = [];

    if(fn) args = normalizeArgs(variables, locateVariable)

    if(is('function', variableValue)) {
      return variableValue.apply(TABUSE_UI, [...extras, ...args])
    } else if(is('asyncfunction', variableValue)) {
      let res = await variableValue.apply(TABUSE_UI, [...extras, ...args]);
      return res
    }

    return variableValue;
  }

  return {
    is,
    parse,
    evaluate,
    getType,
    memoize,
    isEqual,
    stripQuotes,
    normalizeArgs,
    checkTokenType,
    getValueFromObject,
    checkVariableLocation,
  }
})();
