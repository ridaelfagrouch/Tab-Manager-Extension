// Predefined group configurations
let groupConfigs = [];

console.log("Background groupConfigs: ", groupConfigs);

// Serialize RegExp objects to strings --------------------------------------------------------------------------------------
function serializeGroupConfigs(groupConfigs) {
  return groupConfigs.map(config => ({
    ...config,
    urls: Array.from(config.urls).map(url => url.toString())
  }));
}

// Deserialize strings back to RegExp objects -------------------------------------------------------------------------------
function deserializeGroupConfigs(groupConfigs) {
  return groupConfigs.map(config => ({
    ...config,
    urls: new Set(config.urls.map(url => new RegExp(url.slice(1, -1))))
  }));
}

// New helper function to remove empty groups -------------------------------------------------------------------------------
function removeEmptyGroups() {
  groupConfigs = groupConfigs.filter(config => config.urls.size > 0);
}

// Save group configurations to storage -------------------------------------------------------------------------------------
async function saveGroupConfigs() {
  try {
    removeEmptyGroups(); // Remove empty groups before saving
    const serializedGroupConfigs = serializeGroupConfigs(groupConfigs);
    await chrome.storage.local.set({ groupConfigs: serializedGroupConfigs });
    console.log("Group configurations saved:", serializedGroupConfigs);
  } catch (error) {
    console.error("Error saving group configurations:", error);
  }
}

// Load group configurations from storage ----------------------------------------------------------------------------------
async function loadGroupConfigs() {
  try {
    const result = await chrome.storage.local.get("groupConfigs");
    if (result.groupConfigs) {
      groupConfigs = deserializeGroupConfigs(result.groupConfigs);
      console.log("Group configurations loaded:", groupConfigs);
    }
  } catch (error) {
    console.error("Error loading group configurations:", error);
  }
}

// Function to update URL patterns for a specific group -------------------------------------------------------------------
function updateUrlPatternsForGroup(groupName, url) {
  const config = groupConfigs.find(config => config.name === groupName);
  if (config) {
    const domain = new URL(url).hostname;
    const pattern = new RegExp(domain.replace(/\./g, '\\.'));
    config.urls.add(pattern);
  }
}

// New helper function to ensure a group is in groupConfigs ----------------------------------------------------------------
async function ensureGroupInConfigs(groupName, color) {
  console.log(`Ensuring group ${groupName} is in configs`);
  let groupConfig = groupConfigs.find(config => config.name === groupName);
  if (!groupConfig) {
    groupConfig = {
      name: groupName,
      color: color,
      urls: new Set()
    };
    groupConfigs.push(groupConfig);
    console.log(`New group ${groupName} added to groupConfigs`);
  } else {
    console.log(`Group ${groupName} already exists in configs`);
  }
  await saveGroupConfigs();
  return groupConfig;
}

// Update groupConfigs from existing browser groups -----------------------------------------------------------------------
async function updateGroupConfigsFromExisting() {
  try {
    const existingGroups = await chrome.tabGroups.query({});
    const updatedConfigs = [];

    for (const group of existingGroups) {
      const tabs = await chrome.tabs.query({ groupId: group.id });
      const urlPatterns = tabs.map(tab => {
        const url = new URL(tab.url);
        return new RegExp(`^${url.protocol}//${url.hostname}`);
      });

      const existingConfig = groupConfigs.find(config => config.name === group.title);
      if (existingConfig) {
        updatedConfigs.push({
          ...existingConfig,
          color: group.color,
          urls: Array.from(new Set([...existingConfig.urls, ...urlPatterns]))
        });
      } else {
        updatedConfigs.push({
          name: group.title,
          color: group.color,
          urls: new Set(urlPatterns)
        });
      }
    }

    // Add any remaining configs that weren't in existing groups
    groupConfigs.forEach(config => {
      if (!updatedConfigs.some(updatedConfig => updatedConfig.name === config.name)) {
        updatedConfigs.push(config);
      }
    });

    groupConfigs = updatedConfigs;
    await saveGroupConfigs();
    console.log("Updated groupConfigs:", groupConfigs);
  } catch (error) {
    console.error("Error updating group configurations:", error);
  }
}
 
// Helper function to determine the category of a tab -----------------------------------------------------------------------
function getTabCategory(url) {
  for (const config of groupConfigs) {
    for (const pattern of config.urls) {
      if (pattern instanceof RegExp && pattern.test(url)) {
        return config.name;
      }
    }
  }
  return "Others";
}

// Debounce function -------------------------------------------------------------------------------------------------------
function debounce(func, delay) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

// Function to group a single tab -------------------------------------------------------------------------------------------
async function groupTabByCategory(tab) {
  if (!chrome.tabGroups) {
    console.warn("Tab Groups API is not available. Grouping tabs is not supported.");
    return;
  }

  const category = getTabCategory(tab.url);
  console.log(`Grouping tab ${tab.id} into category ${category}`);
  const config = groupConfigs.find((config) => config.name === category);
  const color = config ? config.color : "grey";

  try {
    let existingGroups = await chrome.tabGroups.query({});
    let group = existingGroups.find((g) => g.title === category);

    if (group) {
      console.log(`Existing group found for ${category}`);
      await chrome.tabs.group({ tabIds: [tab.id], groupId: group.id });
    } else {
      console.log(`Creating new group for ${category}`);
      const groupId = await chrome.tabs.group({ tabIds: [tab.id] });
      group = await chrome.tabGroups.update(groupId, {
        title: category,
        color: color,
      });
    }

    // Ensure the group exists in groupConfigs
    await ensureGroupInConfigs(category, group.color);

    // Update URL patterns for the group
    updateUrlPatternsForGroup(category, tab.url);
    await saveGroupConfigs();
  } catch (error) {
    console.error("Error grouping tab:", error);
  }
}

// Function to group tabs by categories -------------------------------------------------------------------------------------
async function groupTabsByCategories() {
  if (!chrome.tabGroups) {
    console.warn("Tab Groups API is not available. Grouping tabs is not supported.");
    return;
  }

  try {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const categories = {};

    tabs.forEach((tab) => {
      const category = getTabCategory(tab.url);
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push(tab.id);
    });

    const existingGroups = await chrome.tabGroups.query({});

    for (const [category, tabIds] of Object.entries(categories)) {
      let group = existingGroups.find((g) => g.title === category);
      const config = groupConfigs.find((config) => config.name === category);
      const color = config ? config.color : "grey";

      if (!group) {
        const groupId = await chrome.tabs.group({ tabIds });
        group = await chrome.tabGroups.update(groupId, {
          title: category,
          color: color,
        });
        await ensureGroupInConfigs(category, color);
      } else {
        const ungroupedTabIds = tabIds.filter(
          (id) => !tabs.find((t) => t.id === id && t.groupId === group.id)
        );
        if (ungroupedTabIds.length > 0) {
          await chrome.tabs.group({ tabIds: ungroupedTabIds, groupId: group.id });
        }
      }
    }
    await saveGroupConfigs();
  } catch (error) {
    console.error("Error grouping tabs by categories:", error);
  }
}

// Function to save tabs automatically -------------------------------------------------------------------------------------
async function saveTabsAutomatically() {
  try {
    const windows = await chrome.windows.getAll({ populate: true });
    const savedWindows = windows.map((window) => ({
      id: window.id,
      tabs: Array.from(
        window.tabs.map((tab) => ({
          id: tab.id,
          url: tab.url,
          pinned: tab.pinned,
          active: tab.active,
          groupId: tab.groupId,
        }))
      ),
    }));

    await chrome.storage.local.set({ savedWindows: savedWindows });
    console.log("Tabs and windows saved automatically", savedWindows);
  } catch (error) {
    console.error("Error saving tabs and windows:", error);
  }
}

// Debounced version of saveTabsAutomatically -------------------------------------------------------------------------------
const debouncedSaveTabs = debounce(saveTabsAutomatically, 1000);

// Set up an interval to save tabs every 5 minutes
const SAVE_INTERVAL = 300000;
let saveIntervalId = setInterval(saveTabsAutomatically, SAVE_INTERVAL);

function stopSaveInterval() {
  clearInterval(saveIntervalId);
}

function logGroupConfigs() {
  console.log("Current groupConfigs:", JSON.stringify(groupConfigs, (key, value) => {
    if (value instanceof Set) {
      return Array.from(value);
    }
    return value;
  }, 2));
}

// Event listeners setup ---------------------------------------------------------------------------------------------------
async function setupEventListeners() {
  await loadGroupConfigs();
  await updateGroupConfigsFromExisting();

  const tabEventsHandler = async (tab) => {
    await debouncedSaveTabs();
    if (tab.url) {
      await groupTabByCategory(tab);
    }
  };

  chrome.tabs.onCreated.addListener(tabEventsHandler);

  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === "complete") {
      await tabEventsHandler(tab);
    }
  });

  // Enhanced listener for group changes ----------------------------------------------------------------------------------
  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.groupId !== undefined) {
      console.log(`Tab ${tabId} group changed to ${changeInfo.groupId}`);
      try {
        if (changeInfo.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) {
          const group = await chrome.tabGroups.get(changeInfo.groupId);
          if (group) {
            console.log(`Tab ${tabId} added to group ${group.title}`);
            // Ensure the group exists in groupConfigs
            await ensureGroupInConfigs(group.title, group.color);
  
            // Validate tab.url before using it
            if (tab.url) {
              // Update the URL pattern for the current group
              updateUrlPatternsForGroup(group.title, tab.url);
  
              // Remove the URL pattern from other groups
              groupConfigs.forEach(config => {
                if (config.name !== group.title) {
                  config.urls = new Set(Array.from(config.urls).filter(pattern => !pattern.test(tab.url)));
                }
              });
  
              // Add the new URL pattern to the group
              try {
                const domain = new URL(tab.url).hostname;
                const pattern = new RegExp(domain.replace(/\./g, '\\.'));
                const groupConfig = groupConfigs?.find(config => config?.name === group?.title);
                if (groupConfig) {
                  groupConfig?.urls.add(pattern);
                } else {
                  console.error(`Group config not found for group ${group.title}`);
                }
              } catch (urlError) {
                console.error(`Invalid URL for tab ${tabId}: ${tab.url}`, urlError);
              }
  
              await saveGroupConfigs();
              // Save the updated groupConfigs
            } else {
              console.warn(`Tab ${tabId} does not have a valid URL`);
            }
          }
        } else {
          console.log(`Tab ${tabId} removed from group`);
          // Tab was removed from a group
          if (tab.url) {
            groupConfigs.forEach(config => {
              config.urls = new Set(Array.from(config.urls).filter(pattern => !pattern.test(tab.url)));
            });
            await saveGroupConfigs(); // This will now remove empty groups
          }
        }
      } catch (error) {
        console.error("Error handling grouped tab:", error);
      }
    }
  });  

  // new listener for group removal ----------------------------------------------------------------------------------
  chrome.tabGroups.onRemoved.addListener(async (group) => {
    console.log(`Group ${group.title} was removed`);
    const groupIndex = groupConfigs.findIndex(config => config.name === group.title);
    if (groupIndex !== -1) {
      groupConfigs.splice(groupIndex, 1);
      await saveGroupConfigs();
      console.log(`Group ${group.title} removed from groupConfigs`);
    }
  });


  chrome.tabGroups.onUpdated.addListener(async (group) => {
    console.log(`Group ${group.id} updated: ${JSON.stringify(group)}`);
    await ensureGroupInConfigs(group.title, group.color);
  });

  chrome.tabs.onRemoved.addListener(debouncedSaveTabs);
  chrome.tabs.onMoved.addListener(debouncedSaveTabs);
  chrome.tabs.onAttached.addListener(debouncedSaveTabs);
  chrome.tabs.onDetached.addListener(debouncedSaveTabs);
  chrome.windows.onCreated.addListener(debouncedSaveTabs);
  chrome.windows.onRemoved.addListener(debouncedSaveTabs);

  chrome.runtime.onInstalled.addListener(async () => {
    await updateGroupConfigsFromExisting();
    await groupTabsByCategories();
    await saveTabsAutomatically();
  });

  chrome.runtime.onStartup.addListener(async () => {
    await updateGroupConfigsFromExisting();
    await groupTabsByCategories();
    await saveTabsAutomatically();
  });

  chrome.runtime.onSuspend.addListener(stopSaveInterval);

  setInterval(logGroupConfigs, 10000); // Log every 10 seconds
}

setupEventListeners();

chrome.runtime.onMessage.addListener((request, _, sendResponse) => {
  if (request.action === "getGroupConfigs") {
    sendResponse({ groupConfigs: serializeGroupConfigs(groupConfigs) });
  } else if (request.action === "saveGroupConfigs") {
    groupConfigs = deserializeGroupConfigs(request.groupConfigs);
    saveGroupConfigs().then(() => sendResponse({ status: "success" }));
  }
  return true;
});


async function deleteGroup(groupName) {
  console.log(`Deleting group: ${groupName}`);
  
  // Remove the group from groupConfigs
  groupConfigs = groupConfigs.filter(config => config.name !== groupName);
  
  // Save the updated groupConfigs
  await saveGroupConfigs();
  
  // Find and remove the corresponding tab group and its tabs
  try {
    const groups = await chrome.tabGroups.query({ title: groupName });
    for (const group of groups) {
      const tabs = await chrome.tabs.query({ groupId: group.id });
      for (const tab of tabs) {
        await chrome.tabs.remove(tab.id);
      }
    }
  } catch (error) {
    console.error(`Error removing tab group and tabs: ${error}`);
  }
  
  console.log(`Group ${groupName} deleted successfully`);
  
  // Reload the settings tab
  reloadSettingsTab();
}



async function reloadSettingsTab() {
  const tabs = await chrome.tabs.query({url: chrome.runtime.getURL("settings.html")});
  for (const tab of tabs) {
    chrome.tabs.reload(tab.id);
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getGroupConfigs") {
    sendResponse({ groupConfigs: serializeGroupConfigs(groupConfigs) });
  } else if (request.action === "saveGroupConfigs") {
    groupConfigs = deserializeGroupConfigs(request.groupConfigs);
    saveGroupConfigs().then(() => sendResponse({ status: "success" }));
  } else if (request.action === "deleteGroup") {
    deleteGroup(request.groupName).then(() => sendResponse({ status: "success" }));
  }
  return true;
});