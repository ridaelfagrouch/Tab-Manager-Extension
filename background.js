// Predefined colors for tab groups
const groupColors = {
  Search: "green",
  Development: "green",
  Entertainment: "red",
  Professional: "blue",
  Social: "pink",
  Movies: "orange",
  Others: "grey",
  codeRepository: "purple",
  article: "yellow",
  job: "cyan",
  ai: "blue",
};

const urlPatterns = {
  Search: [/google\.com/, /bing\.com/],
  codeRepository: [/github\.com/, /bitbucket\.org/],
  Development: [/stackoverflow\.com/, /codepen\.io/],
  Entertainment: [/youtube\.com/],
  Professional: [/linkedin\.com/],
  Social: [
    /facebook\.com/,
    /twitter\.com/,
    /instagram\.com/,
    /reddit\.com/,
    /discord\.com/,
    /whatsapp\.com/,
  ],
  Movies: [/netflix\.com/, /hulu\.com/, /amazon\.com/, /movies7\.to/],
  article: [/medium\.com/, /dev\.to/, /towardsdatascience\.com/],
  job: [/indeed\.com/, /glassdoor\.com/, /apec\.fr/],
  ai: [/chatgpt\.com/, /openai\.com/, /deepmind\.com/, /claude\.ai/],
};

// Helper function to determine the category of a tab
function getTabCategory(url) {
  for (const [category, patterns] of Object.entries(urlPatterns)) {
    for (const pattern of patterns) {
      if (pattern.test(url)) return category;
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
    console.warn(
      "Tab Groups API is not available. Grouping tabs is not supported."
    );
    return;
  }

  const category = getTabCategory(tab.url);
  let existingGroups = await chrome.tabGroups.query({});
  let group = existingGroups.find((g) => g.title === category);

  if (group) {
    await chrome.tabs.group({ tabIds: [tab.id], groupId: group.id });
  } else {
    const groupId = await chrome.tabs.group({ tabIds: [tab.id] });
    await chrome.tabGroups.update(groupId, {
      title: category,
      color: groupColors[category] || "grey",
    });
  }
}

// Function to group tabs by categories
async function groupTabsByCategories() {
  if (!chrome.tabGroups) {
    console.warn(
      "Tab Groups API is not available. Grouping tabs is not supported."
    );
    return;
  }

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
    if (!group) {
      const groupId = await chrome.tabs.group({ tabIds });
      await chrome.tabGroups.update(groupId, {
        title: category,
        color: groupColors[category] || "grey",
      });
    } else {
      // Only group tabs that are not already in this group
      const ungroupedTabIds = tabIds.filter(
        (id) => !tabs.find((t) => t.id === id && t.groupId === group.id)
      );
      if (ungroupedTabIds.length > 0) {
        await chrome.tabs.group({ tabIds: ungroupedTabIds, groupId: group.id });
      }
    }
  }
}

// Function to save tabs
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
function setupEventListeners() {
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


// --------------------------------------------------------------------