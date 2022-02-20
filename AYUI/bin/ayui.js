import TA from "./utils.js";
const {
  is, memoize, pipe,
  checkVariableLocation,
  parse, stripQuotes, stripPads,
} = TA

class DependencyList {}

const BLOCKS = {
  IF: 'if',
  FOR: 'for',
  INPUT: 'input',
  VALUE: 'value',
  EVENT: 'event'
}

const EVENTS = {
  CHANGE: 'change',
  CLICK: 'click',
  INPUT: 'input',
  ON: 'on',
}

const EVENTS_REP = {
  'ta_change': EVENTS.CHANGE,
  'ta_click': EVENTS.CLICK,
  'ta_input': EVENTS.INPUT,
  'ta_on': EVENTS.ON
}

const BLOCKS_REP = {
  'ta_if': BLOCKS.IF,
  'ta_for': BLOCKS.FOR,
  'ta_value': BLOCKS.VALUE,

  'ta_change': BLOCKS.EVENT,
  'ta_click': BLOCKS.EVENT,
  'ta_input': BLOCKS.EVENT,
  'ta_on': BLOCKS.EVENT
}

export default class AYUI {
  constructor({ computed = {}, methods, state, document }) {
    this.document = document;
		this.state = state
		this.methods = methods
		this.parentMemo = memoize('parent');
		this.cloneMemo = memoize('clone');
    this.computed = {};
    this.locateVariable = checkVariableLocation(this.state, this.computed, this.methods);

    this._stateDependencies = {}
    this._stateComputedDependencies = {}
    this.AYUI = this

    this.init({ computed })
	}

	setState() {}

  init({ computed }) {
    // update computed list.
    for(let [key,raw] of Object.entries(computed)) {
      this.saveComputedFunction({ key, raw });
    }

    // get reactive blocks...
    const blocks = [
      ...this.getAllIfBlocks(),
      ...this.getAllEventBlocks(),
      ...this.getAllValueBlocks(),
      ...this.getAllForBlocks(),
    ]
      .sort((a,b) => a - b)
      .reduce((curr, el, idx, arr) => {
        // if(idx>0 && curr == arr[idx-1]) return curr;
        if(curr.find(comp => comp === el)) return curr;
        return [...curr, el];
      } , [])


    // then update the "stateTable", computedTable
    // stateTable contains a dictionary that holds the state/computed 'name' as the key,
    // and a list of elements that are dependent on it.
    // could as well just call it a dependency table.
    // dependency table for elements...
    // dependency table for computed values.
    blocks.map(block => pipe(block, this.AYUI)(this.extractBlockDependencies, this.processBlock))

    console.log(this._stateDependencies)
    console.log(this._stateComputedDependencies)
  }

  // returns
  // { block, internals: [{ type: IF, dependency: [stateValue] }] }
  extractBlockDependencies(block) {
    const data = block.dataset;
    const internals = [];
    const result = { block, internals };

    for (let internal of Object.keys(data)) {
      const valuables = this.getBlockInformation(internal, block)

      if(is('array', valuables)) {
        valuables.forEach(({ type, dependency, extras }) => {
          internals.push({ type, dependency, extras })
          this._stateDependencies[dependency] = [...(this._stateDependencies[dependency] || []), result];
        });
      } else {
        const { type, dependency, extras } = valuables
        internals.push({ type, dependency, extras })
        this._stateDependencies[dependency] = [...(this._stateDependencies[dependency] || []), result];
      }
    }
    return result
  }

  saveComputedFunction({ raw, key }) {
    const fn_name = key || `${Date.now()}_value`;
    // PARSE TO GET THE DEPENDENCIES OF THIS COMPUTED FUNCTION.
    // const [tree, dependencies] = parse(raw);
    // this.computed[fn_name] = evaluate(tree);
    //
    // for(let dependency of dependencies) {
    //   this._stateComputedDependencies[dependency] = fn_name;
    // }

    return { fn_name };
  }

  getBlockInformation(internal, block) {
    // blocks will have various types
    // IF, FOR, INPUT, VALUE.
    // { block, internals: [{ type: IF, dependency: [stateValue] }] }
    const type = BLOCKS_REP[internal]
    // parse this.
    let dependency = block.dataset[internal];

    switch (type) {
      case BLOCKS.FOR:
        const [listvalue, _dependency_] = dependency.split(" of ")
        const extras = { parent: block.parentNode, elder: block.previousElementSibling, listvalue }
        return { type, dependency: _dependency_, extras }
        break;

      case BLOCKS.VALUE:
        // in a value block, you can have more than one template, hence why we
        // have an array of contexts... these contexts are grouped as anonymous functions
        // {{ text }} {{ template }} <= example of contexts... i.e: that is two anon fns.
        const text = block.textContent;
        const context = [];
        const templateRegex = /{{(\s)*(\w)*(\s)*}}/ig;
        let end = false;
        while(!end) {
          let you = templateRegex.exec(text)
          if(!you) {end = true; break};

          // parse the contents of each context.
          // and update the dependencies,
          // the value of the computed fn right now... and the fn we call to update the computed property.
          // we allow other computed properties to be interpolated too.
          // details to be worked out later.
          const raw = stripPads(you[0], 2);
          const { fn_name } = this.saveComputedFunction({ raw });
          context.push({ extras: { raw: you[0], cursor: you[1] }, dependency: fn_name, type })
        }
        return context;
        break;

      case BLOCKS.EVENT:
        let _event;
        const rep = EVENTS_REP[internal];
        if(rep === EVENTS.ON) [_event, dependency] = dependency.split(',');
        return { type, dependency, extras: { event: _event || rep }}
        break;

      case BLOCKS.IF:
      default:
        return { type, dependency };
    }
  }

  processBlock(_block_) {
    const { block, internals } = _block_;

    for(let { type, dependency, extras } of internals) {
      switch(type) {
        case BLOCKS.IF:
          console.log('== if block')
          console.log(type, dependency, extras)
          console.log(block)
          console.log()
          // this.processIfBlock(block, extras);
          break;

        case BLOCKS.FOR:
          console.log('== for block')
          console.log(type, dependency, extras)
          console.log(block)
          console.log()
          // this.processForBlock(block, extras)
          break;

        case BLOCKS.EVENT:
          console.log('== event block')
          console.log(type, dependency, extras)
          console.log(block)
          console.log()
          // this.processEventBlock(block, extras)
          break;

        case BLOCKS.VALUE:
          console.log('== value block')
          console.log(type, dependency, extras)
          console.log(block)
          console.log()
          // this.processValueBlock(block, extras)
          break;

        default:
          break;
      }
    }
  }

  async processIfBlock(block) {
    let elly = block;
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

      // DANGER!!DANGER!!DANGER!!DANGER!!DANGER!!DANGER!!DANGER!!DANGER!!
      let parsed = parse(elly.dataset.ta_if || elly.dataset.ta_else || elly.dataset.ta_else_if)
      let isActive = !!(await evaluate(parsed, this.locateVariable, this.AYUI))
      // DANGER!!DANGER!!DANGER!!DANGER!!DANGER!!DANGER!!DANGER!!DANGER!!

      isActive
        ? elly.style.display = (elly.originalDisplay == 'none' ? 'block' : elly.originalDisplay)
        : elly.style.display = 'none'

      return isActive && !matched
    }
  }

  processForBlock(block, extras) {

  }

  processEventBlock(block, extras) {

  }

  processValueBlock(block, extras) {

  }


  /*******************************
    GET OUR BLOCKSSSSSS PLSSZZZZ
  *******************************/
  getAllEventBlocks() {
    return [
      ...this.document.querySelectorAll('[data-ta_on]'),
      ...this.document.querySelectorAll('[data-ta_click]'),
      ...this.document.querySelectorAll('[data-ta_input]'),
      ...this.document.querySelectorAll('[data-ta_change]'),
    ]
  }

  getAllValueBlocks() {
    	return this.document.querySelectorAll('[data-ta_value]')
  }

  getAllIfBlocks() {
      return this.document.querySelectorAll('[data-ta_if]')
  }

  getAllForBlocks() {
      return this.document.querySelectorAll('[data-ta_for]')
  }

  render(state) {

  }
}

const ayui = new AYUI({
  document,
  methods: {},
  state: () => {},
})
