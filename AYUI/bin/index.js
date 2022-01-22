
/********************/
/*  page 'imports'  */
/********************/
import TA_UTILS from './utils'
const {
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
} = TA_UTILS;

export default AYUI = (function({ methods, state }){
  const TABUSE_UI = this;
  /******************/
  /*  page state    */
  /******************/
  TABUSE_UI.state = state;
  /******************/
  /*  page methods  */
  /******************/
  TABUSE_UI.methods = methods;
  /********************/
  /*  page variables  */
  /********************/
  const DEBOUNCE_TIME = 200;
  const parentMemo = memoize('parent');
  const cloneMemo = memoize('clone');
  const locateVariable = checkVariableLocation(state, methods);

  /**************/
  /* UI UPDATES */
  /**************/
  function setState(newState) {
    setTimeout(() => {
      this.state = { ...this.state, ...newState }
      render(this.state);
    });
    return
  }
  this.setState = setState;

  // our semi-reactives...
  const tabuseActions = {
    visible: document.querySelectorAll('[data-ta_if]'),
    input: document.querySelectorAll('[data-ta_input]'),
    change: document.querySelectorAll('[data-ta_change]'),
    click: document.querySelectorAll('[data-ta_click]'),
    forStatements: document.querySelectorAll('[data-ta_for]'),
    forStamentParents: document.querySelectorAll('[data-ta_for_parent]')
  } // ::TODO::add support for interpolated data in the page.

  const KEYWORDS = [
    'ta_if', 'ta_for', 'ta_for_id',
    'ta_value', 'ta_for_parent'
  ] // keywords.

  let LISTENERS = {
    'ta_input': { eventName: 'oninput', fn: oninput_function },
    'ta_click': { eventName: 'onclick', fn: onclick_function },
    'ta_change': { eventName: 'onchange', fn: onchange_function },
  } // event listeners.

  const oninput_function = ({ target }) => {
    const stateKey = target.dataset.ta_input;
    // debouncing.
    setTimeout(() => {
      switch(target.type) {
        case "checkbox":
          setState({ [stateKey]: target.checked });
          return;

        default:
          setState({ [stateKey]: target.value });
          return;
      }
    }, DEBOUNCE_TIME);
  }

  const onchange_function = e => {
    const stateKey = element.target.dataset.ta_change;
    const variable = locateVariable(stateKey)

    // throw error if it's not a function.
    // setTimeout(() => {
      variable.apply(TABUSE_UI, [e])
    // }, DEBOUNCE_TIME);
  }

  const onclick_function = async e => {
    let parsed = parse(e.target.dataset.ta_click);
    await evaluate(parsed, locateVariable, TABUSE_UI , e)
  }

  function render(state) {
    /********************** */
    /**   control flow      */
    /********************** */
    // ::FOR
    // initial setup for the for statements.
    // first, we check if the element/parent has a for_id
    // this is to ensure unique nodes.
    // then we set an id as appropriate.
    // and we also set a "label" on the parent node to be used
    // as a checkpoint sorta. (as we see in the computing function
    // in some steps ahead, we will be deleting all the nodes of
    // the parent, and then inserting the nodes for the for loop.)
    // then we cache the parent, and the element
    // using the for_id as the unique identifier.
    // doing this, we get a reference to the parent, and
    // a copy of the "for node" at first run.
    // we then call the computing function.
    // this function determines and tries to iterate the value
    // of the expression in the for block.
    // when the function is iterating the values, it deletes the
    // data-ta_for attribute (and for this reason, this entire routine
    // should only run once throughout the lifetime of the page.), and
    // the data-ta_value atributes. and then the user defined events on
    // the nodes are attached accordingly.
    // ------
    // i think i may have found a way to do this based on my previous
    // implementation,...
    // sooo i'm thinking, on second (dot dot dot) render(s)...
    // instead of deleting all the nodes and then attaching new ones,
    // i could clone the parentNode... attach the nodes to the cloned node,
    // then replace the parent with the clone. and obviously attach the
    // listeners on the parent node.
    // -------
    // should increase performance on longer lists.
    // -------
    let TA_FOR_ID = 0; // to ensure unique nodes.
    tabuseActions.forStatements.forEach(async (el) => {
      // set ta_for_id if not set already.
      if (!el.dataset.ta_for_id || !el.parentNode.dataset.ta_for_id) {
        el.dataset.ta_for_id = TA_FOR_ID
        el.parentNode.dataset.ta_for_id = TA_FOR_ID
        el.parentNode.dataset.ta_for_parent = true
        ++TA_FOR_ID;
      };

      const parent = parentMemo(
        e => e, [el.parentNode], // function (2 be memoized) and its args.
        el,                      // 'this' argument for the function.
        el.dataset.ta_for_id     // memoizer identifier... if not set, will use the fn args.
      );

      const element = cloneMemo(
        e => e, [el],            // function (2 be memoized) and its args.
        el,                      // 'this' argument for the function.
        el.dataset.ta_for_id     // memoizer identifier... if not set, will use the fn args.
      )

      await processForStatement(element, parent);
    });

    async function processForStatement(element, parent) {
      const [baseTarget,items] = element.dataset.ta_for.split(" in ");
      let itemsToIterate = await evaluate(parse(items), locateVariable, TABUSE_UI);

      function iterateItems(parent, element, itemsToIterate, baseTarget) {
        // because clone() only clones inline listeners.
        // we have to sift through the user defined reactives
        // and then append the listeners later on.
        const elementReactives = Object
          .entries(element.dataset)
          .filter(([key,]) => KEYWORDS.indexOf(key) === -1)

        // whenever you remove all the child nodes of a select tag...
        // it's value resets.
        let parentValue = null;
        if(parent.value)
          parentValue = parent.value;

        while(parent.firstElementChild)
          parent.removeChild(parent.firstElementChild);

        if(itemsToIterate.length === 0) return;
        const [rowTarget,...objectChain] = element.dataset.ta_value.split(".");

        // do the iteration...blerghh
        itemsToIterate.forEach((iterated, index) => {
          let elementClone = element.cloneNode();
          const lobject = baseTarget === rowTarget ? iterated : locateVariable(rowTarget)

          elementClone.removeAttribute('data-ta_for')
          elementClone.removeAttribute('data-ta_value')
          elementClone.textContent = getValueFromObject(lobject, objectChain);
          elementClone.index = index;

          if(elementReactives.length != 0)
            elementReactives.forEach(([key,]) => elementClone[LISTENERS[key].eventName] = LISTENERS[key].fn);

          parent.append(elementClone);
        });
        if(parentValue) parent.value = parentValue;

        return;
      }

      iterateItems(parent, element, itemsToIterate, baseTarget)
      return
    }

    // this runs on second(dot dot dot) render(s)...
    // because then, the for_parent is set.
    tabuseActions.forStamentParents.forEach(async(element) => {
      const parent = parentMemo(
        e => e, [element],
        element, element.dataset.ta_for_id
      );

      const memoElement = cloneMemo(
        e => e, [element],
        element, element.dataset.ta_for_id
      )

      await processForStatement(memoElement, parent)
    })

    // ::IF:ELSE::ELSE_IF
    tabuseActions.visible.forEach(async element => {
      let elly = element;
      let matched = false;  // this is used to determine if one branch is already matched

      // first if statement.
      if(!elly.originalDisplay)
        elly.originalDisplay = window.getComputedStyle(elly).display;
      matched = await processBlock(elly, matched)
      elly = elly.nextElementSibling

      // subsequent if elses.
      // maybe i should make 'else' the last branch.
      while(elly != null && (elly.dataset.ta_else_if || elly.dataset.ta_else)) {
        // save the value of this element's display.
        if(!elly.originalDisplay)
          elly.originalDisplay = window.getComputedStyle(elly).display;
        matched = await processBlock(elly, matched)
        elly = elly.nextElementSibling
      }

      async function processBlock(elly, matched) {
        // if one of the branches are already active
        // do no computations and set invisible
        if(matched) {
          elly.style.display = 'none';
          return true
        }

        let parsed = parse(elly.dataset.ta_if || elly.dataset.ta_else || elly.dataset.ta_else_if)
        let isActive = !!(await evaluate(parsed, locateVariable, TABUSE_UI))

        isActive
          ? elly.style.display = (elly.originalDisplay == 'none' ? 'block' : elly.originalDisplay)
          : elly.style.display = 'none'

        return isActive && !matched
      }
    });

    /********************** */
    /**  input bindings     */
    /********************** */
    // idea is like vue... updating the input updates the state variable

    tabuseActions.input.forEach(element => {
      const stateKey = element.dataset.ta_input;
      if (stateKey) {
        switch(element.type) {
          case "checkbox":
            element.checked = state[stateKey]
            break;

          default:
            if(element.value || state[stateKey]) element.value = state[stateKey]
            break
        }
        element.oninput = oninput_function;
      }
    })
    // LISTENERS.ta_input.fn = oninput_function;


    tabuseActions.change.forEach(element => {
      const stateKey = element.dataset.ta_change;
      if (stateKey) {
        element.onchange = onchange_function;
      }
    })
    // LISTENERS.ta_change.fn = onchange_function;


    tabuseActions.click.forEach(element => {
      element.onclick = onclick_function;
    })
    // LISTENERS.ta_click.fn = onclick_function;
  }
  render(state);
  return;
});
