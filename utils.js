const TA_UTILS = (function() {
  const getData = () => {
    return {
      "school": {
        "theme": "red wine",
        "tabs": ['https://duckduckgo.com', 'https://mozilla.com']
      }
    }
  }

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


  // in this memoize fn... i really don't need
  // the return values of subsequent calls to the function.
  const memoize = (type) => {
    const values = new Map();

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

  const TOKEN_TYPE = {
    VARIABLE: 'VARIABLE',
    STRING: 'STRING'
  }

  const checkTokenType = el => {
    if (el[0] === "'" || el[0] === '"') {
      return TOKEN_TYPE.STRING;
    }
    return TOKEN_TYPE.VARIABLE;
  }

  const getType = o => Object.prototype.toString.call(o).split(' ')[1].slice(0, -1).toLowerCase();

  const is = (type, value) => getType(value).toLowerCase() === type.toLowerCase();

  const checkVariableLocation = (...args) => {
    const locations = [...args]
    return function(variable) {
      const varLocation = locations.find(location => location.hasOwnProperty(variable))
      return varLocation && varLocation[variable];
    }
  }

  const stripQuotes = el => itemInPosition(el.split(el[0]), 1).trim();

  const itemInPosition = (array, pos) => array[pos]

  // ::TODO::should add <fuction> support for variables.
  const normalizeArgs = (args, locateVariable) => {
    if(!args) return []
    if(!is('array', args)) args = args.split(",");

    return args.map((arg) => {
      arg = arg.trim()

      switch(checkTokenType(arg)) {
        case TOKEN_TYPE.STRING:
          return stripQuotes(arg);

        case TOKEN_TYPE.VARIABLE:
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

    // console.log(stream, stream.slice(0, open) , 'sgtg')
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

  /***************** */
  /*      core??     */
  /***************** */
  const defaultSettings = {
    auto_open_window_on_create: true,
    create_from_current_window: false,
    use_current_tab: false,
  }
  const getAllBrowserTabs = (opts = {}) => browser.tabs.query(opts);
  const getCurrentWindowId = () => browser.windows.WINDOW_ID_CURRENT;
  const createBrowserWindow = (urls) => browser.windows.create({ url: [...urls] })

  const getTabuseState = () => browser.storage.local.get('ta_state')
  const setTabuseState = async (key, value, replace = false) => {
    let { ta_state: currState } = await getTabuseState();
    const data = replace ? value : {...currState, [key]: value };
    return await browser.storage.local.set({ 'ta_state': data });
  }

  const getTabuseSettings = () => browser.storage.local.get('ta_settings')
  const setTabuseSettings = () => {}

  const getBrowserMarker = (id) => browser.sessions.getWindowValue(id, 'ta_key')
  const setBrowserMarker = (id, key) => browser.sessions.setWindowValue(id, 'ta_key', key)

  const getTabuseManagedWindows = async () => {
    const list = await browser.windows.getAll();
    if(!list) return

    const values = await Promise.all(
      list.map(val => browser.sessions.getWindowValue(val.id, 'ta_key'))
    );
    return list.filter((e, i) => values[i] != undefined)
  }

  const createNewCollection = async (opts) => {
    const { collection_name, collection_tabs, create_from_window, open_window_on_create } = opts;
    const { auto_open_window_on_create } = getTabuseSettings();
    const { ta_state: state } = await getTabuseState();
    const active = create_from_window || open_window_on_create;

    if (Object.keys(state).indexOf(collection_name) !== -1) return false;

    const data = {
      name: collection_name,
      active,
      tabs: collection_tabs,
      theme: '',  // use default theme,
      windowId: create_from_window ? getCurrentWindowId() : null,
    }

    // add this to collection_list
    if(open_window_on_create) {
      // open a new window with the tabs_list as the tabs.
      // and set theme too ;) ::TODO THEME::
      const createdWindow = await createBrowserWindow(collection_tabs);
      if(createdWindow) {
        // set id & set thingy on browser
        data.windowId = createdWindow.id;
        data.active = true;
        setBrowserMarker(createdWindow.id, collection_name);
        console.log('n out')
      } else {
        return false;
      }
    }

    const stateSet = await setTabuseState(collection_name, data);
    console.log(stateSet)
    if(stateSet) // do some cleanup... maybe remove the window created.
      return false;
    return true;
  }

  const addTabsToCollection = async (opts) => {
    const { tabs, key } = opts;
    const { ta_state: state } = await getTabuseState();
    const data = {
      ...state[key],
      tabs: [...state[key].tabs, ...tabs],
    }

  setTabuseState(key, data)
    .then(stateSet => {

      console.log(stateSet)
      if(!stateSet) return false
      return true;
    })
  }

  return {
    is,
    parse,
    evaluate,
    getType,
    memoize,
    getData,
    isEqual,
    stripQuotes,
    normalizeArgs,
    checkTokenType,
    getValueFromObject,
    checkVariableLocation,


    getTabuseState,
    setTabuseState,
    getTabuseSettings,
    defaultSettings,
    getAllBrowserTabs,
    getCurrentWindowId,

    addTabsToCollection,
    createNewCollection,

    getTabuseManagedWindows,
    setBrowserMarker,
    getBrowserMarker
  }
})();
