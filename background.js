// Helper function to determine the category of a tab
function getTabCategory(url) {
    const urlPatterns = {
        'Search': [/google\.com/, /bing\.com/],
        'codeRepository': [/github\.com/, /bitbucket\.org/],
        'Development': [/stackoverflow\.com/, /codepen\.io/],
        'Entertainment': [/youtube\.com/],
        'Professional': [/linkedin\.com/],
        'Social': [/facebook\.com/, /twitter\.com/, /instagram\.com/, /reddit\.com/, /discord\.com/],
        'Movies': [/netflix\.com/, /hulu\.com/, /amazon\.com/, /movies7\.to/],
        'article': [/medium\.com/, /dev\.to/, /towardsdatascience\.com/],
        'job': [/indeed\.com/, /glassdoor\.com/, /apec\.fr/],
      };
  
      for (const [category, patterns] of Object.entries(urlPatterns)) {
        for (const pattern of patterns) {
          if (pattern.test(url)) return category;
        }
      }
      return 'Others';
  }
  
  // Predefined colors for tab groups
  const groupColors = {
    'Search': 'blue',
    'Development': 'green',
    'Entertainment': 'red',
    'Professional': 'purple',
    'Social': 'grey',
    'Movies': 'orange',
    'Others': 'grey',
    'codeRepository': 'green',
    'article': 'blue',
    'job': 'purple',
  };
  
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
    try {
      if (!chrome.tabGroups) {
        console.warn('Tab Groups API is not available. Grouping tabs is not supported.');
        return;
      }
  
      const category = getTabCategory(tab.url);
      const existingGroups = await chrome.tabGroups.query({});
      let group = existingGroups.find(g => g.title === category);
  
      if (group) {
        await chrome.tabs.group({ tabIds: [tab.id], groupId: group.id });
      } else {
        const groupId = await chrome.tabs.group({ tabIds: [tab.id] });
        await chrome.tabGroups.update(groupId, { title: category, color: groupColors[category] || 'grey' });
      }
    } catch (error) {
      console.error('Error grouping tab:', error);
    }
  }
  
  // Function to group tabs by categories
  async function groupTabsByCategories() {
    try {
      if (!chrome.tabGroups) {
        console.warn('Tab Groups API is not available. Grouping tabs is not supported.');
        return;
      }
  
      const tabs = await chrome.tabs.query({ currentWindow: true });
      const categories = {};
  
      tabs.forEach(tab => {
        const category = getTabCategory(tab.url);
        if (!categories[category]) {
          categories[category] = [];
        }
        categories[category].push(tab.id);
      });
  
      const existingGroups = await chrome.tabGroups.query({});
  
      for (const [category, tabIds] of Object.entries(categories)) {
        let group = existingGroups.find(g => g.title === category);
        if (group) {
          // Only group tabs that are not already in this group
          const ungroupedTabIds = tabIds.filter(id => !tabs.find(t => t.id === id && t.groupId === group.id));
          if (ungroupedTabIds.length > 0) {
            await chrome.tabs.group({ tabIds: ungroupedTabIds, groupId: group.id });
          }
        } else {
          const groupId = await chrome.tabs.group({ tabIds });
          await chrome.tabGroups.update(groupId, { title: category, color: groupColors[category] || 'grey' });
        }
      }
    } catch (error) {
      console.error('Error grouping tabs:', error);
    }
  }
  
  // Function to save tabs
  async function saveTabsAutomatically() {
    try {
      const windows = await chrome.windows.getAll({ populate: true });
      const savedWindows = windows.map(window => ({
        id: window.id,
        tabs: window.tabs.map(tab => ({
          url: tab.url,
          title: tab.title,
          pinned: tab.pinned,
          groupId: tab.groupId
        }))
      }));
  
      await chrome.storage.local.set({ savedWindows: savedWindows });
      console.log('Tabs and windows saved automatically', savedWindows);
    } catch (error) {
      console.error('Error saving tabs and windows:', error);
    }
  }
  
  // Debounced version of saveTabsAutomatically
  const debouncedSaveTabs = debounce(saveTabsAutomatically, 1000);
  
  // Set up an interval to save tabs every 5 minutes
  const SAVE_INTERVAL = 300000; // 5 minutes
  let saveIntervalId;
  
  function startSaveInterval() {
    saveIntervalId = setInterval(saveTabsAutomatically, SAVE_INTERVAL);
  }
  
  function stopSaveInterval() {
    clearInterval(saveIntervalId);
  }
  
  // Event listeners
  chrome.tabs.onCreated.addListener((tab) => {
    debouncedSaveTabs();
    // Wait a short time for the tab to load its initial content
    setTimeout(() => groupTabByCategory(tab), 500);
  });
  
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
      debouncedSaveTabs();
      // Call groupTabByCategory for the specific tab that was updated
      groupTabByCategory(tab);
    }
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
    startSaveInterval();
  });
  
  chrome.runtime.onStartup.addListener(() => {
    groupTabsByCategories();
    saveTabsAutomatically();
    startSaveInterval();
  });
  
  chrome.runtime.onSuspend.addListener(stopSaveInterval);
  
  // Message listener for manual actions
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'groupTabs') {
      groupTabsByCategories()
        .then(() => sendResponse({ status: 'Tabs grouped by categories' }))
        .catch((error) => {
          console.error('Error in manual grouping:', error);
          sendResponse({ status: 'Error grouping tabs', error: error.message });
        });
      return true; // Indicates you're asynchronously sending a response
    } else if (message.action === 'saveTabs') {
      saveTabsAutomatically()
        .then(() => sendResponse({ status: 'Tabs saved successfully' }))
        .catch((error) => {
          console.error('Error in manual saving:', error);
          sendResponse({ status: 'Error saving tabs', error: error.message });
        });
      return true;
    }
  });