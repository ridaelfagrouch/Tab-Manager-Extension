// Predefined group configurations
let groupConfigs = [];

console.log("Background groupConfigs: ", groupConfigs);

// Serialize RegExp objects to strings
function serializeGroupConfigs(groupConfigs) {
  return groupConfigs.map(config => ({
    ...config,
    urls: config.urls.map(url => url.toString())
  }));
}

// Deserialize strings back to RegExp objects
function deserializeGroupConfigs(groupConfigs) {
  return groupConfigs.map(config => ({
    ...config,
    urls: config.urls.map(url => new RegExp(url.slice(1, -1)))
  }));
}

// Save group configurations to storage
async function saveGroupConfigs() {
  try {
    const serializedGroupConfigs = serializeGroupConfigs(groupConfigs);
    await chrome.storage.local.set({ groupConfigs: serializedGroupConfigs });
  } catch (error) {
    console.error("Error saving group configurations:", error);
  }
}

// Load group configurations from storage
async function loadGroupConfigs() {
  try {
    const result = await chrome.storage.local.get("groupConfigs");
    if (result.groupConfigs) {
      groupConfigs = deserializeGroupConfigs(result.groupConfigs);
    }
  } catch (error) {
    console.error("Error loading group configurations:", error);
  }
}

// Function to update URL patterns for a specific group
function updateUrlPatternsForGroup(groupName, url) {
  const config = groupConfigs.find(config => config.name === groupName);
  if (config) {
    const domain = new URL(url).hostname;
    const pattern = new RegExp(domain.replace(/\./g, '\\.'));
    if (!config.urls.some(existingPattern => existingPattern.toString() === pattern.toString())) {
      config.urls.push(pattern);
    }
  }
}

// update groupConfigs from existing browser groups
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
          urls: Array.from(new Set([...existingConfig.urls, ...urlPatterns])) // Merge and deduplicate URL patterns
        });
      } else {
        updatedConfigs.push({
          name: group.title,
          color: group.color,
          urls: Array.from(new Set(urlPatterns))
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

// Helper function to determine the category of a tab
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

// Debounce function
function debounce(func, delay) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

// Function to group a single tab
async function groupTabByCategory(tab) {
  if (!chrome.tabGroups) {
    console.warn("Tab Groups API is not available. Grouping tabs is not supported.");
    return;
  }

  const category = getTabCategory(tab.url);
  const config = groupConfigs.find((config) => config.name === category);
  const color = config ? config.color : "grey";

  try {
    let existingGroups = await chrome.tabGroups.query({});
    let group = existingGroups.find((g) => g.title === category);

    if (group) {
      await chrome.tabs.group({ tabIds: [tab.id], groupId: group.id });
    } else {
      const groupId = await chrome.tabs.group({ tabIds: [tab.id] });
      await chrome.tabGroups.update(groupId, {
        title: category,
        color: color,
      });
    }

    // Update URL patterns for the group
    updateUrlPatternsForGroup(category, tab.url);
    await saveGroupConfigs();
  } catch (error) {
    console.error("Error grouping tab:", error);
  }
}

// Function to group tabs by categories
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
        await chrome.tabGroups.update(groupId, {
          title: category,
          color: color,
        });
      } else {
        const ungroupedTabIds = tabIds.filter(
          (id) => !tabs.find((t) => t.id === id && t.groupId === group.id)
        );
        if (ungroupedTabIds.length > 0) {
          await chrome.tabs.group({ tabIds: ungroupedTabIds, groupId: group.id });
        }
      }
    }
  } catch (error) {
    console.error("Error grouping tabs by categories:", error);
  }
}

// Function to save tabs automatically
async function saveTabsAutomatically() {
  try {
    const windows = await chrome.windows.getAll({ populate: true });
    const savedWindows = windows.map((window) => ({
      id: window.id,
      tabs: window.tabs.map((tab) => ({
        url: tab.url,
        title: tab.title,
        pinned: tab.pinned,
        groupId: tab.groupId,
      })),
    }));

    await chrome.storage.local.set({ savedWindows: savedWindows });
    console.log("Tabs and windows saved automatically", savedWindows);
  } catch (error) {
    console.error("Error saving tabs and windows:", error);
  }
}

// Debounced version of saveTabsAutomatically
const debouncedSaveTabs = debounce(saveTabsAutomatically, 1000);

// Set up an interval to save tabs every 5 minutes
const SAVE_INTERVAL = 300000; // 5 minutes
let saveIntervalId = setInterval(saveTabsAutomatically, SAVE_INTERVAL);

function stopSaveInterval() {
  clearInterval(saveIntervalId);
}

// Event listeners setup
async function setupEventListeners() {
  await loadGroupConfigs();
  await updateGroupConfigsFromExisting();

  const tabEventsHandler = async (tab) => {
    await debouncedSaveTabs();
    if (tab.url) {
      await groupTabByCategory(tab);
      // Update groupConfigs after tab is grouped
      if (tab.groupId !== undefined && tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) {
        try {
          const group = await chrome.tabGroups.get(tab.groupId);
          if (group) {
            updateUrlPatternsForGroup(group.title, tab.url);
            await saveGroupConfigs();
          }
        } catch (error) {
          console.error("Error handling grouped tab:", error);
        }
      }
    }
  };

  chrome.tabs.onCreated.addListener(tabEventsHandler);

  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === "complete") {
      await tabEventsHandler(tab);
    }
  });

  // Use onUpdated event to detect group changes
  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.groupId !== undefined) {
      try {
        if (changeInfo.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) {
          const group = await chrome.tabGroups.get(changeInfo.groupId);
          if (group) {
            updateUrlPatternsForGroup(group.title, tab.url);

            // Remove URL pattern from other groups
            groupConfigs.forEach(config => {
              if (config.name !== group.title) {
                config.urls = config.urls.filter(pattern => !pattern.test(tab.url));
              }
            });

            await saveGroupConfigs();
          }
        } else {
          // Tab was removed from a group
          groupConfigs.forEach(config => {
            config.urls = config.urls.filter(pattern => !pattern.test(tab.url));
          });
          await saveGroupConfigs();
        }
      } catch (error) {
        console.error("Error handling grouped tab:", error);
      }
    }
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
