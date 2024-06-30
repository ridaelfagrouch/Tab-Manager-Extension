document.addEventListener('DOMContentLoaded', () => {
    const saveTabs = document.getElementById('saveTabs');
    const restoreTabs = document.getElementById('restoreTabs');
    const groupTabs = document.getElementById('groupTabs');
  
    if (saveTabs) {
      saveTabs.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'saveTabs' }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Error saving tabs:', chrome.runtime.lastError);
            alert('Error saving tabs: ' + chrome.runtime.lastError.message);
          } else {
            alert(response.status);
          }
        });
      });
    }
  
    if (restoreTabs) {
      restoreTabs.addEventListener('click', async () => {
        try {
          const data = await chrome.storage.local.get('savedWindows');
          const savedWindows = data.savedWindows || [];
  
          if (savedWindows.length === 0) {
            alert('No saved tabs to restore');
            return;
          }
  
          for (const windowData of savedWindows) {
            const newWindow = await chrome.windows.create({ focused: false });
            for (const tabData of windowData.tabs) {
              await chrome.tabs.create({
                windowId: newWindow.id,
                url: tabData.url,
                pinned: tabData.pinned
              });
            }
            // Remove the initial blank tab
            const tabs = await chrome.tabs.query({ windowId: newWindow.id });
            if (tabs.length > 1) {
              await chrome.tabs.remove(tabs[0].id);
            }
          }
  
          alert('Tabs restored successfully');
        } catch (error) {
          console.error('Error restoring tabs:', error);
          alert('Error restoring tabs: ' + error.message);
        }
      });
    }
  
    if (groupTabs) {
      groupTabs.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'groupTabs' }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Error grouping tabs:', chrome.runtime.lastError);
            alert('Error grouping tabs: ' + chrome.runtime.lastError.message);
          } else {
            alert(response.status);
          }
        });
      });
    }
  });