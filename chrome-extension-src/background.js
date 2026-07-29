/* global chrome */

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: "index.html" });
});

// Set up declarativeNetRequest rules to override Origin and Referer for KGS requests
chrome.runtime.onInstalled.addListener(() => {
  const rules = [
    {
      id: 1,
      priority: 1,
      action: {
        type: "modifyHeaders",
        requestHeaders: [
          {
            header: "Origin",
            operation: "set",
            value: "https://www.gokgs.com",
          },
          {
            header: "Referer",
            operation: "set",
            value: "https://www.gokgs.com/",
          },
        ],
      },
      condition: {
        urlFilter: "||gokgs.com/json/access",
        resourceTypes: ["xmlhttprequest"],
      },
    },
  ];

  chrome.declarativeNetRequest.updateDynamicRules(
    {
      removeRuleIds: [1],
      addRules: rules,
    },
    () => {
      if (chrome.runtime.lastError) {
        console.error(
          "Error updating declarativeNetRequest rules:",
          chrome.runtime.lastError
        );
      } else {
        console.log("DeclarativeNetRequest rules updated successfully.");
      }
    }
  );
});

