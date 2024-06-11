import { filter, findIndex, isEmpty, without } from "lodash-es";
import type { Browser, BrowserSharedDatas } from "./types";

/**
 * event storage quand storage changed
 * --> pourra checker qui est qui comme browser dans le storage
 * ---> check si tout est bon avec add browsers
 */

//Keys storage
export const STORAGE = {
  id: "lastID",
  window: "browsers",
  troisd: "infos3d",
};

export const blankSharedDatas: BrowserSharedDatas = {
  targetPoint: 0,
  command: -1,
  meshRotation: 0,
  meshPosition: 0,
};

const useBrowserStore = () => {
  let current = $state<Browser>();
  let windows = $state<Browser[]>([]);
  let lastID = $state<number>(0);

  //---- Event Related Methods

  /**
   * Clear everything
   */
  const dispose = () => {
    localStorage.removeItem(STORAGE.id);
    localStorage.removeItem(STORAGE.troisd);
    localStorage.removeItem(STORAGE.window);
  };

  //---- Browsers stack methods

  /**
   * Add new broser
   */
  const addBrowser = () => {
    lastID = getStorage(STORAGE.id);
    windows = getStorage(STORAGE.window);

    const currentInfos = getBrowserInfos();
    current = {
      id: lastID + 1,
      ...currentInfos,
    };

    // -- Check if this browser already exists
    const alreadyThere = filter(windows, (w) => sameBrowser(w));
    if (alreadyThere.length) {
      //remove all doublons
      windows = without(windows, ...alreadyThere);
    }

    //add our browser
    windows.push(current);

    //save it
    setStorage(STORAGE.id, current.id);
    setStorage(STORAGE.window, windows);

    // if no 3d browser infos
    if (isEmpty(getStorage(STORAGE.troisd))) {
      save3dInfos({ ...blankSharedDatas, command: current.id });
    } else {
      //if only one browser --> set our browser the default commander
      if (windows.length === 1)
        save3dInfos({ ...blankSharedDatas, command: windows[0].id });
    }

    window.addEventListener("storage", onStorage);
  };

  /**
   * Remove our browser (on unload or changing URL)
   */
  const removeBrowser = () => {
    windows = getStorage(STORAGE.window);
    windows = filter(windows, (browser) => browser.id !== current?.id);

    //here sync
    setStorage(STORAGE.window, windows);

    window.removeEventListener("storage", onStorage);
  };

  //---- Storage Methods

  /**
   * Return data from storage
   * @param value Storage key
   * @returns Various typings based on key storage
   */
  const getStorage = (value: string) => {
    if (value === STORAGE.id) {
      return parseInt(localStorage.getItem(value) || "0");
    } else if (value === STORAGE.troisd) {
      //BrowserSharedDatas
      return JSON.parse(localStorage.getItem(value) || "{}");
    }

    // array of windows
    return JSON.parse(localStorage.getItem(value) || "[]");
  };

  /**
   * Save in storage
   * @param value Key storage
   * @param data Data to save
   */
  const setStorage = (value: string, data: Browser[] | number) => {
    if (value === STORAGE.id) {
      localStorage.setItem(value, data.toString());
    } else {
      if (data) localStorage.setItem(value, JSON.stringify(data));
    }
  };

  /**
   * Save 3d Browser infos
   * @param data Data to save
   */
  const save3dInfos = (data: BrowserSharedDatas) => {
    localStorage.setItem(STORAGE.troisd, JSON.stringify(data));
  };

  //----- Sync Methods

  /**
   * Updating the storage - when moving browser ofr example
   */
  const update = () => {
    if (current && !sameBrowser(current)) {
      windows = getStorage(STORAGE.window);

      const tempBrowser = { id: getStorage(STORAGE.id), ...getBrowserInfos() };
      const currentIndex = findIndex(
        windows,
        (browser) => browser.id === current?.id
      );

      if (currentIndex >= 0) {
        windows[currentIndex] = {
          ...tempBrowser,
          id: windows[currentIndex].id,
        };

        current = windows[currentIndex];
        setStorage(STORAGE.window, windows);
      }
    }
  };

  //---- Internal Methods

  /**
   * Stroage handler - if browser from other context update storage - we wants to know
   * @param e StorageEvent
   */
  const onStorage = (e: StorageEvent) => {
    if (e.key === "windows") {
      windows = getStorage(STORAGE.window);
    }
  };

  /**
   * Return current browser infos
   * @returns Size and position
   */
  const getBrowserInfos = () => {
    return {
      width: window.innerWidth,
      height: window.innerHeight,
      x: window.screenX,
      y: window.screenY,
    };
  };

  /**
   * Check if the browser is the same of the current browser frame
   * @param browser Browser
   * @returns boolean
   */
  const sameBrowser = (browser: Partial<Browser>) => {
    const tempBrowser = { ...getBrowserInfos() };

    return (
      tempBrowser.x === browser?.x &&
      tempBrowser.y === browser?.y &&
      tempBrowser.width === browser?.width &&
      tempBrowser.height === browser?.height
    );
  };

  return {
    get windows() {
      return windows;
    },
    get current() {
      return current;
    },
    dispose,
    update,
    addBrowser,
    getStorage,
    removeBrowser,
    save3dInfos,
  };
};

//getters (sort of)
export const store = useBrowserStore();
