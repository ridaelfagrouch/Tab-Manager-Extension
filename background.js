// Predefined group configurations
let groupConfigs = [
  { name: "Search", color: "green", urls: [/google\.com/, /bing\.com/] },
  { name: "Development", color: "green", urls: [/stackoverflow\.com/, /codepen\.io/] },
  { name: "Entertainment", color: "red", urls: [/youtube\.com/] },
  { name: "Professional", color: "blue", urls: [/linkedin\.com/] },
  { name: "Social", color: "pink", urls: [/facebook\.com/, /twitter\.com/, /instagram\.com/, /reddit\.com/, /discord\.com/, /whatsapp\.com/] },
  { name: "Movies", color: "orange", urls: [/netflix\.com/, /hulu\.com/, /amazon\.com/, /movies7\.to/] },
  { name: "Others", color: "grey", urls: [] },
  { name: "codeRepository", color: "purple", urls: [/github\.com/, /bitbucket\.org/] },
  { name: "article", color: "yellow", urls: [/medium\.com/, /dev\.to/, /towardsdatascience\.com/] },
  { name: "job", color: "cyan", urls: [/indeed\.com/, /glassdoor\.com/, /apec\.fr/] },
  { name: "ai", color: "blue", urls: [/chatgpt\.com/, /openai\.com/, /deepmind\.com/, /claude\.ai/] },
  {name: email, color: "red", urls: [/gmail\.com/, /outlook\.com/, /yahoo\.com/, /mail\.com/, /mail\.google\.com/]},
];

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

  const tabEventsHandler = (tab) => {
    debouncedSaveTabs();
    if (tab.url) groupTabByCategory(tab);
  };

  chrome.tabs.onCreated.addListener(tabEventsHandler);

  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === "complete") tabEventsHandler(tab);
  });

  chrome.tabs.onRemoved.addListener(debouncedSaveTabs);
  chrome.tabs.onMoved.addListener(debouncedSaveTabs);
  chrome.tabs.onAttached.addListener(debouncedSaveTabs);
  chrome.tabs.onDetached.addListener(debouncedSaveTabs);
  chrome.windows.onCreated.addListener(debouncedSaveTabs);
  chrome.windows.onRemoved.addListener(debouncedSaveTabs);

  chrome.runtime.onInstalled.addListener(() => {
    groupTabsByCategories();
    saveTabsAutomatically();
  });

  chrome.runtime.onStartup.addListener(() => {
    groupTabsByCategories();
    saveTabsAutomatically();
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
