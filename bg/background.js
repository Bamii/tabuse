
(async function(){
  const {
    getTabuseSettings, getTabuseState,
    defaultSettings, getTabuseManagedWindows,
    getBrowserMarker, setBrowserMarker, setTabuseState
  } = TA_UTILS;

  Promise.all([getTabuseState(), getTabuseSettings()])
    .then(([state, settings]) => {
        if(!state.ta_state) {
          if(!(browser.storage.local.set({ 'ta_state': {} }))) return;
        }
        if(!settings.ta_settings) {
          if(!(browser.storage.local.set({ 'ta_settings': defaultSettings }))) return;
        }
        console.log(state, settings)
      })

  // for when someone reopens a closed tab or window.
  // get the marker from the window... process accordingly.
  browser.windows.onCreated.addListener(async (e) => {
    const marker = await getBrowserMarker(e.id)
    const currState = (await getTabuseState()).ta_state;
    currState[marker].active = true;
    currState[marker].windowId = e.id;
    await setTabuseState(null, {...currState, [a.name]: a }, true);
  });

  // window closed ...should be bound to windowID of managed windows
  // use the id to update the state.
  browser.windows.onRemoved.addListener(async (window) => {
    console.log("close window: " + window);
    const currState = (await getTabuseState()).ta_state;
    const a = Object.values(currState).find(e => e.windowId === window)
    if(!a) return;
    a.active = false;
    a.windowId = null;
    await setTabuseState(null, {...currState, [a.name]: a }, true);
  });

  // closed tabs
  browser.tabs.onRemoved.addListener(async function(id, { windowId }) {
    const identifier = await getBrowserMarker(windowId)

    if(identifier) {
      const currState = (await getTabuseState()).ta_state;
      const a = Object.values(currState).find((e) => e.windowId === windowId)
      const browserx = await browser.windows.get(windowId, { populate: true })
      const remainingTabs = browserx.tabs.filter(e => e.id != id).map(e => e.url)
      const nuState = { ...currState, [identifier]: {...a, tabs: [...remainingTabs] } }
      await setTabuseState(null, nuState, false)
    }
  })

  // moved tabs..
  browser.tabs.onAttached.addListener(moveFn)
  browser.tabs.onDetached.addListener(moveFn)
  browser.tabs.onMoved.addListener(moveFn)
  async function moveFn (id, { windowId, newWindowId }) {
    const thisId = windowId || newWindowId;
    const identifier = await getBrowserMarker(thisId)

    if(identifier) {
      const currState = (await getTabuseState()).ta_state;
      const a = currState[identifier];
      const browserx = await browser.windows.get(thisId, { populate: true })
      const newList = browserx.tabs.map(e => e.url)
      const nuState = { ...currState, [identifier]: { ...a, tabs: [...newList] } }
      await setTabuseState(null, nuState, true)
    }

    console.log(
      (windowId && `moving tab ${windowId}`) ||
      (newWindowId && `attaching tab ${newWindowId}`)
    )
  }

  // when url changes... for new tabs and updates.
  browser.tabs.onUpdated.addListener(async function (tabId, { url }, { windowId }) {
    if (url) {
      const identifier = await getBrowserMarker(windowId)

      if(identifier) {
        const currState = (await getTabuseState()).ta_state;
        const a = currState[identifier]
        const browserx = await browser.windows.get(windowId, { populate: true })
        const newList = browserx.tabs.map(e => e.url)
        const nuState = { ...currState, [identifier]: {...a, tabs: [...newList] } }
        await setTabuseState(null, nuState, true)
      }

      console.log("Tab: " + tabId + " URL changed to " + url);
    }
  });

  // ::TODO::
  // search through all browsers and set the id accordinly.
  getTabuseManagedWindows()
    .then(windows => {
      console.log(windows)
    })
})(TA_UTILS)
